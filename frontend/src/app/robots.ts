import type { MetadataRoute } from "next";

const SITE_URL = "https://gala-ticket.vercel.app";

// Espace admin non public (protégé par login, sans intérêt pour un moteur
// de recherche) — exclu du crawl. Le reste du site (accueil, achat de
// tickets) est librement indexable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
