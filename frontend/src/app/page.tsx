import Link from "next/link";
import Topbar from "../components/Topbar";

export default function HomePage() {
  return (
    <>
      <Topbar />
      <section className="simple-home">
        <div className="simple-hero">
          <div className="simple-hero-content">
            <span className="eyebrow">Dîner-Gala 2026</span>
            <h1>
              L&apos;excellence scoute
              <br />
              <em>se célèbre ensemble.</em>
            </h1>
            <p>
              Samedi 12 septembre • 18 h 30
              <br />
              Foyer des Jeunes de Marcory
            </p>
            <Link href="/tickets" className="primary simple-cta">
              Acheter un ticket <span>→</span>
            </Link>
          </div>
        </div>
        <footer className="simple-footer">
          <span>© 2026 Requins Féroces</span>
          <Link href="/admin/login">Accès administration</Link>
        </footer>
      </section>
    </>
  );
}
