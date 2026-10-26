import Link from "next/link";
import { ArrowRight, CalendarDays, Camera, MapPin, QrCode, ShieldCheck, Ticket, Wallet } from "lucide-react";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiFetch } from "@/lib/api";
import { isSoldOut, operationalCategories } from "@/lib/categories";
import { EVENT_NAME, EVENT_ORG, getEventSettings } from "@/lib/event";
import { currencyLabel, formatNumber } from "@/lib/format";
import { TicketCategory } from "@/lib/types";

// Sans Request-time API (cookies/headers/searchParams) ni fetch mis en cache,
// Next prérendrait cette page une seule fois à `next build` et figerait la
// date/le lieu dans le HTML statique servi à tout le monde (vu en pratique :
// build → "○ (Static)" pour "/"). `force-dynamic` force un rendu à chaque
// requête pour que la date/le lieu (configurables par l'admin, voir
// lib/event.ts) et les catégories ne soient jamais périmés.
export const dynamic = "force-dynamic";

async function getOfferCategories(): Promise<TicketCategory[]> {
  try {
    return operationalCategories(await apiFetch<TicketCategory[]>("/ticket-categories"));
  } catch {
    // API injoignable : l'accueil reste utilisable, la section billets est masquée.
    return [];
  }
}

// Étapes réelles du parcours (CLAUDE.md §6) — aucune information inventée.
const HOW_STEPS = [
  {
    icon: Ticket,
    title: "Choisissez vos billets",
    text: "Une ou plusieurs catégories dans la même commande, sans création de compte.",
  },
  {
    icon: Wallet,
    title: "Payez avec Wave",
    text: "Le lien de paiement Wave s'ouvre avec le montant de votre commande pré-rempli.",
  },
  {
    icon: Camera,
    title: "Envoyez la capture",
    text: "Joignez la capture d'écran de la confirmation Wave depuis le suivi de commande.",
  },
  {
    icon: QrCode,
    title: "Recevez vos billets",
    text: "Après vérification par l'organisateur, votre code de téléchargement s'active.",
  },
];

export default async function HomePage() {
  const [{ date, location }, categories] = await Promise.all([getEventSettings(), getOfferCategories()]);

  return (
    <div className="public-page">
      <SiteHeader variant="inverse" />
      <main id="contenu">
        <section className="hero is-inverse" aria-labelledby="hero-title">
          <div className="container hero-grid">
            <div>
              <span className="hero-eyebrow">
                {EVENT_NAME} · {EVENT_ORG}
              </span>
              <h1 id="hero-title" className="hero-title display">
                L&apos;excellence scoute
                <em>se célèbre ensemble.</em>
              </h1>
              <p className="hero-lead">
                Billetterie officielle du Dîner-Gala des {EVENT_ORG}. Réservez vos places en quelques minutes et
                retrouvez vos billets à tout moment grâce à votre code personnel.
              </p>
              <div className="hero-meta">
                <div className="hero-meta-item">
                  <CalendarDays size={18} strokeWidth={2} aria-hidden="true" />
                  <div>
                    <span>Date</span>
                    <b>{date}</b>
                  </div>
                </div>
                <div className="hero-meta-item">
                  <MapPin size={18} strokeWidth={2} aria-hidden="true" />
                  <div>
                    <span>Lieu</span>
                    <b>{location}</b>
                  </div>
                </div>
              </div>
              <div className="hero-actions">
                <Link href="/tickets" className="btn btn-gold btn-lg">
                  Réserver mes billets <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
                </Link>
                <Link href="/mes-tickets" className="btn btn-inverse btn-lg">
                  Retrouver mes billets
                </Link>
              </div>
            </div>

            <div className="hero-pass" aria-hidden="true">
              <div className="hero-pass-head">
                <span className="logo-badge">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.jpeg" alt="" width={40} height={40} />
                </span>
                <div>
                  <small>Billet officiel</small>
                  <b>{EVENT_ORG}</b>
                </div>
              </div>
              <div className="hero-pass-body">
                <p className="hero-pass-title">{EVENT_NAME}</p>
                <div className="hero-pass-row">
                  <span>Date</span>
                  <b>{date}</b>
                </div>
                <div className="hero-pass-row">
                  <span>Lieu</span>
                  <b>{location}</b>
                </div>
              </div>
              <div className="hero-pass-stub">
                <span>Accès sur présentation du QR code</span>
                <QrCode size={28} strokeWidth={1.6} />
              </div>
            </div>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="section section-surface" aria-labelledby="offers-title">
            <div className="container">
              <div className="section-head">
                <div>
                  <span className="eyebrow">Billetterie</span>
                  <h2 id="offers-title" className="display">
                    Les billets
                  </h2>
                  <p>Composez librement votre commande : plusieurs catégories peuvent être réunies en un seul achat.</p>
                </div>
                <Link href="/tickets" className="btn btn-secondary">
                  Voir la billetterie <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
              <ul className="offer-grid" role="list">
                {categories.map((category) => (
                  <li key={category.id} className="offer-card">
                    <div className="offer-card-head">
                      <h3>{category.name}</h3>
                      {isSoldOut(category) && <StatusBadge tone="danger">Épuisé</StatusBadge>}
                    </div>
                    {category.description && <p>{category.description}</p>}
                    <div className="offer-price">
                      {formatNumber(category.price)}
                      <small>{currencyLabel(category.currency)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="section" aria-labelledby="how-title">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Comment ça marche</span>
                <h2 id="how-title" className="display">
                  Quatre étapes, aucun compte
                </h2>
              </div>
            </div>
            <ol className="how-grid">
              {HOW_STEPS.map((step, index) => (
                <li key={step.title} className="how-step">
                  <span className="how-step-icon" aria-hidden="true">
                    <step.icon size={20} strokeWidth={2} />
                  </span>
                  <span className="how-step-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>

            <div className="retrieve-band is-inverse" style={{ marginTop: "clamp(40px, 6vw, 72px)" }}>
              <div>
                <h2>Déjà une commande ?</h2>
                <p>
                  Saisissez le code de téléchargement reçu à la commande pour afficher, imprimer ou enregistrer vos
                  billets. Il s&apos;active dès que l&apos;organisateur a validé votre paiement.
                </p>
              </div>
              <Link href="/mes-tickets" className="btn btn-gold btn-lg">
                <ShieldCheck size={18} strokeWidth={2} aria-hidden="true" /> Retrouver mes billets
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter eventDate={date} eventLocation={location} />
    </div>
  );
}
