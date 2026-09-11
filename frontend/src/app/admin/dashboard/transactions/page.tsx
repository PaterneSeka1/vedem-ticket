"use client";

import { useMemo, useState } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import { useToast } from "@/context/ToastContext";
import { downloadCsv } from "@/lib/csv";
import { formatOrderItems } from "@/lib/format";

type StatusFilter = "all" | "success" | "pending" | "failed";
type MethodFilter = "all" | "WAVE" | "CASH";

const STATUS_LABEL: Record<string, string> = { success: "Payée", pending: "En attente", failed: "Échouée" };
const STATUS_CLASS: Record<string, string> = { success: "paid", pending: "pending", failed: "failed" };

export default function TransactionsPage() {
  const { payments, orderById, categoryById, loading } = useAdminData();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [method, setMethod] = useState<MethodFilter>("all");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...payments]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .filter((p) => status === "all" || p.status === status)
      .filter((p) => method === "all" || p.method === method)
      .filter((p) => {
        if (!term) return true;
        const order = orderById.get(p.orderId);
        return (
          p.id.toLowerCase().includes(term) ||
          order?.buyerName.toLowerCase().includes(term) ||
          order?.buyerPhone.toLowerCase().includes(term)
        );
      });
  }, [payments, orderById, search, status, method]);

  function handleExport() {
    downloadCsv(
      "transactions.csv",
      ["Référence", "Client", "Téléphone", "Produit", "Paiement", "Montant", "Statut", "Date"],
      rows.map((p) => {
        const order = orderById.get(p.orderId);
        return [
          p.id,
          order?.buyerName ?? "",
          order?.buyerPhone ?? "",
          order ? formatOrderItems(order, categoryById) : "",
          p.method === "WAVE" ? "Wave" : "Espèces",
          order?.totalAmount ?? "",
          STATUS_LABEL[p.status] ?? p.status,
          p.createdAt ?? "",
        ];
      }),
    );
    toast.success("Export CSV téléchargé.");
  }

  return (
    <section className="panel transactions">
      <div className="panel-head">
        <div>
          <span>SUIVI DES PAIEMENTS</span>
          <h2>Transactions</h2>
        </div>
        <button type="button" onClick={handleExport} disabled={rows.length === 0}>
          Exporter ↓
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Rechercher un client, un téléphone, une référence…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">Tous les statuts</option>
          <option value="success">Payée</option>
          <option value="pending">En attente</option>
          <option value="failed">Échouée</option>
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value as MethodFilter)}>
          <option value="all">Tous les moyens</option>
          <option value="WAVE">Wave</option>
          <option value="CASH">Espèces</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Référence</th>
              <th>Client</th>
              <th>Téléphone</th>
              <th>Produit</th>
              <th>Paiement</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const order = orderById.get(p.orderId);
              return (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td>{order?.buyerName ?? "—"}</td>
                  <td>{order?.buyerPhone ?? "—"}</td>
                  <td>{order ? formatOrderItems(order, categoryById) : "—"}</td>
                  <td>{p.method === "WAVE" ? "Wave" : "Espèces"}</td>
                  <td>{order ? new Intl.NumberFormat("fr-FR").format(order.totalAmount ?? 0) : "—"}</td>
                  <td>
                    <span className={`status ${STATUS_CLASS[p.status] ?? ""}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                  Aucune transaction ne correspond.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
