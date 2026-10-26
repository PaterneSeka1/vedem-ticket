import { isRevenueMethod } from "./payments";
import { Order, Payment, Ticket, TicketCategory } from "./types";

export interface CategoryMetrics {
  category: TicketCategory;
  /** Tickets émis (hors annulés), invitations comprises. */
  issued: number;
  /** Dont tickets d'invitation. */
  invitations: number;
  /** Tickets scannés à l'entrée. */
  used: number;
}

export interface DashboardMetrics {
  /** Somme des `totalAmount` des commandes réglées en Wave ou en espèces (frais Wave exclus). */
  revenue: number;
  revenueByMethod: { WAVE: number; CASH: number };
  paidOrdersByMethod: { WAVE: number; CASH: number; INVITATION: number };
  /** Paiements Wave dont la capture attend une vérification. */
  pendingWave: Payment[];
  /** Montant attendu sur le lien Wave des paiements à vérifier (billets + frais). */
  pendingWaveAmount: number;
  /** Commandes créées sans aucun paiement enregistré (lien Wave pas encore suivi d'une capture). */
  awaitingProofOrders: number;
  ticketsIssued: number;
  ticketsInvitation: number;
  ticketsSold: number;
  entries: number;
  byCategory: CategoryMetrics[];
}

/**
 * Indicateurs du tableau de bord, calculés à partir des données admin.
 *
 * Règles (voir CLAUDE.md §4) :
 * - une commande est « réglée » par son paiement `success` — le backend
 *   refuse un second encaissement, mais on déduplique tout de même par
 *   commande pour qu'aucune anomalie ne puisse doubler une recette ;
 * - une invitation (méthode `INVITATION`) n'est jamais du chiffre d'affaires
 *   (son `totalAmount` vaut 0, on l'exclut en plus explicitement) ;
 * - les frais Wave ne sont pas une recette de l'événement : ils couvrent la
 *   commission Wave et ne sont donc pas ajoutés ;
 * - toutes les catégories comptent, y compris historiques (tombola) : les
 *   recettes déjà encaissées ne sont jamais masquées.
 */
export function computeDashboardMetrics(
  orders: Order[],
  payments: Payment[],
  tickets: Ticket[],
  categories: TicketCategory[],
): DashboardMetrics {
  const orderById = new Map(orders.map((order) => [order.id, order]));

  const settlingPaymentByOrder = new Map<string, Payment>();
  for (const payment of payments) {
    if (payment.status === "success" && !settlingPaymentByOrder.has(payment.orderId)) {
      settlingPaymentByOrder.set(payment.orderId, payment);
    }
  }

  const revenueByMethod = { WAVE: 0, CASH: 0 };
  const paidOrdersByMethod = { WAVE: 0, CASH: 0, INVITATION: 0 };
  for (const [orderId, payment] of settlingPaymentByOrder) {
    const method = payment.method as keyof typeof paidOrdersByMethod;
    if (method in paidOrdersByMethod) paidOrdersByMethod[method] += 1;
    if (isRevenueMethod(payment.method)) {
      revenueByMethod[method as keyof typeof revenueByMethod] += orderById.get(orderId)?.totalAmount ?? 0;
    }
  }

  const pendingWave = payments.filter((p) => p.method === "WAVE" && p.status === "pending");
  const pendingWaveAmount = pendingWave.reduce((sum, p) => {
    const order = orderById.get(p.orderId);
    return sum + (order ? (order.totalAmount ?? 0) + (order.waveFees ?? 0) : 0);
  }, 0);

  const ordersWithPayment = new Set(payments.map((p) => p.orderId));
  const awaitingProofOrders = orders.filter(
    (order) => order.status === "pending" && !ordersWithPayment.has(order.id),
  ).length;

  const invitationOrderIds = new Set(
    [...settlingPaymentByOrder].filter(([, p]) => p.method === "INVITATION").map(([orderId]) => orderId),
  );

  const byCategoryId = new Map<string, CategoryMetrics>(
    categories.map((category) => [category.id, { category, issued: 0, invitations: 0, used: 0 }]),
  );

  let ticketsIssued = 0;
  let ticketsInvitation = 0;
  let entries = 0;
  for (const ticket of tickets) {
    if (ticket.status === "cancelled") continue;
    const isInvitation = invitationOrderIds.has(ticket.orderId);
    ticketsIssued += 1;
    if (isInvitation) ticketsInvitation += 1;
    if (ticket.status === "used") entries += 1;

    const bucket = byCategoryId.get(ticket.ticketCategoryId);
    if (bucket) {
      bucket.issued += 1;
      if (isInvitation) bucket.invitations += 1;
      if (ticket.status === "used") bucket.used += 1;
    }
  }

  return {
    revenue: revenueByMethod.WAVE + revenueByMethod.CASH,
    revenueByMethod,
    paidOrdersByMethod,
    pendingWave,
    pendingWaveAmount,
    awaitingProofOrders,
    ticketsIssued,
    ticketsInvitation,
    ticketsSold: ticketsIssued - ticketsInvitation,
    entries,
    byCategory: [...byCategoryId.values()],
  };
}

/** Paiement « réglant » de chaque commande (premier `success`), pour l'affichage. */
export function settlingPayments(payments: Payment[]): Map<string, Payment> {
  const map = new Map<string, Payment>();
  for (const payment of payments) {
    if (payment.status === "success" && !map.has(payment.orderId)) map.set(payment.orderId, payment);
  }
  return map;
}
