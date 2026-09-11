vi.mock('../prisma/db.js', async () => {
  const { createFakeDb } = await import('../test/fake-db.js');
  return { db: createFakeDb() };
});

import { db } from '../prisma/db.js';
import { OrdersService } from '../orders/orders.service.js';
import { TicketCategoriesService } from '../tickets/ticket-categories.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { PaymentsService } from './payments.service.js';

describe('PaymentsService', () => {
  let categories: TicketCategoriesService;
  let orders: OrdersService;
  let service: PaymentsService;

  beforeEach(() => {
    (db.orm.orders as any).clear();
    (db.orm.ticket_categories as any).clear();
    (db.orm.tickets as any).clear();
    (db.orm.payments as any).clear();
    categories = new TicketCategoriesService();
    orders = new OrdersService(categories, new TicketsService());
    service = new PaymentsService(orders, categories);
  });

  async function createPendingOrder() {
    const category = await categories.create({ name: 'Standard', price: 5000 });
    return orders.create({
      buyerName: 'Fatou Koné',
      buyerPhone: '0700000000',
      ticketCategoryId: category._id as string,
      quantity: 1,
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

  describe('handleWaveEvent', () => {
    it('ignores event types it does not handle', async () => {
      const result = await service.handleWaveEvent({
        type: 'checkout.session.expired',
        data: { id: 'cos-1', payment_status: 'cancelled' },
      });
      expect(result).toEqual({ ignored: true, reason: 'unhandled_event_type' });
    });

    it('ignores a completed event for an unknown checkout session', async () => {
      const result = await service.handleWaveEvent({
        type: 'checkout.session.completed',
        data: { id: 'cos-unknown', payment_status: 'succeeded' },
      });
      expect(result).toEqual({ ignored: true, reason: 'payment_not_found' });
    });

    it('marks the payment successful and pays the order when payment_status is succeeded', async () => {
      const order = await createPendingOrder();
      await db.orm.payments.create({
        orderId: order._id as string,
        method: 'WAVE',
        status: 'pending',
        waveReference: 'cos-1',
        confirmedByUserId: null,
        confirmedAt: null,
        createdAt: new Date(),
      });

      const result = await service.handleWaveEvent({
        type: 'checkout.session.completed',
        data: { id: 'cos-1', payment_status: 'succeeded' },
      });
      expect(result).toEqual({ ok: true });

      const payment = await db.orm.payments.where({ waveReference: 'cos-1' }).first();
      expect(payment?.status).toBe('success');
      const paidOrder = await orders.findByIdOrThrow(order._id as string);
      expect(paidOrder.status).toBe('paid');
    });

    it('marks the payment failed when payment_status is not succeeded', async () => {
      const order = await createPendingOrder();
      await db.orm.payments.create({
        orderId: order._id as string,
        method: 'WAVE',
        status: 'pending',
        waveReference: 'cos-2',
        confirmedByUserId: null,
        confirmedAt: null,
        createdAt: new Date(),
      });

      await service.handleWaveEvent({
        type: 'checkout.session.completed',
        data: { id: 'cos-2', payment_status: 'cancelled' },
      });

      const payment = await db.orm.payments.where({ waveReference: 'cos-2' }).first();
      expect(payment?.status).toBe('failed');
      const stillPending = await orders.findByIdOrThrow(order._id as string);
      expect(stillPending.status).toBe('pending');
    });

    it('is idempotent: replaying a processed event does not re-run markPaid', async () => {
      const order = await createPendingOrder();
      await db.orm.payments.create({
        orderId: order._id as string,
        method: 'WAVE',
        status: 'success',
        waveReference: 'cos-3',
        confirmedByUserId: null,
        confirmedAt: new Date(),
        createdAt: new Date(),
      });

      const result = await service.handleWaveEvent({
        type: 'checkout.session.completed',
        data: { id: 'cos-3', payment_status: 'succeeded' },
      });
      expect(result).toEqual({ ok: true, alreadyProcessed: true });
    });
  });

  describe('initiateWaveCheckout with WAVE_SIMULATE=1', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env.FRONTEND_BASE_URL = 'http://localhost:3000';
      process.env.WAVE_SIMULATE = '1';
      delete process.env.WAVE_API_KEY;
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('creates a pending WAVE payment without calling the real Wave API', async () => {
      const order = await createPendingOrder();
      const result = await service.initiateWaveCheckout(order._id as string);

      expect(result.paymentId).toBeTruthy();
      expect(result.checkoutUrl).toBe(`http://localhost:3000/success?orderId=${order._id}`);

      const payment = await db.orm.payments.where({ _id: result.paymentId }).first();
      expect(payment?.method).toBe('WAVE');
      expect(payment?.status).toBe('pending');
      expect(payment?.waveReference).toMatch(/^sim_/);
    });
  });

  describe('simulateWaveOutcome', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('is unavailable (404) when WAVE_SIMULATE is not enabled', async () => {
      delete process.env.WAVE_SIMULATE;
      const order = await createPendingOrder();
      const payment = await db.orm.payments.create({
        orderId: order._id as string,
        method: 'WAVE',
        status: 'pending',
        waveReference: 'sim_1',
        confirmedByUserId: null,
        confirmedAt: null,
        createdAt: new Date(),
      });

      await expect(
        service.simulateWaveOutcome(payment._id as string, 'success'),
      ).rejects.toThrow();
    });

    it('marks the payment successful and pays the order when outcome is "success"', async () => {
      process.env.WAVE_SIMULATE = '1';
      const order = await createPendingOrder();
      const payment = await db.orm.payments.create({
        orderId: order._id as string,
        method: 'WAVE',
        status: 'pending',
        waveReference: 'sim_2',
        confirmedByUserId: null,
        confirmedAt: null,
        createdAt: new Date(),
      });

      await service.simulateWaveOutcome(payment._id as string, 'success');

      const paidOrder = await orders.findByIdOrThrow(order._id as string);
      expect(paidOrder.status).toBe('paid');
    });

    it('marks the payment failed and leaves the order pending when outcome is "failed"', async () => {
      process.env.WAVE_SIMULATE = '1';
      const order = await createPendingOrder();
      const payment = await db.orm.payments.create({
        orderId: order._id as string,
        method: 'WAVE',
        status: 'pending',
        waveReference: 'sim_3',
        confirmedByUserId: null,
        confirmedAt: null,
        createdAt: new Date(),
      });

      await service.simulateWaveOutcome(payment._id as string, 'failed');

      const stillPendingOrder = await orders.findByIdOrThrow(order._id as string);
      expect(stillPendingOrder.status).toBe('pending');
      const updatedPayment = await db.orm.payments.where({ _id: payment._id as string }).first();
      expect(updatedPayment?.status).toBe('failed');
    });
  });
});
