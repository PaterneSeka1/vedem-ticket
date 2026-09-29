"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import TicketBundle from "@/components/TicketBundle";
import { ApiError, apiFetch } from "@/lib/api";
import { getLastAccessCode } from "@/lib/order-storage";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { Order } from "@/lib/types";

/**
 * Téléchargement des tickets avec le code remis à la commande. Le code n'est
 * actif qu'une fois la transaction validée par l'admin : avant, l'API le
 * refuse (403) et on affiche son message. Pré-rempli avec le code de la
 * dernière commande de cet appareil, s'il est connu.
 */
// Le code stocké ne change pas pendant la visite : pas d'abonnement réel.
const subscribeNoop = () => () => {};

export default function MesTicketsPage() {
  const { categories } = useCart();
  const toast = useToast();
  // Page pré-rendue : le code stocké n'est lu que côté client (null au rendu
  // serveur), sans décalage d'hydratation. Il sert de valeur par défaut tant
  // que l'acheteur n'a rien saisi.
  const storedCode = useSyncExternalStore(subscribeNoop, () => getLastAccessCode(), () => null);
  const [typedCode, setCode] = useState<string | null>(null);
  const code = typedCode ?? storedCode ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      // POST (et non GET) : le code ne doit pas apparaître dans les URLs.
      const result = await apiFetch<Order>("/orders/access", { method: "POST", body: { code } });
      setOrder(result);
      toast.success("Tickets retrouvés !");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 404
            ? "Code invalide. Vérifie-le et réessaie."
            : err.message
          : "Une erreur est survenue, réessaie dans un instant.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const categoryNameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <>
      <Topbar />
      <section className="success-screen">
        <div className="success-card">
          {order ? (
            <>
              <div className="success-icon">✓</div>
              <span className="section-kicker">Transaction validée</span>
              <h1>Vos tickets</h1>
              <p>
                Imprimez vos tickets ou enregistrez-les en PDF pour les garder — le QR code fera foi à
                l&apos;entrée.
              </p>
              <TicketBundle
                buyerName={order.buyerName}
                categoryNameById={categoryNameById}
                tickets={order.tickets ?? []}
              />
              <button type="button" className="text-link no-print" onClick={() => setOrder(null)}>
                Utiliser un autre code
              </button>
            </>
          ) : (
            <>
              <span className="section-kicker">Mes tickets</span>
              <h1>Télécharger mes tickets</h1>
              <p>
                Saisis le code de téléchargement reçu lors de ta commande. Il fonctionne dès que
                l&apos;organisateur a validé ta transaction.
              </p>
              <form className="access-form" onSubmit={handleSubmit}>
                <input
                  required
                  aria-label="Code de téléchargement"
                  placeholder="XXXX-XXXX"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={32}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                {error && <div className="cash-error">{error}</div>}
                <button className="primary" type="submit" disabled={submitting || !code.trim()}>
                  {submitting ? "Vérification…" : "Accéder à mes tickets"}
                </button>
              </form>
              <p className="order-ref">
                Pas encore de commande ? <Link href="/tickets">Voir la billetterie</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
