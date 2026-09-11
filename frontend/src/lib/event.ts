// Infos de l'événement — un seul événement géré par l'application (voir
// CLAUDE.md §4). Nom/organisateur restent en dur (non demandés comme
// configurables). Date et lieu sont pilotés par l'API (`GET`/`PATCH
// /event-settings`, voir backend/src/event-settings) pour s'appliquer
// partout sans exception, y compris sur les tickets déjà émis : ni la page
// d'accueil, ni le checkout, ni un ticket réimprimé plus tard ne doivent
// réintroduire leur propre variante figée du libellé.
import { apiFetch } from "./api";
import { EventSettings } from "./types";

export const EVENT_ORG = "Requins Féroces";
export const EVENT_NAME = "Dîner-Gala 2026";

// Affiché le temps du tout premier chargement, ou si l'API est injoignable —
// aligné sur les valeurs par défaut créées côté backend au premier appel
// (backend/src/event-settings/event-settings.service.ts) pour qu'un repli ne
// montre jamais une info différente.
export const FALLBACK_EVENT_SETTINGS: EventSettings = {
  date: "Samedi 12 septembre 2026 • 18 h 30",
  location: "Foyer des Jeunes de Marcory",
};

export async function getEventSettings(): Promise<EventSettings> {
  try {
    return await apiFetch<EventSettings>("/event-settings");
  } catch {
    return FALLBACK_EVENT_SETTINGS;
  }
}
