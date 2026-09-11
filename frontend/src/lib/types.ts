// Types alignés sur la spec OpenAPI de VEDEM Ticket API.
// Les endpoints qui renvoient `schema:{type:"object"}` (sans détail) sont
// typés au mieux ici — à ajuster dès qu'on voit une vraie réponse en dev.

export interface TicketCategory {
  id: string;
  name: string;
  price: number;
  currency: string;
  // null = pas de limite de stock (voir CLAUDE.md §5 — `stock` optionnel).
  stock: number | null;
  description?: string;
}

// Valeurs réelles renvoyées par le backend (voir CLAUDE.md §4 "Statuts de
// paiement"/commande) — `| string` pour rester tolérant à une valeur inconnue.
export type OrderStatus = "pending" | "paid" | "failed" | string;

export interface OrderTicket {
  id?: string;
  code: string;
  qrCodeDataUrl: string;
  ticketCategoryId: string;
}

export interface OrderItem {
  ticketCategoryId: string;
  quantity: number;
}

// Une commande peut porter sur plusieurs catégories différentes (voir
// CLAUDE.md §4) : `items` remplace l'ancien couple `ticketCategoryId`/`quantity`.
export interface Order {
  id: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount?: number;
  tickets: OrderTicket[];
  createdAt?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  // Le backend stocke/renvoie ces valeurs en majuscules (voir CLAUDE.md §5).
  method: "WAVE" | "CASH" | string;
  status: "pending" | "success" | "failed" | string;
  createdAt?: string;
}

// Valeurs réelles renvoyées par le backend (voir CLAUDE.md §5 "Ticket").
export type TicketStatus = "valid" | "used" | "cancelled" | string;

export interface Ticket {
  id: string;
  orderId: string;
  ticketCategoryId: string;
  code: string;
  status: TicketStatus;
  usedAt?: string | null;
  scannedByUserId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
}

// Un seul document existe jamais côté backend (un seul événement, voir
// CLAUDE.md §4) : date et lieu configurables par l'admin, consultés
// publiquement (accueil, checkout, tickets — voir `lib/event.ts`).
export interface EventSettings {
  date: string;
  location: string;
}
