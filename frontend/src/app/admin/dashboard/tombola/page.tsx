"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAdminData } from "@/context/AdminDataContext";

// Convention déjà utilisée en "Vue générale" : la tombola n'est pas un objet
// métier à part, c'est une TicketCategory (nom/prix/stock) dont le nom
// contient "tombola" — voir CLAUDE.md §5, aucune entité dédiée n'est modélisée.
function isTombola(name: string | undefined) {
  return (name ?? "").toLowerCase().includes("tombola");
}

export default function TombolaPage() {
  const { tickets, categories, orderById, categoryById } = useAdminData();

  const tombolaCategories = useMemo(() => categories.filter((c) => isTombola(c.name)), [categories]);

  const tombolaTickets = useMemo(
    () => tickets.filter((t) => isTombola(categoryById.get(t.ticketCategoryId)?.name)),
    [tickets, categoryById],
  );

  const usedCount = tombolaTickets.filter((t) => t.status === "used").length;

  if (tombolaCategories.length === 0) {
    return (
      <section className="panel transactions">
        <div className="panel-head">
          <div>
            <span>TOMBOLA</span>
            <h2>Aucune catégorie tombola</h2>
          </div>
        </div>
        <p style={{ color: "var(--muted)", padding: "8px 4px 16px" }}>
          Créez une catégorie de tickets dont le nom contient « Tombola » depuis{" "}
          <Link href="/admin/dashboard/settings" className="text-link" style={{ padding: 0 }}>
            Paramètres
          </Link>{" "}
          pour voir apparaître les numéros vendus ici.
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="stats">
        <article>
          <span>NUMÉROS VENDUS</span>
          <b>{tombolaTickets.length}</b>
          <em>tous lots confondus</em>
        </article>
        <article>
          <span>VALIDÉS À L&apos;ENTRÉE</span>
          <b>{usedCount}</b>
          <em>sur {tombolaTickets.length} numéro(s)</em>
        </article>
      </div>

      <section className="panel transactions" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <div>
            <span>TOMBOLA</span>
            <h2>Numéros vendus</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Numéro (code)</th>
                <th>Client</th>
                <th>Lot</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {tombolaTickets.map((t) => {
                const order = orderById.get(t.orderId);
                const category = categoryById.get(t.ticketCategoryId);
                return (
                  <tr key={t.id}>
                    <td>{t.code}</td>
                    <td>{order?.buyerName ?? "—"}</td>
                    <td>{category?.name ?? "—"}</td>
                    <td>
                      <span className={`status ${t.status === "used" ? "pending" : "paid"}`}>
                        {t.status === "used" ? "Validé" : "Non scanné"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {tombolaTickets.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>
                    Aucun numéro vendu pour l&apos;instant.
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
