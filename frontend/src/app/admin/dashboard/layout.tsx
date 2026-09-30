"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { AdminDataProvider } from "@/context/AdminDataContext";
import AdminDashboardShell from "@/components/AdminDashboardShell";

// Protège tout /admin/dashboard/** : sans token, on ne rend rien et on
// redirige vers le login.
//
// Sur un rechargement direct d'une sous-page (ex: F5 sur /admin/dashboard/tickets),
// le premier rendu client reproduit le rendu serveur — donc `token` vaut la
// snapshot serveur (`null`, `useAdminAuth`/`useSyncExternalStore` n'a pas
// encore lu le vrai localStorage) même si une session valide existe. Rediriger
// dès cet instant enverrait à tort vers /login : on attend la fin de
// l'hydratation (`hydrated`, qui bascule dans le même rendu que `token`
// resynchronisé avec le localStorage réel) avant de trancher.
const subscribeNoop = () => () => {};

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token } = useAdminAuth();
  const hydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/admin/login");
    }
  }, [hydrated, token, router]);

  if (!hydrated || !token) return null;

  return (
    <AdminDataProvider>
      <AdminDashboardShell>{children}</AdminDashboardShell>
    </AdminDataProvider>
  );
}
