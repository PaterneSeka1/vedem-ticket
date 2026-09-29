"use client";

import { ChangeEvent, FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Upload } from "lucide-react";
import Topbar from "@/components/Topbar";
import { ApiError, apiFetch, apiUpload } from "@/lib/api";
import { formatAccessCode, money } from "@/lib/format";
import { getLastAccessCode, getLastOrderId } from "@/lib/order-storage";
import { useToast } from "@/context/ToastContext";
import { Order } from "@/lib/types";

// La confirmation est manuelle (l'admin vérifie la capture) : elle peut
// prendre du temps, inutile de poller aussi souvent qu'avec l'ancien webhook.
const POLL_INTERVAL_MS = 10000;
// Aligné sur la limite côté backend (payment-proof.util.ts).
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Suivi d'une commande : paiement par lien Wave, envoi de la capture comme
 * preuve, attente de la validation par l'admin. Les tickets ne s'affichent
 * pas ici : ils se téléchargent sur /mes-tickets avec le code remis à la
 * commande, actif seulement une fois la transaction validée.
 */
function SuccessContent() {
  const params = useSearchParams();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notifiedPaidRef = useRef(false);

  // Lu une seule fois (initialiseur paresseux) : pas une valeur réactive.
  const [storedOrderId] = useState(() => (typeof window !== "undefined" ? getLastOrderId() : null));
  const orderId = params.get("orderId") || storedOrderId;
  // Le code n'est renvoyé par l'API qu'à la création de la commande : il n'est
  // connu ici que s'il a été gardé sur cet appareil (voir checkout/page.tsx).
  const [accessCode] = useState(() => (typeof window !== "undefined" ? getLastAccessCode(orderId) : null));

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setOrder(await apiFetch<Order>(`/orders/${orderId}`));
    } catch {
      setError("not-found");
    }
  }, [orderId]);

  const isPaid = order?.status === "paid";

  useEffect(() => {
    if (!orderId || isPaid) return;
    let cancelled = false;
    const poll = () => {
      if (!cancelled) void loadOrder();
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId, isPaid, loadOrder]);

  useEffect(() => {
    if (isPaid && !notifiedPaidRef.current) {
      notifiedPaidRef.current = true;
      toast.success("Transaction validée — ton code de téléchargement est actif !");
    }
  }, [isPaid, toast]);

  if (!orderId) {
    return (
      <section className="success-screen">
        <div className="success-card">
          <span className="section-kicker">Commande introuvable</span>
          <h1>On ne retrouve pas ta commande</h1>
          <p>
            Aucune commande n&apos;est enregistrée sur cet appareil. Utilise le lien de ta commande, ou
            reprends la billetterie depuis le début.
          </p>
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
          <p>Contacte l&apos;organisateur avec la référence de ta commande : <b>{orderId}</b>.</p>
        </div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="success-screen">
        <div className="success-card">
          <p>Chargement de ta commande…</p>
        </div>
      </section>
    );
  }

  if (isPaid) {
    return (
      <section className="success-screen">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <span className="section-kicker">Transaction validée</span>
          <h1>Vos tickets sont prêts !</h1>
          <p>Ton code de téléchargement est désormais actif.</p>
          <AccessCodeBox accessCode={accessCode} active />
          <Link href="/mes-tickets" className="primary proof-wave-link">
            Télécharger mes tickets
          </Link>
        </div>
      </section>
    );
  }

  const paymentStatus = order.payment?.method === "WAVE" ? order.payment.status : null;

  return (
    <section className="success-screen">
      <div className="success-card">
        {paymentStatus === "pending" ? (
          <>
            <span className="section-kicker">Paiement en attente de confirmation</span>
            <h1>Capture reçue, merci !</h1>
            <p>
              L&apos;organisateur vérifie ton paiement. Dès qu&apos;il l&apos;aura validé, ton code
              de téléchargement deviendra actif — tu peux fermer cette page et revenir plus tard
              via « Mes tickets ».
            </p>
            <details className="proof-resend">
              <summary>Tu t&apos;es trompé de capture ? En envoyer une autre</summary>
              <ProofUploadForm orderId={order.id} onUploaded={loadOrder} />
            </details>
            {/* Affiché seulement une fois la capture envoyée : un paiement Wave
                `pending` n'existe qu'après l'envoi de la preuve. */}
            <AccessCodeBox accessCode={accessCode} active={false} />
          </>
        ) : (
          <>
            <span className="section-kicker">Étape 3 sur 3 — Paiement</span>
            <h1>Paie avec Wave</h1>
            {paymentStatus === "failed" && (
              <p className="proof-rejected">
                Ta précédente capture n&apos;a pas été validée par l&apos;organisateur. Vérifie le montant
                payé et envoie une nouvelle capture.
              </p>
            )}
            <ol className="proof-steps">
              <li>
                <b>Paie {order.totalAmount !== undefined ? money(order.totalAmount) : ""} via Wave</b>
                <WavePayButton orderId={order.id} />
              </li>
              <li>
                <b>Fais une capture d&apos;écran de la confirmation Wave et envoie-la ici</b>
                <ProofUploadForm orderId={order.id} onUploaded={loadOrder} />
              </li>
            </ol>
          </>
        )}

        <p className="order-ref">
          Référence de commande : <b>{order.id}</b>
        </p>
      </div>
    </section>
  );
}

/**
 * Code de téléchargement + lien de la page où l'utiliser. Sans code connu sur
 * cet appareil (stockage effacé, autre appareil), on renvoie vers
 * l'organisateur, qui le retrouve depuis le dashboard.
 */
function AccessCodeBox({ accessCode, active }: { accessCode: string | null; active: boolean }) {
  const [pageUrl] = useState(() =>
    typeof window !== "undefined" ? `${window.location.origin}/mes-tickets` : "/mes-tickets",
  );

  if (!accessCode) {
    return (
      <div className="access-code-box">
        <p>
          Ton code de téléchargement t&apos;a été affiché à la commande. Si tu ne l&apos;as plus,
          contacte l&apos;organisateur avec ta référence de commande.
        </p>
      </div>
    );
  }

  return (
    <div className="access-code-box">
      <span>Ton code de téléchargement</span>
      <strong>{formatAccessCode(accessCode)}</strong>
      <p>
        {active
          ? "Saisis-le sur la page ci-dessous pour télécharger tes tickets, maintenant ou plus tard :"
          : "Note-le bien, avec le lien ci-dessous : il te permettra de télécharger tes tickets dès que l'organisateur aura validé ta transaction. Avant, il ne fonctionne pas."}
      </p>
      <Link href="/mes-tickets">{pageUrl}</Link>
    </div>
  );
}

function WavePayButton({ orderId }: { orderId: string }) {
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ paymentUrl: string }>("/payments/wave/checkout", { method: "POST", body: { orderId } })
      .then((res) => {
        if (!cancelled) setPaymentUrl(res.paymentUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Lien Wave indisponible.");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (error) return <div className="cash-error">{error}</div>;
  if (!paymentUrl) return <p className="proof-hint">Préparation du lien Wave…</p>;

  return (
    <a className="primary proof-wave-link" href={paymentUrl} target="_blank" rel="noopener noreferrer">
      <span className="wave-mark">W</span> Ouvrir Wave pour payer <ExternalLink size={16} strokeWidth={2.4} />
    </a>
  );
}

function ProofUploadForm({ orderId, onUploaded }: { orderId: string; onUploaded: () => Promise<void> }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setError(null);
    if (selected && !ACCEPTED_PROOF_TYPES.includes(selected.type)) {
      setError("Format non pris en charge : envoie une image JPEG, PNG ou WebP.");
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (selected && selected.size > MAX_PROOF_BYTES) {
      setError("Image trop volumineuse (5 Mo maximum).");
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(selected);
    setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiUpload(`/payments/wave/proof/${orderId}`, formData);
      toast.success("Capture envoyée — en attente de confirmation.");
      await onUploaded();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Envoi impossible, réessaie dans un instant.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="proof-upload" onSubmit={handleSubmit}>
      <label className="proof-drop">
        <input type="file" accept={ACCEPTED_PROOF_TYPES.join(",")} onChange={handleFileChange} />
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Aperçu de la capture du paiement" />
        ) : (
          <span>
            <Upload size={20} strokeWidth={2.2} />
            Choisir la capture d&apos;écran
          </span>
        )}
      </label>
      {error && <div className="cash-error">{error}</div>}
      <button className="primary" type="submit" disabled={!file || submitting}>
        {submitting ? "Envoi…" : "Envoyer la preuve de paiement"}
      </button>
    </form>
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
