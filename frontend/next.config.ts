import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
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
