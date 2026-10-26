"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import TicketCard from "./TicketCard";
import { FALLBACK_EVENT_SETTINGS, getEventSettings } from "@/lib/event";
import { plural } from "@/lib/format";
import { OrderTicket, TicketStatus } from "@/lib/types";

interface TicketBundleProps {
  buyerName: string;
  /** Nom de catégorie par `ticketCategoryId` — une commande peut porter sur
   * plusieurs catégories différentes (voir CLAUDE.md §4), chaque billet
   * affiche donc la sienne plutôt qu'un nom unique pour tout le lot. */
  categoryNameById: Record<string, string>;
  tickets: OrderTicket[];
  /** Statut par code, connu côté admin uniquement (voir AdminTicketModal). */
  statusByCode?: Record<string, TicketStatus>;
}

/**
 * Un ou plusieurs billets imprimables/enregistrables en PDF via un seul
 * bouton. `window.print()` + les styles `@media print` (`.print-area`)
 * masquent tout le reste de la page ; la boîte de dialogue d'impression du
 * navigateur permet nativement d'imprimer ou d'enregistrer en PDF — pas de
 * dépendance PDF supplémentaire.
 */
export default function TicketBundle({ buyerName, categoryNameById, tickets, statusByCode }: TicketBundleProps) {
  // Récupéré une seule fois pour tout le lot (pas par billet) — configurable
  // par l'admin (voir lib/event.ts), doit refléter la valeur actuelle même
  // pour un billet réimprimé longtemps après l'achat, sans exception.
  const [eventSettings, setEventSettings] = useState(FALLBACK_EVENT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    getEventSettings().then((settings) => {
      if (!cancelled) setEventSettings(settings);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="ticket-bundle">
      <div className="ticket-bundle-bar no-print">
        <span className="text-secondary" style={{ fontSize: "var(--text-sm)" }}>
          {plural(tickets.length, "billet")}
        </span>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} strokeWidth={2} aria-hidden="true" />
          Imprimer / Enregistrer en PDF
        </button>
      </div>

      <div className="print-area ticket-stack">
        {tickets.map((ticket, i) => (
          <TicketCard
            key={ticket.code ?? i}
            code={ticket.code}
            qrCodeDataUrl={ticket.qrCodeDataUrl}
            // Catégorie inconnue côté public (ex. réservée aux invitations,
            // absente de `GET /ticket-categories`) : libellé neutre.
            categoryName={categoryNameById[ticket.ticketCategoryId] ?? "Billet"}
            buyerName={buyerName}
            index={i + 1}
            total={tickets.length}
            status={statusByCode?.[ticket.code]}
            eventDate={eventSettings.date}
            eventLocation={eventSettings.location}
          />
        ))}
      </div>
    </div>
  );
}
