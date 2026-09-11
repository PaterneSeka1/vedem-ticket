import type { Metadata } from "next";
import { CartProvider } from "@/context/CartContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import "./globals.css";

// URL canonique du site (alias Vercel stable — voir DEPLOYMENT.md). Sert de
// base aux URLs absolues requises par Open Graph/Twitter (image, url) et au
// sitemap/robots.txt ci-dessous ; à mettre à jour si un domaine personnalisé
// est ajouté un jour.
const SITE_URL = "https://gala-ticket.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Dîner-Gala — Requins Féroces",
  description: "Billetterie officielle du Dîner-Gala des Requins Féroces.",
  keywords: ["Dîner-Gala", "Requins Féroces", "billetterie", "tickets", "événement", "Abidjan"],
  openGraph: {
    title: "Dîner-Gala — Requins Féroces",
    description: "Billetterie officielle du Dîner-Gala des Requins Féroces.",
    url: SITE_URL,
    siteName: "Dîner-Gala — Requins Féroces",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dîner-Gala — Requins Féroces",
    description: "Billetterie officielle du Dîner-Gala des Requins Féroces.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <ToastProvider>
          <ConfirmProvider>
            <AdminAuthProvider>
              <CartProvider>
                <main>{children}</main>
              </CartProvider>
            </AdminAuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
