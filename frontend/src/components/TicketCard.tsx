import { EVENT_NAME, EVENT_ORG } from "@/lib/event";
import { TicketStatus } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = { valid: "Valide", used: "Utilisé", cancelled: "Annulé" };

interface TicketCardProps {
  code: string;
  qrCodeDataUrl: string;
  categoryName: string;
  buyerName: string;
  index: number;
  total: number;
  /** Absent côté acheteur (toujours "valid" juste après paiement) — utilisé côté admin. */
  status?: TicketStatus;
  /** Configurables par l'admin (voir lib/event.ts) — fournis par l'appelant
   * (TicketBundle) plutôt que lus en dur ici, pour qu'un ticket réimprimé
   * plus tard affiche toujours la valeur à jour, sans exception. */
  eventDate: string;
  eventLocation: string;
}

/**
 * Rendu "billet" complet d'un ticket (logo, événement, titulaire, QR code en
 * grand) — pensé pour être imprimé ou enregistré en PDF (voir styles
 * `.ticket-full*` et `@media print` dans globals.css). Un seul ticket par
 * commande n'affiche pas "1/1" comme s'il en manquait — testé visuellement.
 */
export default function TicketCard({
  code,
  qrCodeDataUrl,
  categoryName,
  buyerName,
  index,
  total,
  status,
  eventDate,
  eventLocation,
}: TicketCardProps) {
  return (
    <div className="ticket-full">
      {status && status !== "valid" && (
        <span className={`ticket-full-badge ${status}`}>{STATUS_LABEL[status] ?? status}</span>
      )}
      <div className="ticket-full-main">
        <div className="ticket-full-brand">
          <span className="logo-crop small">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" />
          </span>
          <span>
            <b>{EVENT_ORG}</b>
            <small>Billet officiel</small>
          </span>
        </div>

        <span className="ticket-full-category">
          {categoryName}
          {total > 1 ? ` · Ticket ${index}/${total}` : ""}
        </span>
        <h3>{EVENT_NAME}</h3>

        <div className="ticket-full-row">
          <div>
            <span>Titulaire</span>
            <b>{buyerName}</b>
          </div>
        </div>
        <div className="ticket-full-row">
          <div>
            <span>Date</span>
            <b>{eventDate}</b>
          </div>
          <div>
            <span>Lieu</span>
            <b>{eventLocation}</b>
          </div>
        </div>
      </div>

      <div className="ticket-full-stub">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrCodeDataUrl} alt={`QR code du ticket ${code}`} />
        <code>{code}</code>
        <small>À présenter (imprimé ou à l&apos;écran) pour l&apos;entrée</small>
      </div>
    </div>
  );
}
