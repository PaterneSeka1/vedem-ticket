"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { TicketCategory } from "@/lib/types";

const MAX_QTY = 20;

interface CartContextValue {
  categories: TicketCategory[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  quantities: Record<string, number>;
  // Une seule catégorie peut être sélectionnée à la fois (contrainte de l'API :
  // une commande = une ticketCategoryId + une quantity).
  setQuantity: (categoryId: string, qty: number) => void;
  selectedCategoryId: string | null;
  selectedCategory: TicketCategory | null;
  selectedQuantity: number;
  total: number;
  reset: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Pas de setState synchrone ici : tout passe par les callbacks then/catch/finally
  // de la requête, pour rester utilisable directement dans l'effect de montage.
  const load = useCallback(() => {
    apiFetch<TicketCategory[]>("/ticket-categories")
      .then((data) => {
        setCategories(data);
        const initial: Record<string, number> = {};
        data.forEach((c) => (initial[c.id] = 0));
        if (data[0]) initial[data[0].id] = 1;
        setQuantities(initial);
        setSelectedCategoryId(data[0]?.id ?? null);
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
    setQuantities((prev) => {
      // Une seule catégorie active : dès qu'on choisit une quantité > 0
      // sur une catégorie, les autres repassent à 0.
      const next: Record<string, number> = {};
      Object.keys(prev).forEach((id) => (next[id] = 0));
      next[categoryId] = clamped;
      return next;
    });
    setSelectedCategoryId(clamped > 0 ? categoryId : null);
  }, []);

  const reset = useCallback(() => {
    setQuantities((prev) => {
      const next: Record<string, number> = {};
      Object.keys(prev).forEach((id) => (next[id] = 0));
      if (categories[0]) next[categories[0].id] = 1;
      return next;
    });
    setSelectedCategoryId(categories[0]?.id ?? null);
  }, [categories]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const selectedQuantity = selectedCategoryId ? quantities[selectedCategoryId] ?? 0 : 0;
  const total = selectedCategory ? selectedCategory.price * selectedQuantity : 0;

  return (
    <CartContext.Provider
      value={{
        categories,
        loading,
        error,
        reload,
        quantities,
        setQuantity,
        selectedCategoryId,
        selectedCategory,
        selectedQuantity,
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
