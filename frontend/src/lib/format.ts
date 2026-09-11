import { Order, TicketCategory } from "./types";

export function money(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
}

/**
 * Résume les lignes d'une commande ("2 × Standard, 1 × VIP") — une commande
 * pouvant porter sur plusieurs catégories (voir CLAUDE.md §4). Utilisé par
 * les tableaux admin (dashboard, transactions).
 */
export function formatOrderItems(order: Order, categoryById: Map<string, TicketCategory>): string {
  if (order.items.length === 0) return "?";
  return order.items
    .map((item) => `${item.quantity} × ${categoryById.get(item.ticketCategoryId)?.name ?? "?"}`)
    .join(", ");
}

/**
 * Construit un lien "click-to-chat" WhatsApp (wa.me) à partir d'un numéro
 * local et d'un message pré-rempli. Les numéros ivoiriens (format à 10
 * chiffres depuis la réforme 2021, ex. 07 00 00 00 00) sont préfixés de
 * l'indicatif +225 sans retirer le 0 initial, conformément à ce format.
 */
export function whatsappLink(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("225") && digits.length <= 10) digits = `225${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
