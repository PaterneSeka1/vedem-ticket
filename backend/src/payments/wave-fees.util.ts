/** Frais Wave répercutés sur l'acheteur : 1 % (ex. 5000 F → 50 F). */
export const WAVE_FEE_PERCENT = 1;

/**
 * Frais Wave dus sur un montant (en unité entière de la devise, ex. F CFA),
 * arrondis à l'unité supérieure pour ne jamais encaisser moins que les frais.
 */
export function computeWaveFees(amount: number): number {
  return Math.ceil((amount * WAVE_FEE_PERCENT) / 100);
}
