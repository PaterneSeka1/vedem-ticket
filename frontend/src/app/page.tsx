import Link from "next/link";
import Topbar from "@/components/Topbar";
import { getEventSettings } from "@/lib/event";

// Sans Request-time API (cookies/headers/searchParams) ni fetch mis en cache,
// Next prérendrait cette page une seule fois à `next build` et figerait la
// date/le lieu dans le HTML statique servi à tout le monde (vu en pratique :
// build → "○ (Static)" pour "/"). `force-dynamic` force un rendu à chaque
// requête pour que la date/le lieu (configurables par l'admin, voir
// lib/event.ts) ne soient jamais périmés.
export const dynamic = "force-dynamic";

// Page d'accueil volontairement minimale (maquette validée avec le client) :
// un hero unique avec l'appel à l'action principal, puis le footer — pas de
// section "à propos"/grille de formules/CTA de clôture.
export default async function HomePage() {
  const { date, location } = await getEventSettings();
  return (
    <div className="simple-home">
      <Topbar />
      <section className="simple-hero">
        <div className="simple-hero-content">
          <span className="eyebrow">Dîner-Gala 2026</span>
          <h1>
            L&apos;excellence scoute
            <br />
            <em>se célèbre ensemble.</em>
          </h1>
          <p>
            {date}
            <br />
            {location}
          </p>
          <Link href="/tickets" className="primary simple-cta">
            Acheter un ticket <span>→</span>
          </Link>
        </div>
      </section>

      <footer className="simple-footer">
        <span>© 2026 Requins Féroces</span>
        <Link href="/admin/login">Accès administration</Link>
      </footer>
    </div>
  );
}
