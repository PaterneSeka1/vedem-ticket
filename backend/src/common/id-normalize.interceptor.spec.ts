import { normalize } from './id-normalize.interceptor.js';

class FakeObjectId {
  constructor(private readonly hex: string) {}
  toString() {
    return this.hex;
  }
  toJSON() {
    return this.hex;
  }
}

describe('normalize', () => {
  it('renames a top-level _id to id', () => {
    expect(normalize({ _id: 'abc', name: 'Standard' })).toEqual({ id: 'abc', name: 'Standard' });
  });

  it('renames _id inside every item of an array', () => {
    const input = [{ _id: '1', name: 'A' }, { _id: '2', name: 'B' }];
    expect(normalize(input)).toEqual([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
  });

  it('renames _id inside a nested wrapper object (e.g. { order, tickets })', () => {
    const input = {
      order: { _id: 'order-1', status: 'paid' },
      tickets: [{ _id: 'ticket-1', code: 'abc' }],
    };
    expect(normalize(input)).toEqual({
      order: { id: 'order-1', status: 'paid' },
      tickets: [{ id: 'ticket-1', code: 'abc' }],
    });
  });

  it('leaves an ObjectId-like value under `id` untouched (its own toJSON handles final formatting)', () => {
    const objectId = new FakeObjectId('507f1f77bcf86cd799439011');
    const result = normalize({ _id: objectId }) as { id: unknown };
    expect(result.id).toBe(objectId);
  });

  it('leaves other keys, primitives, null and Date values unchanged', () => {
    const date = new Date('2026-09-12T00:00:00.000Z');
    expect(normalize({ status: 'valid', usedAt: null, createdAt: date })).toEqual({
      status: 'valid',
      usedAt: null,
      createdAt: date,
    });
  });
});
