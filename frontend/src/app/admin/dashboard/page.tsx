"use client";

import { useMemo } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import { formatOrderItems, money } from "@/lib/format";

export default function AdminDashboardPage() {
  const { categories, orders, payments, tickets, categoryById, orderById } = useAdminData();

  const paidOrders = orders.filter((o) => o.status === "paid");
  // Le backend ne renvoie pas de champ `amount` sur un paiement (ce n'est pas
  // un montant partiel indépendant) : on retrouve le montant via la commande
  // liée (`order.totalAmount`), déjà chargée dans `orderById`.
  const successfulPayments = payments.filter((p) => p.status === "success");
  const totalRevenue = successfulPayments.reduce(
    (sum, p) => sum + (orderById.get(p.orderId)?.totalAmount ?? 0),
    0,
  );
  // Une commande peut porter sur plusieurs catégories (voir CLAUDE.md §4) :
  // on somme la quantité de chaque item plutôt qu'un unique `order.quantity`.
  const ticketsSold = paidOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, item) => s + item.quantity, 0),
    0,
  );
  const tombolaSold = paidOrders.reduce(
    (sum, o) =>
      sum +
      o.items
        .filter((item) => categoryById.get(item.ticketCategoryId)?.name.toLowerCase().includes("tombola"))
        .reduce((s, item) => s + item.quantity, 0),
    0,
  );
  const waveCount = successfulPayments.filter((p) => p.method === "WAVE").length;
  const wavePct = successfulPayments.length ? Math.round((waveCount / successfulPayments.length) * 100) : 0;
  const cashPct = successfulPayments.length ? 100 - wavePct : 0;
  const entriesCount = tickets.filter((t) => t.status === "used").length;

  // "Dernières transactions" : les plus récentes d'abord, pas tout l'historique
  // (voir l'onglet Transactions pour la liste complète avec filtres).
  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 10);
  }, [payments]);

  return (
    <>
      <div className="stats">
        <article>
          <span>RECETTES TOTALES</span>
          <b>{money(totalRevenue)}</b>
          <em>{payments.length} paiement(s) enregistré(s)</em>
        </article>
        <article>
          <span>TICKETS VENDUS</span>
          <b>{ticketsSold}</b>
          <em>{paidOrders.length} commande(s) payée(s)</em>
        </article>
        <article>
          <span>TOMBOLA</span>
          <b>{tombolaSold}</b>
          <em>{categories.some((c) => c.name.toLowerCase().includes("tombola")) ? "tickets vendus" : "aucune catégorie tombola"}</em>
        </article>
        <article>
          <span>ENTRÉES</span>
          <b>{entriesCount}</b>
          <em>ticket(s) scanné(s) à l&apos;entrée</em>
        </article>
      </div>

      <section className="panel split-panel" style={{ margin: "14px 0" }}>
        <div className="panel-head">
          <div>
            <span>PAIEMENTS</span>
            <h2>Répartition</h2>
          </div>
        </div>
        <div
          className="donut"
          style={{ background: `conic-gradient(var(--blue) 0 ${wavePct}%, var(--gold) ${wavePct}%)` }}
        >
          <b>{money(totalRevenue).replace(" FCFA", "")}</b>
          <span>Total</span>
        </div>
        <div className="legend">
          <span>
            <i className="wave-dot"></i>Wave Business <b>{wavePct} %</b>
          </span>
          <span>
            <i className="cash-dot"></i>Espèces <b>{cashPct} %</b>
          </span>
        </div>
      </section>

      <section className="panel transactions">
        <div className="panel-head">
          <div>
            <span>ACTIVITÉ RÉCENTE</span>
            <h2>Dernières transactions</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Client</th>
                <th>Produit</th>
                <th>Paiement</th>
                <th>Montant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.map((p) => {
                const order = orderById.get(p.orderId);
                const statusLabel =
                  p.status === "success" ? "Payée" : p.status === "pending" ? "En attente" : "Échouée";
                const statusClass =
                  p.status === "success" ? "paid" : p.status === "pending" ? "pending" : "failed";
                return (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>{order?.buyerName ?? "—"}</td>
                    <td>{order ? formatOrderItems(order, categoryById) : "—"}</td>
                    <td>{p.method === "WAVE" ? "Wave" : "Espèces"}</td>
                    <td>{order ? new Intl.NumberFormat("fr-FR").format(order.totalAmount ?? 0) : "—"}</td>
                    <td>
                      <span className={`status ${statusClass}`}>{statusLabel}</span>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                    Aucune transaction pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
