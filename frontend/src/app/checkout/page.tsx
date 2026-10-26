"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, Info, Lock, MapPin, ShoppingBag } from "lucide-react";
import SiteHeader from "@/components/public/SiteHeader";
import SiteFooter from "@/components/public/SiteFooter";
import PurchaseHeader from "@/components/public/PurchaseHeader";
import { Card, SectionHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import PaymentSummary from "@/components/ui/PaymentSummary";
import Skeleton from "@/components/ui/Skeleton";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { apiFetch, extractId, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import { saveLastOrder } from "@/lib/order-storage";
import { Order } from "@/lib/types";

type Field = "buyerName" | "buyerPhone" | "buyerEmail";
type Errors = Partial<Record<Field, string>>;

// Format tolérant : chiffres, espaces, +, tirets, points, parenthèses ; au
// moins 8 chiffres (numéros ivoiriens à 10 chiffres, ou format international).
const PHONE_PATTERN = /^\+?[\d\s.\-()]{8,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: Record<Field, string>): Errors {
  const errors: Errors = {};
  if (values.buyerName.trim().length < 2) errors.buyerName = "Indiquez votre nom et prénom.";
  const digits = values.buyerPhone.replace(/\D/g, "");
  if (!values.buyerPhone.trim()) errors.buyerPhone = "Indiquez un numéro de téléphone pour vous joindre.";
  else if (!PHONE_PATTERN.test(values.buyerPhone.trim()) || digits.length < 8)
    errors.buyerPhone = "Numéro invalide — exemple : 07 00 00 00 00.";
  if (values.buyerEmail.trim() && !EMAIL_PATTERN.test(values.buyerEmail.trim()))
    errors.buyerEmail = "Adresse e-mail invalide.";
  return errors;
}

// Seul Wave est proposé au public : le paiement en espèces se fait
// exclusivement en personne auprès de l'administrateur, qui génère le
// ticket depuis le dashboard (voir CashModal) — il n'existe volontairement
// aucune trace de ce mode de paiement dans le parcours d'achat public.
export default function CheckoutPage() {
  const { items, total, waveFees, totalQuantity, loading, eventDate, eventLocation, reset } = useCart();
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Record<Field, string>>({ buyerName: "", buyerPhone: "", buyerEmail: "" });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validate(values);
  const visibleError = (field: Field) => ((submitted || touched[field]) && errors[field]) || null;

  function update(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (items.length === 0) return;
    const firstInvalid = (Object.keys(errors) as Field[])[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      // POST /orders — public, calcule le montant et les frais côté serveur et vérifie le stock.
      const order = await apiFetch<Order>("/orders", {
        method: "POST",
        body: {
          buyerName: values.buyerName.trim(),
          buyerPhone: values.buyerPhone.trim(),
          buyerEmail: values.buyerEmail.trim() || undefined,
          items: items.map((line) => ({ ticketCategoryId: line.category.id, quantity: line.quantity })),
        },
      });
      const orderId = extractId(order);
      // Le code de téléchargement n'est renvoyé qu'ici (création) : on le garde
      // pour l'afficher sur /success et pré-remplir /mes-tickets.
      saveLastOrder(orderId, order.accessCode);
      reset();
      router.push(`/success?orderId=${orderId}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Une erreur est survenue, réessayez dans un instant.";
      setSubmitError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  const empty = !loading && items.length === 0 && !submitting;

  return (
    <div className="public-page">
      <SiteHeader hideCta />
      <PurchaseHeader current={1} backHref="/tickets" backLabel="Billets" />
      <main id="contenu" className="container">
        <div className="flow-title">
          <span className="eyebrow">Coordonnées</span>
          <h1>À qui remettre les billets ?</h1>
          <p>Ces informations figurent sur vos billets et permettent à l&apos;organisateur de vous joindre.</p>
        </div>

        {empty ? (
          <Card>
            <EmptyState
              icon={ShoppingBag}
              title="Votre panier est vide"
              description="Choisissez d'abord vos billets pour passer commande."
              action={
                <Link href="/tickets" className="btn btn-primary">
                  Choisir mes billets
                </Link>
              }
            />
          </Card>
        ) : (
          <form className="flow-grid" onSubmit={handleSubmit} noValidate>
            <Card>
              <div className="card-body">
                <div className="form-section">
                  <h2 className="form-section-title">
                    <span className="step-index" aria-hidden="true">
                      1
                    </span>
                    Vos informations
                  </h2>
                  <div className="form-grid cols-2">
                    <FormField id="buyerName" label="Nom et prénom" error={visibleError("buyerName")} className="span-2">
                      <input
                        className="input input-lg"
                        autoComplete="name"
                        placeholder="Ex. Awa Koné"
                        value={values.buyerName}
                        onChange={(e) => update("buyerName", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, buyerName: true }))}
                        required
                      />
                    </FormField>
                    <FormField
                      id="buyerPhone"
                      label="Téléphone"
                      hint="Numéro utilisé pour votre paiement Wave, de préférence."
                      error={visibleError("buyerPhone")}
                    >
                      <input
                        className="input input-lg"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="07 00 00 00 00"
                        value={values.buyerPhone}
                        onChange={(e) => update("buyerPhone", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, buyerPhone: true }))}
                        required
                      />
                    </FormField>
                    <FormField id="buyerEmail" label="E-mail" optional error={visibleError("buyerEmail")}>
                      <input
                        className="input input-lg"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="nom@exemple.com"
                        value={values.buyerEmail}
                        onChange={(e) => update("buyerEmail", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, buyerEmail: true }))}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="form-section">
                  <h2 className="form-section-title">
                    <span className="step-index" aria-hidden="true">
                      2
                    </span>
                    Moyen de paiement
                  </h2>
                  <div className="pay-method">
                    <span className="pay-method-mark" aria-hidden="true">
                      W
                    </span>
                    <div>
                      <b>Wave</b>
                      <small>Paiement par lien Wave, puis envoi de la capture d&apos;écran</small>
                    </div>
                    <Check size={20} strokeWidth={2.4} aria-hidden="true" />
                  </div>
                  <div className="callout" data-tone="info" style={{ marginTop: 16 }}>
                    <Info size={16} strokeWidth={2} aria-hidden="true" />
                    <span>
                      À l&apos;étape suivante, vous ouvrirez Wave pour payer puis enverrez la capture de confirmation.
                      L&apos;organisateur vérifie chaque paiement avant d&apos;activer vos billets.
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <aside className="flow-aside" aria-label="Récapitulatif de la commande">
              <Card>
                <SectionHeader title="Récapitulatif" description={`${totalQuantity} billet${totalQuantity > 1 ? "s" : ""}`} />
                <div className="card-body">
                  {loading ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <Skeleton height={14} />
                      <Skeleton height={14} width="70%" />
                      <Skeleton height={22} width="50%" />
                    </div>
                  ) : (
                    <PaymentSummary
                      lines={items.map((line) => ({
                        key: line.category.id,
                        name: line.category.name,
                        quantity: line.quantity,
                        unitPrice: line.category.price,
                      }))}
                      waveFees={waveFees}
                      totalLabel="À payer via Wave"
                      feesNote="à la charge de l'acheteur"
                    />
                  )}
                  <div className="event-recap">
                    <div>
                      <CalendarDays size={15} strokeWidth={2} aria-hidden="true" />
                      {eventDate}
                    </div>
                    <div>
                      <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                      {eventLocation}
                    </div>
                  </div>
                  {submitError && (
                    <div className="callout" data-tone="danger" role="alert">
                      <Info size={16} strokeWidth={2} aria-hidden="true" />
                      <span>{submitError}</span>
                    </div>
                  )}
                  <button
                    className="btn btn-primary btn-lg btn-block"
                    type="submit"
                    disabled={submitting || items.length === 0}
                    data-loading={submitting || undefined}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner" aria-hidden="true" /> Création de la commande…
                      </>
                    ) : (
                      <>
                        Passer au paiement · {money(total + waveFees)}
                        <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
                      </>
                    )}
                  </button>
                  <p className="trust-note">
                    <Lock size={13} strokeWidth={2} aria-hidden="true" />
                    Montant définitif calculé par le serveur. Vos coordonnées ne servent qu&apos;à cette commande.
                  </p>
                </div>
              </Card>
            </aside>
          </form>
        )}
      </main>
      <SiteFooter eventDate={eventDate} eventLocation={eventLocation} />
    </div>
  );
}
