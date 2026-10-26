/**
 * Tombola — fermée : la tombola n'a jamais été une entité à part, c'est une
 * `TicketCategory` dont le nom contient « tombola ». Ses données (catégorie,
 * commandes, paiements, tickets) sont conservées telles quelles et restent
 * dans les historiques ; seules les **nouvelles** ventes et invitations sur
 * ces catégories sont refusées, et elles n'apparaissent plus sur la
 * billetterie publique. Aucune donnée n'est modifiée ni supprimée.
 */
export function isTombolaCategory(category: { name: string } | null | undefined): boolean {
  return (category?.name ?? '').toLowerCase().includes('tombola');
}
