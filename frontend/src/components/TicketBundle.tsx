"use client";

import { Printer } from "lucide-react";
import TicketCard from "./TicketCard";
import { OrderTicket, TicketStatus } from "@/lib/types";

interface TicketBundleProps {
  buyerName: string;
  categoryName: string;
  tickets: OrderTicket[];
  /** Statut par code, connu côté admin uniquement (voir AdminTicketModal). */
  statusByCode?: Record<string, TicketStatus>;
}

/**
 * Un ou plusieurs `TicketCard` imprimables/téléchargeables via un seul
 * bouton. `window.print()` + les styles `@media print` de globals.css
 * (`.print-area`) masquent tout le reste de la page ; la boîte de dialogue
 * d'impression du navigateur permet nativement d'imprimer ou d'enregistrer
 * en PDF — pas de dépendance PDF supplémentaire.
 */
export default function TicketBundle({ buyerName, categoryName, tickets, statusByCode }: TicketBundleProps) {
  return (
    <div className="ticket-bundle">
      <button
        type="button"
        className="primary no-print ticket-bundle-print"
        onClick={() => window.print()}
      >
        <Printer size={18} strokeWidth={2.2} />
        Imprimer / Télécharger en PDF
      </button>

      <div className="print-area ticket-stack">
        {tickets.map((ticket, i) => (
          <TicketCard
            key={ticket.code ?? i}
            code={ticket.code}
            qrCodeDataUrl={ticket.qrCodeDataUrl}
            categoryName={categoryName}
            buyerName={buyerName}
            index={i + 1}
            total={tickets.length}
            status={statusByCode?.[ticket.code]}
          />
        ))}
      </div>
    </div>
  );
}
