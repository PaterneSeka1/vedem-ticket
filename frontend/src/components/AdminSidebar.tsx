"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  LayoutGrid,
  LogOut,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Vue générale", Icon: LayoutGrid },
  { href: "/admin/dashboard/transactions", label: "Transactions", Icon: ArrowLeftRight },
  { href: "/admin/dashboard/tickets", label: "Tickets", Icon: Ticket },
  { href: "/admin/dashboard/tombola", label: "Tombola", Icon: Sparkles },
  { href: "/admin/dashboard/access-control", label: "Contrôle d'accès", Icon: ShieldCheck },
  { href: "/admin/dashboard/settings", label: "Paramètres", Icon: Settings },
];

export default function AdminSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand dash-brand">
        <span className="logo-crop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" />
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
          const Icon = item.Icon;
          return (
            <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
              <Icon size={17} strokeWidth={2.2} /> <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <button className="logout" type="button" onClick={onLogout}>
        <LogOut size={17} strokeWidth={2.2} /> <span>Déconnexion</span>
      </button>
    </aside>
  );
}
