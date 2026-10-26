import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; object-src 'none'" },
        ],
      },
    ];
  },
  // La page Tombola a été retirée de l'interface d'administration (le backend
  // et les données restent intacts) : un ancien favori ramène à la vue générale.
  async redirects() {
    return [
      {
        source: "/admin/dashboard/tombola",
        destination: "/admin/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
