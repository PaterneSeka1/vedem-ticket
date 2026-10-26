import { PaymentMethod, PaymentStatus, TicketStatus } from "./types";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "violet" | "gold";

interface StatusMeta {
  label: string;
  tone: Tone;
}

// Un paiement Wave `pending` attend la vérification de sa capture par
// l'admin ; `failed` = capture refusée.
const PAYMENT_STATUS: Record<string, StatusMeta> = {
  success: { label: "Confirmé", tone: "success" },
  pending: { label: "À vérifier", tone: "warning" },
  failed: { label: "Refusé", tone: "danger" },
};

const ORDER_STATUS: Record<string, StatusMeta> = {
  paid: { label: "Payée", tone: "success" },
  pending: { label: "En attente", tone: "warning" },
  failed: { label: "Échouée", tone: "danger" },
};

const TICKET_STATUS: Record<string, StatusMeta> = {
  valid: { label: "Valide", tone: "info" },
  used: { label: "Utilisé", tone: "success" },
  cancelled: { label: "Annulé", tone: "danger" },
};

const METHOD_LABEL: Record<string, string> = {
  WAVE: "Wave",
  CASH: "Espèces",
  INVITATION: "Invitation",
};

export function paymentStatusMeta(status: PaymentStatus): StatusMeta {
  return PAYMENT_STATUS[status] ?? { label: status, tone: "neutral" };
}

export function orderStatusMeta(status: string): StatusMeta {
  return ORDER_STATUS[status] ?? { label: status, tone: "neutral" };
}

export function ticketStatusMeta(status: TicketStatus): StatusMeta {
  return TICKET_STATUS[status] ?? { label: status, tone: "neutral" };
}

export function methodLabel(method: PaymentMethod): string {
  return METHOD_LABEL[method] ?? method;
}

/** Méthodes qui encaissent réellement de l'argent (une invitation n'encaisse rien). */
export function isRevenueMethod(method: PaymentMethod): boolean {
  return method === "WAVE" || method === "CASH";
}
