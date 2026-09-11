import Link from "next/link";

export default function Topbar() {
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="Retour à l'accueil">
        <span className="logo-crop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="Logo officiel bleu des Requins d'Abidjan" />
        </span>
        <span>
          <b>Requins Féroces</b>
          <small>Dîner-Gala 2026</small>
        </span>
      </Link>
    </header>
  );
}
