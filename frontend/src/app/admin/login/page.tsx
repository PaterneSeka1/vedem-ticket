"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import FormField from "@/components/ui/FormField";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api";
import { EVENT_NAME, EVENT_ORG } from "@/lib/event";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      toast.success("Connexion réussie.");
      router.push("/admin/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Trop de tentatives. Réessayez dans quelques minutes.");
      } else if (err instanceof ApiError && err.status === 401) {
        setError("Identifiant ou mot de passe incorrect.");
      } else {
        setError("Connexion impossible. Vérifiez votre réseau et réessayez.");
      }
      setSubmitting(false);
    }
  }

  // Un seul compte administrateur, sans inscription ni récupération de mot
  // de passe en libre-service (voir CLAUDE.md §7).
  return (
    <div className="login-page">
      <aside className="login-visual is-inverse" aria-hidden="true">
        <div className="site-brand" style={{ color: "var(--white)" }}>
          <span className="logo-badge">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpeg" alt="" width={40} height={40} />
          </span>
          <span className="site-brand-text">
            <b>{EVENT_ORG}</b>
            <small style={{ color: "var(--text-inverse-muted)" }}>{EVENT_NAME}</small>
          </span>
        </div>
        <div>
          <h2>Administration de la billetterie</h2>
          <p>Vérification des paiements Wave, ventes en espèces, invitations et contrôle des entrées.</p>
        </div>
        <small style={{ color: "var(--text-inverse-muted)" }}>Accès réservé à l&apos;organisateur.</small>
      </aside>

      <main id="contenu" className="login-panel">
        <div className="login-card">
          <Link href="/" className="flow-back">
            <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Retour au site
          </Link>
          <div>
            <span className="logo-badge lg" style={{ marginBottom: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.jpeg" alt={`Logo ${EVENT_ORG}`} width={64} height={64} />
            </span>
            <h1>Connexion</h1>
            <p>Espace privé de l&apos;organisateur du {EVENT_NAME}.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <FormField id="username" label="Identifiant">
              <input
                className="input input-lg"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                autoFocus
                required
              />
            </FormField>
            <div className="field">
              <label className="field-label" htmlFor="password">
                Mot de passe
              </label>
              <div className="input-group">
                <input
                  id="password"
                  className="input input-lg"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  style={{ paddingLeft: 16 }}
                />
                <button
                  type="button"
                  className="input-group-action"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={showPassword}
                  style={{ right: 8 }}
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="callout" data-tone="danger" role="alert">
                <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={submitting}>
              {submitting && <span className="spinner" aria-hidden="true" />}
              {submitting ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
