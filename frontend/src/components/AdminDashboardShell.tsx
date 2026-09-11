"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminData } from "@/context/AdminDataContext";
import AdminSidebar from "./AdminSidebar";
import CashModal from "./CashModal";

/**
 * Habillage commun à tout /admin/dashboard/** : sidebar, en-tête (avec
 * l'action rapide "Générer des tickets espèces", utile quel que soit
 * l'onglet actif) et bandeau d'erreur de chargement. Le contenu propre à
 * chaque onglet est rendu en `children` par les pages filles.
 */
export default function AdminDashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, logout } = useAdminAuth();
  const { categories, loadError, refresh } = useAdminData();
  const [cashModalOpen, setCashModalOpen] = useState(false);

  function handleLogout() {
    logout();
    router.push("/");
  }

  // Session admin expirée/révoquée (401) : on ne peut plus rien faire sur ce
  // token, autant renvoyer directement vers l'écran de connexion.
  function handleUnauthorized() {
    logout();
    router.replace("/admin/login");
  }

  return (
    <section className="dashboard">
      <AdminSidebar onLogout={handleLogout} />

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
          <div className="dash-alert error">
            <span>!</span>
            <div>
              <b>Impossible de charger les données</b>
              <small>{loadError}</small>
            </div>
          </div>
        )}

        {children}
      </div>

      <CashModal
        open={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        categories={categories}
        token={token}
        onConfirmed={refresh}
        onUnauthorized={handleUnauthorized}
      />
    </section>
  );
}
