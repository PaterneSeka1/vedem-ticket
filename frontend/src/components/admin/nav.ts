import { ArrowLeftRight, LayoutGrid, LucideIcon, ScanLine, Settings, Ticket } from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Libellé court (barre de navigation mobile). */
  shortLabel: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}

// La page Tombola a été retirée de l'interface (le backend et les données
// restent intacts, voir lib/categories.ts) : `/admin/dashboard/tombola`
// redirige vers la vue générale (next.config.ts).
export const ADMIN_NAV: { label: string; items: AdminNavItem[] }[] = [
  {
    label: "Pilotage",
    items: [
      {
        href: "/admin/dashboard",
        label: "Vue générale",
        shortLabel: "Accueil",
        title: "Vue générale",
        description: "Recettes, paiements à vérifier et entrées en temps réel.",
        Icon: LayoutGrid,
      },
      {
        href: "/admin/dashboard/transactions",
        label: "Transactions",
        shortLabel: "Paiements",
        title: "Transactions",
        description: "Paiements Wave, espèces et invitations.",
        Icon: ArrowLeftRight,
      },
      {
        href: "/admin/dashboard/tickets",
        label: "Billets",
        shortLabel: "Billets",
        title: "Billets",
        description: "Billets émis, statuts et réimpression.",
        Icon: Ticket,
      },
    ],
  },
  {
    label: "Événement",
    items: [
      {
        href: "/admin/dashboard/access-control",
        label: "Contrôle d'accès",
        shortLabel: "Scanner",
        title: "Contrôle d'accès",
        description: "Validation des billets à l'entrée.",
        Icon: ScanLine,
      },
      {
        href: "/admin/dashboard/settings",
        label: "Paramètres",
        shortLabel: "Paramètres",
        title: "Paramètres",
        description: "Informations de l'événement et catégories de billets.",
        Icon: Settings,
      },
    ],
  },
];

const ALL_ITEMS = ADMIN_NAV.flatMap((group) => group.items);

export function isActive(item: AdminNavItem, pathname: string | null): boolean {
  // « Vue générale » est la racine du segment : active seulement sur une
  // correspondance exacte, sinon elle le serait sur toutes les sous-pages.
  return item.href === "/admin/dashboard" ? pathname === item.href : !!pathname?.startsWith(item.href);
}

export function currentNavItem(pathname: string | null): AdminNavItem {
  return ALL_ITEMS.find((item) => isActive(item, pathname)) ?? ALL_ITEMS[0];
}

export function navItem(href: string): AdminNavItem {
  return ALL_ITEMS.find((item) => item.href === href) ?? ALL_ITEMS[0];
}
