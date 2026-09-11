"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { ApiError } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      router.push("/admin/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Trop de tentatives, réessaie plus tard.");
      } else if (err instanceof ApiError && err.status === 401) {
        setError("Identifiant ou mot de passe incorrect.");
      } else {
        setError("Connexion impossible, réessaie.");
      }
      setSubmitting(false);
    }
  }

  return (
    <>
      <Topbar />
      {/* Carte centrée sur fond navy (même habillage que la page /success) —
          un seul compte administrateur, pas d'inscription ni de récupération
          de mot de passe en libre-service (voir CLAUDE.md §7). */}
      <section className="success-screen">
        <div className="success-card admin-login-card">
          <Link href="/" className="back">
            ← Retour au site
          </Link>

          <div className="logo-crop admin-login-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="Logo Requins Féroces" />
          </div>

          <span className="section-kicker">Espace privé</span>
          <h1>Bienvenue</h1>
          <p className="admin-login-lead">Connectez-vous pour accéder au tableau de bord administrateur.</p>

          <form className="admin-login-form" onSubmit={handleSubmit}>
            <label>
              Identifiant
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <div className="cash-error">{error}</div>}
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Connexion…" : "Se connecter →"}
            </button>
          </form>

          <p className="admin-login-note">Accès réservé à l&apos;administrateur du Dîner-Gala.</p>
        </div>
      </section>
    </>
  );
}
