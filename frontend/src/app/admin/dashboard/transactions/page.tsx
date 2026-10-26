"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, SearchX, Wallet } from "lucide-react";
import PaymentDrawer from "@/components/admin/PaymentDrawer";
import { Card } from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { FilterToolbar, SearchInput, SegmentedFilter } from "@/components/ui/FilterToolbar";
import { MethodTag, StatusBadge } from "@/components/ui/StatusBadge";
import { useAdminData } from "@/context/AdminDataContext";
import { useToast } from "@/context/ToastContext";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, formatOrderItems, money, shortRef } from "@/lib/format";
import { methodLabel, paymentStatusMeta } from "@/lib/payments";
import { Payment } from "@/lib/types";

type StatusFilter = "all" | "pending" | "success" | "failed";
type MethodFilter = "all" | "WAVE" | "CASH" | "INVITATION";

const STATUS_FILTERS: StatusFilter[] = ["all", "pending", "success", "failed"];

const byNewest = (a: Payment, b: Payment) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();

function TransactionsContent() {
  const { payments, orderById, categoryById, ready, loading, refresh } = useAdminData();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Filtre de statut et transaction ouverte vivent dans l'URL : liens
  // directs depuis la vue générale (« Vérifier »), retour arrière cohérent.
  const statusParam = params.get("status") as StatusFilter | null;
  const status: StatusFilter = statusParam && STATUS_FILTERS.includes(statusParam) ? statusParam : "all";
  const openId = params.get("payment");

  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<MethodFilter>("all");

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const counts = useMemo(() => {
    const scoped = payments.filter((p) => method === "all" || p.method === method);
    return {
      all: scoped.length,
      pending: scoped.filter((p) => p.status === "pending").length,
      success: scoped.filter((p) => p.status === "success").length,
      failed: scoped.filter((p) => p.status === "failed").length,
    };
  }, [payments, method]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const termDigits = term.replace(/\D/g, "");
    return payments
      .filter((p) => status === "all" || p.status === status)
      .filter((p) => method === "all" || p.method === method)
      .filter((p) => {
        if (!term) return true;
        const order = orderById.get(p.orderId);
        // Téléphone absent (null) pour une invitation : jamais d'appel de
        // méthode dessus (plantait la recherche avant la refonte).
        const phoneDigits = (order?.buyerPhone ?? "").replace(/\D/g, "");
        return (
          p.id.toLowerCase().includes(term) ||
          p.orderId.toLowerCase().includes(term) ||
          (order?.buyerName ?? "").toLowerCase().includes(term) ||
          (termDigits.length >= 3 && phoneDigits.includes(termDigits)) ||
          (order?.accessCode ?? "").toLowerCase().includes(term.replace("-", ""))
        );
      })
      .sort(byNewest);
  }, [payments, orderById, search, status, method]);

  const pendingQueue = useMemo(
    () => payments.filter((p) => p.method === "WAVE" && p.status === "pending").sort((a, b) => -byNewest(a, b)),
    [payments],
  );

  const openPayment = payments.find((p) => p.id === openId) ?? null;
  const nextPending = openPayment ? (pendingQueue.find((p) => p.id !== openPayment.id) ?? null) : null;

  const amountOf = (p: Payment) => (p.method === "INVITATION" ? 0 : (orderById.get(p.orderId)?.totalAmount ?? 0));

  const columns: Column<Payment>[] = [
    {
      id: "ref",
      header: "Référence",
      secondary: true,
      sortValue: (p) => p.id,
      cell: (p) => <span className="ref">{shortRef(p.id)}</span>,
    },
    {
      id: "client",
      header: "Client",
      sortValue: (p) => orderById.get(p.orderId)?.buyerName ?? "",
      cell: (p) => {
        const order = orderById.get(p.orderId);
        return (
          <>
            <span className="cell-primary">{order?.buyerName ?? "—"}</span>
            <span className="cell-secondary">{order?.buyerPhone || "Sans téléphone"}</span>
          </>
        );
      },
    },
    {
      id: "items",
      header: "Billets",
      secondary: true,
      cell: (p) => {
        const order = orderById.get(p.orderId);
        return <span className="text-secondary">{order ? formatOrderItems(order, categoryById) : "—"}</span>;
      },
    },
    { id: "method", header: "Moyen", cell: (p) => <MethodTag method={p.method} /> },
    {
      id: "amount",
      header: "Montant",
      align: "right",
      sortValue: amountOf,
      cell: (p) => {
        const order = orderById.get(p.orderId);
        if (p.method === "INVITATION") return <span className="text-tertiary">Offert</span>;
        return (
          <>
            <span className="cell-amount">{order ? money(order.totalAmount ?? 0) : "—"}</span>
            {!!order?.waveFees && p.method === "WAVE" && (
              <span className="cell-secondary">+ {money(order.waveFees)} frais</span>
            )}
          </>
        );
      },
    },
    {
      id: "status",
      header: "Statut",
      sortValue: (p) => p.status,
      cell: (p) => {
        const meta = paymentStatusMeta(p.status);
        return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
      },
    },
    {
      id: "date",
      header: "Date",
      nowrap: true,
      sortValue: (p) => new Date(p.createdAt ?? 0).getTime(),
      cell: (p) => <span className="text-secondary">{formatDateTime(p.createdAt)}</span>,
    },
    {
      id: "action",
      header: <span className="sr-only">Action</span>,
      align: "right",
      cell: (p) =>
        p.method === "WAVE" && p.status === "pending" ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={(event) => {
              event.stopPropagation();
              setParam("payment", p.id);
            }}
          >
            Vérifier
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(event) => {
              event.stopPropagation();
              setParam("payment", p.id);
            }}
          >
            Détails
          </button>
        ),
    },
  ];

  function handleExport() {
    downloadCsv(
      `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Référence", "Commande", "Client", "Téléphone", "Billets", "Moyen", "Montant billets", "Frais Wave", "Statut", "Date"],
      rows.map((p) => {
        const order = orderById.get(p.orderId);
        return [
          p.id,
          p.orderId,
          order?.buyerName ?? "",
          order?.buyerPhone ?? "",
          order ? formatOrderItems(order, categoryById) : "",
          methodLabel(p.method),
          p.method === "INVITATION" ? 0 : (order?.totalAmount ?? ""),
          p.method === "WAVE" ? (order?.waveFees ?? 0) : 0,
          paymentStatusMeta(p.status).label,
          p.createdAt ?? "",
        ];
      }),
    );
    toast.success(`Export CSV téléchargé (${rows.length} ligne${rows.length > 1 ? "s" : ""}).`);
  }

  const filtersActive = search.trim() !== "" || status !== "all" || method !== "all";

  return (
    <>
      <FilterToolbar label="Filtrer les transactions">
        <SegmentedFilter
          label="Statut"
          value={status}
          onChange={(value) => setParam("status", value === "all" ? null : value)}
          options={[
            { value: "all", label: "Toutes", count: counts.all },
            { value: "pending", label: "À vérifier", count: counts.pending, tone: "warning" },
            { value: "success", label: "Confirmées", count: counts.success },
            { value: "failed", label: "Refusées", count: counts.failed },
          ]}
        />
        <div className="toolbar-spacer" />
        <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={rows.length === 0}>
          <Download size={16} strokeWidth={2} aria-hidden="true" /> Exporter CSV
        </button>
      </FilterToolbar>

      <Card>
        <div className="card-header bordered">
          <FilterToolbar label="Rechercher">
            <SearchInput
              label="Rechercher une transaction"
              placeholder="Client, téléphone, référence, code…"
              value={search}
              onChange={setSearch}
            />
            <select
              className="select"
              aria-label="Moyen de paiement"
              value={method}
              onChange={(e) => setMethod(e.target.value as MethodFilter)}
            >
              <option value="all">Tous les moyens</option>
              <option value="WAVE">Wave</option>
              <option value="CASH">Espèces</option>
              <option value="INVITATION">Invitations</option>
            </select>
          </FilterToolbar>
        </div>
        <DataTable
          caption="Transactions"
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          loading={!ready && loading}
          initialSort={{ id: "date", direction: "desc" }}
          resetKey={`${search}|${status}|${method}`}
          onRowClick={(p) => setParam("payment", p.id)}
          rowLabel={(p) => `Ouvrir la transaction ${shortRef(p.id)}`}
          highlightRow={(p) => p.method === "WAVE" && p.status === "pending"}
          renderCard={(p) => {
            const order = orderById.get(p.orderId);
            const meta = paymentStatusMeta(p.status);
            return (
              <>
                <div className="data-list-row">
                  <span className="cell-primary truncate">{order?.buyerName ?? "—"}</span>
                  <span className="cell-amount">
                    {p.method === "INVITATION" ? "Offert" : order ? money(order.totalAmount ?? 0) : "—"}
                  </span>
                </div>
                <div className="data-list-row">
                  <span className="data-list-meta">
                    <MethodTag method={p.method} />
                    <span className="ref">{shortRef(p.id)}</span>
                    {formatDateTime(p.createdAt)}
                  </span>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </div>
                {p.method === "WAVE" && p.status === "pending" && (
                  <span className="btn btn-primary btn-sm btn-block" aria-hidden="true">
                    Vérifier la capture
                  </span>
                )}
              </>
            );
          }}
          empty={
            filtersActive ? (
              <EmptyState
                icon={SearchX}
                title="Aucune transaction ne correspond"
                description="Modifiez la recherche ou les filtres."
                action={
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSearch("");
                      setMethod("all");
                      setParam("status", null);
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={Wallet}
                title="Aucune transaction pour l'instant"
                description="Les paiements Wave, les ventes en espèces et les invitations apparaîtront ici."
              />
            )
          }
        />
      </Card>

      {openPayment && (
        <PaymentDrawer
          key={openPayment.id}
          payment={openPayment}
          order={orderById.get(openPayment.orderId)}
          categoryById={categoryById}
          onClose={() => setParam("payment", null)}
          onProcessed={refresh}
          nextPending={nextPending}
          onOpenPayment={(p) => setParam("payment", p.id)}
        />
      )}
    </>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsContent />
    </Suspense>
  );
}
