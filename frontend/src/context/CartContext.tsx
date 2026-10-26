"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { estimateWaveFees, isSoldOut, operationalCategories, remainingPlaces } from "@/lib/categories";
import { FALLBACK_EVENT_SETTINGS, getEventSettings } from "@/lib/event";
import { TicketCategory } from "@/lib/types";

export const MAX_QTY_PER_CATEGORY = 20;

// Panier conservé le temps de la session de navigation : un rechargement de
// /checkout ne le vide plus. sessionStorage (et non localStorage) : un panier
// abandonné ne doit pas réapparaître des jours plus tard.
const CART_STORAGE_KEY = "vedem-cart";

function readStoredQuantities(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0,
      ),
    );
  } catch {
    return {};
  }
}

function writeStoredQuantities(quantities: Record<string, number>) {
  try {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(quantities));
  } catch {
    // Stockage indisponible (navigation privée…) : le panier reste en mémoire.
  }
}

export interface CartLine {
  category: TicketCategory;
  quantity: number;
}

interface CartContextValue {
  /** Catégories proposées à la vente (sans la tombola, voir lib/categories.ts). */
  categories: TicketCategory[];
  /** Toutes les catégories publiques, tombola comprise — pour nommer des billets déjà émis. */
  allPublicCategories: TicketCategory[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  quantities: Record<string, number>;
  setQuantity: (categoryId: string, qty: number) => void;
  maxQuantityFor: (category: TicketCategory) => number;
  // Une commande peut porter sur plusieurs catégories différentes (voir
  // CLAUDE.md §4) : `items` liste toutes les catégories dont la quantité > 0.
  items: CartLine[];
  totalQuantity: number;
  /** Prix des billets (hors frais Wave). */
  total: number;
  /** Frais Wave estimés (miroir du calcul serveur, indicatif). */
  waveFees: number;
  reset: () => void;
  // Date/lieu configurables par l'admin (voir lib/event.ts).
  eventDate: string;
  eventLocation: string;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [allPublicCategories, setAllPublicCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [eventSettings, setEventSettings] = useState(FALLBACK_EVENT_SETTINGS);

  // Pas de setState synchrone ici : tout passe par les callbacks then/catch/finally
  // de la requête, pour rester utilisable directement dans l'effect de montage.
  const load = useCallback(() => {
    apiFetch<TicketCategory[]>("/ticket-categories")
      .then((data) => {
        setAllPublicCategories(data);
        // Restaure le panier de la session, limité aux catégories encore en
        // vente (une catégorie supprimée ou épuisée entre-temps est ignorée).
        const stored = readStoredQuantities();
        const next: Record<string, number> = {};
        operationalCategories(data).forEach((c) => {
          next[c.id] = isSoldOut(c) ? 0 : Math.min(stored[c.id] ?? 0, MAX_QTY_PER_CATEGORY, remainingPlaces(c) ?? Infinity);
        });
        setQuantities(next);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erreur inconnue"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    getEventSettings().then(setEventSettings);
  }, [load]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    load();
  }, [load]);

  const categories = useMemo(() => operationalCategories(allPublicCategories), [allPublicCategories]);

  const maxQuantityFor = useCallback(
    (category: TicketCategory) =>
      isSoldOut(category) ? 0 : Math.min(MAX_QTY_PER_CATEGORY, remainingPlaces(category) ?? MAX_QTY_PER_CATEGORY),
    [],
  );

  const setQuantity = useCallback(
    (categoryId: string, qty: number) => {
      const category = categories.find((c) => c.id === categoryId);
      const max = category ? maxQuantityFor(category) : MAX_QTY_PER_CATEGORY;
      setQuantities((prev) => {
        const next = { ...prev, [categoryId]: Math.max(0, Math.min(max, qty)) };
        writeStoredQuantities(next);
        return next;
      });
    },
    [categories, maxQuantityFor],
  );

  const reset = useCallback(() => {
    setQuantities((prev) => {
      const next: Record<string, number> = {};
      Object.keys(prev).forEach((id) => (next[id] = 0));
      writeStoredQuantities({});
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
  const total = useMemo(() => items.reduce((sum, line) => sum + line.category.price * line.quantity, 0), [items]);
  const waveFees = useMemo(() => estimateWaveFees(items), [items]);

  return (
    <CartContext.Provider
      value={{
        categories,
        allPublicCategories,
        loading,
        error,
        reload,
        quantities,
        setQuantity,
        maxQuantityFor,
        items,
        totalQuantity,
        total,
        waveFees,
        reset,
        eventDate: eventSettings.date,
        eventLocation: eventSettings.location,
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
