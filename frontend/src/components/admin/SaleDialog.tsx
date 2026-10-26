"use client";

import { FormEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle, Plus, Printer } from "lucide-react";
import TicketBundle from "@/components/TicketBundle";
import CopyButton from "@/components/ui/CopyButton";
import Dialog from "@/components/ui/Dialog";
import FormField from "@/components/ui/FormField";
import PaymentSummary from "@/components/ui/PaymentSummary";
import QuantityStepper from "@/components/ui/QuantityStepper";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { useAdminSession } from "@/hooks/useAdminSession";
import { apiFetch, extractId, isUnauthorized, ApiError } from "@/lib/api";
import { operationalCategories } from "@/lib/categories";
import { EVENT_NAME } from "@/lib/event";
import { formatAccessCode, money, plural, shortRef, whatsappLink } from "@/lib/format";
import { Order, OrderTicket, TicketCategory } from "@/lib/types";

/**
 * `cash` : encaissement espèces (commande publique puis `POST /payments/cash`).
 * `invitation` : billet offert à une personnalité (`POST /payments/invitation`,
 * sans paiement — CLAUDE.md §4) ; seul mode où les catégories réservées aux
 * invitations (ex. VVIP) sont proposées, et où le téléphone est facultatif.
 */
export type SaleMode = "cash" | "invitation";

interface SaleDialogProps {
  open: boolean;
  mode: SaleMode;
  onClose: () => void;
  categories: TicketCategory[];
  /** Vente/invitation enregistrée : recharger les données du dashboard. */
  onCompleted: () => void;
}

interface SaleResult {
  orderId: string;
  accessCode: string | null;
  buyerName: string;
  buyerPhone: string;
  summary: string;
  tickets: OrderTicket[];
  categoryNameById: Record<string, string>;
}

export default function SaleDialog({ open, mode, onClose, categories, onCompleted }: SaleDialogProps) {
  const { token, handleUnauthorized } = useAdminSession();
  const confirm = useConfirm();
  const toast = useToast();
  const isInvitation = mode === "invitation";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SaleResult | null>(null);
  const [showTickets, setShowTickets] = useState(false);

  // Espèces : jamais de catégorie réservée aux invitations (le backend la
  // refuserait). Invitation : toutes, les catégories d'invitation en tête.
  // Dans les deux cas, la tombola n'est plus proposée (lib/categories.ts).
  const available = useMemo(() => {
    const operational = operationalCategories(categories);
    return isInvitation
      ? [...operational].sort((a, b) => Number(!!b.invitationOnly) - Number(!!a.invitationOnly))
      : operational.filter((category) => !category.invitationOnly);
  }, [categories, isInvitation]);

  const lines = available
    .map((category) => ({ category, quantity: quantities[category.id] ?? 0 }))
    .filter((line) => line.quantity > 0);
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  // Une invitation n'encaisse rien, quelle que soit la catégorie.
  const totalAmount = isInvitation ? 0 : lines.reduce((sum, line) => sum + line.category.price * line.quantity, 0);

  const errors = {
    name: name.trim().length < 2 ? "Indiquez le nom du client." : null,
    phone:
      !isInvitation && phone.replace(/\D/g, "").length < 8
        ? "Téléphone requis pour une vente (8 chiffres minimum)."
        : phone.trim() && phone.replace(/\D/g, "").length < 8
          ? "Numéro incomplet."
          : null,
    items: totalQuantity === 0 ? "Sélectionnez au moins un billet." : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors || !token) return;

    const ok = await confirm({
      title: isInvitation ? "Créer cette invitation ?" : `Confirmer l'encaissement de ${money(totalAmount)} ?`,
      message: isInvitation
        ? `${plural(totalQuantity, "billet")} offert${totalQuantity > 1 ? "s" : ""} à ${name.trim()}, générés immédiatement.`
        : `Vous déclarez avoir reçu ${money(totalAmount)} en espèces de ${name.trim()}. Les billets seront générés immédiatement.`,
      confirmLabel: isInvitation ? "Créer l'invitation" : "Confirmer l'encaissement",
    });
    if (!ok) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const orderItems = lines.map((line) => ({ ticketCategoryId: line.category.id, quantity: line.quantity }));
      let order: Order;
      if (isInvitation) {
        // Invitation : commande + billets en un seul appel admin, sans paiement.
        const created = await apiFetch<{ order: Order }>("/payments/invitation", {
          method: "POST",
          token,
          body: { buyerName: name.trim(), ...(phone.trim() ? { buyerPhone: phone.trim() } : {}), items: orderItems },
        });
        order = created.order;
      } else {
        // 1. Créer la commande (comme un achat public), 2. confirmer l'espèce (admin).
        order = await apiFetch<Order>("/orders", {
          method: "POST",
          body: { buyerName: name.trim(), buyerPhone: phone.trim(), items: orderItems },
        });
        await apiFetch(`/payments/cash/${extractId(order)}`, { method: "POST", token });
      }
      const orderId = extractId(order);
      // 3. Relire la commande avec ses billets + QR codes (route admin).
      const full = await apiFetch<Order>(`/orders/${orderId}/tickets`, { token });

      setResult({
        orderId,
        accessCode: order.accessCode ?? full.accessCode ?? null,
        buyerName: name.trim(),
        buyerPhone: phone.trim(),
        summary: lines.map((l) => `${l.quantity} × ${l.category.name}`).join(", "),
        tickets: full.tickets ?? [],
        categoryNameById: Object.fromEntries(categories.map((c) => [c.id, c.name])),
      });
      toast.success(isInvitation ? "Invitation créée — billets générés." : "Encaissement enregistré — billets générés.");
      onCompleted();
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      setSubmitError(err instanceof ApiError ? err.message : "Une erreur est survenue, réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForNew() {
    setName("");
    setPhone("");
    setQuantities({});
    setSubmitted(false);
    setSubmitError(null);
    setResult(null);
    setShowTickets(false);
  }

  if (result) {
    const message =
      `Bonjour ${result.buyerName}, voici votre ${isInvitation ? "invitation" : "billet"} pour le ${EVENT_NAME} (${result.summary}). ` +
      `Référence ${shortRef(result.orderId)}. Le QR code fera foi à l'entrée, merci de le conserver.` +
      (result.accessCode
        ? ` Vous pouvez télécharger vos billets sur ${window.location.origin}/mes-tickets avec le code ${formatAccessCode(result.accessCode)}.`
        : "");
    return (
      <Dialog
        open={open}
        onClose={onClose}
        size="lg"
        fullscreenMobile
        eyebrow={isInvitation ? "Invitation créée" : "Espèces encaissées"}
        title="Billets générés"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={resetForNew}>
              <Plus size={16} strokeWidth={2} aria-hidden="true" /> Nouvelle {isInvitation ? "invitation" : "vente"}
            </button>
            <span className="spacer" />
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Terminer
            </button>
          </>
        }
      >
        <div className="sale-result">
          <div className="sale-result-head">
            <span className="status-icon" aria-hidden="true">
              <CheckCircle2 size={22} strokeWidth={2} />
            </span>
            <div>
              <h3>{result.buyerName}</h3>
              <p>
                {result.summary} · {isInvitation ? "Offert" : money(totalAmount)} · Réf.{" "}
                <span className="ref">{shortRef(result.orderId)}</span>
              </p>
            </div>
          </div>

          {result.accessCode && (
            <div className="access-code" data-active="true">
              <span className="eyebrow">Code de téléchargement — à transmettre au client</span>
              <div className="access-code-value">
                <strong>{formatAccessCode(result.accessCode)}</strong>
                <CopyButton value={formatAccessCode(result.accessCode)} label="Copier le code" />
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {result.buyerPhone && (
              <a
                className="btn btn-whatsapp"
                href={whatsappLink(result.buyerPhone, message)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={16} strokeWidth={2} aria-hidden="true" /> Envoyer par WhatsApp
              </a>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setShowTickets((v) => !v)} aria-expanded={showTickets}>
              <Printer size={16} strokeWidth={2} aria-hidden="true" />
              {showTickets ? "Masquer les billets" : "Afficher / imprimer les billets"}
            </button>
          </div>
          <p className="field-hint">
            {result.buyerPhone
              ? "Le lien WhatsApp ouvre la conversation avec le message et le code ; joignez-y les QR codes (capture ou PDF) si besoin."
              : "Aucun téléphone renseigné : imprimez les billets ou transmettez le code de téléchargement."}
          </p>

          {showTickets ? (
            <TicketBundle
              buyerName={result.buyerName}
              categoryNameById={result.categoryNameById}
              tickets={result.tickets}
            />
          ) : (
            <div className="qr-strip">
              {result.tickets.map((ticket, i) => (
                <div className="qr-tile" key={ticket.code}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ticket.qrCodeDataUrl} alt={`QR code du billet ${i + 1}`} />
                  <b>{ticket.categoryName ?? result.categoryNameById[ticket.ticketCategoryId] ?? "Billet"}</b>
                  <code>{ticket.code}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={submitting}
      size="lg"
      fullscreenMobile
      eyebrow={isInvitation ? "Billet d'invitation" : "Encaissement manuel"}
      title={isInvitation ? "Créer une invitation" : "Vente en espèces"}
      description={
        isInvitation
          ? "Aucun paiement : les billets sont générés immédiatement et ne comptent pas dans le stock vendu."
          : "À utiliser une fois l'argent reçu. Le stock est revérifié à la confirmation."
      }
      footer={
        <>
          <div className="sale-total">
            <span>{plural(totalQuantity, "billet")}</span>
            <strong>{isInvitation ? "Offert" : money(totalAmount)}</strong>
          </div>
          <button type="submit" form="sale-form" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" /> Enregistrement…
              </>
            ) : isInvitation ? (
              "Créer l'invitation"
            ) : (
              "Encaisser et générer"
            )}
          </button>
        </>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit} noValidate>
        <section className="sale-section" aria-labelledby="sale-client">
          <h3 className="sale-section-title" id="sale-client">
            <span className="step-index" aria-hidden="true">
              1
            </span>
            {isInvitation ? "Invité" : "Client"}
          </h3>
          <div className="form-grid cols-2">
            <FormField id="sale-name" label="Nom et prénom" error={submitted ? errors.name : null}>
              <input
                className="input"
                placeholder={isInvitation ? "Ex. M. le Président" : "Ex. Awa Koné"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
                data-autofocus
              />
            </FormField>
            <FormField id="sale-phone" label="Téléphone" optional={isInvitation} error={submitted ? errors.phone : null}>
              <input
                className="input"
                type="tel"
                inputMode="tel"
                placeholder="07 00 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="off"
              />
            </FormField>
          </div>
        </section>

        <section className="sale-section" aria-labelledby="sale-items">
          <h3 className="sale-section-title" id="sale-items">
            <span className="step-index" aria-hidden="true">
              2
            </span>
            Billets
          </h3>
          {available.length === 0 ? (
            <p className="field-hint">Aucune catégorie disponible — créez-en une dans Paramètres.</p>
          ) : (
            <div className="sale-lines">
              {available.map((category) => {
                const qty = quantities[category.id] ?? 0;
                return (
                  <div className="sale-line" key={category.id} data-selected={qty > 0 || undefined}>
                    <div className="sale-line-info">
                      <b>
                        {category.name}
                        {category.invitationOnly && <StatusBadge tone="violet">Invitations</StatusBadge>}
                      </b>
                      <small>
                        {isInvitation ? "Offert" : money(category.price)}
                        {category.stock !== null && ` · capacité ${category.stock}`}
                      </small>
                    </div>
                    <QuantityStepper
                      value={qty}
                      itemLabel={category.name}
                      max={50}
                      onChange={(value) => setQuantities((prev) => ({ ...prev, [category.id]: Math.max(0, value) }))}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {submitted && errors.items && (
            <p className="field-error" style={{ marginTop: 8 }}>
              <AlertTriangle size={13} strokeWidth={2.2} aria-hidden="true" /> {errors.items}
            </p>
          )}
        </section>

        {lines.length > 0 && (
          <section className="sale-section" aria-labelledby="sale-review">
            <h3 className="sale-section-title" id="sale-review">
              <span className="step-index" aria-hidden="true">
                3
              </span>
              Vérification
            </h3>
            <div className="card" style={{ padding: 16 }}>
              <PaymentSummary
                lines={lines.map((line) => ({
                  key: line.category.id,
                  name: line.category.name,
                  quantity: line.quantity,
                  unitPrice: isInvitation ? 0 : line.category.price,
                }))}
                totalLabel={isInvitation ? "Montant" : "À encaisser en espèces"}
                totalOverride={isInvitation ? "Offert" : undefined}
              />
            </div>
          </section>
        )}

        {submitError && (
          <div className="callout" data-tone="danger" role="alert" style={{ marginTop: 16 }}>
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        )}
      </form>
    </Dialog>
  );
}
