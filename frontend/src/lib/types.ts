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
  // Réservée aux tickets d'invitation (ex. VVIP) : absente de la billetterie
  // publique (`GET /ticket-categories`), visible uniquement via la route admin
  // `GET /ticket-categories/all`, et refusée à l'achat.
  invitationOnly?: boolean;
  // Frais Wave (1 %, arrondis à l'unité supérieure) à la charge de l'acheteur
  // sur cette catégorie — figés côté serveur sur la commande (`Order.waveFees`).
  chargeWaveFees?: boolean;
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
  // Absent (null) pour une invitation — voir CLAUDE.md §5.
  buyerPhone: string | null;
  buyerEmail?: string | null;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount?: number;
  // Frais Wave figés à la création (0 si aucun) : ajoutés uniquement au
  // montant du lien Wave, jamais aux espèces ni à `totalAmount`.
  waveFees?: number | null;
  // Présent uniquement via les routes qui les exposent : `GET /orders/:id/tickets`
  // (admin) et `POST /orders/access` (code de téléchargement). Jamais via la
  // route publique `GET /orders/:id`, qui ne sert qu'au suivi.
  tickets?: OrderTicket[];
  // Code de téléchargement (stocké sans tiret, voir `formatAccessCode`) :
  // renvoyé par `POST /orders` à la création et par les routes admin.
  accessCode?: string | null;
  // Dernier paiement de la commande, renvoyé par `GET /orders/:id` (suivi
  // acheteur) et `GET /orders/:id/tickets` (admin) : `null` tant qu'aucune capture Wave
  // n'a été envoyée, `pending` en attente de vérification par l'admin,
  // `failed` si la capture a été refusée.
  payment?: { method: Payment["method"]; status: Payment["status"] } | null;
  createdAt?: string;
}

export type PaymentMethod = "WAVE" | "CASH" | "INVITATION" | string;
export type PaymentStatus = "pending" | "success" | "failed" | string;

export interface Payment {
  id: string;
  orderId: string;
  // Le backend stocke/renvoie ces valeurs en majuscules (voir CLAUDE.md §5).
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt?: string;
  confirmedAt?: string | null;
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

// Réponse de `POST /payments/wave/checkout` : lien marchand Wave avec le
// montant pré-rempli (`amount` = `ticketsAmount` + `fees`).
export interface WaveCheckout {
  paymentUrl: string;
  amount: number;
  ticketsAmount: number;
  fees: number;
  currency: string;
}

// Réponse de `PATCH /tickets/:code/scan`.
export interface ScanResponse {
  ticket: { code: string; status: string; usedAt: string | null };
  buyerName: string | null;
  categoryName: string | null;
}
