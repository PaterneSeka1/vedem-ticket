"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Vue générale", icon: "⌂" },
  { href: "/admin/dashboard/transactions", label: "Transactions", icon: "⇄" },
  { href: "/admin/dashboard/tickets", label: "Tickets", icon: "▣" },
  { href: "/admin/dashboard/tombola", label: "Tombola", icon: "◎" },
  { href: "/admin/dashboard/access-control", label: "Contrôle d'accès", icon: "⌁" },
  { href: "/admin/dashboard/settings", label: "Paramètres", icon: "⚙" },
];

export default function AdminSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();

  return (
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
        {NAV_ITEMS.map((item) => {
          // "Vue générale" est la racine du segment : elle ne doit être active
          // que sur une correspondance exacte, sinon elle resterait active sur
          // toutes les sous-pages (préfixe commun à toutes les routes).
          const active = item.href === "/admin/dashboard" ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
              {item.icon} <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <button className="logout" type="button" onClick={onLogout}>
        ↩ <span>Déconnexion</span>
      </button>
    </aside>
  );
}
