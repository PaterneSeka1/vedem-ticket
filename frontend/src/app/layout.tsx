import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
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

// Inter : interface (lisibilité, chiffres tabulaires). Fraunces : titres
// éditoriaux de la partie publique et du billet (registre « gala »).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-fraunces", axes: ["opsz"] });

export const viewport: Viewport = {
  themeColor: "#061f3f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
    <html lang="fr" data-scroll-behavior="smooth" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <a href="#contenu" className="skip-link">
          Aller au contenu
        </a>
        <ToastProvider>
          <ConfirmProvider>
            <AdminAuthProvider>
              <CartProvider>
                {children}
              </CartProvider>
            </AdminAuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
