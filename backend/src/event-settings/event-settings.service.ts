import { Injectable } from '@nestjs/common';
import { db } from '../prisma/db.js';
import type { UpdateEventSettingsDto } from './dto/update-event-settings.dto.js';

// Valeurs de départ : reprennent exactement ce qui était en dur côté frontend
// (frontend/src/lib/event.ts) avant que ça devienne configurable, pour que le
// premier déploiement de cette fonctionnalité ne change rien à l'affichage
// tant que l'admin n'a pas explicitement modifié ces réglages.
const DEFAULT_DATE = 'Samedi 12 septembre 2026 • 18 h 30';
const DEFAULT_LOCATION = 'Foyer des Jeunes de Marcory';

@Injectable()
export class EventSettingsService {
  /**
   * Un seul document existe jamais dans cette collection (un seul événement
   * géré par l'application, cf. CLAUDE.md §4). Créé avec les valeurs par
   * défaut au premier appel s'il n'existe pas encore.
   */
  async getSettings() {
    const existing = await db.orm.event_settings.first();
    if (existing) {
      return existing;
    }
    return db.orm.event_settings.create({
      date: DEFAULT_DATE,
      location: DEFAULT_LOCATION,
    });
  }

  async updateSettings(dto: UpdateEventSettingsDto) {
    const existing = await this.getSettings();
    return db.orm.event_settings.where({ _id: existing._id }).update({
      date: dto.date ?? existing.date,
      location: dto.location ?? existing.location,
    });
  }
}
