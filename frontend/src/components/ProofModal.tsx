"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ApiError, apiFetch, apiFetchBlob, isUnauthorized } from "@/lib/api";
import { formatOrderItems, money } from "@/lib/format";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { Order, Payment, TicketCategory } from "@/lib/types";

interface ProofModalProps {
  payment: Payment;
  order: Order | undefined;
  categoryById: Map<string, TicketCategory>;
  token: string | null;
  onClose: () => void;
  /** Paiement confirmé ou refusé : recharger les données du dashboard. */
  onProcessed: () => void;
  onUnauthorized: () => void;
}

/**
 * Vérification d'un paiement Wave : affiche la capture envoyée par
 * l'acheteur (`GET /payments/:id/proof`, image brute authentifiée — d'où le
 * Blob plutôt qu'un simple `<img src>`), puis confirme (génère les tickets)
 * ou refuse (l'acheteur pourra renvoyer une capture). Le parent remonte ce
 * composant via `key` à chaque paiement sélectionné.
 */
export default function ProofModal({
  payment,
  order,
  categoryById,
  token,
  onClose,
  onProcessed,
  onUnauthorized,
}: ProofModalProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
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
          onUnauthorized();
          return;
        }
        setLoadError(err instanceof ApiError ? err.message : "Impossible de charger la capture.");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [payment.id, token, onUnauthorized]);

  async function process(action: "confirm" | "reject") {
    if (action === "reject") {
      const ok = await confirm({
        title: "Refuser ce paiement ?",
        message: "Aucun ticket ne sera généré. L'acheteur pourra envoyer une nouvelle capture.",
        confirmLabel: "Refuser",
        danger: true,
      });
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/payments/${payment.id}/${action}`, { method: "POST", token });
      toast.success(action === "confirm" ? "Paiement confirmé — tickets générés." : "Paiement refusé.");
      onProcessed();
      onClose();
    } catch (err) {
      if (isUnauthorized(err)) {
        onUnauthorized();
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Action impossible, réessaie.");
      setSubmitting(false);
    }
  }

  const isPending = payment.status === "pending";

  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-labelledby="proof-modal-title">
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <span className="section-kicker">Paiement Wave</span>
            <h2 id="proof-modal-title">Preuve de paiement</h2>
            <p>Vérifie le montant et le destinataire sur la capture avant de confirmer.</p>
          </div>
          <button className="modal-close" aria-label="Fermer" onClick={onClose} type="button">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        <dl className="proof-summary">
          <dt>Client</dt>
          <dd>{order ? `${order.buyerName} — ${order.buyerPhone}` : "—"}</dd>
          <dt>Commande</dt>
          <dd>{order ? formatOrderItems(order, categoryById) : "—"}</dd>
          <dt>Montant attendu</dt>
          <dd>{order?.totalAmount !== undefined ? money(order.totalAmount) : "—"}</dd>
        </dl>

        <div className="proof-image">
          {loadError && <p style={{ color: "#bd2c2c" }}>{loadError}</p>}
          {!loadError && !imageUrl && <p style={{ color: "var(--muted)" }}>Chargement…</p>}
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Capture du paiement Wave envoyée par l'acheteur" />
          )}
        </div>

        {isPending ? (
          <div className="proof-actions">
            <button className="primary danger" type="button" disabled={submitting} onClick={() => process("reject")}>
              Refuser
            </button>
            <button className="primary" type="button" disabled={submitting} onClick={() => process("confirm")}>
              {submitting ? "Traitement…" : "Confirmer le paiement"}
            </button>
          </div>
        ) : (
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Paiement déjà {payment.status === "success" ? "confirmé" : "refusé"}.
          </p>
        )}
      </div>
    </div>
  );
}
