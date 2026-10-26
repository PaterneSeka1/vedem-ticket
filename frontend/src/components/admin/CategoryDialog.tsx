"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import FormField from "@/components/ui/FormField";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { useAdminSession } from "@/hooks/useAdminSession";
import { apiFetch, ApiError, isUnauthorized } from "@/lib/api";
import { TicketCategory } from "@/lib/types";

interface CategoryDialogProps {
  onClose: () => void;
  /** Présente = édition d'une catégorie existante ; absente = création. */
  category?: TicketCategory | null;
  onSaved: () => void;
}

const DEFAULT_CURRENCY = "XOF";

/**
 * Création / édition d'une catégorie de billets. Monté à chaque ouverture
 * (voir settings/page.tsx) : l'état initial se dérive des props, sans effet
 * de réinitialisation.
 */
export default function CategoryDialog({ onClose, category, onSaved }: CategoryDialogProps) {
  const isEdit = !!category;
  const { token, handleUnauthorized } = useAdminSession();
  const toast = useToast();
  const confirm = useConfirm();

  const [name, setName] = useState(category?.name ?? "");
  const [price, setPrice] = useState(category ? String(category.price) : "");
  const [currency, setCurrency] = useState(category?.currency ?? DEFAULT_CURRENCY);
  const [stock, setStock] = useState(category?.stock != null ? String(category.stock) : "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [invitationOnly, setInvitationOnly] = useState(category?.invitationOnly ?? false);
  const [chargeWaveFees, setChargeWaveFees] = useState(category?.chargeWaveFees ?? false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNumber = Number(price);
  const errors = {
    name: name.trim().length < 1 ? "Le nom est obligatoire." : null,
    // Une catégorie en vente doit avoir un prix positif ; une catégorie
    // d'invitation peut valoir 0 (jamais encaissé) — même règle que le backend.
    price:
      invitationOnly && price.trim() === ""
        ? null
        : !Number.isInteger(priceNumber) || priceNumber < (invitationOnly ? 0 : 1)
          ? invitationOnly
            ? "Prix entier positif ou nul."
            : "Prix entier supérieur à 0."
          : null,
    stock: stock.trim() !== "" && (!Number.isInteger(Number(stock)) || Number(stock) < 0) ? "Capacité entière positive, ou vide pour illimitée." : null,
    currency: !/^[A-Z]{3}$/.test(currency.trim()) ? "Code devise sur 3 lettres (ex. XOF)." : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (!token || hasErrors) return;

    // Une modification s'applique immédiatement à la billetterie publique.
    if (isEdit && category) {
      const ok = await confirm({
        title: "Enregistrer les modifications ?",
        message: `Les changements s'appliqueront immédiatement à « ${category.name} » sur la billetterie publique.`,
        confirmLabel: "Enregistrer",
      });
      if (!ok) return;
    }

    setSubmitting(true);
    setError(null);
    const trimmedStock = stock.trim();
    const priceValue = invitationOnly && price.trim() === "" ? 0 : priceNumber;
    try {
      if (isEdit && category) {
        await apiFetch(`/ticket-categories/${category.id}`, {
          method: "PATCH",
          token,
          body: {
            name: name.trim(),
            price: priceValue,
            currency: currency.trim() || DEFAULT_CURRENCY,
            // Champ vidé volontairement -> `null` (pas de limite) ; sinon la valeur saisie.
            stock: trimmedStock === "" ? null : Number(trimmedStock),
            description: description.trim() || null,
            invitationOnly,
            chargeWaveFees,
          },
        });
      } else {
        await apiFetch("/ticket-categories", {
          method: "POST",
          token,
          body: {
            name: name.trim(),
            price: priceValue,
            currency: currency.trim() || DEFAULT_CURRENCY,
            ...(trimmedStock !== "" ? { stock: Number(trimmedStock) } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(invitationOnly ? { invitationOnly: true } : {}),
            ...(chargeWaveFees ? { chargeWaveFees: true } : {}),
          },
        });
      }
      toast.success(isEdit ? "Catégorie mise à jour." : "Catégorie créée.");
      onSaved();
      onClose();
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
      setSubmitting(false);
    }
  }

  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null);

  return (
    <Dialog
      open
      onClose={onClose}
      busy={submitting}
      eyebrow={isEdit ? "Modifier la catégorie" : "Nouvelle catégorie"}
      title={isEdit ? category!.name : "Créer une catégorie de billets"}
      description="Nom, prix et capacité affichés sur la billetterie publique."
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Annuler
          </button>
          <button type="submit" form="category-form" className="btn btn-primary" disabled={submitting}>
            {submitting && <span className="spinner" aria-hidden="true" />}
            {isEdit ? "Enregistrer" : "Créer la catégorie"}
          </button>
        </>
      }
    >
      <form id="category-form" className="form-grid cols-2" onSubmit={handleSubmit} noValidate>
        <FormField id="cat-name" label="Nom" error={show("name")} className="span-2">
          <input className="input" placeholder="Ex. VIP" value={name} onChange={(e) => setName(e.target.value)} data-autofocus />
        </FormField>
        <FormField
          id="cat-price"
          label="Prix unitaire"
          optional={invitationOnly}
          hint={invitationOnly ? "Jamais encaissé pour une invitation." : undefined}
          error={show("price")}
        >
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={invitationOnly ? 0 : 1}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </FormField>
        <FormField id="cat-currency" label="Devise" hint="XOF = franc CFA (affiché « FCFA »)." error={show("currency")}>
          <input
            className="input"
            maxLength={3}
            style={{ textTransform: "uppercase" }}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
        </FormField>
        <FormField id="cat-stock" label="Capacité" optional hint="Nombre total de places. Vide = illimitée." error={show("stock")} className="span-2">
          <input className="input" type="number" inputMode="numeric" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} />
        </FormField>
        <FormField id="cat-description" label="Description" optional className="span-2">
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <label className="check-card span-2">
          <input type="checkbox" checked={invitationOnly} onChange={(e) => setInvitationOnly(e.target.checked)} />
          <span>
            <b>Réservée aux invitations</b>
            <small>Masquée de la billetterie publique et impossible à acheter : utilisable uniquement via « Créer une invitation » (ex. VVIP).</small>
          </span>
        </label>
        <label className="check-card span-2">
          <input type="checkbox" checked={chargeWaveFees} onChange={(e) => setChargeWaveFees(e.target.checked)} />
          <span>
            <b>Frais Wave à la charge de l&apos;acheteur</b>
            <small>Ajoute 1 % (arrondi à l&apos;unité supérieure) au montant du lien Wave. Jamais appliqué aux espèces.</small>
          </span>
        </label>
        {error && (
          <div className="callout span-2" data-tone="danger" role="alert">
            <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </Dialog>
  );
}
