"use client";

import { FormEvent, useMemo, useState } from "react";
import { money } from "@/lib/format";
import { apiFetch, extractId, isUnauthorized, ApiError } from "@/lib/api";
import { Order, TicketCategory } from "@/lib/types";

interface CashModalProps {
  open: boolean;
  onClose: () => void;
  categories: TicketCategory[];
  token: string | null;
  onConfirmed: () => void;
  /** Session admin expirée/révoquée (401) pendant l'encaissement : déconnecte et renvoie vers le login. */
  onUnauthorized: () => void;
}

export default function CashModal({
  open,
  onClose,
  categories,
  token,
  onConfirmed,
  onUnauthorized,
}: CashModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // null = pas encore touché par l'utilisateur → on retombe sur la première
  // catégorie disponible (calculé au rendu, pas besoin d'effect pour ça).
  const [categoryIdOverride, setCategoryIdOverride] = useState<string | null>(null);
  const [amountOverride, setAmountOverride] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reference: string; summary: string; detail: string } | null>(
    null
  );

  const category = categories.find((c) => c.id === categoryIdOverride) ?? categories[0];
  const categoryId = category?.id ?? "";
  const amount = amountOverride ?? category?.price ?? 0;
  const calc = useMemo(() => {
    if (!category) return { qty: 0, remainder: 0 };
    const qty = Math.floor(amount / category.price);
    const remainder = amount % category.price;
    return { qty, remainder };
  }, [amount, category]);

  const errorMessage = !category
    ? ""
    : calc.remainder
    ? `Le montant doit être un multiple exact de ${money(category.price)}`
    : calc.qty < 1
    ? "Montant insuffisant pour générer un ticket"
    : "";

  function resetForm() {
    setName("");
    setPhone("");
    setCategoryIdOverride(null);
    setAmountOverride(null);
    setResult(null);
    setSubmitError(null);
  }

  function handleClose() {
    onClose();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category || calc.remainder || calc.qty < 1 || !token) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Étape 1 : créer la commande (comme un achat public classique).
      const order = await apiFetch<Order>("/orders", {
        method: "POST",
        body: {
          buyerName: name.trim(),
          buyerPhone: phone.trim(),
          ticketCategoryId: category.id,
          quantity: calc.qty,
        },
      });
      const orderId = extractId(order);

      // Étape 2 : confirmer le paiement espèces (admin) — pas de body attendu, juste orderId en path.
      await apiFetch(`/payments/cash/${orderId}`, { method: "POST", token });

      setResult({
        reference: orderId,
        summary: `${money(amount)} reçus de ${name.trim()}.`,
        detail: `${calc.qty} × ${category.name} • Paiement espèces`,
      });
      onConfirmed();
    } catch (err) {
      if (isUnauthorized(err)) {
        onUnauthorized();
        return;
      }
      setSubmitError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    resetForm();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-labelledby="cash-title">
      <div className="modal-card">
        {!result ? (
          <div>
            <div className="modal-head">
              <div>
                <span className="section-kicker">Encaissement manuel</span>
                <h2 id="cash-title">Générer des tickets en espèces</h2>
                <p>Réservé au compte administrateur unique.</p>
              </div>
              <button className="modal-close" aria-label="Fermer" onClick={handleClose} type="button">
                ×
              </button>
            </div>

            <form className="cash-form" onSubmit={handleSubmit}>
              <label>
                Nom et prénom
                <input
                  required
                  placeholder="Ex. Awa Koné"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Téléphone
                <input
                  required
                  type="tel"
                  minLength={6}
                  placeholder="07 00 00 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label>
                Type de ticket
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryIdOverride(e.target.value);
                    // Changer de catégorie réinitialise le montant sur son prix par défaut.
                    setAmountOverride(null);
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {money(c.price)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Montant reçu
                <input
                  required
                  type="number"
                  min={category?.price ?? 500}
                  step={category?.price ?? 500}
                  value={amount}
                  onChange={(e) => setAmountOverride(Number(e.target.value))}
                />
              </label>
              <div className="cash-calc">
                <span>
                  Nombre généré
                  <small>{category ? `${money(category.price)} par ticket` : ""}</small>
                </span>
                <b>
                  {calc.qty} ticket{calc.qty > 1 ? "s" : ""}
                </b>
              </div>
              <div className="cash-error">{errorMessage || submitError}</div>
              <button className="primary cash-submit" type="submit" disabled={submitting || !!errorMessage}>
                {submitting ? "Enregistrement…" : "Confirmer l'encaissement et générer"}
              </button>
            </form>
          </div>
        ) : (
          <div className="cash-result show">
            <div className="success-icon">✓</div>
            <span className="section-kicker">Espèces encaissées</span>
            <h2>Tickets générés avec succès</h2>
            <p>{result.summary}</p>
            <div className="mini-ticket">
              <span className="cash-mark">₣</span>
              <span>
                <small>RÉFÉRENCE</small>
                <b>#{result.reference}</b>
                <small>{result.detail}</small>
              </span>
            </div>
            <div className="cash-result-actions">
              <button className="primary" type="button" onClick={handleDone}>
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
