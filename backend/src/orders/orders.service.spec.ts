vi.mock('../prisma/db.js', async () => {
  const { createFakeDb } = await import('../test/fake-db.js');
  return { db: createFakeDb() };
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import { TicketCategoriesService } from '../tickets/ticket-categories.service.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { OrdersService } from './orders.service.js';

describe('OrdersService', () => {
  let categories: TicketCategoriesService;
  let tickets: TicketsService;
  let service: OrdersService;

  beforeEach(() => {
    (db.orm.orders as any).clear();
    (db.orm.ticket_categories as any).clear();
    (db.orm.tickets as any).clear();
    (db.orm.payments as any).clear();
    categories = new TicketCategoriesService();
    tickets = new TicketsService();
    service = new OrdersService(categories, tickets);
  });

  it('computes totalAmount from the category price and rejects a non-positive quantity', async () => {
    const category = await categories.create({ name: 'Standard', price: 5000 });
    const order = await service.create({
      buyerName: 'Fatou Koné',
      buyerPhone: '0700000000',
      items: [{ ticketCategoryId: category._id as string, quantity: 3 }],
    });
    expect(order.totalAmount).toBe(15000);
    expect(order.status).toBe('pending');

    await expect(
      service.create({
        buyerName: 'X',
        buyerPhone: '0700000000',
        items: [{ ticketCategoryId: category._id as string, quantity: 0 }],
      }),
    ).rejects.toThrow('entier positif');
  });

  it('accepts several different categories in a single order and sums their totals', async () => {
    const standard = await categories.create({ name: 'Standard', price: 5000 });
    const vip = await categories.create({ name: 'VIP', price: 15000 });
    const order = await service.create({
      buyerName: 'Fatou Koné',
      buyerPhone: '0700000000',
      items: [
        { ticketCategoryId: standard._id as string, quantity: 2 },
        { ticketCategoryId: vip._id as string, quantity: 1 },
      ],
    });

    expect(order.totalAmount).toBe(2 * 5000 + 15000);
    expect(order.items).toEqual([
      { ticketCategoryId: standard._id, quantity: 2 },
      { ticketCategoryId: vip._id, quantity: 1 },
    ]);

    const paid = await service.markPaid(order._id as string);
    expect(paid.tickets).toHaveLength(3);
    const byCategory = (categoryId: string) =>
      paid.tickets.filter((t: any) => String(t.ticketCategoryId) === String(categoryId));
    expect(byCategory(standard._id as string)).toHaveLength(2);
    expect(byCategory(vip._id as string)).toHaveLength(1);
  });

  it('merges duplicate items targeting the same category instead of counting them twice', async () => {
    const category = await categories.create({ name: 'Standard', price: 5000, stock: 4 });
    const order = await service.create({
      buyerName: 'Fatou Koné',
      buyerPhone: '0700000000',
      items: [
        { ticketCategoryId: category._id as string, quantity: 2 },
        { ticketCategoryId: category._id as string, quantity: 2 },
      ],
    });

    expect(order.items).toEqual([{ ticketCategoryId: category._id, quantity: 4 }]);
    expect(order.totalAmount).toBe(20000);
  });

  it('rejects an order that would exceed the remaining stock', async () => {
    const category = await categories.create({ name: 'Standard', price: 5000, stock: 5 });
    await service.create({
      buyerName: 'A',
      buyerPhone: '0700000000',
      items: [{ ticketCategoryId: category._id as string, quantity: 5 }],
    });
    // Le premier achat n'est pas encore payé : le stock ne doit pas empêcher un second essai...
    const second = await service.create({
      buyerName: 'B',
      buyerPhone: '0700000000',
      items: [{ ticketCategoryId: category._id as string, quantity: 5 }],
    });
    expect(second.status).toBe('pending');

    // ...mais une fois payé, il compte contre le stock.
    await service.markPaid(second._id as string);
    await expect(
      service.create({
        buyerName: 'C',
        buyerPhone: '0700000000',
        items: [{ ticketCategoryId: category._id as string, quantity: 1 }],
      }),
    ).rejects.toThrow('Stock insuffisant');
  });

  describe('createInvitation', () => {
    it('creates a pending order with totalAmount 0, ignoring category price', async () => {
      const category = await categories.create({ name: 'VIP', price: 15000 });
      const order = await service.createInvitation({
        buyerName: 'Personnalité X',
        items: [{ ticketCategoryId: category._id as string, quantity: 2 }],
      });

      expect(order.totalAmount).toBe(0);
      expect(order.status).toBe('pending');
      expect(order.buyerPhone).toBeNull();
    });

    it('ignores the remaining stock, unlike a regular order', async () => {
      const category = await categories.create({ name: 'VIP', price: 15000, stock: 1 });
      await service.create({
        buyerName: 'A',
        buyerPhone: '0700000000',
        items: [{ ticketCategoryId: category._id as string, quantity: 1 }],
      });
      const paidOrder = await service.create({
        buyerName: 'A',
        buyerPhone: '0700000000',
        items: [{ ticketCategoryId: category._id as string, quantity: 1 }],
      });
      await service.markPaid(paidOrder._id as string);

      // Le stock (1) est déjà épuisé par la commande payante ci-dessus...
      await expect(
        service.create({
          buyerName: 'B',
          buyerPhone: '0700000000',
          items: [{ ticketCategoryId: category._id as string, quantity: 1 }],
        }),
      ).rejects.toThrow('Stock insuffisant');

      // ...mais une invitation n'est jamais bloquée par le stock.
      const invitation = await service.createInvitation({
        buyerName: 'Personnalité X',
        items: [{ ticketCategoryId: category._id as string, quantity: 3 }],
      });
      expect(invitation.totalAmount).toBe(0);
    });

    it('still rejects an unknown category and merges duplicate lines', async () => {
      await expect(
        service.createInvitation({
          buyerName: 'Personnalité X',
          items: [{ ticketCategoryId: 'does-not-exist', quantity: 1 }],
        }),
      ).rejects.toThrow('introuvable');

      const category = await categories.create({ name: 'VIP', price: 15000 });
      const order = await service.createInvitation({
        buyerName: 'Personnalité X',
        items: [
          { ticketCategoryId: category._id as string, quantity: 1 },
          { ticketCategoryId: category._id as string, quantity: 2 },
        ],
      });
      expect(order.items).toEqual([{ ticketCategoryId: category._id, quantity: 3 }]);
    });
  });

  it('markPaid() is idempotent and generates tickets exactly once', async () => {
    const category = await categories.create({ name: 'Standard', price: 5000 });
    const order = await service.create({
      buyerName: 'Fatou Koné',
      buyerPhone: '0700000000',
      items: [{ ticketCategoryId: category._id as string, quantity: 2 }],
    });

    const first = await service.markPaid(order._id as string);
    expect(first.order.status).toBe('paid');
    expect(first.tickets).toHaveLength(2);

    const second = await service.markPaid(order._id as string);
    expect(second.tickets).toHaveLength(2);
  });

  describe('access code', () => {
    async function createOrder() {
      const category = await categories.create({ name: 'Standard', price: 5000 });
      return service.create({
        buyerName: 'Fatou Koné',
        buyerPhone: '0700000000',
        items: [{ ticketCategoryId: category._id as string, quantity: 2 }],
      });
    }

    it('gives each new order its own 8-character code', async () => {
      const first = await createOrder();
      const second = await createOrder();
      expect(first.accessCode).toMatch(/^[A-Z0-9]{8}$/);
      expect(second.accessCode).not.toBe(first.accessCode);
    });

    it('refuses the code (403) until the order is paid', async () => {
      const order = await createOrder();
      await expect(service.accessByCode(order.accessCode as string)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns the tickets with their QR codes once paid, ignoring dashes and case', async () => {
      const order = await createOrder();
      await service.markPaid(order._id as string);

      const code = order.accessCode as string;
      const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
      const result = await service.accessByCode(typed);

      expect(result.status).toBe('paid');
      expect(result.tickets).toHaveLength(2);
      expect(result.tickets[0].qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('rejects an unknown or empty code (404)', async () => {
      await createOrder();
      await expect(service.accessByCode('ZZZZ-ZZZZ')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.accessByCode('--')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('never exposes the tickets or the code through the public status route', async () => {
      const order = await createOrder();
      await service.markPaid(order._id as string);

      const status = await service.getPublicStatus(order._id as string);
      expect(status.status).toBe('paid');
      expect(status).not.toHaveProperty('accessCode');
      expect(status).not.toHaveProperty('tickets');
    });
  });
});
