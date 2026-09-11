"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { apiFetch } from "@/lib/api";
import { Order } from "@/lib/types";

const PENDING_ORDER_KEY = "vedem-pending-order";
const POLL_INTERVAL_MS = 3000;
const SLOW_WARNING_MS = 45000;

function SuccessContent() {
  const params = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingTooLong, setWaitingTooLong] = useState(false);

  // Initialiseur paresseux de useState : Date.now() n'est évalué qu'au
  // premier rendu, jamais réévalué ensuite (contrairement au corps du composant).
  const [startedAt] = useState(() => Date.now());

  // L'orderId peut arriver par l'URL (retour Wave, si le backend le transmet)
  // ou avoir été sauvegardé avant la redirection (voir checkout/page.tsx).
  // sessionStorage n'est lu qu'une fois via le même mécanisme : ce n'est pas
  // une valeur réactive, inutile de la garder synchronisée en continu.
  const [storedOrderId] = useState(() =>
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_ORDER_KEY) : null
  );
  const orderId = params.get("orderId") || storedOrderId;
  // Wave redirige ici avec `payment=error` en cas d'échec/annulation du
  // checkout (voir errorUrl côté backend, payments.service.ts).
  const paymentFailed = params.get("payment") === "error";

  useEffect(() => {
    if (!orderId || paymentFailed) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const data = await apiFetch<Order>(`/orders/${orderId}`);
        if (cancelled) return;
        setOrder(data);
        if (data.status === "paid") {
          sessionStorage.removeItem(PENDING_ORDER_KEY);
          if (interval) clearInterval(interval);
        }
      } catch {
        if (!cancelled) setError("not-found");
      }
    }

    poll();
    interval = setInterval(() => {
      if (Date.now() - startedAt > SLOW_WARNING_MS) setWaitingTooLong(true);
      poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [orderId, startedAt, paymentFailed]);

  if (paymentFailed) {
    return (
      <section className="success-screen">
        <div className="success-card">
          <span className="section-kicker">Paiement annulé</span>
          <h1>Le paiement Wave n&apos;a pas abouti</h1>
          <p>
            Ta commande reste enregistrée mais aucun ticket n&apos;a été généré. Tu peux réessayer
            le paiement depuis la billetterie.
          </p>
          <Link href="/tickets" className="primary" style={{ display: "inline-block", textDecoration: "none" }}>
            Réessayer
          </Link>
        </div>
      </section>
    );
  }

  if (!orderId) {
    return (
      <section className="success-screen">
        <div className="success-card">
          <span className="section-kicker">Commande introuvable</span>
          <h1>On ne retrouve pas ta commande</h1>
          <p>Reprends la billetterie depuis le début pour recommencer un achat.</p>
          <Link href="/tickets" className="primary" style={{ display: "inline-block", textDecoration: "none" }}>
            Retour à la billetterie
          </Link>
        </div>
      </section>
    );
  }

  if (error === "not-found") {
    return (
      <section className="success-screen">
        <div className="success-card">
          <span className="section-kicker">Erreur</span>
          <h1>Impossible de retrouver cette commande</h1>
          <p>Contacte l&apos;administrateur avec la référence de ta commande si le paiement a bien été effectué.</p>
        </div>
      </section>
    );
  }

  if (!order || order.status !== "paid") {
    return (
      <section className="success-screen">
        <div className="success-card">
          <span className="section-kicker">Paiement en cours</span>
          <h1>On attend la confirmation…</h1>
          <p>
            Ta commande est enregistrée. Cette page se met à jour automatiquement dès que le
            paiement est confirmé.
          </p>
          {waitingTooLong && (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              Ça prend plus de temps que prévu. Si tu as bien payé, contacte l&apos;organisateur avec
              ta référence : <b>{orderId}</b>.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="success-screen">
      <div className="success-card">
        <div className="success-icon">✓</div>
        <span className="section-kicker">Paiement confirmé</span>
        <h1>Vos tickets sont prêts !</h1>
        <p>
          La commande <b>#{order.id}</b> a été enregistrée avec succès.
        </p>
        {order.tickets.map((ticket, i) => (
          <div className="mini-ticket" key={ticket.code ?? i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ticket.qrCodeDataUrl} alt={`QR code ticket ${i + 1}`} width={56} height={56} />
            <div>
              <span>DÎNER-GALA 2026</span>
              <b>{ticket.code}</b>
              <small>12 septembre • Marcory</small>
            </div>
          </div>
        ))}
        <Link href="/" className="text-link">
          Retour à l&apos;accueil
        </Link>
      </div>
    </section>
  );
}

export default function SuccessPage() {
  return (
    <>
      <Topbar />
      <Suspense fallback={null}>
        <SuccessContent />
      </Suspense>
    </>
  );
}
