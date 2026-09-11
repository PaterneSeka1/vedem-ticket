"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { TicketCategory } from "@/lib/types";

const MAX_QTY = 20;

export interface CartLine {
  category: TicketCategory;
  quantity: number;
}

interface CartContextValue {
  categories: TicketCategory[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  quantities: Record<string, number>;
  setQuantity: (categoryId: string, qty: number) => void;
  // Une commande peut porter sur plusieurs catégories différentes (voir
  // CLAUDE.md §4) : `items` liste toutes les catégories dont la quantité > 0.
  items: CartLine[];
  totalQuantity: number;
  total: number;
  reset: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Pas de setState synchrone ici : tout passe par les callbacks then/catch/finally
  // de la requête, pour rester utilisable directement dans l'effect de montage.
  const load = useCallback(() => {
    apiFetch<TicketCategory[]>("/ticket-categories")
      .then((data) => {
        setCategories(data);
        const initial: Record<string, number> = {};
        data.forEach((c) => (initial[c.id] = 0));
        setQuantities(initial);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inconnue"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Version pour un rechargement déclenché par l'utilisateur (pas un effect) :
  // remet loading/error à leur état initial avant de relancer la requête.
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    load();
  }, [load]);

  const setQuantity = useCallback((categoryId: string, qty: number) => {
    const clamped = Math.max(0, Math.min(MAX_QTY, qty));
    setQuantities((prev) => ({ ...prev, [categoryId]: clamped }));
  }, []);

  const reset = useCallback(() => {
    setQuantities((prev) => {
      const next: Record<string, number> = {};
      Object.keys(prev).forEach((id) => (next[id] = 0));
      return next;
    });
  }, []);

  const items = useMemo<CartLine[]>(
    () =>
      categories
        .map((category) => ({ category, quantity: quantities[category.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [categories, quantities],
  );

  const totalQuantity = useMemo(() => items.reduce((sum, line) => sum + line.quantity, 0), [items]);
  const total = useMemo(
    () => items.reduce((sum, line) => sum + line.category.price * line.quantity, 0),
    [items],
  );

  return (
    <CartContext.Provider
      value={{
        categories,
        loading,
        error,
        reload,
        quantities,
        setQuantity,
        items,
        totalQuantity,
        total,
        reset,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé à l'intérieur de <CartProvider>");
  return ctx;
}
