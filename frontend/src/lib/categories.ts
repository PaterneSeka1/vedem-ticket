import { TicketCategory } from "./types";

/**
 * Tombola — fermée. Ce n'est pas une entité à part : c'est une
 * `TicketCategory` dont le nom contient « tombola ». Le backend refuse toute
 * nouvelle vente ou invitation dessus et la retire de `GET
 * /ticket-categories` (voir backend/src/tickets/tombola.util.ts) ; ce helper
 * en est le miroir côté interface (listes admin de gestion courante). Ses
 * données restent intactes et comptent dans les historiques financiers.
 */
export function isTombolaCategory(category: Pick<TicketCategory, "name"> | undefined | null): boolean {
  return (category?.name ?? "").toLowerCase().includes("tombola");
}

/** Catégories proposées à la vente / à la gestion courante (sans la tombola). */
export function operationalCategories(categories: TicketCategory[]): TicketCategory[] {
  return categories.filter((category) => !isTombolaCategory(category));
}

/**
 * Places restantes : `remaining` (route publique) si connu, sinon la
 * capacité `stock` (routes admin) ; `null` = illimitée.
 */
export function remainingPlaces(category: TicketCategory): number | null {
  if (category.remaining !== undefined) return category.remaining;
  return category.stock;
}

export function isSoldOut(category: TicketCategory): boolean {
  const remaining = remainingPlaces(category);
  return remaining !== null && remaining <= 0;
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
