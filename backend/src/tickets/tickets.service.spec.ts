vi.mock('../prisma/db.js', async () => {
  const { createFakeDb } = await import('../test/fake-db.js');
  return { db: createFakeDb() };
});

import { db } from '../prisma/db.js';
import { TicketsService } from './tickets.service.js';

describe('TicketsService', () => {
  let service: TicketsService;

  beforeEach(() => {
    (db.orm.tickets as any).clear();
    (db.orm.orders as any).clear();
    (db.orm.ticket_categories as any).clear();
    service = new TicketsService();
  });

  it('generates one ticket per unit ordered, each with a unique code', async () => {
    const tickets = await service.generateForOrder({ id: 'order-1', ticketCategoryId: 'cat-1', quantity: 3 });
    expect(tickets).toHaveLength(3);
    expect(new Set(tickets.map((t: any) => t.code)).size).toBe(3);
    expect(tickets.every((t: any) => t.status === 'valid')).toBe(true);
  });

  it('is idempotent: calling it twice for the same order does not duplicate tickets', async () => {
    await service.generateForOrder({ id: 'order-1', ticketCategoryId: 'cat-1', quantity: 2 });
    const second = await service.generateForOrder({ id: 'order-1', ticketCategoryId: 'cat-1', quantity: 2 });
    expect(second).toHaveLength(2);
    const all = await service.findByOrder('order-1');
    expect(all).toHaveLength(2);
  });

  it('scan() marks a valid ticket as used and enriches with buyer/category', async () => {
    (db.orm.orders as any).seed({ _id: 'order-1', buyerName: 'Aya Bamba' });
    (db.orm.ticket_categories as any).seed({ _id: 'cat-1', name: 'Standard' });
    const [ticket] = await service.generateForOrder({ id: 'order-1', ticketCategoryId: 'cat-1', quantity: 1 });

    const result = await service.scan((ticket as any).code, 'admin-1');
    expect(result.ticket.status).toBe('used');
    expect(result.ticket.scannedByUserId).toBe('admin-1');
    expect(result.buyerName).toBe('Aya Bamba');
    expect(result.categoryName).toBe('Standard');
  });

  it('scan() rejects a ticket that was already used', async () => {
    const [ticket] = await service.generateForOrder({ id: 'order-1', ticketCategoryId: 'cat-1', quantity: 1 });
    await service.scan((ticket as any).code, 'admin-1');
    await expect(service.scan((ticket as any).code, 'admin-1')).rejects.toThrow('déjà scanné');
  });

  it('scan() rejects an unknown code', async () => {
    await expect(service.scan('unknown-code', 'admin-1')).rejects.toThrow('introuvable');
  });
});
