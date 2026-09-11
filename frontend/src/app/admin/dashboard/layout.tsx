"use client";

import { useEffect, useState } from "react";
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
// dès cet instant enverrait à tort vers /login : on laisse passer un premier
// effect (donc après hydratation, une fois `token` resynchronisé avec le
// localStorage réel) avant de trancher.
export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token } = useAdminAuth();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

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
