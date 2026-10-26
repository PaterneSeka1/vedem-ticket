import { Order, TicketCategory } from "./types";

const numberFormat = new Intl.NumberFormat("fr-FR");

export function money(amount: number): string {
  return `${numberFormat.format(amount)} FCFA`;
}

/** Nombre formaté à la française (espaces fines), sans devise. */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/**
 * Référence courte et lisible d'un identifiant MongoDB (24 caractères) :
 * les 8 derniers caractères en majuscules. Les ObjectId se terminent par un
 * compteur : deux documents proches restent distinguables. L'identifiant
 * complet reste disponible (détail, copie, export CSV).
 */
export function shortRef(id: string): string {
  return id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase();
}

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}

export function formatTime(value: string | number | Date): string {
  return timeFormat.format(new Date(value));
}

/** « il y a 3 min » — pour l'heure de dernière actualisation du dashboard. */
export function formatRelative(value: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - value) / 1000));
  if (seconds < 45) return "à l'instant";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `il y a ${hours} h`;
}

/** Pluriel français simple : `plural(2, "ticket")` → « 2 tickets ». */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count > 1 ? pluralForm : singular}`;
}

/** Affiche un code de téléchargement stocké "K7M2P9QX" sous la forme "K7M2-P9QX". */
export function formatAccessCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
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

/** Libellé d'affichage d'une devise ISO (XOF → FCFA, seule devise utilisée en pratique). */
export function currencyLabel(currency: string | undefined): string {
  return !currency || currency === "XOF" ? "FCFA" : currency;
}
