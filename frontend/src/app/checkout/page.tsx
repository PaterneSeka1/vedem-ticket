"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { useCart } from "@/context/CartContext";
import { money } from "@/lib/format";
import { apiFetch, extractId, ApiError } from "@/lib/api";
import { Order } from "@/lib/types";

const PENDING_ORDER_KEY = "vedem-pending-order";

export default function CheckoutPage() {
  const router = useRouter();
  const { selectedCategory, selectedQuantity, total } = useCart();
  const [payMethod, setPayMethod] = useState<"wave" | "cash">("wave");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedCategory || selectedQuantity === 0) return;
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
          ticketCategoryId: selectedCategory.id,
          quantity: selectedQuantity,
        },
      });
      const orderId = extractId(order);
      sessionStorage.setItem(PENDING_ORDER_KEY, orderId);

      if (payMethod === "wave") {
        // POST /payments/wave/checkout — renvoie checkoutUrl, redirection externe.
        // La commande passe "paid" de façon async via webhook Wave, pas ici.
        const checkout = await apiFetch<{ checkoutUrl: string }>("/payments/wave/checkout", {
          method: "POST",
          body: { orderId },
        });
        window.location.href = checkout.checkoutUrl;
      } else {
        // Espèces : la commande reste en attente jusqu'à confirmation admin
        // (POST /payments/cash/{orderId} côté dashboard).
        router.push(`/success?orderId=${orderId}`);
      }
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue, réessaie dans un instant."
      );
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

            <h3 className="payment-title">Choisissez votre mode de paiement</h3>
            <label className={`payment-option${payMethod === "wave" ? " selected" : ""}`}>
              <input
                type="radio"
                name="pay"
                value="wave"
                checked={payMethod === "wave"}
                onChange={() => setPayMethod("wave")}
              />
              <span className="wave-mark">W</span>
              <span>
                <b>Wave Business</b>
                <small>Confirmation sécurisée et immédiate</small>
              </span>
              <i>✓</i>
            </label>

            <div className="cash-note">
              <b>Vous préférez payer en espèces ?</b>Remettez directement le montant à
              l&apos;administrateur unique. Il enregistrera l&apos;encaissement depuis son espace
              et générera immédiatement vos tickets.
            </div>
            <label className={`payment-option${payMethod === "cash" ? " selected" : ""}`}>
              <input
                type="radio"
                name="pay"
                value="cash"
                checked={payMethod === "cash"}
                onChange={() => setPayMethod("cash")}
              />
              <span className="wave-mark">₣</span>
              <span>
                <b>Espèces</b>
                <small>À régler sur place auprès de l&apos;administrateur</small>
              </span>
              <i>✓</i>
            </label>

            {submitError && <div className="cash-error">{submitError}</div>}

            <button className="primary pay-button" type="submit" disabled={submitting}>
              {submitting ? "Traitement…" : payMethod === "cash" ? "Confirmer la réservation" : "Payer avec Wave"}{" "}
              <span>{money(total)}</span>
            </button>
            <p className="secure">▣ Paiement sécurisé • Vos données restent confidentielles</p>
          </form>

          <aside className="order-card">
            <span>VOTRE COMMANDE</span>
            <div>
              {selectedCategory && selectedQuantity > 0 && (
                <div className="order-line">
                  <span>
                    <b>{selectedCategory.name}</b>
                    <small>
                      {selectedQuantity} × {money(selectedCategory.price)}
                    </small>
                  </span>
                  <b>{money(total)}</b>
                </div>
              )}
            </div>
            <hr />
            <div className="order-total">
              <span>Total</span>
              <b>{money(total)}</b>
            </div>
            <small>
              Samedi 12 septembre 2026
              <br />
              Foyer des Jeunes de Marcory
            </small>
          </aside>
        </div>
      </section>
    </>
  );
}
