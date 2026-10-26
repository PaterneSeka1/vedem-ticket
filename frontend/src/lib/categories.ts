import { TicketCategory } from "./types";

/**
 * Tombola — retirée de l'expérience courante, **côté frontend uniquement**.
 *
 * La tombola n'a jamais été une entité à part : c'est une `TicketCategory`
 * dont le nom contient « tombola ». Ses données (catégorie, commandes,
 * paiements, tickets) restent intactes en base et continuent de compter
 * dans les historiques financiers (recettes, transactions, tickets émis).
 *
 * Ce masquage n'est PAS une désactivation métier : le backend accepte
 * toujours une commande sur cette catégorie si on l'appelle directement
 * (`POST /orders`). Une désactivation effective demanderait une règle
 * serveur (ex. supprimer le stock ou passer la catégorie en
 * `invitationOnly`) — hors périmètre de la refonte UX.
 */
export function isTombolaCategory(category: Pick<TicketCategory, "name"> | undefined | null): boolean {
  return (category?.name ?? "").toLowerCase().includes("tombola");
}

/** Catégories proposées à la vente / à la gestion courante (sans la tombola). */
export function operationalCategories(categories: TicketCategory[]): TicketCategory[] {
  return categories.filter((category) => !isTombolaCategory(category));
}

/** `stock` = capacité totale (pas le reste disponible) ; `null` = illimitée. */
export function isSoldOut(category: TicketCategory): boolean {
  return category.stock !== null && category.stock <= 0;
}

/**
 * Frais Wave estimés côté client — miroir exact de
 * `backend/src/payments/wave-fees.util.ts` (1 %, arrondi à l'unité
 * supérieure, calculé sur la part des catégories `chargeWaveFees`).
 * Purement indicatif : le montant faisant foi est celui figé par le serveur
 * sur la commande et renvoyé par `POST /payments/wave/checkout`.
 */
export const WAVE_FEE_PERCENT = 1;

export function estimateWaveFees(lines: { category: TicketCategory; quantity: number }[]): number {
  const base = lines.reduce(
    (sum, line) => sum + (line.category.chargeWaveFees ? line.category.price * line.quantity : 0),
    0,
  );
  return Math.ceil((base * WAVE_FEE_PERCENT) / 100);
}
