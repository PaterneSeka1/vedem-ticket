"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { Order, Ticket } from "@/lib/types";
import TicketBundle from "./TicketBundle";

interface AdminTicketModalProps {
  ticket: Ticket | null;
  buyerName: string;
  categoryName: string;
  onClose: () => void;
}

/**
 * Aperçu imprimable d'un ticket déjà émis (dashboard admin) — utile pour
 * réimprimer/renvoyer un ticket espèces ou remplacer un ticket perdu. Le
 * QR code n'est pas dans `GET /tickets` (Étape 5, `TicketsService.findAll`
 * ne l'enrichit pas) ; on le récupère via la route publique
 * `GET /orders/:id`, comme le fait déjà CashModal après un encaissement.
 */
export default function AdminTicketModal({ ticket, buyerName, categoryName, onClose }: AdminTicketModalProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pas de reset synchrone de l'état ici (ticket précédent qui resterait
  // affiché le temps du fetch) : le parent remonte ce composant via `key`
  // à chaque changement de ticket sélectionné, ce qui repart d'un état vide.
  useEffect(() => {
    if (!ticket) return;
    let cancelled = false;

    apiFetch<Order>(`/orders/${ticket.orderId}`)
      .then((order) => {
        if (cancelled) return;
        const match = order.tickets.find((t) => t.code === ticket.code);
        if (match) {
          setQrCodeDataUrl(match.qrCodeDataUrl);
        } else {
          setError("QR code introuvable pour ce ticket.");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Impossible de charger le ticket.");
      });

    return () => {
      cancelled = true;
    };
  }, [ticket]);

  if (!ticket) return null;

  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title">
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <span className="section-kicker">Ticket</span>
            <h2 id="ticket-modal-title">{ticket.code}</h2>
            <p>Aperçu imprimable — à remettre ou renvoyer au client.</p>
          </div>
          <button className="modal-close" aria-label="Fermer" onClick={onClose} type="button">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        {error && <p style={{ color: "#bd2c2c" }}>{error}</p>}
        {!error && !qrCodeDataUrl && <p style={{ color: "var(--muted)" }}>Chargement…</p>}
        {qrCodeDataUrl && (
          <TicketBundle
            buyerName={buyerName}
            categoryNameById={{ [ticket.ticketCategoryId]: categoryName }}
            tickets={[{ code: ticket.code, qrCodeDataUrl, ticketCategoryId: ticket.ticketCategoryId }]}
            statusByCode={{ [ticket.code]: ticket.status }}
          />
        )}
      </div>
    </div>
  );
}
