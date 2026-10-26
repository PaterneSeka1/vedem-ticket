"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { ADMIN_NAV, isActive } from "./nav";

interface AdminSidebarProps {
  onLogout: () => void;
  /** Paiements Wave à vérifier — pastille sur « Transactions ». */
  pendingCount: number;
}

export default function AdminSidebar({ onLogout, pendingCount }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar is-inverse" aria-label="Administration">
      <Link href="/admin/dashboard" className="admin-brand" aria-label="Gala Requins — vue générale">
        <span className="logo-badge sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpeg" alt="" width={32} height={32} />
        </span>
        <span className="admin-brand-text">
          <b>Gala Requins</b>
          <small>Administration</small>
        </span>
      </Link>

      <nav className="admin-nav" aria-label="Sections">
        {ADMIN_NAV.map((group) => (
          <div className="admin-nav-group" key={group.label}>
            <span className="admin-nav-label">{group.label}</span>
            {group.items.map((item) => {
              const count = item.href === "/admin/dashboard/transactions" ? pendingCount : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="admin-nav-link"
                  aria-current={isActive(item, pathname) ? "page" : undefined}
                  title={item.label}
                  aria-label={count > 0 ? `${item.label} — ${count} paiement(s) à vérifier` : item.label}
                >
                  <item.Icon size={18} strokeWidth={2} aria-hidden="true" />
                  <span>{item.label}</span>
                  {count > 0 && (
                    <span className="admin-nav-count" aria-hidden="true">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <div className="admin-profile">
          <span className="avatar" aria-hidden="true">
            AD
          </span>
          <div>
            <b>Administrateur</b>
            <small>Compte unique</small>
          </div>
          <button type="button" className="admin-profile-action" onClick={onLogout} aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut size={17} strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
