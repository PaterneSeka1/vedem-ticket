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

interface ResultLine {
  categoryName: string;
  quantity: number;
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
  // Une commande espèces peut porter sur plusieurs catégories différentes
  // (voir CLAUDE.md §4) : un sélecteur de quantité par catégorie, comme côté
  // achat public, remplace l'ancienne saisie "montant reçu" (qui ne se
  // généralise pas à un panier mixte : plusieurs combinaisons de catégories
  // peuvent totaliser le même montant).
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reference: string;
    summary: string;
    detail: string;
    buyerName: string;
    buyerPhone: string;
    lines: ResultLine[];
    categoryNameById: Record<string, string>;
    tickets: OrderTicket[];
  } | null>(null);

  function setQuantity(categoryId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [categoryId]: Math.max(0, qty) }));
  }

  const items = useMemo(
    () =>
      categories
        .map((category) => ({ category, quantity: quantities[category.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [categories, quantities],
  );
  const totalQuantity = items.reduce((sum, line) => sum + line.quantity, 0);
  const totalAmount = items.reduce((sum, line) => sum + line.category.price * line.quantity, 0);

  const errorMessage = totalQuantity === 0 ? "Sélectionnez au moins un ticket" : "";

  function resetForm() {
    setName("");
    setPhone("");
    setQuantities({});
    setResult(null);
    setSubmitError(null);
  }

  function handleClose() {
    onClose();
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (items.length === 0 || !token) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Étape 1 : créer la commande (comme un achat public classique).
      const order = await apiFetch<Order>("/orders", {
        method: "POST",
        body: {
          buyerName: name.trim(),
          buyerPhone: phone.trim(),
          items: items.map((line) => ({ ticketCategoryId: line.category.id, quantity: line.quantity })),
        },
      });
      const orderId = extractId(order);

      // Étape 2 : confirmer le paiement espèces (admin) — pas de body attendu, juste orderId en path.
      await apiFetch(`/payments/cash/${orderId}`, { method: "POST", token });

      // Étape 3 : récupérer la commande avec ses tickets + QR codes (route
      // publique GET /orders/:id — génération déjà faite à l'étape 2, on ne
      // fait ici que relire le résultat pour l'afficher/le transmettre).
      const full = await apiFetch<Order>(`/orders/${orderId}`);

      const lines: ResultLine[] = items.map((line) => ({
        categoryName: line.category.name,
        quantity: line.quantity,
      }));
      const categoryNameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
      const detail = lines.map((l) => `${l.quantity} × ${l.categoryName}`).join(", ");

      setResult({
        reference: orderId,
        summary: `${money(totalAmount)} reçus de ${name.trim()}.`,
        detail: `${detail} • Paiement espèces`,
        buyerName: name.trim(),
        buyerPhone: phone.trim(),
        lines,
        categoryNameById,
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

              <div className="cash-categories">
                <span style={{ fontSize: 13, fontWeight: 750, color: "var(--navy)" }}>
                  Tickets à générer <small style={{ fontWeight: 400, color: "var(--muted)" }}>(une ou plusieurs catégories)</small>
                </span>
                {categories.map((category) => {
                  const qty = quantities[category.id] ?? 0;
                  return (
                    <div className="cash-category-row" key={category.id}>
                      <span>
                        <b>{category.name}</b>
                        <small>{money(category.price)}</small>
                      </span>
                      <div className="qty">
                        <button
                          aria-label="Diminuer"
                          type="button"
                          onClick={() => setQuantity(category.id, qty - 1)}
                          disabled={qty === 0}
                        >
                          −
                        </button>
                        <output>{qty}</output>
                        <button aria-label="Augmenter" type="button" onClick={() => setQuantity(category.id, qty + 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="cash-calc">
                <span>
                  Montant total
                  <small>
                    {totalQuantity} ticket{totalQuantity > 1 ? "s" : ""}
                  </small>
                </span>
                <b>{money(totalAmount)}</b>
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
                  <small>{result.categoryNameById[ticket.ticketCategoryId] ?? ""}</small>
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
                  `Bonjour ${result.buyerName}, voici votre ticket pour le Dîner-Gala 2026 (${result.lines
                    .map((l) => `${l.quantity} × ${l.categoryName}`)
                    .join(", ")}). Référence #${result.reference}. Le QR code joint fera foi à l'entrée, merci de le conserver.`
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
