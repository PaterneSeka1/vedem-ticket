"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { apiFetch, ApiError, isUnauthorized } from "@/lib/api";
import { TicketCategory } from "@/lib/types";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";

interface CategoryModalProps {
  onClose: () => void;
  /** Présente = édition d'une catégorie existante ; absente = création. */
  category?: TicketCategory | null;
  token: string | null;
  onSaved: () => void;
  onUnauthorized: () => void;
}

const DEFAULT_CURRENCY = "XOF";

/**
 * Rendu seulement quand la modale doit être ouverte (voir settings/page.tsx :
 * `{modalOpen && <CategoryModal key={...} .../>}`) — le composant est monté
 * puis démonté à chaque ouverture/fermeture, donc l'état initial peut être
 * dérivé directement des props une seule fois, sans effect de réinitialisation.
 */
export default function CategoryModal({ onClose, category, token, onSaved, onUnauthorized }: CategoryModalProps) {
  const isEdit = !!category;
  const toast = useToast();
  const confirm = useConfirm();

  const [name, setName] = useState(category?.name ?? "");
  const [price, setPrice] = useState(category ? String(category.price) : "");
  const [currency, setCurrency] = useState(category?.currency ?? DEFAULT_CURRENCY);
  const [stock, setStock] = useState(category?.stock != null ? String(category.stock) : "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    // Une modification s'applique immédiatement à la billetterie publique
    // (prix, stock…) : on le confirme explicitement. Une création n'a pas
    // besoin de cette étape (rien n'existe encore côté public).
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
    try {
      if (isEdit && category) {
        await apiFetch(`/ticket-categories/${category.id}`, {
          method: "PATCH",
          token,
          body: {
            name: name.trim(),
            price: Number(price),
            currency: currency.trim() || DEFAULT_CURRENCY,
            // Champ vidé volontairement -> `null` (pas de limite) ; sinon la valeur saisie.
            stock: trimmedStock === "" ? null : Number(trimmedStock),
            description: description.trim() || null,
          },
        });
      } else {
        await apiFetch("/ticket-categories", {
          method: "POST",
          token,
          body: {
            name: name.trim(),
            price: Number(price),
            currency: currency.trim() || DEFAULT_CURRENCY,
            ...(trimmedStock !== "" ? { stock: Number(trimmedStock) } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
          },
        });
      }
      toast.success(isEdit ? "Catégorie mise à jour." : "Catégorie créée.");
      onSaved();
      onClose();
    } catch (err) {
      if (isUnauthorized(err)) {
        onUnauthorized();
        return;
      }
      setError(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal open" role="dialog" aria-modal="true" aria-labelledby="category-title">
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <span className="section-kicker">{isEdit ? "Modifier" : "Nouvelle catégorie"}</span>
            <h2 id="category-title">{isEdit ? category!.name : "Créer une catégorie de tickets"}</h2>
            <p>Prix, devise et stock affichés sur la billetterie publique.</p>
          </div>
          <button className="modal-close" aria-label="Fermer" onClick={onClose} type="button">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        <form className="cash-form" onSubmit={handleSubmit}>
          <label className="full">
            Nom
            <input required placeholder="Ex. VIP" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Prix
            <input
              required
              type="number"
              min={1}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label>
            Devise
            <input
              maxLength={3}
              style={{ textTransform: "uppercase" }}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            Stock <small>(vide = illimité)</small>
            <input type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
          <label className="full">
            Description <small>(facultatif)</small>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="cash-error">{error}</div>
          <button className="primary cash-submit" type="submit" disabled={submitting}>
            {submitting ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Créer la catégorie"}
          </button>
        </form>
      </div>
    </div>
  );
}
