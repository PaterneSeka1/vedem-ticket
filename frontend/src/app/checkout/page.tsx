"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { Check, ShieldCheck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { money } from "@/lib/format";
import { apiFetch, extractId, ApiError } from "@/lib/api";
import { saveLastOrder } from "@/lib/order-storage";
import { Order } from "@/lib/types";
import { useToast } from "@/context/ToastContext";

// Seul Wave est proposé au public : le paiement en espèces se fait
// exclusivement en personne auprès de l'administrateur, qui génère le
// ticket depuis le dashboard (voir CashModal) — il n'existe volontairement
// aucune trace de ce mode de paiement dans le parcours d'achat public.
export default function CheckoutPage() {
  const { items, total, eventDate, eventLocation } = useCart();
  const router = useRouter();
  const toast = useToast();
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // POST /orders — public, calcule le montant côté serveur et vérifie le stock.
      const order = await apiFetch<Order>("/orders", {
        method: "POST",
        body: {
          buyerName,
          buyerPhone,
          buyerEmail: buyerEmail || undefined,
          items: items.map((line) => ({ ticketCategoryId: line.category.id, quantity: line.quantity })),
        },
      });
      const orderId = extractId(order);
      // Le code de téléchargement n'est renvoyé qu'ici (création) : on le garde
      // pour l'afficher sur /success et pré-remplir /mes-tickets.
      saveLastOrder(orderId, order.accessCode);

      // Le paiement se fait depuis l'espace commande (/success) : lien Wave,
      // puis envoi de la capture, puis confirmation manuelle par l'admin.
      router.push(`/success?orderId=${orderId}`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Une erreur est survenue, réessaie dans un instant.";
      setSubmitError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  return (
    <>
      <Topbar />
      <section className="flow-screen">
        <div className="flow-head">
          <Link href="/tickets" className="back">
            ← Retour
          </Link>
          <div>
            <span>ÉTAPE 2 SUR 3</span>
            <b>Informations & paiement</b>
          </div>
          <div className="step-dots">
            <i className="on"></i>
            <i className="on"></i>
            <i></i>
          </div>
        </div>

        <div className="checkout-grid">
          <form className="checkout-form" onSubmit={handleSubmit}>
            <div className="flow-title compact">
              <span className="section-kicker">Vos informations</span>
              <h1>À qui envoyons-nous les tickets ?</h1>
            </div>

            <div className="form-grid">
              <label className="full">
                Nom et prénom
                <input
                  required
                  placeholder="Votre nom complet"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                />
              </label>
              <label className="full">
                Numéro de téléphone
                <input
                  required
                  type="tel"
                  placeholder="07 00 00 00 00"
                  minLength={6}
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                />
              </label>
              <label className="full">
                Adresse e-mail <small>(facultatif)</small>
                <input
                  type="email"
                  placeholder="nom@exemple.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                />
              </label>
            </div>

            <h3 className="payment-title">Mode de paiement</h3>
            {/* Un seul mode de paiement public : pas de choix à faire, mais on
                garde la structure de grille de `.payment-option` (input caché
                + 3 colonnes) pour que le CSS existant s'applique tel quel. */}
            <label className="payment-option selected">
              <input type="radio" name="pay" value="wave" checked readOnly />
              <span className="wave-mark">W</span>
              <span>
                <b>Wave Business</b>
                <small>Paiement par lien Wave, puis envoi de la capture</small>
              </span>
              <i>
                <Check size={14} strokeWidth={3} />
              </i>
            </label>

            {submitError && <div className="cash-error">{submitError}</div>}

            <button className="primary pay-button" type="submit" disabled={submitting || items.length === 0}>
              {submitting ? "Traitement…" : "Continuer vers le paiement"} <span>{money(total)}</span>
            </button>
            <p className="secure">
              <ShieldCheck size={14} strokeWidth={2.4} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              Paiement sécurisé • Vos données restent confidentielles
            </p>
          </form>

          <aside className="order-card">
            <span>VOTRE COMMANDE</span>
            <div>
              {items.map((line) => (
                <div className="order-line" key={line.category.id}>
                  <span>
                    <b>{line.category.name}</b>
                    <small>
                      {line.quantity} × {money(line.category.price)}
                    </small>
                  </span>
                  <b>{money(line.category.price * line.quantity)}</b>
                </div>
              ))}
            </div>
            <hr />
            <div className="order-total">
              <span>Total</span>
              <b>{money(total)}</b>
            </div>
            <small>
              {eventDate}
              <br />
              {eventLocation}
            </small>
          </aside>
        </div>
      </section>
    </>
  );
}
