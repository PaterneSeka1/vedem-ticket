"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock3, KeyRound, TicketCheck } from "lucide-react";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";
import TicketBundle from "@/components/TicketBundle";
import { Card } from "@/components/ui/Card";
import { ApiError, apiFetch } from "@/lib/api";
import { getLastAccessCode } from "@/lib/order-storage";
import { formatAccessCode } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { Order } from "@/lib/types";

// Le code stocké ne change pas pendant la visite : pas d'abonnement réel.
const subscribeNoop = () => () => {};

/** Saisie assistée : majuscules, caractères alphanumériques, tiret inséré après 4 caractères. */
function normalizeInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

type AccessError = { tone: "warning" | "danger"; message: string };

/**
 * Téléchargement des billets avec le code remis à la commande. Le code n'est
 * actif qu'une fois la transaction validée par l'admin : avant, l'API le
 * refuse (403) et on l'explique. Pré-rempli avec le code de la dernière
 * commande de cet appareil, s'il est connu.
 */
export default function MesTicketsPage() {
  const { allPublicCategories } = useCart();
  const toast = useToast();
  // Page pré-rendue : le code stocké n'est lu que côté client (null au rendu
  // serveur), sans décalage d'hydratation.
  const storedCode = useSyncExternalStore(subscribeNoop, () => getLastAccessCode(), () => null);
  const [typedCode, setCode] = useState<string | null>(null);
  const code = typedCode ?? (storedCode ? formatAccessCode(storedCode) : "");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<AccessError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const complete = code.replace("-", "").length === 8;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!complete) {
      setError({ tone: "danger", message: "Le code comporte 8 caractères (format XXXX-XXXX)." });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // POST (et non GET) : le code ne doit pas apparaître dans les URLs.
      const result = await apiFetch<Order>("/orders/access", { method: "POST", body: { code } });
      setOrder(result);
      toast.success("Billets retrouvés.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError({
          tone: "warning",
          message:
            "Votre paiement n'a pas encore été validé par l'organisateur. Réessayez plus tard avec le même code — le suivi de commande vous indique l'avancement.",
        });
      } else if (err instanceof ApiError && err.status === 404) {
        setError({ tone: "danger", message: "Code invalide. Vérifiez-le et réessayez." });
      } else if (err instanceof ApiError && err.status === 429) {
        setError({ tone: "danger", message: "Trop de tentatives. Patientez quelques minutes avant de réessayer." });
      } else {
        setError({ tone: "danger", message: "Connexion impossible. Vérifiez votre réseau et réessayez." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const categoryNameById = Object.fromEntries(allPublicCategories.map((c) => [c.id, c.name]));

  return (
    <div className="public-page">
      <SiteHeader />
      <main id="contenu" className="container status-page">
        {order ? (
          <div className="status-layout single" style={{ gridTemplateColumns: "minmax(0, 760px)" }}>
            <div>
              <div className="status-hero no-print">
                <span className="status-icon" data-tone="success" aria-hidden="true">
                  <TicketCheck size={24} strokeWidth={2} />
                </span>
                <span className="eyebrow">Paiement validé</span>
                <h1>Vos billets</h1>
                <p>
                  Présentez le QR code de chaque billet à l&apos;entrée, sur votre téléphone ou imprimé. Chaque billet
                  n&apos;est valable qu&apos;une seule fois.
                </p>
              </div>
              <TicketBundle
                buyerName={order.buyerName}
                categoryNameById={categoryNameById}
                tickets={order.tickets ?? []}
              />
              <div className="no-print" style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setOrder(null)}>
                  <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Utiliser un autre code
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="status-layout single" style={{ gridTemplateColumns: "minmax(0, 520px)" }}>
            <div>
              <div className="status-hero">
                <span className="status-icon" data-tone="brand" aria-hidden="true">
                  <KeyRound size={22} strokeWidth={2} />
                </span>
                <span className="eyebrow">Mes billets</span>
                <h1>Retrouver mes billets</h1>
                <p>
                  Saisissez le code de téléchargement affiché lors de votre commande. Il fonctionne dès que
                  l&apos;organisateur a validé votre paiement.
                </p>
              </div>
              <Card>
                <form className="card-body" onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }} noValidate>
                  <label htmlFor="access-code" className="field-label">
                    Code de téléchargement
                  </label>
                  <input
                    id="access-code"
                    className="code-input"
                    placeholder="XXXX-XXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    inputMode="text"
                    value={code}
                    onChange={(e) => {
                      setCode(normalizeInput(e.target.value));
                      setError(null);
                    }}
                    aria-invalid={error?.tone === "danger" || undefined}
                    aria-describedby={error ? "access-error" : undefined}
                  />
                  {error && (
                    <div className="callout" data-tone={error.tone} id="access-error" role="alert">
                      {error.tone === "warning" ? (
                        <Clock3 size={16} strokeWidth={2} aria-hidden="true" />
                      ) : (
                        <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
                      )}
                      <span>{error.message}</span>
                    </div>
                  )}
                  <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting || !code}>
                    {submitting ? (
                      <>
                        <span className="spinner" aria-hidden="true" /> Vérification…
                      </>
                    ) : (
                      "Afficher mes billets"
                    )}
                  </button>
                </form>
              </Card>
              <p className="text-secondary" style={{ marginTop: 20, fontSize: "var(--text-sm)" }}>
                Commande en cours de paiement ? <Link href="/success">Suivre ma commande</Link> · Pas encore de
                billets ? <Link href="/tickets">Voir la billetterie</Link>
              </p>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
