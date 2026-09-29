vi.mock('../prisma/db.js', async () => {
  const { createFakeDb } = await import('../test/fake-db.js');
  return { db: createFakeDb() };
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import { OrdersService } from '../orders/orders.service.js';
import { TicketCategoriesService } from '../tickets/ticket-categories.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { PaymentsService } from './payments.service.js';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

function file(buffer: Buffer) {
  return { buffer, size: buffer.length };
}

describe('PaymentsService', () => {
  let categories: TicketCategoriesService;
  let orders: OrdersService;
  let service: PaymentsService;

  beforeEach(() => {
    (db.orm.orders as any).clear();
    (db.orm.ticket_categories as any).clear();
    (db.orm.tickets as any).clear();
    (db.orm.payments as any).clear();
    (db.orm.payment_proofs as any).clear();
    categories = new TicketCategoriesService();
    orders = new OrdersService(categories, new TicketsService());
    service = new PaymentsService(orders, categories);
  });

  async function createPendingOrder() {
    const category = await categories.create({ name: 'Standard', price: 5000 });
    return orders.create({
      buyerName: 'Fatou Koné',
      buyerPhone: '0700000000',
      items: [{ ticketCategoryId: category._id as string, quantity: 1 }],
    });
  }

  describe('confirmCashPayment', () => {
    it('records a successful CASH payment and pays the order (ticket generated)', async () => {
      const order = await createPendingOrder();
      const result = await service.confirmCashPayment(order._id as string, 'admin-1');

      expect(result.payment.method).toBe('CASH');
      expect(result.payment.status).toBe('success');
      expect(result.payment.confirmedByUserId).toBe('admin-1');
      expect(result.order.status).toBe('paid');
      expect(result.tickets).toHaveLength(1);
    });

    it('is idempotent: confirming twice does not create a second payment record', async () => {
      const order = await createPendingOrder();
      await service.confirmCashPayment(order._id as string, 'admin-1');
      await service.confirmCashPayment(order._id as string, 'admin-1');

      const payments = await db.orm.payments.where({ orderId: order._id as string }).all();
      expect(payments).toHaveLength(1);
    });
  });

  describe('createInvitation', () => {
    it('creates the order, records an INVITATION payment and generates tickets, without amount', async () => {
      const category = await categories.create({ name: 'VIP', price: 15000 });
      const result = await service.createInvitation(
        { buyerName: 'Personnalité X', items: [{ ticketCategoryId: category._id as string, quantity: 2 }] },
        'admin-1',
      );

      expect(result.payment.method).toBe('INVITATION');
      expect(result.payment.status).toBe('success');
      expect(result.payment.confirmedByUserId).toBe('admin-1');
      expect(result.order.status).toBe('paid');
      expect(result.order.totalAmount).toBe(0);
      expect(result.order.accessCode).toMatch(/^[A-Z0-9]{8}$/);
      expect(result.tickets).toHaveLength(2);
    });

    it('does not count against the category stock seen by paying buyers', async () => {
      const category = await categories.create({ name: 'VIP', price: 15000, stock: 1 });
      await service.createInvitation(
        { buyerName: 'Personnalité X', items: [{ ticketCategoryId: category._id as string, quantity: 1 }] },
        'admin-1',
      );

      // Le stock (1) reste entièrement disponible pour un acheteur payant.
      const order = await orders.create({
        buyerName: 'Fatou Koné',
        buyerPhone: '0700000000',
        items: [{ ticketCategoryId: category._id as string, quantity: 1 }],
      });
      expect(order.status).toBe('pending');
    });
  });

  describe('getWavePaymentLink', () => {
    const previousUrl = process.env.WAVE_PAYMENT_URL;
    beforeEach(() => {
      process.env.WAVE_PAYMENT_URL = 'https://pay.wave.com/m/M_test/c/ci/';
    });
    afterEach(() => {
      process.env.WAVE_PAYMENT_URL = previousUrl;
    });

    it('returns the merchant link with the order amount, without recording a payment', async () => {
      const order = await createPendingOrder();
      const result = await service.getWavePaymentLink(order._id as string);

      expect(result).toEqual({
        paymentUrl: 'https://pay.wave.com/m/M_test/c/ci/?amount=5000',
        amount: 5000,
        currency: 'XOF',
      });
      expect(await db.orm.payments.all()).toHaveLength(0);
    });

    it('rejects an order that is no longer pending', async () => {
      const order = await createPendingOrder();
      await orders.markPaid(order._id as string);
      await expect(service.getWavePaymentLink(order._id as string)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an order whose categories use different currencies', async () => {
      const xof = await categories.create({ name: 'Standard', price: 5000 });
      const eur = await categories.create({ name: 'VIP', price: 50, currency: 'EUR' });
      const order = await orders.create({
        buyerName: 'Fatou Koné',
        buyerPhone: '0700000000',
        items: [
          { ticketCategoryId: xof._id as string, quantity: 1 },
          { ticketCategoryId: eur._id as string, quantity: 1 },
        ],
      });
      await expect(service.getWavePaymentLink(order._id as string)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('submitWaveProof', () => {
    it('creates a pending WAVE payment with its proof, leaving the order pending (no ticket)', async () => {
      const order = await createPendingOrder();
      const result = await service.submitWaveProof(order._id as string, file(PNG_BYTES));

      expect(result.status).toBe('pending');
      const payment = await db.orm.payments.where({ _id: result.paymentId }).first();
      expect(payment?.method).toBe('WAVE');
      expect(payment?.status).toBe('pending');

      const proof = await service.getWaveProof(result.paymentId);
      expect(proof.mimeType).toBe('image/png');
      expect(proof.data.equals(PNG_BYTES)).toBe(true);

      expect((await orders.findByIdOrThrow(order._id as string)).status).toBe('pending');
      expect(await db.orm.tickets.all()).toHaveLength(0);
    });

    it('replaces the proof of the payment still pending instead of creating a second one', async () => {
      const order = await createPendingOrder();
      const first = await service.submitWaveProof(order._id as string, file(PNG_BYTES));
      const second = await service.submitWaveProof(order._id as string, file(JPEG_BYTES));

      expect(second.paymentId).toBe(first.paymentId);
      expect(await db.orm.payments.all()).toHaveLength(1);
      expect(await db.orm.payment_proofs.all()).toHaveLength(1);
      expect((await service.getWaveProof(first.paymentId)).mimeType).toBe('image/jpeg');
    });

    it('creates a new pending payment after a rejection', async () => {
      const order = await createPendingOrder();
      const first = await service.submitWaveProof(order._id as string, file(PNG_BYTES));
      await service.rejectWavePayment(first.paymentId);
      const second = await service.submitWaveProof(order._id as string, file(PNG_BYTES));

      expect(second.paymentId).not.toBe(first.paymentId);
    });

    it('rejects a missing file or a non-image file', async () => {
      const order = await createPendingOrder();
      await expect(service.submitWaveProof(order._id as string, undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(
        service.submitWaveProof(order._id as string, file(Buffer.from('<html></html>'))),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a proof for an order already paid', async () => {
      const order = await createPendingOrder();
      await orders.markPaid(order._id as string);
      await expect(service.submitWaveProof(order._id as string, file(PNG_BYTES))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('confirmWavePayment', () => {
    it('marks the payment successful, pays the order and generates its tickets', async () => {
      const order = await createPendingOrder();
      const { paymentId } = await service.submitWaveProof(order._id as string, file(PNG_BYTES));
      const result = await service.confirmWavePayment(paymentId, 'admin-1');

      expect(result.payment?.status).toBe('success');
      expect(result.payment?.confirmedByUserId).toBe('admin-1');
      expect(result.order.status).toBe('paid');
      expect(result.tickets).toHaveLength(1);
    });

    it('is idempotent: confirming twice does not generate new tickets', async () => {
      const order = await createPendingOrder();
      const { paymentId } = await service.submitWaveProof(order._id as string, file(PNG_BYTES));
      await service.confirmWavePayment(paymentId, 'admin-1');
      await service.confirmWavePayment(paymentId, 'admin-1');

      expect(await db.orm.tickets.all()).toHaveLength(1);
    });

    it('refuses to confirm a rejected payment', async () => {
      const order = await createPendingOrder();
      const { paymentId } = await service.submitWaveProof(order._id as string, file(PNG_BYTES));
      await service.rejectWavePayment(paymentId);
      await expect(service.confirmWavePayment(paymentId, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 404 for an unknown payment', async () => {
      await expect(service.confirmWavePayment('unknown', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('rejectWavePayment', () => {
    it('marks the payment failed and leaves the order pending', async () => {
      const order = await createPendingOrder();
      const { paymentId } = await service.submitWaveProof(order._id as string, file(PNG_BYTES));
      const payment = await service.rejectWavePayment(paymentId);

      expect(payment?.status).toBe('failed');
      expect((await orders.findByIdOrThrow(order._id as string)).status).toBe('pending');
      expect(await db.orm.tickets.all()).toHaveLength(0);
    });

    it('refuses to reject a payment already confirmed', async () => {
      const order = await createPendingOrder();
      const { paymentId } = await service.submitWaveProof(order._id as string, file(PNG_BYTES));
      await service.confirmWavePayment(paymentId, 'admin-1');
      await expect(service.rejectWavePayment(paymentId)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
