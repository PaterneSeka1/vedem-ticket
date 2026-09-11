"use client";

import { createContext, useContext, useSyncExternalStore, ReactNode, useCallback } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { LoginResponse } from "@/lib/types";

const STORAGE_KEY = "vedem-admin-token";

// Le token vit dans localStorage (source de vérité). On le lit via
// useSyncExternalStore plutôt que via un useState+useEffect : ça évite tout
// setState synchrone dans un effect et le décalage d'hydratation SSR (le
// serveur n'a pas accès à localStorage).
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

function writeStoredToken(token: string | null) {
  if (token) localStorage.setItem(STORAGE_KEY, token);
  else localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((listener) => listener());
}

interface AdminAuthContextValue {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback(async (username: string, password: string) => {
    // POST /auth/login — répond 401 si identifiants invalides, 429 si trop de tentatives.
    const data = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    writeStoredToken(data.accessToken);
  }, []);

  const logout = useCallback(() => {
    writeStoredToken(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth doit être utilisé à l'intérieur de <AdminAuthProvider>");
  return ctx;
}

export { ApiError };
