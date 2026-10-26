"use client";

import { useMemo, useState } from "react";
import { Download, SearchX, Ticket as TicketIcon } from "lucide-react";
import TicketDrawer from "@/components/admin/TicketDrawer";
import { Card } from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { FilterToolbar, SearchInput, SegmentedFilter } from "@/components/ui/FilterToolbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAdminData } from "@/context/AdminDataContext";
import { useToast } from "@/context/ToastContext";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, shortRef } from "@/lib/format";
import { settlingPayments } from "@/lib/metrics";
import { ticketStatusMeta } from "@/lib/payments";
import { Ticket } from "@/lib/types";

type StatusFilter = "all" | "valid" | "used" | "cancelled";
type OriginFilter = "all" | "sold" | "invitation";

export default function TicketsPage() {
  const { tickets, payments, orderById, categoryById, categories, ready, loading } = useAdminData();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const invitationOrderIds = useMemo(() => {
    const ids = new Set<string>();
    settlingPayments(payments).forEach((payment, orderId) => {
      if (payment.method === "INVITATION") ids.add(orderId);
    });
    return ids;
  }, [payments]);

  // Catégories proposées au filtre : uniquement celles qui ont des billets
  // (les billets historiques, tombola comprise, restent consultables).
  const categoryOptions = useMemo(() => {
    const used = new Set(tickets.map((t) => t.ticketCategoryId));
    return categories.filter((c) => used.has(c.id));
  }, [tickets, categories]);

  const scoped = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets
      .filter((t) => categoryId === "all" || t.ticketCategoryId === categoryId)
      .filter((t) => {
        if (origin === "all") return true;
        const isInvitation = invitationOrderIds.has(t.orderId);
        return origin === "invitation" ? isInvitation : !isInvitation;
      })
      .filter((t) => {
        if (!term) return true;
        const order = orderById.get(t.orderId);
        return (
          t.code.toLowerCase().includes(term) ||
          t.orderId.toLowerCase().includes(term) ||
          (order?.buyerName ?? "").toLowerCase().includes(term)
        );
      });
  }, [tickets, orderById, search, categoryId, origin, invitationOrderIds]);

  const counts = useMemo(
    () => ({
      all: scoped.length,
      valid: scoped.filter((t) => t.status === "valid").length,
      used: scoped.filter((t) => t.status === "used").length,
      cancelled: scoped.filter((t) => t.status === "cancelled").length,
    }),
    [scoped],
  );

  const rows = useMemo(() => scoped.filter((t) => status === "all" || t.status === status), [scoped, status]);
  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  const columns: Column<Ticket>[] = [
    {
      id: "code",
      header: "Code",
      sortValue: (t) => t.code,
      cell: (t) => <span className="ref">{t.code}</span>,
    },
    {
      id: "holder",
      header: "Titulaire",
      sortValue: (t) => orderById.get(t.orderId)?.buyerName ?? "",
      cell: (t) => (
        <>
          <span className="cell-primary">{orderById.get(t.orderId)?.buyerName ?? "—"}</span>
          <span className="cell-secondary">Commande {shortRef(t.orderId)}</span>
        </>
      ),
    },
    {
      id: "category",
      header: "Catégorie",
      sortValue: (t) => categoryById.get(t.ticketCategoryId)?.name ?? "",
      cell: (t) => (
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {categoryById.get(t.ticketCategoryId)?.name ?? "—"}
          {invitationOrderIds.has(t.orderId) && (
            <StatusBadge tone="violet" dot={false}>
              Invitation
            </StatusBadge>
          )}
        </span>
      ),
    },
    {
      id: "status",
      header: "Statut",
      sortValue: (t) => t.status,
      cell: (t) => {
        const meta = ticketStatusMeta(t.status);
        return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
      },
    },
    {
      id: "usedAt",
      header: "Entrée",
      secondary: true,
      nowrap: true,
      sortValue: (t) => (t.usedAt ? new Date(t.usedAt).getTime() : 0),
      cell: (t) => <span className="text-secondary">{t.usedAt ? formatDateTime(t.usedAt) : "—"}</span>,
    },
    {
      id: "action",
      header: <span className="sr-only">Action</span>,
      align: "right",
      cell: (t) => (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedId(t.id);
          }}
        >
          Voir / imprimer
        </button>
      ),
    },
  ];

  function handleExport() {
    downloadCsv(
      `billets-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Code", "Titulaire", "Catégorie", "Origine", "Statut", "Entrée le", "Commande"],
      rows.map((t) => [
        t.code,
        orderById.get(t.orderId)?.buyerName ?? "",
        categoryById.get(t.ticketCategoryId)?.name ?? "",
        invitationOrderIds.has(t.orderId) ? "Invitation" : "Vente",
        ticketStatusMeta(t.status).label,
        t.usedAt ?? "",
        t.orderId,
      ]),
    );
    toast.success(`Export CSV téléchargé (${rows.length} billet${rows.length > 1 ? "s" : ""}).`);
  }

  const filtersActive = search.trim() !== "" || status !== "all" || origin !== "all" || categoryId !== "all";

  return (
    <>
      <FilterToolbar label="Filtrer par statut">
        <SegmentedFilter
          label="Statut"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Tous", count: counts.all },
            { value: "valid", label: "Valides", count: counts.valid },
            { value: "used", label: "Utilisés", count: counts.used },
            { value: "cancelled", label: "Annulés", count: counts.cancelled },
          ]}
        />
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={rows.length === 0}>
          <Download size={16} strokeWidth={2} aria-hidden="true" /> Exporter CSV
        </button>
      </FilterToolbar>

      <Card>
        <div className="card-header bordered">
          <FilterToolbar label="Rechercher un billet">
            <SearchInput label="Rechercher un billet" placeholder="Code, titulaire, commande…" value={search} onChange={setSearch} />
            <select
              className="select"
              aria-label="Catégorie"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="all">Toutes les catégories</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="Origine"
              value={origin}
              onChange={(e) => setOrigin(e.target.value as OriginFilter)}
            >
              <option value="all">Ventes et invitations</option>
              <option value="sold">Ventes</option>
              <option value="invitation">Invitations</option>
            </select>
          </FilterToolbar>
        </div>
        <DataTable
          caption="Billets émis"
          rows={rows}
          columns={columns}
          rowKey={(t) => t.id}
          loading={!ready && loading}
          pageSize={25}
          initialSort={{ id: "holder", direction: "asc" }}
          resetKey={`${search}|${status}|${origin}|${categoryId}`}
          onRowClick={(t) => setSelectedId(t.id)}
          rowLabel={(t) => `Ouvrir le billet ${t.code}`}
          renderCard={(t) => {
            const meta = ticketStatusMeta(t.status);
            return (
              <>
                <div className="data-list-row">
                  <span className="cell-primary truncate">{orderById.get(t.orderId)?.buyerName ?? "—"}</span>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </div>
                <div className="data-list-meta">
                  <span>{categoryById.get(t.ticketCategoryId)?.name ?? "—"}</span>
                  {invitationOrderIds.has(t.orderId) && <span>Invitation</span>}
                  <span className="ref">{t.code}</span>
                </div>
              </>
            );
          }}
          empty={
            filtersActive ? (
              <EmptyState
                icon={SearchX}
                title="Aucun billet ne correspond"
                description="Modifiez la recherche ou les filtres."
                action={
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSearch("");
                      setStatus("all");
                      setOrigin("all");
                      setCategoryId("all");
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={TicketIcon}
                title="Aucun billet émis"
                description="Les billets sont générés dès qu'un paiement est confirmé ou qu'une invitation est créée."
              />
            )
          }
        />
      </Card>

      {selected && (
        <TicketDrawer
          key={selected.id}
          ticket={selected}
          order={orderById.get(selected.orderId)}
          categoryName={categoryById.get(selected.ticketCategoryId)?.name ?? "Billet"}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
