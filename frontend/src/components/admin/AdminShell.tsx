"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  ExternalLink,
  Gift,
  LogOut,
  Menu,
  RotateCw,
  Settings,
} from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { useAdminData } from "@/context/AdminDataContext";
import { useConfirm } from "@/context/ConfirmContext";
import { useAdminSession } from "@/hooks/useAdminSession";
import { formatRelative } from "@/lib/format";
import AdminSidebar from "./AdminSidebar";
import SaleDialog, { SaleMode } from "./SaleDialog";
import { currentNavItem, isActive, navItem } from "./nav";

interface AdminActions {
  openSale: (mode: SaleMode) => void;
}

const AdminActionsContext = createContext<AdminActions | null>(null);

/** Actions globales de l'administration (vente espèces, invitation) accessibles depuis n'importe quelle page. */
export function useAdminActions(): AdminActions {
  const ctx = useContext(AdminActionsContext);
  if (!ctx) throw new Error("useAdminActions doit être utilisé à l'intérieur de <AdminShell>");
  return ctx;
}

/** Horloge minute pour « actualisé il y a … » (re-rendu léger, sans setState dans le corps d'effet). */
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Habillage de tout /admin/dashboard/** : sidebar (desktop), rail
 * (tablette), barre basse + menu (mobile), topbar contextualisée (titre,
 * description, actualisation, actions rapides) et dialogue de vente.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAdminSession();
  const { payments, categories, loading, ready, loadError, lastUpdatedAt, refresh } = useAdminData();
  const confirm = useConfirm();
  const now = useNow();
  const [saleMode, setSaleMode] = useState<SaleMode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const pendingCount = useMemo(
    () => payments.filter((p) => p.method === "WAVE" && p.status === "pending").length,
    [payments],
  );
  const current = currentNavItem(pathname);
  const actions = useMemo<AdminActions>(() => ({ openSale: (mode) => setSaleMode(mode) }), []);

  async function handleLogout() {
    setMenuOpen(false);
    const ok = await confirm({
      title: "Se déconnecter ?",
      message: "Vous devrez saisir à nouveau votre identifiant et votre mot de passe pour revenir au tableau de bord.",
      confirmLabel: "Se déconnecter",
    });
    if (!ok) return;
    logout();
    router.push("/");
  }

  function openSale(mode: SaleMode) {
    setMenuOpen(false);
    setSaleMode(mode);
  }

  const refreshing = loading && ready;

  return (
    <AdminActionsContext.Provider value={actions}>
      <div className="admin">
        <AdminSidebar onLogout={handleLogout} pendingCount={pendingCount} />

        <div className="admin-main">
          <header className="admin-topbar">
            <Link href="/admin/dashboard" className="admin-mobile-brand" aria-label="Vue générale">
              <span className="logo-badge sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpeg" alt="" width={32} height={32} />
              </span>
            </Link>
            <div className="admin-topbar-title">
              <h1>{current.title}</h1>
              <p>{current.description}</p>
            </div>
            <div className="admin-topbar-actions">
              {lastUpdatedAt && (
                <span className="admin-updated hide-tablet" aria-live="polite">
                  {refreshing ? "Actualisation…" : `Actualisé ${formatRelative(lastUpdatedAt, now)}`}
                </span>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={refresh}
                disabled={loading}
                aria-label="Actualiser les données"
                title="Actualiser"
              >
                <RotateCw size={16} strokeWidth={2} className={loading ? "spin" : undefined} />
              </button>
              <button type="button" className="btn btn-secondary hide-mobile" onClick={() => setSaleMode("invitation")}>
                <Gift size={16} strokeWidth={2} aria-hidden="true" /> <span className="hide-tablet">Invitation</span>
                <span className="sr-only">Créer une invitation</span>
              </button>
              <button type="button" className="btn btn-primary hide-mobile" onClick={() => setSaleMode("cash")}>
                <Banknote size={16} strokeWidth={2} aria-hidden="true" /> Vente espèces
              </button>
            </div>
          </header>

          <main id="contenu" className="admin-content">
            {loadError && (
              <div className="callout" data-tone="danger" role="alert">
                <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
                <div style={{ flex: 1 }}>
                  <span className="callout-title">Impossible de charger les données</span>
                  {loadError}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={refresh}>
                  Réessayer
                </button>
              </div>
            )}
            {children}
          </main>
        </div>

        <MobileNav pathname={pathname} pendingCount={pendingCount} onMenu={() => setMenuOpen(true)} />

        <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" size="sm">
          <nav className="sheet-menu" aria-label="Menu secondaire">
            <button type="button" onClick={() => openSale("cash")}>
              <span className="sheet-menu-icon">
                <Banknote size={18} strokeWidth={2} />
              </span>
              Vente espèces
            </button>
            <button type="button" onClick={() => openSale("invitation")}>
              <span className="sheet-menu-icon">
                <Gift size={18} strokeWidth={2} />
              </span>
              Créer une invitation
            </button>
            <Link href="/admin/dashboard/settings" onClick={() => setMenuOpen(false)}>
              <span className="sheet-menu-icon">
                <Settings size={18} strokeWidth={2} />
              </span>
              Paramètres
            </Link>
            <Link href="/" target="_blank" onClick={() => setMenuOpen(false)}>
              <span className="sheet-menu-icon">
                <ExternalLink size={18} strokeWidth={2} />
              </span>
              Voir le site public
            </Link>
            <div className="sheet-menu-separator" />
            <button type="button" className="danger" onClick={handleLogout}>
              <span className="sheet-menu-icon">
                <LogOut size={18} strokeWidth={2} />
              </span>
              Se déconnecter
            </button>
          </nav>
        </Dialog>

        <SaleDialog
          // Remonté à chaque ouverture : le formulaire repart à zéro.
          key={saleMode ?? "closed"}
          open={saleMode !== null}
          mode={saleMode ?? "cash"}
          onClose={() => setSaleMode(null)}
          categories={categories}
          onCompleted={refresh}
        />
      </div>
    </AdminActionsContext.Provider>
  );
}

const MOBILE_ITEMS = [
  "/admin/dashboard",
  "/admin/dashboard/transactions",
  "/admin/dashboard/access-control",
  "/admin/dashboard/tickets",
];

function MobileNav({ pathname, pendingCount, onMenu }: { pathname: string | null; pendingCount: number; onMenu: () => void }) {
  return (
    <nav className="admin-mobile-nav" aria-label="Navigation">
      {MOBILE_ITEMS.map((href) => {
        const item = navItem(href);
        const isScan = href === "/admin/dashboard/access-control";
        const count = href === "/admin/dashboard/transactions" ? pendingCount : 0;
        return (
          <Link
            key={href}
            href={href}
            className={isScan ? "nav-scan" : undefined}
            aria-current={isActive(item, pathname) ? "page" : undefined}
            aria-label={count > 0 ? `${item.shortLabel} — ${count} à vérifier` : undefined}
          >
            {isScan ? (
              <span className="nav-scan-icon" aria-hidden="true">
                <item.Icon size={18} strokeWidth={2.2} />
              </span>
            ) : (
              <item.Icon size={20} strokeWidth={2} aria-hidden="true" />
            )}
            {item.shortLabel}
            {count > 0 && (
              <span className="admin-nav-count" aria-hidden="true">
                {count}
              </span>
            )}
          </Link>
        );
      })}
      <button type="button" onClick={onMenu} aria-haspopup="dialog">
        <Menu size={20} strokeWidth={2} aria-hidden="true" />
        Menu
      </button>
    </nav>
  );
}
