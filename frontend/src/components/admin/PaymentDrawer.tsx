"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ImageOff, Maximize2, Printer, XCircle } from "lucide-react";
import TicketBundle from "@/components/TicketBundle";
import CopyButton from "@/components/ui/CopyButton";
import Dialog from "@/components/ui/Dialog";
import Skeleton from "@/components/ui/Skeleton";
import { MethodTag, StatusBadge } from "@/components/ui/StatusBadge";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { useAdminSession } from "@/hooks/useAdminSession";
import { ApiError, apiFetch, apiFetchBlob, isUnauthorized } from "@/lib/api";
import { formatAccessCode, formatDateTime, formatOrderItems, money, shortRef } from "@/lib/format";
import { orderStatusMeta, paymentStatusMeta } from "@/lib/payments";
import { Order, Payment, TicketCategory } from "@/lib/types";
import ProofLightbox from "./ProofLightbox";

const PROOF_ALT = "Capture du paiement Wave envoyée par l'acheteur";

interface PaymentDrawerProps {
  payment: Payment;
  order: Order | undefined;
  categoryById: Map<string, TicketCategory>;
  onClose: () => void;
  /** Paiement confirmé ou refusé : recharger les données. */
  onProcessed: () => void;
  /** Paiements Wave encore à vérifier après celui-ci (enchaînement). */
  nextPending?: Payment | null;
  onOpenPayment?: (payment: Payment) => void;
}

/**
 * Détail d'une transaction. Pour un paiement Wave : vérification de la
 * capture (`GET /payments/:id/proof`, image authentifiée → Blob), montant
 * attendu frais compris, confirmation (génère les billets) ou refus
 * (l'acheteur pourra renvoyer une capture), puis enchaînement sur le
 * paiement suivant à vérifier. Le parent remonte ce composant via `key`.
 */
export default function PaymentDrawer({
  payment,
  order,
  categoryById,
  onClose,
  onProcessed,
  nextPending,
  onOpenPayment,
}: PaymentDrawerProps) {
  const { token, handleUnauthorized } = useAdminSession();
  const toast = useToast();
  const confirm = useConfirm();
  const isWave = payment.method === "WAVE";
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [submitting, setSubmitting] = useState<"confirm" | "reject" | null>(null);
  const [processed, setProcessed] = useState<"confirm" | "reject" | null>(null);
  const [ticketsOrder, setTicketsOrder] = useState<Order | null>(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => {
    if (!isWave || !token) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    apiFetchBlob(`/payments/${payment.id}/proof`, token)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthorized(err)) {
          handleUnauthorized();
          return;
        }
        setImageError(err instanceof ApiError ? err.message : "Impossible de charger la capture.");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isWave, payment.id, token, handleUnauthorized]);

  async function process(action: "confirm" | "reject") {
    if (action === "reject") {
      const ok = await confirm({
        title: "Refuser ce paiement ?",
        message: "Aucun billet ne sera généré. L'acheteur verra que sa capture n'a pas été validée et pourra en envoyer une nouvelle.",
        confirmLabel: "Refuser le paiement",
        danger: true,
      });
      if (!ok) return;
    }
    setSubmitting(action);
    try {
      await apiFetch(`/payments/${payment.id}/${action}`, { method: "POST", token });
      toast.success(action === "confirm" ? "Paiement confirmé — billets générés." : "Paiement refusé.");
      setProcessed(action);
      onProcessed();
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Action impossible, réessayez.");
    } finally {
      setSubmitting(null);
    }
  }

  async function loadTickets() {
    if (!order) return;
    setTicketsLoading(true);
    try {
      setTicketsOrder(await apiFetch<Order>(`/orders/${order.id}/tickets`, { token }));
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Impossible de charger les billets.");
    } finally {
      setTicketsLoading(false);
    }
  }

  const statusMeta = paymentStatusMeta(processed === "confirm" ? "success" : processed === "reject" ? "failed" : payment.status);
  const canReview = isWave && payment.status === "pending" && !processed;
  const fees = order?.waveFees ?? 0;
  const ticketsAmount = order?.totalAmount ?? 0;

  const footer = canReview ? (
    <>
      <button type="button" className="btn btn-danger-soft" disabled={!!submitting} onClick={() => process("reject")}>
        {submitting === "reject" ? <span className="spinner" aria-hidden="true" /> : <XCircle size={16} strokeWidth={2} aria-hidden="true" />}
        Refuser
      </button>
      <span className="spacer" />
      <button type="button" className="btn btn-success btn-lg" disabled={!!submitting} onClick={() => process("confirm")}>
        {submitting === "confirm" ? <span className="spinner" aria-hidden="true" /> : <Check size={16} strokeWidth={2.4} aria-hidden="true" />}
        Confirmer le paiement
      </button>
    </>
  ) : processed && nextPending && onOpenPayment ? (
    <>
      <span className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
        Paiement {processed === "confirm" ? "confirmé" : "refusé"}.
      </span>
      <span className="spacer" />
      <button type="button" className="btn btn-primary" onClick={() => onOpenPayment(nextPending)}>
        Vérifier le suivant
      </button>
    </>
  ) : undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      busy={!!submitting}
      variant="drawer"
      size={isWave ? "lg" : "md"}
      eyebrow={`Transaction ${shortRef(payment.id)}`}
      title={order?.buyerName ?? "Commande introuvable"}
      footer={footer}
    >
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <MethodTag method={payment.method} />
          <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
          {order && <StatusBadge tone={orderStatusMeta(order.status).tone} dot={false}>Commande {orderStatusMeta(order.status).label.toLowerCase()}</StatusBadge>}
        </div>

        {processed && (
          <div className="callout" data-tone={processed === "confirm" ? "success" : "warning"} role="status">
            {processed === "confirm" ? <CheckCircle2 size={16} strokeWidth={2} aria-hidden="true" /> : <XCircle size={16} strokeWidth={2} aria-hidden="true" />}
            <span>
              {processed === "confirm"
                ? "Billets générés : le code de téléchargement du client est désormais actif."
                : "L'acheteur peut envoyer une nouvelle capture depuis son suivi de commande."}
            </span>
          </div>
        )}

        {isWave && (
          <>
            <div className="expected-amount">
              <span>Montant attendu sur la capture</span>
              <strong>{order ? money(ticketsAmount + fees) : "—"}</strong>
              {fees > 0 && (
                <small>
                  {money(ticketsAmount)} de billets + {money(fees)} de frais Wave
                </small>
              )}
            </div>

            <div className="proof-frame">
              {imageError ? (
                <div className="empty-state compact" data-tone="danger">
                  <span className="empty-state-icon">
                    <ImageOff size={20} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <p>{imageError}</p>
                </div>
              ) : !imageUrl ? (
                <Skeleton height={280} radius={12} />
              ) : (
                <button type="button" onClick={() => setLightboxOpen(true)} aria-label="Agrandir la capture">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={PROOF_ALT} />
                  <span className="proof-zoom-hint">
                    <Maximize2 size={13} strokeWidth={2.2} aria-hidden="true" /> Agrandir
                  </span>
                </button>
              )}
            </div>

            {canReview && (
              <ul className="checklist" aria-label="Points à vérifier">
                <li>
                  <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                  Le montant payé correspond au montant attendu.
                </li>
                <li>
                  <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                  Le destinataire est bien le compte Wave de l&apos;organisateur.
                </li>
                <li>
                  <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                  Le paiement apparaît dans l&apos;historique du compte marchand.
                </li>
              </ul>
            )}
          </>
        )}

        <dl className="kv">
          <dt>Client</dt>
          <dd>{order?.buyerName ?? "—"}</dd>
          <dt>Téléphone</dt>
          <dd>{order?.buyerPhone || "—"}</dd>
          {order?.buyerEmail && (
            <>
              <dt>E-mail</dt>
              <dd>{order.buyerEmail}</dd>
            </>
          )}
          <dt>Billets</dt>
          <dd>{order ? formatOrderItems(order, categoryById) : "—"}</dd>
          <dt>Montant</dt>
          <dd>
            {payment.method === "INVITATION" ? "Offert" : order ? money(ticketsAmount) : "—"}
            {fees > 0 && <span className="text-tertiary"> + {money(fees)} de frais Wave</span>}
          </dd>
          <dt>Code de téléchargement</dt>
          <dd>
            {order?.accessCode ? (
              <span className="code-chip">
                {formatAccessCode(order.accessCode)}
                <CopyButton value={formatAccessCode(order.accessCode)} label="Copier le code" />
              </span>
            ) : (
              "—"
            )}
          </dd>
          <dt>Enregistré le</dt>
          <dd>{formatDateTime(payment.createdAt)}</dd>
          {payment.confirmedAt && (
            <>
              <dt>Confirmé le</dt>
              <dd>{formatDateTime(payment.confirmedAt)}</dd>
            </>
          )}
          <dt>Référence complète</dt>
          <dd>
            <span className="ref">{payment.id}</span> <CopyButton value={payment.id} label="Copier la référence" />
          </dd>
        </dl>

        {order?.status === "paid" && (
          <section aria-label="Billets de la commande" style={{ display: "grid", gap: 12 }}>
            {ticketsOrder ? (
              <TicketBundle
                buyerName={ticketsOrder.buyerName}
                categoryNameById={Object.fromEntries([...categoryById].map(([id, c]) => [id, c.name]))}
                tickets={ticketsOrder.tickets ?? []}
              />
            ) : (
              <div>
                <button type="button" className="btn btn-secondary" onClick={loadTickets} disabled={ticketsLoading}>
                  {ticketsLoading ? <span className="spinner" aria-hidden="true" /> : <Printer size={16} strokeWidth={2} aria-hidden="true" />}
                  Afficher les billets
                </button>
              </div>
            )}
          </section>
        )}

        {!order && (
          <div className="callout" data-tone="warning">
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
            <span>La commande liée à ce paiement est introuvable dans les données chargées.</span>
          </div>
        )}
      </div>

      {lightboxOpen && imageUrl && <ProofLightbox src={imageUrl} alt={PROOF_ALT} onClose={() => setLightboxOpen(false)} />}
    </Dialog>
  );
}
