import Link from "next/link";
import Topbar from "@/components/Topbar";

// Page d'accueil volontairement minimale (maquette validée avec le client) :
// un hero unique avec l'appel à l'action principal, puis le footer — pas de
// section "à propos"/grille de formules/CTA de clôture.
export default function HomePage() {
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
            Samedi 12 septembre 2026 • 18 h 30
            <br />
            Foyer des Jeunes de Marcory
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
