vi.mock('../prisma/db.js', async () => {
  const { createFakeDb } = await import('../test/fake-db.js');
  return { db: createFakeDb() };
});

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
    categories = new TicketCategoriesService();
    tickets = new TicketsService();
    service = new OrdersService(categories, tickets);
  });

  it('computes totalAmount from the category price and rejects a non-positive quantity', async () => {
    const category = await categories.create({ name: 'Standard', price: 5000 });
    const order = await service.create({
      buyerName: 'Fatou Koné',
      buyerPhone: '0700000000',
      ticketCategoryId: category._id as string,
      quantity: 3,
    });
    expect(order.totalAmount).toBe(15000);
    expect(order.status).toBe('pending');

    await expect(
      service.create({
        buyerName: 'X',
        buyerPhone: '0700000000',
        ticketCategoryId: category._id as string,
        quantity: 0,
      }),
    ).rejects.toThrow('entier positif');
  });

  it('rejects an order that would exceed the remaining stock', async () => {
    const category = await categories.create({ name: 'Standard', price: 5000, stock: 5 });
    await service.create({
      buyerName: 'A',
      buyerPhone: '0700000000',
      ticketCategoryId: category._id as string,
      quantity: 5,
    });
    // Le premier achat n'est pas encore payé : le stock ne doit pas empêcher un second essai...
    const second = await service.create({
      buyerName: 'B',
      buyerPhone: '0700000000',
      ticketCategoryId: category._id as string,
      quantity: 5,
    });
    expect(second.status).toBe('pending');

    // ...mais une fois payé, il compte contre le stock.
    await service.markPaid(second._id as string);
    await expect(
      service.create({
        buyerName: 'C',
        buyerPhone: '0700000000',
        ticketCategoryId: category._id as string,
        quantity: 1,
      }),
    ).rejects.toThrow('Stock insuffisant');
  });

  it('markPaid() is idempotent and generates tickets exactly once', async () => {
    const category = await categories.create({ name: 'Standard', price: 5000 });
    const order = await service.create({
      buyerName: 'Fatou Koné',
      buyerPhone: '0700000000',
      ticketCategoryId: category._id as string,
      quantity: 2,
    });

    const first = await service.markPaid(order._id as string);
    expect(first.order.status).toBe('paid');
    expect(first.tickets).toHaveLength(2);

    const second = await service.markPaid(order._id as string);
    expect(second.tickets).toHaveLength(2);
  });
});
