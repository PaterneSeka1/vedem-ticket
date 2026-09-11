import type { MetadataRoute } from "next";

const SITE_URL = "https://gala-ticket.vercel.app";

// Seules les pages publiques et durables sont listées : /checkout et
// /success sont des étapes transactionnelles (état propre à chaque
// acheteur), et /admin/** est un espace privé — aucune des deux n'a de sens
// à faire remonter dans un moteur de recherche.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/tickets`, lastModified, changeFrequency: "weekly", priority: 0.8 },
  ];
}
