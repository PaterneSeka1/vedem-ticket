"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "./AdminAuthContext";
import { useToast } from "./ToastContext";
import { apiFetch, isUnauthorized } from "@/lib/api";
import { Order, Payment, Ticket, TicketCategory } from "@/lib/types";

// Données partagées par tout l'espace /admin/dashboard (chargées une seule
// fois par le layout, consommées par chaque onglet) : évite de refaire les
// mêmes 4 requêtes à chaque changement d'onglet et garde les données
// cohérentes entre elles (ex: rafraîchir après un encaissement espèces met à
// jour l'onglet actif, quel qu'il soit).
interface AdminDataContextValue {
  categories: TicketCategory[];
  orders: Order[];
  payments: Payment[];
  tickets: Ticket[];
  categoryById: Map<string, TicketCategory>;
  orderById: Map<string, Order>;
  loading: boolean;
  loadError: string | null;
  refresh: () => void;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { token, logout } = useAdminAuth();
  const toast = useToast();

  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Session admin expirée/révoquée (401) : plus rien à faire avec ce token,
  // autant renvoyer directement vers le login (voir CashModal, pattern identique).
  const handleUnauthorized = useCallback(() => {
    toast.error("Session expirée — reconnecte-toi.");
    logout();
    router.replace("/admin/login");
  }, [logout, router, toast]);

  // Pas de setState synchrone ici : tout passe par then/catch/finally, pour
  // rester utilisable directement dans l'effect de montage.
  const loadData = useCallback(() => {
    if (!token) return;
    Promise.all([
      apiFetch<TicketCategory[]>("/ticket-categories"),
      apiFetch<Order[]>("/orders", { token }),
      apiFetch<Payment[]>("/payments", { token }),
      apiFetch<Ticket[]>("/tickets", { token }),
    ])
      .then(([cats, ords, pays, tkts]) => {
        setCategories(cats);
        setOrders(ords);
        setPayments(pays);
        setTickets(tkts);
      })
      .catch((err) => {
        if (isUnauthorized(err)) {
          handleUnauthorized();
          return;
        }
        setLoadError(err instanceof Error ? err.message : "Erreur inconnue");
      })
      .finally(() => setLoading(false));
  }, [token, handleUnauthorized]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Rechargement déclenché par l'utilisateur (ex: après un encaissement
  // espèces, ou la création d'une catégorie) : remet l'erreur à zéro avant de
  // relancer la requête.
  const refresh = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    loadData();
  }, [loadData]);

  const categoryById = useMemo(() => {
    const map = new Map<string, TicketCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const orderById = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  return (
    <AdminDataContext.Provider
      value={{ categories, orders, payments, tickets, categoryById, orderById, loading, loadError, refresh }}
    >
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error("useAdminData doit être utilisé à l'intérieur de <AdminDataProvider>");
  return ctx;
}
