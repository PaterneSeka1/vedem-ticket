"use client";

import { ChangeEvent, FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileImage,
  ImageUp,
  KeyRound,
  SearchX,
  X,
} from "lucide-react";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";
import { Card, SectionHeader } from "@/components/ui/Card";
import CopyButton from "@/components/ui/CopyButton";
import EmptyState from "@/components/ui/EmptyState";
import PaymentSummary from "@/components/ui/PaymentSummary";
import Skeleton from "@/components/ui/Skeleton";
import { Timeline, TimelineStep } from "@/components/ui/Steps";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { ApiError, apiFetch, apiUpload } from "@/lib/api";
import { formatAccessCode, money, shortRef } from "@/lib/format";
import { getLastAccessCode, getLastOrderId } from "@/lib/order-storage";
import { Order, WaveCheckout } from "@/lib/types";

// La confirmation est manuelle (l'admin vérifie la capture) : inutile de
// poller très souvent. Un retour sur l'onglet (après l'app Wave) relance
// aussi une vérification immédiate.
const POLL_INTERVAL_MS = 10000;
// Aligné sur la limite côté backend (payment-proof.util.ts).
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ACCEPTED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Suivi d'une commande : paiement par lien Wave, envoi de la capture comme
 * preuve, attente de la validation par l'admin. Les billets ne s'affichent
 * pas ici : ils se téléchargent sur /mes-tickets avec le code remis à la
 * commande, actif seulement une fois la transaction validée.
 */
function SuccessContent() {
  const params = useSearchParams();
  const toast = useToast();
  const { allPublicCategories } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
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
    } catch (err) {
      // Une coupure réseau ponctuelle ne doit pas afficher « introuvable » :
      // seul un 4xx de l'API signifie que la commande n'existe pas.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) setNotFound(true);
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
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderId, isPaid, loadOrder]);

  useEffect(() => {
    if (isPaid && !notifiedPaidRef.current) {
      notifiedPaidRef.current = true;
      toast.success("Paiement validé — votre code de téléchargement est actif.");
    }
  }, [isPaid, toast]);

  if (!orderId || notFound) {
    return (
      <div className="container status-page">
        <div className="status-layout single">
          <Card>
            <EmptyState
              icon={SearchX}
              title={notFound ? "Commande introuvable" : "Aucune commande sur cet appareil"}
              description={
                notFound
                  ? `Vérifiez le lien de votre commande ou contactez l'organisateur avec la référence ${shortRef(orderId ?? "")}.`
                  : "Utilisez le lien reçu lors de votre commande, ou reprenez la billetterie depuis le début."
              }
              action={
                <Link href="/tickets" className="btn btn-primary">
                  Aller à la billetterie
                </Link>
              }
            />
          </Card>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container status-page" role="status" aria-label="Chargement de la commande">
        <div className="status-layout">
          <div style={{ display: "grid", gap: 16 }}>
            <Skeleton width="45%" height={36} />
            <Skeleton width="70%" height={16} />
            <Skeleton height={320} radius={16} />
          </div>
          <Skeleton height={260} radius={16} />
        </div>
      </div>
    );
  }

  const categoryName = (id: string) => allPublicCategories.find((c) => c.id === id)?.name ?? "Billet";
  const summaryLines = order.items.map((item) => {
    const category = allPublicCategories.find((c) => c.id === item.ticketCategoryId);
    return {
      key: item.ticketCategoryId,
      name: categoryName(item.ticketCategoryId),
      quantity: item.quantity,
      unitPrice: category?.price ?? 0,
    };
  });
  const pricesKnown = order.items.every((item) => allPublicCategories.some((c) => c.id === item.ticketCategoryId));
  const waveStatus = order.payment?.method === "WAVE" ? order.payment.status : null;

  return (
    <div className="container status-page">
      <div className="status-layout">
        <div>
          <OrderHero order={order} waveStatus={waveStatus} />
          <Card>
            <div className="card-body">
              <Timeline label="Avancement de votre commande" steps={buildSteps(order, waveStatus, loadOrder)} />
            </div>
          </Card>
        </div>

        <aside style={{ display: "grid", gap: 16 }} aria-label="Votre commande">
          <AccessCodeCard accessCode={accessCode} active={isPaid} />
          <Card>
            <SectionHeader title="Votre commande" />
            <div className="card-body" style={{ display: "grid", gap: 16 }}>
              {pricesKnown ? (
                <PaymentSummary
                  lines={summaryLines}
                  waveFees={order.waveFees ?? 0}
                  totalLabel={isPaid ? "Total réglé" : "Total à payer"}
                  // Montant figé par le serveur à la création : fait foi même si
                  // un prix de catégorie a changé depuis.
                  totalOverride={money((order.totalAmount ?? 0) + (order.waveFees ?? 0))}
                />
              ) : (
                <PaymentSummary
                  lines={[]}
                  totalLabel="Total"
                  totalOverride={money((order.totalAmount ?? 0) + (order.waveFees ?? 0))}
                />
              )}
              <div className="order-ref-line">
                Référence <span className="code-chip">{shortRef(order.id)}</span>
                <CopyButton value={order.id} label="Copier la référence complète" />
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function OrderHero({ order, waveStatus }: { order: Order; waveStatus: string | null }) {
  if (order.status === "paid") {
    return (
      <div className="status-hero">
        <span className="status-icon" data-tone="success" aria-hidden="true">
          <CheckCircle2 size={24} strokeWidth={2} />
        </span>
        <span className="eyebrow">Paiement validé</span>
        <h1>Vos billets sont prêts</h1>
        <p>L&apos;organisateur a validé votre paiement. Votre code de téléchargement est désormais actif.</p>
        <div>
          <Link href="/mes-tickets" className="btn btn-primary btn-lg">
            Télécharger mes billets <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }
  if (waveStatus === "pending") {
    return (
      <div className="status-hero">
        <span className="status-icon" data-tone="warning" aria-hidden="true">
          <Clock3 size={24} strokeWidth={2} />
        </span>
        <span className="eyebrow">En attente de vérification</span>
        <h1>Capture reçue, merci</h1>
        <p>
          Votre capture ne vaut pas encore confirmation : l&apos;organisateur vérifie le paiement sur son compte Wave.
          Vous pouvez fermer cette page et revenir plus tard — elle se met à jour automatiquement.
        </p>
      </div>
    );
  }
  return (
    <div className="status-hero">
      <span className="status-icon" data-tone={waveStatus === "failed" ? "danger" : "brand"} aria-hidden="true">
        {waveStatus === "failed" ? <AlertTriangle size={24} strokeWidth={2} /> : <CheckCircle2 size={24} strokeWidth={2} />}
      </span>
      <span className="eyebrow">{waveStatus === "failed" ? "Paiement non validé" : "Commande créée"}</span>
      <h1>{waveStatus === "failed" ? "Une nouvelle capture est nécessaire" : "Finalisez votre paiement"}</h1>
      <p>
        {waveStatus === "failed"
          ? "Votre précédente capture n'a pas été validée par l'organisateur. Vérifiez le montant payé et envoyez une nouvelle capture."
          : "Payez avec Wave, puis envoyez la capture d'écran de la confirmation. Vos billets seront disponibles après vérification."}
      </p>
    </div>
  );
}

function buildSteps(order: Order, waveStatus: string | null, onUploaded: () => Promise<void>): TimelineStep[] {
  const paid = order.status === "paid";
  const proofPending = waveStatus === "pending";
  const rejected = waveStatus === "failed";
  const awaitingPayment = !paid && !proofPending;

  return [
    { title: "Commande créée", text: "Vos billets sont réservés à votre nom, en attente de paiement.", state: "done" },
    {
      title: "Paiement Wave",
      state: awaitingPayment ? "current" : "done",
      text: awaitingPayment ? "Ouvrez Wave : le montant est pré-rempli." : "Paiement effectué depuis Wave.",
      body: awaitingPayment ? <WavePayment orderId={order.id} /> : undefined,
    },
    {
      title: "Envoi de la capture",
      state: rejected ? "error" : awaitingPayment ? "current" : "done",
      text: awaitingPayment
        ? "Capture d'écran de l'écran de confirmation Wave (JPEG, PNG ou WebP, 5 Mo max)."
        : "Capture transmise à l'organisateur.",
      body: awaitingPayment ? (
        <ProofUploadForm orderId={order.id} onUploaded={onUploaded} />
      ) : proofPending ? (
        <details>
          <summary className="link-button" style={{ cursor: "pointer", fontSize: "var(--text-sm)" }}>
            Mauvaise capture ? En envoyer une autre
          </summary>
          <div style={{ marginTop: 12 }}>
            <ProofUploadForm orderId={order.id} onUploaded={onUploaded} replacing />
          </div>
        </details>
      ) : undefined,
    },
    {
      title: "Vérification par l'organisateur",
      state: paid ? "done" : proofPending ? "current" : "upcoming",
      text: paid
        ? "Paiement confirmé."
        : "Contrôle manuel du paiement reçu sur le compte Wave de l'organisateur.",
    },
    {
      title: "Billets disponibles",
      state: paid ? "done" : "upcoming",
      text: paid ? (
        <>
          Rendez-vous sur <Link href="/mes-tickets">Mes billets</Link> avec votre code.
        </>
      ) : (
        "Votre code de téléchargement s'activera à cette étape."
      ),
    },
  ];
}

function AccessCodeCard({ accessCode, active }: { accessCode: string | null; active: boolean }) {
  return (
    <section className="access-code" data-active={active || undefined} aria-labelledby="access-code-title">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <KeyRound size={16} strokeWidth={2} aria-hidden="true" />
        <h2 id="access-code-title" className="card-title" style={{ fontSize: "var(--text-base)" }}>
          Code de téléchargement
        </h2>
      </div>
      {accessCode ? (
        <>
          <div className="access-code-value">
            <strong>{formatAccessCode(accessCode)}</strong>
            <CopyButton value={formatAccessCode(accessCode)} label="Copier le code" />
          </div>
          <p>
            {active
              ? "Actif : saisissez-le sur la page Mes billets pour afficher et imprimer vos billets."
              : "Notez-le précieusement. Il deviendra actif dès que l'organisateur aura validé votre paiement."}
          </p>
          {active && (
            <Link href="/mes-tickets" className="btn btn-primary btn-block">
              Ouvrir Mes billets
            </Link>
          )}
        </>
      ) : (
        <p>
          Votre code vous a été affiché lors de la commande. Si vous ne l&apos;avez plus, contactez l&apos;organisateur
          avec votre référence de commande.
        </p>
      )}
    </section>
  );
}

function WavePayment({ orderId }: { orderId: string }) {
  const [checkout, setCheckout] = useState<WaveCheckout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<WaveCheckout>("/payments/wave/checkout", { method: "POST", body: { orderId } })
      .then((res) => {
        if (!cancelled) setCheckout(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Lien Wave indisponible, réessayez.");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (error) {
    return (
      <div className="callout" data-tone="danger" role="alert">
        <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
        <span>{error}</span>
      </div>
    );
  }
  if (!checkout) {
    return (
      <div style={{ display: "grid", gap: 10 }} role="status" aria-label="Préparation du lien Wave">
        <Skeleton height={64} radius={12} />
        <Skeleton height={48} width={220} radius={12} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="amount-due">
        <span>Montant à payer</span>
        <strong>{money(checkout.amount)}</strong>
        {checkout.fees > 0 && (
          <small>
            {money(checkout.ticketsAmount)} de billets + {money(checkout.fees)} de frais Wave
          </small>
        )}
      </div>
      <div>
        <a className="btn btn-primary btn-lg" href={checkout.paymentUrl} target="_blank" rel="noopener noreferrer">
          <span className="method-mark wave" aria-hidden="true">
            W
          </span>
          Payer avec Wave
          <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">(s&apos;ouvre dans un nouvel onglet)</span>
        </a>
      </div>
    </div>
  );
}

function ProofUploadForm({
  orderId,
  onUploaded,
  replacing = false,
}: {
  orderId: string;
  onUploaded: () => Promise<void>;
  replacing?: boolean;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(selected: File | null) {
    setError(null);
    if (selected && !ACCEPTED_PROOF_TYPES.includes(selected.type)) {
      setError("Format non pris en charge : envoyez une image JPEG, PNG ou WebP.");
      return;
    }
    if (selected && selected.size > MAX_PROOF_BYTES) {
      setError("Image trop volumineuse (5 Mo maximum).");
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
      toast.success("Capture envoyée — en attente de vérification.");
      setFile(null);
      setPreviewUrl(null);
      await onUploaded();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Envoi impossible, réessayez dans un instant.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputId = `proof-${replacing ? "replace" : "upload"}`;

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {file && previewUrl ? (
        <div className="dropzone-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Aperçu de la capture sélectionnée" />
          <div>
            <b className="truncate">{file.name}</b>
            <small>{(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} Mo</small>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => selectFile(null)}
            aria-label="Retirer la capture"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <label
          className="dropzone"
          htmlFor={inputId}
          data-dragging={dragging || undefined}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            selectFile(event.dataTransfer.files?.[0] ?? null);
          }}
        >
          <input
            id={inputId}
            type="file"
            accept={ACCEPTED_PROOF_TYPES.join(",")}
            onChange={(e: ChangeEvent<HTMLInputElement>) => selectFile(e.target.files?.[0] ?? null)}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          <span className="dropzone-icon" aria-hidden="true">
            <ImageUp size={18} strokeWidth={2} />
          </span>
          <b>Choisir la capture d&apos;écran</b>
          <small>ou glissez-la ici · JPEG, PNG, WebP · 5 Mo max</small>
        </label>
      )}
      {error && (
        <p className="field-error" id={`${inputId}-error`} role="alert">
          <AlertTriangle size={13} strokeWidth={2.2} aria-hidden="true" /> {error}
        </p>
      )}
      <div>
        <button className="btn btn-primary" type="submit" disabled={!file || submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" /> Envoi…
            </>
          ) : (
            <>
              <FileImage size={16} strokeWidth={2} aria-hidden="true" />
              {replacing ? "Remplacer la capture" : "Envoyer la capture"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function SuccessPage() {
  return (
    <div className="public-page">
      <SiteHeader />
      <main id="contenu">
        <Suspense fallback={null}>
          <SuccessContent />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
