vi.mock('../prisma/db.js', async () => {
  const { createFakeDb } = await import('../test/fake-db.js');
  return { db: createFakeDb() };
});

import { db } from '../prisma/db.js';
import { TicketCategoriesService } from './ticket-categories.service.js';

describe('TicketCategoriesService', () => {
  let service: TicketCategoriesService;

  beforeEach(() => {
    (db.orm.ticket_categories as any).clear();
    (db.orm.orders as any).clear();
    (db.orm.payments as any).clear();
    service = new TicketCategoriesService();
  });

  it('creates a category with a default currency', async () => {
    const category = await service.create({ name: 'Standard', price: 5000 });
    expect(category.currency).toBe('XOF');
    expect(category.stock).toBeNull();
  });

  it('throws NotFoundException when the category does not exist', async () => {
    await expect(service.findByIdOrThrow('does-not-exist')).rejects.toThrow('introuvable');
  });

  it('countSold sums the quantity of paid orders only', async () => {
    const category = await service.create({ name: 'Standard', price: 5000 });
    (db.orm.orders as any).seed({
      _id: 'o1',
      status: 'paid',
      items: [{ ticketCategoryId: category._id, quantity: 3 }],
    });
    (db.orm.orders as any).seed({
      _id: 'o2',
      status: 'paid',
      items: [{ ticketCategoryId: category._id, quantity: 2 }],
    });
    (db.orm.orders as any).seed({
      _id: 'o3',
      status: 'pending',
      items: [{ ticketCategoryId: category._id, quantity: 10 }],
    });

    const sold = await service.countSold(category._id as string);
    expect(sold).toBe(5);
  });

  it('countSold only counts the matching item within an order that mixes several categories', async () => {
    const standard = await service.create({ name: 'Standard', price: 5000 });
    const vip = await service.create({ name: 'VIP', price: 15000 });
    (db.orm.orders as any).seed({
      _id: 'o1',
      status: 'paid',
      items: [
        { ticketCategoryId: standard._id, quantity: 2 },
        { ticketCategoryId: vip._id, quantity: 1 },
      ],
    });

    expect(await service.countSold(standard._id as string)).toBe(2);
    expect(await service.countSold(vip._id as string)).toBe(1);
  });

  it('countSold excludes orders paid via an INVITATION payment', async () => {
    const category = await service.create({ name: 'VIP', price: 15000 });
    (db.orm.orders as any).seed({
      _id: 'o1',
      status: 'paid',
      items: [{ ticketCategoryId: category._id, quantity: 2 }],
    });
    (db.orm.orders as any).seed({
      _id: 'o2',
      status: 'paid',
      items: [{ ticketCategoryId: category._id, quantity: 5 }],
    });
    (db.orm.payments as any).seed({
      _id: 'p1',
      orderId: 'o2',
      method: 'INVITATION',
      status: 'success',
    });

    const sold = await service.countSold(category._id as string);
    expect(sold).toBe(2);
  });

  it('update() falls back to existing values for omitted fields', async () => {
    const category = await service.create({ name: 'Standard', price: 5000, stock: 100 });
    const updated = await service.update(category._id as string, { price: 6000 });
    expect(updated?.name).toBe('Standard');
    expect(updated?.price).toBe(6000);
    expect(updated?.stock).toBe(100);
  });
});
