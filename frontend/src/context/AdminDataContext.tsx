"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAdminSession } from "@/hooks/useAdminSession";
import { apiFetch, isUnauthorized } from "@/lib/api";
import { FALLBACK_EVENT_SETTINGS } from "@/lib/event";
import { EventSettings, Order, Payment, Ticket, TicketCategory } from "@/lib/types";

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
  eventSettings: EventSettings;
  categoryById: Map<string, TicketCategory>;
  orderById: Map<string, Order>;
  /** Une requête est en cours (chargement initial ou actualisation). */
  loading: boolean;
  /** Le premier chargement a abouti : les listes vides signifient « vraiment vide ». */
  ready: boolean;
  loadError: string | null;
  /** Horodatage (ms) du dernier chargement réussi. */
  lastUpdatedAt: number | null;
  refresh: () => void;
  /** Reflète localement un scan validé par le serveur, sans recharger les 5 jeux de données. */
  markTicketUsed: (code: string, usedAt: string | null) => void;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { token, handleUnauthorized } = useAdminSession();

  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings>(FALLBACK_EVENT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Pas de setState synchrone ici : tout passe par then/catch/finally, pour
  // rester utilisable directement dans l'effect de montage.
  const loadData = useCallback(() => {
    if (!token) return;
    Promise.all([
      // Route admin : inclut les catégories réservées aux invitations (VVIP).
      apiFetch<TicketCategory[]>("/ticket-categories/all", { token }),
      apiFetch<Order[]>("/orders", { token }),
      apiFetch<Payment[]>("/payments", { token }),
      apiFetch<Ticket[]>("/tickets", { token }),
      apiFetch<EventSettings>("/event-settings"),
    ])
      .then(([cats, ords, pays, tkts, event]) => {
        setCategories(cats);
        setOrders(ords);
        setPayments(pays);
        setTickets(tkts);
        setEventSettings(event);
        setReady(true);
        setLastUpdatedAt(Date.now());
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

  const markTicketUsed = useCallback((code: string, usedAt: string | null) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.code === code ? { ...ticket, status: "used", usedAt: usedAt ?? new Date().toISOString() } : ticket,
      ),
    );
  }, []);

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
      value={{
        categories,
        orders,
        payments,
        tickets,
        eventSettings,
        categoryById,
        orderById,
        loading,
        ready,
        loadError,
        lastUpdatedAt,
        refresh,
        markTicketUsed,
      }}
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
