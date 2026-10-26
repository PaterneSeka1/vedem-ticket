"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  ChevronRight,
  Clock3,
  DoorOpen,
  Gift,
  ScanLine,
  ShieldCheck,
  Ticket,
  Wallet,
} from "lucide-react";
import { useAdminActions } from "@/components/admin/AdminShell";
import { Card, SectionHeader } from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import StatCard from "@/components/ui/StatCard";
import { MethodTag, StatusBadge } from "@/components/ui/StatusBadge";
import { useAdminData } from "@/context/AdminDataContext";
import { isTombolaCategory } from "@/lib/categories";
import { formatDateTime, formatNumber, formatOrderItems, money, plural, shortRef } from "@/lib/format";
import { computeDashboardMetrics } from "@/lib/metrics";
import { paymentStatusMeta } from "@/lib/payments";
import { Payment } from "@/lib/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { openSale } = useAdminActions();
  const { categories, orders, payments, tickets, categoryById, orderById, ready } = useAdminData();

  const metrics = useMemo(
    () => computeDashboardMetrics(orders, payments, tickets, categories),
    [orders, payments, tickets, categories],
  );

  const recentPayments = useMemo(
    () =>
      [...payments]
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        .slice(0, 8),
    [payments],
  );

  // Catégories affichées : toutes celles en vente + celles qui ont émis des
  // billets (dont historiques comme la tombola, pour ne masquer aucun chiffre).
  const categoryRows = metrics.byCategory.filter(
    (row) => row.issued > 0 || (!isTombolaCategory(row.category) && !row.category.invitationOnly),
  );

  const entryRate = metrics.ticketsIssued ? Math.round((metrics.entries / metrics.ticketsIssued) * 100) : 0;
  const pendingCount = metrics.pendingWave.length;
  const paidRevenueOrders = metrics.paidOrdersByMethod.WAVE + metrics.paidOrdersByMethod.CASH;

  const columns: Column<Payment>[] = [
    {
      id: "client",
      header: "Client",
      cell: (p) => {
        const order = orderById.get(p.orderId);
        return (
          <>
            <span className="cell-primary">{order?.buyerName ?? "—"}</span>
            <span className="cell-secondary">{order ? formatOrderItems(order, categoryById) : "—"}</span>
          </>
        );
      },
    },
    { id: "method", header: "Moyen", cell: (p) => <MethodTag method={p.method} /> },
    {
      id: "amount",
      header: "Montant",
      align: "right",
      cell: (p) => <span className="cell-amount">{amountLabel(p)}</span>,
    },
    {
      id: "status",
      header: "Statut",
      cell: (p) => {
        const meta = paymentStatusMeta(p.status);
        return <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>;
      },
    },
    { id: "date", header: "Date", nowrap: true, cell: (p) => <span className="text-secondary">{formatDateTime(p.createdAt)}</span> },
  ];

  function amountLabel(p: Payment) {
    if (p.method === "INVITATION") return "Offert";
    const order = orderById.get(p.orderId);
    return order ? money(order.totalAmount ?? 0) : "—";
  }

  const openPayment = (p: Payment) => router.push(`/admin/dashboard/transactions?payment=${p.id}`);

  return (
    <>
      {ready && pendingCount > 0 && (
        <div className="admin-banner" role="status">
          <Clock3 size={18} strokeWidth={2} aria-hidden="true" />
          <div>
            <b>{plural(pendingCount, "paiement Wave", "paiements Wave")} à vérifier</b> —{" "}
            {money(metrics.pendingWaveAmount)} attendus sur le compte Wave.
          </div>
          <Link href="/admin/dashboard/transactions?status=pending" className="btn btn-primary btn-sm">
            Vérifier <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="kpi-grid">
        <StatCard
          label="Recettes encaissées"
          icon={Wallet}
          tone="brand"
          loading={!ready}
          value={
            <>
              {formatNumber(metrics.revenue)}
              <small>FCFA</small>
            </>
          }
          hint={`${plural(paidRevenueOrders, "commande réglée", "commandes réglées")} · hors invitations et frais Wave`}
        />
        <StatCard
          label="Paiements à vérifier"
          icon={Clock3}
          tone="warning"
          loading={!ready}
          highlight={pendingCount > 0}
          href="/admin/dashboard/transactions?status=pending"
          value={formatNumber(pendingCount)}
          hint={pendingCount > 0 ? `${money(metrics.pendingWaveAmount)} attendus` : "Aucune capture en attente"}
        />
        <StatCard
          label="Billets émis"
          icon={Ticket}
          tone="info"
          loading={!ready}
          href="/admin/dashboard/tickets"
          value={formatNumber(metrics.ticketsIssued)}
          hint={`${formatNumber(metrics.ticketsSold)} vendus · ${formatNumber(metrics.ticketsInvitation)} invitations`}
        />
        <StatCard
          label="Entrées validées"
          icon={DoorOpen}
          tone="success"
          loading={!ready}
          href="/admin/dashboard/access-control"
          value={
            <>
              {formatNumber(metrics.entries)}
              <small>/ {formatNumber(metrics.ticketsIssued)}</small>
            </>
          }
          hint={`${entryRate} % des billets émis`}
        >
          <div
            className="meter"
            role="progressbar"
            aria-label="Taux d'entrée"
            aria-valuenow={entryRate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${entryRate}%`, background: "var(--success-600)" }} />
          </div>
        </StatCard>
      </div>

      <div className="overview-grid">
        <div style={{ display: "grid", gap: "var(--space-6)", minWidth: 0 }}>
          <Card>
            <SectionHeader
              title="Dernières transactions"
              description="Les 8 opérations les plus récentes"
              actions={
                <Link href="/admin/dashboard/transactions" className="btn btn-ghost btn-sm">
                  Tout voir <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
                </Link>
              }
            />
            <div style={{ marginTop: 16 }}>
              <DataTable
                caption="Dernières transactions"
                rows={recentPayments}
                columns={columns}
                rowKey={(p) => p.id}
                loading={!ready}
                onRowClick={openPayment}
                rowLabel={(p) => `Ouvrir la transaction ${shortRef(p.id)}`}
                highlightRow={(p) => p.method === "WAVE" && p.status === "pending"}
                pageSize={8}
                renderCard={(p) => {
                  const order = orderById.get(p.orderId);
                  const meta = paymentStatusMeta(p.status);
                  return (
                    <>
                      <div className="data-list-row">
                        <span className="cell-primary truncate">{order?.buyerName ?? "—"}</span>
                        <span className="cell-amount">{amountLabel(p)}</span>
                      </div>
                      <div className="data-list-row">
                        <span className="data-list-meta">
                          <MethodTag method={p.method} />
                          {formatDateTime(p.createdAt)}
                        </span>
                        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                      </div>
                    </>
                  );
                }}
                empty={
                  <EmptyState
                    compact
                    icon={Wallet}
                    title="Aucune transaction"
                    description="Les paiements Wave, espèces et invitations apparaîtront ici."
                  />
                }
              />
            </div>
          </Card>

          <Card>
            <SectionHeader title="Billets par catégorie" description="Émis (dont invitations) et capacité" />
            <div className="card-body">
              {!ready ? (
                <div style={{ display: "grid", gap: 16 }}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} height={28} />
                  ))}
                </div>
              ) : categoryRows.length === 0 ? (
                <EmptyState compact icon={Ticket} title="Aucune catégorie" />
              ) : (
                <div className="category-bars">
                  {categoryRows.map(({ category, issued, invitations, used }) => {
                    const capacity = category.stock;
                    const pct = capacity ? Math.min(100, Math.round((issued / capacity) * 100)) : null;
                    return (
                      <div key={category.id}>
                        <div className="category-bar-head">
                          <span className="truncate">
                            {category.name}
                            {isTombolaCategory(category) && (
                              <small> · historique</small>
                            )}
                          </span>
                          <b>
                            {formatNumber(issued)}
                            <small>{capacity !== null ? ` / ${formatNumber(capacity)}` : " · illimité"}</small>
                          </b>
                        </div>
                        <div className="meter" aria-hidden="true">
                          <span
                            style={{
                              width: `${pct ?? (metrics.ticketsIssued ? Math.round((issued / metrics.ticketsIssued) * 100) : 0)}%`,
                            }}
                          />
                        </div>
                        <p className="stat-card-hint" style={{ marginTop: 4 }}>
                          {formatNumber(invitations)} invitation{invitations > 1 ? "s" : ""} · {formatNumber(used)} entrée
                          {used > 1 ? "s" : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="overview-side">
          <Card>
            <SectionHeader title="Actions rapides" />
            <div className="card-body">
              <div className="quick-actions">
                <button type="button" className="quick-action" onClick={() => openSale("cash")}>
                  <span className="quick-action-icon">
                    <Banknote size={18} strokeWidth={2} />
                  </span>
                  <span>
                    <b>Vente espèces</b>
                    <small>Encaisser et générer des billets</small>
                  </span>
                  <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                </button>
                <button type="button" className="quick-action" onClick={() => openSale("invitation")}>
                  <span className="quick-action-icon">
                    <Gift size={18} strokeWidth={2} />
                  </span>
                  <span>
                    <b>Créer une invitation</b>
                    <small>Billets offerts, sans paiement</small>
                  </span>
                  <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                </button>
                <Link href="/admin/dashboard/transactions?status=pending" className="quick-action">
                  <span className="quick-action-icon">
                    <ShieldCheck size={18} strokeWidth={2} />
                  </span>
                  <span>
                    <b>Vérifier les paiements Wave</b>
                    <small>{pendingCount > 0 ? `${pendingCount} en attente` : "Aucun en attente"}</small>
                  </span>
                  <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
                <Link href="/admin/dashboard/access-control" className="quick-action">
                  <span className="quick-action-icon">
                    <ScanLine size={18} strokeWidth={2} />
                  </span>
                  <span>
                    <b>Ouvrir le scanner</b>
                    <small>Contrôle des entrées</small>
                  </span>
                  <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Répartition des recettes" description="Montants encaissés par moyen de paiement" />
            <div className="card-body">
              {!ready ? (
                <Skeleton height={80} />
              ) : (
                <RevenueSplit
                  wave={metrics.revenueByMethod.WAVE}
                  cash={metrics.revenueByMethod.CASH}
                  waveCount={metrics.paidOrdersByMethod.WAVE}
                  cashCount={metrics.paidOrdersByMethod.CASH}
                  invitationCount={metrics.paidOrdersByMethod.INVITATION}
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function RevenueSplit({
  wave,
  cash,
  waveCount,
  cashCount,
  invitationCount,
}: {
  wave: number;
  cash: number;
  waveCount: number;
  cashCount: number;
  invitationCount: number;
}) {
  const total = wave + cash;
  const wavePct = total ? Math.round((wave / total) * 100) : 0;
  const cashPct = total ? 100 - wavePct : 0;
  return (
    <>
      <div
        className="split-bar"
        role="img"
        aria-label={total ? `Wave ${wavePct} %, espèces ${cashPct} %` : "Aucune recette encaissée"}
      >
        {total > 0 && (
          <>
            <span style={{ width: `${wavePct}%`, background: "var(--method-wave)" }} />
            <span style={{ width: `${cashPct}%`, background: "var(--method-cash)" }} />
          </>
        )}
      </div>
      <div className="split-legend">
        <div className="split-legend-row">
          <i style={{ background: "var(--method-wave)" }} aria-hidden="true" />
          <span>
            Wave <small>{plural(waveCount, "commande")}</small>
          </span>
          <b>
            {money(wave)}
            <small>{wavePct} %</small>
          </b>
        </div>
        <div className="split-legend-row">
          <i style={{ background: "var(--method-cash)" }} aria-hidden="true" />
          <span>
            Espèces <small>{plural(cashCount, "commande")}</small>
          </span>
          <b>
            {money(cash)}
            <small>{cashPct} %</small>
          </b>
        </div>
        <div className="split-legend-row">
          <i style={{ background: "var(--method-invitation)" }} aria-hidden="true" />
          <span>
            Invitations <small>non comptées dans les recettes</small>
          </span>
          <b>{formatNumber(invitationCount)}</b>
        </div>
      </div>
    </>
  );
}
