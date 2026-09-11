/**
 * Faux client `db` en mémoire, pour tester la logique métier des services
 * (qui importent `db` directement depuis `src/prisma/db.ts`) sans MongoDB
 * réel. Couvre uniquement le sous-ensemble de l'API `db.orm.<collection>`
 * effectivement utilisé par nos services : `.create`, `.all`, `.first` (sans
 * filtre — utile pour les collections singleton comme `event_settings`), et
 * `.where(filter).{first,all,update,delete,upsert}`.
 *
 * Utilisation dans un spec :
 *
 *   vi.mock('../prisma/db.js', async () => {
 *     const { createFakeDb } = await import('../test/fake-db.js');
 *     return { db: createFakeDb() };
 *   });
 *   import { db } from '../prisma/db.js'; // résout vers le mock ci-dessus
 */

type Doc = Record<string, unknown>;

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

class FakeCollection {
  private docs: Doc[] = [];
  private counter = 0;

  private nextId(): string {
    this.counter += 1;
    return `fake_id_${this.counter}`;
  }

  create(data: Doc): Promise<Doc> {
    const doc = { _id: this.nextId(), ...data };
    this.docs.push(doc);
    return Promise.resolve({ ...doc });
  }

  all(): Promise<Doc[]> {
    return Promise.resolve(this.docs.map((doc) => ({ ...doc })));
  }

  first(): Promise<Doc | null> {
    const found = this.docs[0];
    return Promise.resolve(found ? { ...found } : null);
  }

  where(filter: Doc) {
    return {
      first: async (): Promise<Doc | null> => {
        const found = this.docs.find((doc) => matches(doc, filter));
        return found ? { ...found } : null;
      },
      all: async (): Promise<Doc[]> => {
        return this.docs.filter((doc) => matches(doc, filter)).map((doc) => ({ ...doc }));
      },
      update: async (patch: Doc): Promise<Doc | null> => {
        const found = this.docs.find((doc) => matches(doc, filter));
        if (!found) return null;
        Object.assign(found, patch);
        return { ...found };
      },
      delete: async (): Promise<void> => {
        const index = this.docs.findIndex((doc) => matches(doc, filter));
        if (index >= 0) this.docs.splice(index, 1);
      },
      upsert: async ({ create, update }: { create: Doc; update: Doc }): Promise<Doc> => {
        const found = this.docs.find((doc) => matches(doc, filter));
        if (found) {
          Object.assign(found, update);
          return { ...found };
        }
        return this.create(create);
      },
    };
  }

  /** Aide de test — insère un document tel quel (avec son propre `_id`). */
  seed(doc: Doc): Doc {
    this.docs.push({ ...doc });
    return doc;
  }

  clear(): void {
    this.docs = [];
    this.counter = 0;
  }
}

const COLLECTION_NAMES = [
  'users',
  'ticket_categories',
  'orders',
  'payments',
  'tickets',
  'event_settings',
] as const;

export function createFakeDb() {
  const orm = Object.fromEntries(
    COLLECTION_NAMES.map((name) => [name, new FakeCollection()]),
  ) as Record<(typeof COLLECTION_NAMES)[number], FakeCollection>;

  return { orm };
}

export type FakeDb = ReturnType<typeof createFakeDb>;
