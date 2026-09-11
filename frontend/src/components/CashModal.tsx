"use client";

import { FormEvent, useMemo, useState } from "react";
import { Banknote, CheckCircle2, MessageCircle, X } from "lucide-react";
import { money, whatsappLink } from "@/lib/format";
import { apiFetch, extractId, isUnauthorized, ApiError } from "@/lib/api";
import { Order, OrderTicket, TicketCategory } from "@/lib/types";

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
  const [result, setResult] = useState<{
    reference: string;
    summary: string;
    detail: string;
    buyerName: string;
    buyerPhone: string;
    quantity: number;
    categoryName: string;
    tickets: OrderTicket[];
  } | null>(null);

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

      // Étape 3 : récupérer la commande avec ses tickets + QR codes (route
      // publique GET /orders/:id — génération déjà faite à l'étape 2, on ne
      // fait ici que relire le résultat pour l'afficher/le transmettre).
      const full = await apiFetch<Order>(`/orders/${orderId}`);

      setResult({
        reference: orderId,
        summary: `${money(amount)} reçus de ${name.trim()}.`,
        detail: `${calc.qty} × ${category.name} • Paiement espèces`,
        buyerName: name.trim(),
        buyerPhone: phone.trim(),
        quantity: calc.qty,
        categoryName: category.name,
        tickets: full.tickets,
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
                <X size={18} strokeWidth={2.4} />
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
            <div className="success-icon">
              <CheckCircle2 size={32} strokeWidth={2.2} />
            </div>
            <span className="section-kicker">Espèces encaissées</span>
            <h2>Tickets générés avec succès</h2>
            <p>{result.summary}</p>
            <div className="mini-ticket">
              <span className="cash-mark">
                <Banknote size={20} strokeWidth={2.2} />
              </span>
              <span>
                <small>RÉFÉRENCE</small>
                <b>#{result.reference}</b>
                <small>{result.detail}</small>
              </span>
            </div>

            {result.tickets.map((ticket, i) => (
              <div className="mini-ticket" key={ticket.code ?? i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ticket.qrCodeDataUrl} alt={`QR code ticket ${i + 1}`} width={56} height={56} />
                <div>
                  <span>TICKET {i + 1}</span>
                  <b>{ticket.code}</b>
                  <small>{result.categoryName}</small>
                </div>
              </div>
            ))}
            <p className="cash-result-note">
              Enregistre ou capture ces QR codes pour les joindre au message WhatsApp — le lien
              ci-dessous ouvre uniquement la conversation avec {result.buyerName}.
            </p>

            <div className="cash-result-actions">
              <a
                className="primary whatsapp-btn"
                href={whatsappLink(
                  result.buyerPhone,
                  `Bonjour ${result.buyerName}, voici votre ticket pour le Dîner-Gala 2026 (${result.quantity} × ${result.categoryName}). Référence #${result.reference}. Le QR code joint fera foi à l'entrée, merci de le conserver.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
              >
                <MessageCircle size={18} strokeWidth={2.2} /> Envoyer par WhatsApp
              </a>
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
