import { StatusBadge } from "@/components/ui/StatusBadge";
import { EVENT_NAME, EVENT_ORG } from "@/lib/event";
import { ticketStatusMeta } from "@/lib/payments";
import { TicketStatus } from "@/lib/types";

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
 * Billet complet (TicketPreview) : bandeau événement + talon QR code. Pensé
 * pour l'écran (QR agrandi sur mobile, à présenter à l'entrée) comme pour
 * l'impression / l'enregistrement en PDF (un billet par page, voir
 * styles/ticket.css). Un seul billet n'affiche pas « 1/1 ».
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
  const statusMeta = status && status !== "valid" ? ticketStatusMeta(status) : null;
  return (
    <article className="ticket" data-status={status} aria-label={`Billet ${categoryName} — ${code}`}>
      {statusMeta && (
        <span className="ticket-status">
          <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
        </span>
      )}
      <div className="ticket-main">
        <div className="ticket-brand">
          <span className="logo-badge sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="" width={32} height={32} />
          </span>
          <span>
            <b>{EVENT_ORG}</b>
            <small>Billet officiel</small>
          </span>
        </div>
        {categoryName && <span className="ticket-category">{categoryName}</span>}
        <h3 className="ticket-title">{EVENT_NAME}</h3>
        <div className="ticket-fields">
          <div className="full">
            <span>Titulaire</span>
            <b>{buyerName}</b>
          </div>
          <div>
            <span>Date</span>
            <b>{eventDate}</b>
          </div>
          <div>
            <span>Lieu</span>
            <b>{eventLocation}</b>
          </div>
        </div>
        {total > 1 && (
          <p className="ticket-count">
            Billet {index} sur {total}
          </p>
        )}
      </div>

      <div className="ticket-stub">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ticket-qr" src={qrCodeDataUrl} alt={`QR code du billet ${code}`} />
        <code className="ticket-code">{code}</code>
        <small>Présentez ce QR code à l&apos;entrée, imprimé ou sur votre téléphone.</small>
      </div>
    </article>
  );
}
