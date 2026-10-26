"use client";

import { useEffect, useState } from "react";
import TicketBundle from "@/components/TicketBundle";
import CopyButton from "@/components/ui/CopyButton";
import Dialog from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAdminSession } from "@/hooks/useAdminSession";
import { ApiError, apiFetch, isUnauthorized } from "@/lib/api";
import { formatAccessCode, formatDateTime, shortRef } from "@/lib/format";
import { ticketStatusMeta } from "@/lib/payments";
import { Order, Ticket } from "@/lib/types";

interface TicketDrawerProps {
  ticket: Ticket;
  order: Order | undefined;
  categoryName: string;
  onClose: () => void;
}

/**
 * Détail imprimable d'un billet déjà émis — réimpression, renvoi au client
 * ou remplacement d'un billet perdu. Le QR code n'est pas dans `GET
 * /tickets` : on le récupère via la route admin `GET /orders/:id/tickets`.
 * Le parent remonte ce composant via `key` à chaque billet sélectionné.
 */
export default function TicketDrawer({ ticket, order, categoryName, onClose }: TicketDrawerProps) {
  const { token, handleUnauthorized } = useAdminSession();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch<Order>(`/orders/${ticket.orderId}/tickets`, { token })
      .then((full) => {
        if (cancelled) return;
        const match = full.tickets?.find((t) => t.code === ticket.code);
        if (match) setQrCodeDataUrl(match.qrCodeDataUrl);
        else setError("QR code introuvable pour ce billet.");
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthorized(err)) {
          handleUnauthorized();
          return;
        }
        setError(err instanceof ApiError ? err.message : "Impossible de charger le billet.");
      });
    return () => {
      cancelled = true;
    };
  }, [ticket, token, attempt, handleUnauthorized]);

  const meta = ticketStatusMeta(ticket.status);

  return (
    <Dialog open onClose={onClose} variant="drawer" size="lg" eyebrow="Billet" title={categoryName}>
      <div style={{ display: "grid", gap: 20 }}>
        <dl className="kv">
          <dt>Statut</dt>
          <dd>
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          </dd>
          <dt>Titulaire</dt>
          <dd>{order?.buyerName ?? "—"}</dd>
          <dt>Code</dt>
          <dd>
            <span className="ref">{ticket.code}</span> <CopyButton value={ticket.code} label="Copier le code du billet" />
          </dd>
          {ticket.usedAt && (
            <>
              <dt>Entrée validée</dt>
              <dd>{formatDateTime(ticket.usedAt)}</dd>
            </>
          )}
          <dt>Commande</dt>
          <dd>
            <span className="ref">{shortRef(ticket.orderId)}</span>
          </dd>
          {order?.accessCode && (
            <>
              <dt>Code de téléchargement</dt>
              <dd>
                <span className="code-chip">
                  {formatAccessCode(order.accessCode)}
                  <CopyButton value={formatAccessCode(order.accessCode)} label="Copier le code de téléchargement" />
                </span>
              </dd>
            </>
          )}
        </dl>

        {error ? (
          <ErrorState
            compact
            title="Billet indisponible"
            message={error}
            onRetry={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          />
        ) : !qrCodeDataUrl ? (
          <Skeleton height={260} radius={16} />
        ) : (
          <TicketBundle
            buyerName={order?.buyerName ?? "—"}
            categoryNameById={{ [ticket.ticketCategoryId]: categoryName }}
            tickets={[{ code: ticket.code, qrCodeDataUrl, ticketCategoryId: ticket.ticketCategoryId }]}
            statusByCode={{ [ticket.code]: ticket.status }}
          />
        )}
      </div>
    </Dialog>
  );
}
