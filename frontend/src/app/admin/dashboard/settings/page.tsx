"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminData } from "@/context/AdminDataContext";
import { apiFetch, ApiError, isUnauthorized } from "@/lib/api";
import { TicketCategory } from "@/lib/types";
import CategoryModal from "@/components/CategoryModal";
import { useToast } from "@/context/ToastContext";
import { useConfirm } from "@/context/ConfirmContext";

export default function SettingsPage() {
  const router = useRouter();
  const { token, logout } = useAdminAuth();
  const { categories, orders, refresh, loading } = useAdminData();
  const toast = useToast();
  const confirm = useConfirm();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TicketCategory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleUnauthorized() {
    toast.error("Session expirée — reconnecte-toi.");
    logout();
    router.replace("/admin/login");
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(category: TicketCategory) {
    setEditing(category);
    setModalOpen(true);
  }

  async function handleDelete(category: TicketCategory) {
    const ordersUsingIt = orders.filter((o) => o.items.some((item) => item.ticketCategoryId === category.id)).length;
    const ok = await confirm({
      title: `Supprimer « ${category.name} » ?`,
      message:
        ordersUsingIt > 0
          ? `${ordersUsingIt} commande(s) référencent déjà cette catégorie. La supprimer n'affecte pas ces commandes mais elle disparaîtra immédiatement de la billetterie.`
          : "Cette action est définitive et retire la catégorie de la billetterie publique.",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;

    setDeletingId(category.id);
    setDeleteError(null);
    try {
      await apiFetch(`/ticket-categories/${category.id}`, { method: "DELETE", token });
      refresh();
      toast.success(`Catégorie « ${category.name} » supprimée.`);
    } catch (err) {
      if (isUnauthorized(err)) {
        handleUnauthorized();
        return;
      }
      const message = err instanceof ApiError ? err.message : "Suppression impossible.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <section className="panel transactions">
        <div className="panel-head">
          <div>
            <span>ÉVÉNEMENT</span>
            <h2>Catégories de tickets</h2>
          </div>
          <button className="admin-primary" type="button" onClick={openCreate}>
            <Plus size={17} strokeWidth={2.5} /> Nouvelle catégorie
          </button>
        </div>

        {deleteError && <div className="cash-error" style={{ padding: "0 4px 10px" }}>{deleteError}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prix</th>
                <th>Stock</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    {new Intl.NumberFormat("fr-FR").format(c.price)} {c.currency}
                  </td>
                  <td>{c.stock === null ? "Illimité" : c.stock}</td>
                  <td>{c.description || "—"}</td>
                  <td style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" className="table-action" onClick={() => openEdit(c)}>
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="table-action"
                      onClick={() => handleDelete(c)}
                      disabled={deletingId === c.id}
                    >
                      {deletingId === c.id ? "…" : "Supprimer"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && categories.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                    Aucune catégorie pour l&apos;instant — la billetterie publique n&apos;affichera rien tant
                    qu&apos;au moins une catégorie n&apos;est pas créée ici.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <CategoryModal
          // Force un remount à chaque ouverture (création ou catégorie éditée
          // différente) : l'état initial du formulaire se dérive des props
          // sans effect de réinitialisation (voir CategoryModal).
          key={editing?.id ?? "new"}
          onClose={() => setModalOpen(false)}
          category={editing}
          token={token}
          onSaved={refresh}
          onUnauthorized={handleUnauthorized}
        />
      )}
    </>
  );
}
