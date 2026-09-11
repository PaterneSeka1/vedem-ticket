"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { useAdminData } from "@/context/AdminDataContext";
import { useToast } from "@/context/ToastContext";
import AdminTicketModal from "@/components/AdminTicketModal";
import { downloadCsv } from "@/lib/csv";
import { Ticket } from "@/lib/types";

type StatusFilter = "all" | "valid" | "used" | "cancelled";

const STATUS_LABEL: Record<string, string> = { valid: "Valide", used: "Utilisé", cancelled: "Annulé" };
const STATUS_CLASS: Record<string, string> = { valid: "paid", used: "pending", cancelled: "failed" };

export default function TicketsPage() {
  const { tickets, orderById, categoryById, categories, loading } = useAdminData();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets
      .filter((t) => status === "all" || t.status === status)
      .filter((t) => categoryId === "all" || t.ticketCategoryId === categoryId)
      .filter((t) => {
        if (!term) return true;
        const order = orderById.get(t.orderId);
        return t.code.toLowerCase().includes(term) || order?.buyerName.toLowerCase().includes(term);
      });
  }, [tickets, orderById, search, status, categoryId]);

  function handleExport() {
    downloadCsv(
      "tickets.csv",
      ["Code", "Client", "Catégorie", "Statut", "Utilisé le"],
      rows.map((t) => {
        const order = orderById.get(t.orderId);
        const category = categoryById.get(t.ticketCategoryId);
        return [
          t.code,
          order?.buyerName ?? "",
          category?.name ?? "",
          STATUS_LABEL[t.status] ?? t.status,
          t.usedAt ?? "",
        ];
      }),
    );
    toast.success("Export CSV téléchargé.");
  }

  return (
    <section className="panel transactions">
      <div className="panel-head">
        <div>
          <span>BILLETTERIE</span>
          <h2>Tickets</h2>
        </div>
        <button type="button" onClick={handleExport} disabled={rows.length === 0}>
          Exporter ↓
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Rechercher un code, un client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">Tous les statuts</option>
          <option value="valid">Valide</option>
          <option value="used">Utilisé</option>
          <option value="cancelled">Annulé</option>
        </select>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="all">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Client</th>
              <th>Catégorie</th>
              <th>Statut</th>
              <th>Utilisé le</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const order = orderById.get(t.orderId);
              const category = categoryById.get(t.ticketCategoryId);
              return (
                <tr key={t.id}>
                  <td>{t.code}</td>
                  <td>{order?.buyerName ?? "—"}</td>
                  <td>{category?.name ?? "—"}</td>
                  <td>
                    <span className={`status ${STATUS_CLASS[t.status] ?? ""}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td>{t.usedAt ? new Date(t.usedAt).toLocaleString("fr-FR") : "—"}</td>
                  <td>
                    <button type="button" className="table-action" onClick={() => setSelectedTicket(t)}>
                      <Printer size={14} strokeWidth={2.2} />
                      Voir / imprimer
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                  Aucun ticket ne correspond. Les tickets sont générés dès qu&apos;une commande est payée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminTicketModal
        key={selectedTicket ? selectedTicket.id : "none"}
        ticket={selectedTicket}
        buyerName={selectedTicket ? orderById.get(selectedTicket.orderId)?.buyerName ?? "—" : ""}
        categoryName={selectedTicket ? categoryById.get(selectedTicket.ticketCategoryId)?.name ?? "—" : ""}
        onClose={() => setSelectedTicket(null)}
      />
    </section>
  );
}
