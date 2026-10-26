import Link from "next/link";
import { EVENT_NAME, EVENT_ORG } from "@/lib/event";

interface SiteFooterProps {
  /** Date et lieu configurables — affichés seulement s'ils sont fournis. */
  eventDate?: string;
  eventLocation?: string;
}

export default function SiteFooter({ eventDate, eventLocation }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Link href="/" className="site-brand">
              <span className="logo-badge sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpeg" alt="" width={32} height={32} />
              </span>
              <span className="site-brand-text">
                <b>{EVENT_ORG}</b>
                <small>{EVENT_NAME}</small>
              </span>
            </Link>
            <p>Billetterie officielle du Dîner-Gala des {EVENT_ORG}.</p>
          </div>
          <nav aria-label="Billetterie">
            <h2>Billetterie</h2>
            <ul>
              <li>
                <Link href="/tickets">Réserver des billets</Link>
              </li>
              <li>
                <Link href="/mes-tickets">Retrouver mes billets</Link>
              </li>
              <li>
                <Link href="/success">Suivre ma commande</Link>
              </li>
            </ul>
          </nav>
          {(eventDate || eventLocation) && (
            <div>
              <h2>L&apos;événement</h2>
              <ul>
                {eventDate && <li>{eventDate}</li>}
                {eventLocation && <li>{eventLocation}</li>}
              </ul>
            </div>
          )}
        </div>
        <div className="site-footer-bottom">
          <span>
            © {new Date().getFullYear()} {EVENT_ORG}. Tous droits réservés.
          </span>
          <Link href="/admin/login">Accès organisateur</Link>
        </div>
      </div>
    </footer>
  );
}
