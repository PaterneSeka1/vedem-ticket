import type { Metadata } from "next";
import { CartProvider } from "@/context/CartContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dîner-Gala — Requins Féroces",
  description: "Billetterie officielle du Dîner-Gala des Requins Féroces.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AdminAuthProvider>
          <CartProvider>
            <main>{children}</main>
          </CartProvider>
        </AdminAuthProvider>
      </body>
    </html>
  );
}
