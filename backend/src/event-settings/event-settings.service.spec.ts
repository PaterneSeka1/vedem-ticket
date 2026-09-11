vi.mock('../prisma/db.js', async () => {
  const { createFakeDb } = await import('../test/fake-db.js');
  return { db: createFakeDb() };
});

import { db } from '../prisma/db.js';
import { EventSettingsService } from './event-settings.service.js';

describe('EventSettingsService', () => {
  let service: EventSettingsService;

  beforeEach(() => {
    (db.orm.event_settings as any).clear();
    service = new EventSettingsService();
  });

  it('creates the singleton with default values on first read', async () => {
    const settings = await service.getSettings();
    expect(settings.date).toBeTruthy();
    expect(settings.location).toBeTruthy();
  });

  it('does not create a second document on repeated reads', async () => {
    await service.getSettings();
    await service.getSettings();
    expect(await db.orm.event_settings.all()).toHaveLength(1);
  });

  it('update() falls back to existing values for omitted fields', async () => {
    await service.getSettings();
    const updated = await service.updateSettings({ location: 'Palais des Congrès' });
    expect(updated?.location).toBe('Palais des Congrès');
    expect(updated?.date).toBeTruthy();
  });

  it('update() persists both fields when provided', async () => {
    await service.getSettings();
    const updated = await service.updateSettings({
      date: 'Vendredi 3 avril 2026 • 19 h 00',
      location: 'Sofitel Abidjan',
    });
    expect(updated?.date).toBe('Vendredi 3 avril 2026 • 19 h 00');
    expect(updated?.location).toBe('Sofitel Abidjan');
    expect(await db.orm.event_settings.all()).toHaveLength(1);
  });
});
