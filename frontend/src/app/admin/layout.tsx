import type { Metadata } from "next";

// S'applique à /admin/login et à tout /admin/dashboard/** (layout parent) :
// espace privé, à ne jamais indexer — en plus du Disallow dans robots.ts,
// au cas où l'URL serait tout de même découverte (ex: lien interne suivi
// avant le blocage du crawl).
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
