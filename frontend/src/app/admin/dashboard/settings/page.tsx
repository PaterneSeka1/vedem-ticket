"use client";

import { FormEvent, useMemo, useState } from "react";
import { Archive, CalendarDays, MapPin, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import CategoryDialog from "@/components/admin/CategoryDialog";
import ActionMenu from "@/components/ui/ActionMenu";
import { Card, SectionHeader } from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import FormField from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAdminData } from "@/context/AdminDataContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useToast } from "@/context/ToastContext";
import { useAdminSession } from "@/hooks/useAdminSession";
import { apiFetch, ApiError, isUnauthorized } from "@/lib/api";
import { isTombolaCategory } from "@/lib/categories";
import { currencyLabel, formatNumber, plural } from "@/lib/format";
import { EventSettings, TicketCategory } from "@/lib/types";

export default function SettingsPage() {
  const { categories, orders, tickets, eventSettings, refresh, ready } = useAdminData();

  // Catégories de gestion courante : la tombola (historique) n'est plus
  // exposée ici, mais reste en base et dans les historiques (lib/categories.ts).
  const operational = useMemo(() => categories.filter((c) => !isTombolaCategory(c)), [categories]);
  const archivedCount = categories.length - operational.length;

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Sections des paramètres">
        <a href="#evenement">Informations de l&apos;événement</a>
        <a href="#categories">Catégories de billets</a>
      </nav>

      <div className="settings-sections">
        {/* Le formulaire est remonté au premier chargement pour partir des valeurs serveur. */}
        <EventSection key={ready ? "ready" : "loading"} initial={eventSettings} disabled={!ready} onSaved={refresh} />
        <CategoriesSection
          categories={operational}
          archivedCount={archivedCount}
          ordersCount={(id) => orders.filter((o) => o.items.some((item) => item.ticketCategoryId === id)).length}
          issuedCount={(id) => tickets.filter((t) => t.ticketCategoryId === id && t.status !== "cancelled").length}
          loading={!ready}
          onChanged={refresh}
        />
      </div>
    </div>
  );
}

function EventSection({ initial, disabled, onSaved }: { initial: EventSettings; disabled: boolean; onSaved: () => void }) {
  const { token, handleUnauthorized } = useAdminSession();
  const toast = useToast();
  const [date, setDate] = useState(initial.date);
  const [location, setLocation] = useState(initial.location);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const dirty = date !== saved.date || location !== saved.location;
  const errors = {
    date: date.trim() ? null : "La date est obligatoire.",
    location: location.trim() ? null : "Le lieu est obligatoire.",
  };

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    if (errors.date || errors.location) return;
    setSaving(true);
    try {
      const next = await apiFetch<EventSettings>("/event-settings", {
        method: "PATCH",
        body: { date: date.trim(), location: location.trim() },
        token,
      });
      setSaved(next ?? { date: date.trim(), location: location.trim() });
      onSaved();
      toast.success("Date et lieu mis à jour partout (accueil, commande, billets).");
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section" id="evenement" aria-labelledby="evenement-title">
      <SectionHeader
        id="evenement-title"
        title="Informations de l'événement"
        description="Affichées partout, y compris sur les billets déjà émis (lues à jour à chaque affichage)."
      />
      <form className="card-body" onSubmit={handleSave} noValidate style={{ display: "grid", gap: 16 }}>
        <div className="form-grid cols-2">
          <FormField id="event-date" label="Date et heure" hint="Texte libre, affiché tel quel." error={submitted ? errors.date : null}>
            <input
              className="input"
              placeholder="Samedi 12 septembre 2026 • 18 h 30"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField id="event-location" label="Lieu" error={submitted ? errors.location : null}>
            <input
              className="input"
              placeholder="Foyer des Jeunes de Marcory"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={disabled}
            />
          </FormField>
        </div>
        <div className="preview-line" aria-label="Aperçu">
          <span>
            <CalendarDays size={14} strokeWidth={2} aria-hidden="true" /> {date || "—"}
          </span>
          <span>
            <MapPin size={14} strokeWidth={2} aria-hidden="true" /> {location || "—"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!dirty || saving}
            onClick={() => {
              setDate(saved.date);
              setLocation(saved.location);
              setSubmitted(false);
            }}
          >
            Annuler les modifications
          </button>
          <button type="submit" className="btn btn-primary" disabled={!dirty || saving || disabled}>
            {saving && <span className="spinner" aria-hidden="true" />}
            Enregistrer
          </button>
        </div>
      </form>
    </Card>
  );
}

function CategoriesSection({
  categories,
  archivedCount,
  ordersCount,
  issuedCount,
  loading,
  onChanged,
}: {
  categories: TicketCategory[];
  archivedCount: number;
  ordersCount: (id: string) => number;
  issuedCount: (id: string) => number;
  loading: boolean;
  onChanged: () => void;
}) {
  const { token, handleUnauthorized } = useAdminSession();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<TicketCategory | null | undefined>(undefined);

  async function handleDelete(category: TicketCategory) {
    const used = ordersCount(category.id);
    const ok = await confirm({
      title: `Supprimer « ${category.name} » ?`,
      message:
        used > 0
          ? `${plural(used, "commande référence", "commandes référencent")} déjà cette catégorie. Ces commandes et leurs billets ne sont pas modifiés, mais la catégorie disparaîtra immédiatement de la billetterie.`
          : "Cette action est définitive et retire la catégorie de la billetterie publique.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/ticket-categories/${category.id}`, { method: "DELETE", token });
      onChanged();
      toast.success(`Catégorie « ${category.name} » supprimée.`);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Suppression impossible.");
    }
  }

  const columns: Column<TicketCategory>[] = [
    {
      id: "name",
      header: "Catégorie",
      sortValue: (c) => c.name,
      cell: (c) => (
        <>
          <span className="cell-primary" style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {c.name}
            {c.invitationOnly && <StatusBadge tone="violet">Invitations</StatusBadge>}
            {c.chargeWaveFees && (
              <StatusBadge tone="info" dot={false}>
                Frais Wave
              </StatusBadge>
            )}
          </span>
          {c.description && <span className="cell-secondary">{c.description}</span>}
        </>
      ),
    },
    {
      id: "price",
      header: "Prix",
      align: "right",
      sortValue: (c) => c.price,
      cell: (c) =>
        c.invitationOnly ? (
          <span className="text-tertiary">Offert</span>
        ) : (
          <span className="cell-amount">
            {formatNumber(c.price)} {currencyLabel(c.currency)}
          </span>
        ),
    },
    {
      id: "issued",
      header: "Émis / capacité",
      align: "right",
      sortValue: (c) => issuedCount(c.id),
      cell: (c) => (
        <span className="tabular">
          {formatNumber(issuedCount(c.id))}
          <span className="text-tertiary"> / {c.stock === null ? "illimitée" : formatNumber(c.stock)}</span>
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (c) => (
        <ActionMenu
          label={`Actions pour ${c.name}`}
          items={[
            { label: "Modifier", icon: Pencil, onSelect: () => setEditing(c) },
            { label: "Supprimer", icon: Trash2, danger: true, onSelect: () => void handleDelete(c) },
          ]}
        />
      ),
    },
  ];

  return (
    <Card as="section" id="categories" aria-labelledby="categories-title">
      <SectionHeader
        id="categories-title"
        title="Catégories de billets"
        description="Prix, capacité, frais Wave et catégories réservées aux invitations."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" /> Nouvelle catégorie
          </button>
        }
      />
      <div style={{ marginTop: 16 }}>
        <DataTable
          caption="Catégories de billets"
          rows={categories}
          columns={columns}
          rowKey={(c) => c.id}
          loading={loading}
          renderCard={(c) => (
            <div className="data-list-row" style={{ alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <span className="cell-primary">{c.name}</span>
                <span className="data-list-meta" style={{ marginTop: 4 }}>
                  <span>{c.invitationOnly ? "Offert" : `${formatNumber(c.price)} ${currencyLabel(c.currency)}`}</span>
                  <span>
                    {formatNumber(issuedCount(c.id))} / {c.stock === null ? "illimitée" : formatNumber(c.stock)}
                  </span>
                  {c.invitationOnly && <StatusBadge tone="violet">Invitations</StatusBadge>}
                  {c.chargeWaveFees && <StatusBadge tone="info" dot={false}>Frais Wave</StatusBadge>}
                </span>
              </div>
              <ActionMenu
                label={`Actions pour ${c.name}`}
                items={[
                  { label: "Modifier", icon: Pencil, onSelect: () => setEditing(c) },
                  { label: "Supprimer", icon: Trash2, danger: true, onSelect: () => void handleDelete(c) },
                ]}
              />
            </div>
          )}
          empty={
            <EmptyState
              icon={Tags}
              title="Aucune catégorie"
              description="La billetterie publique n'affichera rien tant qu'au moins une catégorie n'est pas créée."
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(null)}>
                  <Plus size={14} strokeWidth={2} aria-hidden="true" /> Créer une catégorie
                </button>
              }
            />
          }
        />
      </div>
      {archivedCount > 0 && (
        <div className="card-footer">
          <p className="field-hint" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Archive size={14} strokeWidth={2} aria-hidden="true" />
            {plural(archivedCount, "catégorie historique masquée", "catégories historiques masquées")} (tombola) : conservée
            {archivedCount > 1 ? "s" : ""} en base et comptée{archivedCount > 1 ? "s" : ""} dans les recettes et l&apos;historique.
          </p>
        </div>
      )}

      {editing !== undefined && (
        <CategoryDialog key={editing?.id ?? "new"} category={editing} onClose={() => setEditing(undefined)} onSaved={onChanged} />
      )}
    </Card>
  );
}
