"use client";

import { FormEvent, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Gift, MessageCircle, X } from "lucide-react";
import { formatAccessCode, money, whatsappLink } from "@/lib/format";
import { apiFetch, extractId, isUnauthorized, ApiError } from "@/lib/api";
import { Order, OrderTicket, TicketCategory } from "@/lib/types";

/**
 * `cash` : encaissement espèces (commande publique puis `POST /payments/cash`).
 * `invitation` : ticket offert à une personnalité (`POST /payments/invitation`,
 * sans paiement — CLAUDE.md §4) ; seul mode où les catégories réservées aux
 * invitations (ex. VVIP) sont proposées, et où le téléphone est facultatif.
 */
export type TicketModalMode = "cash" | "invitation";

interface CashModalProps {
  open: boolean;
  mode?: TicketModalMode;
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
  mode = "cash",
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
  const isInvitation = mode === "invitation";
  // Espèces : jamais de catégorie réservée aux invitations (le backend la
  // refuserait). Invitation : toutes, les catégories d'invitation en tête.
  const availableCategories = useMemo(
    () =>
      isInvitation
        ? [...categories].sort((a, b) => Number(!!b.invitationOnly) - Number(!!a.invitationOnly))
        : categories.filter((category) => !category.invitationOnly),
    [categories, isInvitation],
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reference: string;
    accessCode: string | null;
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
      availableCategories
        .map((category) => ({ category, quantity: quantities[category.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [availableCategories, quantities],
  );
  const totalQuantity = items.reduce((sum, line) => sum + line.quantity, 0);
  // Une invitation n'encaisse rien, quelle que soit la catégorie.
  const totalAmount = isInvitation ? 0 : items.reduce((sum, line) => sum + line.category.price * line.quantity, 0);

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
      const orderItems = items.map((line) => ({ ticketCategoryId: line.category.id, quantity: line.quantity }));
      let order: Order;
      if (isInvitation) {
        // Invitation : commande + tickets en un seul appel admin, sans paiement.
        const created = await apiFetch<{ order: Order }>("/payments/invitation", {
          method: "POST",
          token,
          body: {
            buyerName: name.trim(),
            ...(phone.trim() ? { buyerPhone: phone.trim() } : {}),
            items: orderItems,
          },
        });
        order = created.order;
      } else {
        // Étape 1 : créer la commande (comme un achat public classique).
        order = await apiFetch<Order>("/orders", {
          method: "POST",
          body: { buyerName: name.trim(), buyerPhone: phone.trim(), items: orderItems },
        });
        // Étape 2 : confirmer le paiement espèces (admin) — pas de body attendu, juste orderId en path.
        await apiFetch(`/payments/cash/${extractId(order)}`, { method: "POST", token });
      }
      const orderId = extractId(order);

      // Étape 3 : récupérer la commande avec ses tickets + QR codes (route
      // admin GET /orders/:id/tickets — génération déjà faite à l'étape 2, on
      // ne fait ici que relire le résultat pour l'afficher/le transmettre).
      const full = await apiFetch<Order>(`/orders/${orderId}/tickets`, { token });

      const lines: ResultLine[] = items.map((line) => ({
        categoryName: line.category.name,
        quantity: line.quantity,
      }));
      const categoryNameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
      const detail = lines.map((l) => `${l.quantity} × ${l.categoryName}`).join(", ");

      setResult({
        reference: orderId,
        accessCode: order.accessCode ?? null,
        summary: isInvitation ? `Invitation offerte à ${name.trim()}.` : `${money(totalAmount)} reçus de ${name.trim()}.`,
        detail: `${detail} • ${isInvitation ? "Invitation" : "Paiement espèces"}`,
        buyerName: name.trim(),
        buyerPhone: phone.trim(),
        lines,
        categoryNameById,
        tickets: full.tickets ?? [],
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
                <span className="section-kicker">{isInvitation ? "Ticket d'invitation" : "Encaissement manuel"}</span>
                <h2 id="cash-title">{isInvitation ? "Offrir des tickets à une personnalité" : "Générer des tickets en espèces"}</h2>
                <p>
                  {isInvitation
                    ? "Aucun paiement : les tickets sont générés immédiatement et ne comptent pas dans le stock."
                    : "Réservé au compte administrateur unique."}
                </p>
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
                  placeholder={isInvitation ? "Ex. M. le Ministre" : "Ex. Awa Koné"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Téléphone {isInvitation && <small>(facultatif)</small>}
                <input
                  required={!isInvitation}
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
                {availableCategories.map((category) => {
                  const qty = quantities[category.id] ?? 0;
                  return (
                    <div className="cash-category-row" key={category.id}>
                      <span>
                        <b>
                          {category.name}
                          {category.invitationOnly && <span className="invitation-badge">Invitations</span>}
                        </b>
                        <small>{isInvitation ? "Offert" : money(category.price)}</small>
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
                <b>{isInvitation ? "Offert" : money(totalAmount)}</b>
              </div>
              <div className="cash-error">{errorMessage || submitError}</div>
              <button className="primary cash-submit" type="submit" disabled={submitting || !!errorMessage}>
                {submitting
                  ? "Enregistrement…"
                  : isInvitation
                    ? "Créer l'invitation et générer"
                    : "Confirmer l'encaissement et générer"}
              </button>
            </form>
          </div>
        ) : (
          <div className="cash-result show">
            <div className="success-icon">
              <CheckCircle2 size={32} strokeWidth={2.2} />
            </div>
            <span className="section-kicker">{isInvitation ? "Invitation créée" : "Espèces encaissées"}</span>
            <h2>Tickets générés avec succès</h2>
            <p>{result.summary}</p>
            <div className="mini-ticket">
              <span className="cash-mark">
                {isInvitation ? <Gift size={20} strokeWidth={2.2} /> : <Banknote size={20} strokeWidth={2.2} />}
              </span>
              <span>
                <small>RÉFÉRENCE</small>
                <b>#{result.reference}</b>
                <small>{result.detail}</small>
                {result.accessCode && (
                  <small>
                    Code de téléchargement : <b>{formatAccessCode(result.accessCode)}</b>
                  </small>
                )}
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
              {result.buyerPhone
                ? `Enregistre ou capture ces QR codes pour les joindre au message WhatsApp — le lien ci-dessous ouvre uniquement la conversation avec ${result.buyerName}.`
                : "Aucun téléphone renseigné : enregistre ces QR codes ou transmets le code de téléchargement à l'invité."}
            </p>

            <div className="cash-result-actions">
              {result.buyerPhone && (
              <a
                className="primary whatsapp-btn"
                href={whatsappLink(
                  result.buyerPhone,
                  `Bonjour ${result.buyerName}, voici votre ${isInvitation ? "invitation" : "ticket"} pour le Dîner-Gala 2026 (${result.lines
                    .map((l) => `${l.quantity} × ${l.categoryName}`)
                    .join(", ")}). Référence #${result.reference}. Le QR code joint fera foi à l'entrée, merci de le conserver.` +
                    (result.accessCode
                      ? ` Vous pouvez aussi télécharger vos tickets sur ${window.location.origin}/mes-tickets avec le code ${formatAccessCode(result.accessCode)}.`
                      : "")
                )}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}
              >
                <MessageCircle size={18} strokeWidth={2.2} /> Envoyer par WhatsApp
              </a>
              )}
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
