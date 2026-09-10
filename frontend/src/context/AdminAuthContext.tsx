"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { LoginResponse } from "@/lib/types";

const STORAGE_KEY = "vedem-admin-token";

interface AdminAuthContextValue {
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    setToken(stored);
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // POST /auth/login — répond 401 si identifiants invalides, 429 si trop de tentatives.
    const data = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    localStorage.setItem(STORAGE_KEY, data.accessToken);
    setToken(data.accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ token, isLoading, login, logout }}>
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
