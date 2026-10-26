"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useToast } from "@/context/ToastContext";

/**
 * Token admin + traitement unique d'une session expirée/révoquée (401) :
 * déconnexion et retour à l'écran de connexion. Remplace les copies de
 * `handleUnauthorized` dupliquées dans chaque page/modale.
 */
export function useAdminSession() {
  const router = useRouter();
  const { token, logout } = useAdminAuth();
  const toast = useToast();

  const handleUnauthorized = useCallback(() => {
    toast.error("Session expirée — reconnectez-vous.");
    logout();
    router.replace("/admin/login");
  }, [logout, router, toast]);

  return { token, logout, handleUnauthorized };
}
