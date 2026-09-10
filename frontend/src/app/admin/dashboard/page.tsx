"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { apiFetch } from "@/lib/api";
import { Order, Payment, TicketCategory } from "@/lib/types";
import { money } from "@/lib/format";
import CashModal from "@/components/CashModal";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { token, isLoading: authLoading, logout } = useAdminAuth();

  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cashModalOpen, setCashModalOpen] = useState(false);

  const loadData = useCallback(() => {
    if (!token) return;
    setLoadError(null);
    Promise.all([
      apiFetch<TicketCategory[]>("/ticket-categories"),
      apiFetch<Order[]>("/orders", { token }),
      apiFetch<Payment[]>("/payments", { token }),
    ])
      .then(([cats, ords, pays]) => {
        setCategories(cats);
        setOrders(ords);
        setPayments(pays);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Erreur inconnue"));
  }, [token]);

  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/admin/login");
      return;
    }
    loadData();
  }, [authLoading, token, router, loadData]);

  const categoryById = useMemo(() => {
    const map = new Map<string, TicketCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const orderById = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const paidOrders = orders.filter((o) => o.status === "paid");
  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const ticketsSold = paidOrders.reduce((sum, o) => sum + o.quantity, 0);
  const tombolaSold = paidOrders
    .filter((o) => categoryById.get(o.ticketCategoryId)?.name.toLowerCase().includes("tombola"))
    .reduce((sum, o) => sum + o.quantity, 0);
  const waveCount = payments.filter((p) => p.method === "wave").length;
  const cashCount = payments.filter((p) => p.method === "cash").length;
  const wavePct = payments.length ? Math.round((waveCount / payments.length) * 100) : 0;
  const cashPct = payments.length ? 100 - wavePct : 0;

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <section className="dashboard">
      <aside className="sidebar">
        <div className="brand dash-brand">
          <span className="logo-crop">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-requins.jpg" alt="" />
          </span>
          <span>
            <b>Gala Requins</b>
            <small>Administration</small>
          </span>
        </div>
        <nav>
          <button className="active" type="button">
            ⌂ <span>Vue générale</span>
          </button>
          <button type="button">
            ⇄ <span>Transactions</span>
          </button>
          <button type="button">
            ▣ <span>Tickets</span>
          </button>
          <button type="button">
            ◎ <span>Tombola</span>
          </button>
          <button type="button">
            ⌁ <span>Contrôle d&apos;accès</span>
          </button>
          <button type="button">
            ⚙ <span>Paramètres</span>
          </button>
        </nav>
        <button className="logout" type="button" onClick={handleLogout}>
          ↩ <span>Déconnexion</span>
        </button>
      </aside>

      <div className="dash-main">
        <header>
          <div>
            <h1>Bonjour, Administrateur</h1>
            <small>Compte administrateur unique</small>
          </div>
          <div className="dash-actions">
            <button className="admin-primary" type="button" onClick={() => setCashModalOpen(true)}>
              ＋ Générer des tickets espèces
            </button>
            <span className="avatar">AD</span>
          </div>
        </header>

        {loadError && (
          <div className="dash-alert">
            <span>!</span>
            <div>
              <b>Impossible de charger les données</b>
              <small>{loadError}</small>
            </div>
          </div>
        )}

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
            <em>tickets validés</em>
          </article>
          <article>
            <span>ENTRÉES</span>
            <b>—</b>
            <em>pas encore d&apos;endpoint de comptage côté API</em>
          </article>
        </div>

        <section className="panel split-panel" style={{ margin: "14px 0" }}>
          <div className="panel-head">
            <div>
              <span>PAIEMENTS</span>
              <h2>Répartition</h2>
            </div>
          </div>
          <div className="donut">
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
                {payments.map((p) => {
                  const order = orderById.get(p.orderId);
                  const category = order ? categoryById.get(order.ticketCategoryId) : undefined;
                  return (
                    <tr key={p.id}>
                      <td>#{p.id}</td>
                      <td>{order?.buyerName ?? "—"}</td>
                      <td>
                        {order ? `${order.quantity} × ${category?.name ?? "?"}` : "—"}
                      </td>
                      <td>{p.method === "wave" ? "Wave" : "Espèces"}</td>
                      <td>{new Intl.NumberFormat("fr-FR").format(p.amount)}</td>
                      <td>
                        <span className="status paid">Payée</span>
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
      </div>

      <CashModal
        open={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        categories={categories}
        token={token}
        onConfirmed={loadData}
      />
    </section>
  );
}
