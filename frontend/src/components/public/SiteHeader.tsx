  "use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ticket } from "lucide-react";
import { EVENT_NAME, EVENT_ORG } from "@/lib/event";

interface SiteHeaderProps {
  /** `inverse` : posé sur le hero sombre de l'accueil. */
  variant?: "default" | "inverse";
  /** Masque l'appel à l'action « Réserver » (déjà dans le parcours d'achat). */
  hideCta?: boolean;
}

export default function SiteHeader({ variant = "default", hideCta = false }: SiteHeaderProps) {
  const pathname = usePathname();
  const inverse = variant === "inverse";
  return (
    <header className={`site-header${inverse ? " is-inverse" : ""}`} data-variant={variant}>
      <div className="container site-header-inner">
        <Link href="/" className="site-brand" aria-label={`${EVENT_ORG} — accueil`}>
          <span className="logo-badge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="" width={40} height={40} />
          </span>
          <span className="site-brand-text">
            <b>{EVENT_ORG}</b>
            <small>{EVENT_NAME}</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Navigation principale">
          <Link
            href="/tickets"
            className="site-nav-link hide-mobile"
            aria-current={pathname === "/tickets" ? "page" : undefined}
          >
            Billetterie
          </Link>
          <Link
            href="/mes-tickets"
            className="site-nav-link"
            aria-current={pathname === "/mes-tickets" ? "page" : undefined}
          >
            <Ticket size={16} strokeWidth={2} aria-hidden="true" />
            Mes billets
          </Link>
          {!hideCta && (
            <Link href="/tickets" className={`btn btn-sm ${inverse ? "btn-gold" : "btn-primary"}`}>
              Réserver
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
