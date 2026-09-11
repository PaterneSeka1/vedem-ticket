"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4500;
const ICON_BY_TYPE = { success: CheckCircle2, error: XCircle, info: Info } as const;

let nextId = 0;

/**
 * Notifications transverses (succès/erreur/info) affichées en haut à droite,
 * au-dessus de toutes les pages publiques et admin (montées une seule fois
 * dans RootLayout). Complète — sans les remplacer — les messages d'erreur
 * déjà affichés en ligne dans les formulaires : utile surtout quand l'action
 * fait disparaître ou changer la vue (modale qui se ferme, redirection,
 * export, expiration de session).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, type, message }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  // Nettoyage des timers en attente si le provider est démonté (jamais en
  // pratique, il vit à la racine — par sûreté).
  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      timersMap.forEach((t) => clearTimeout(t));
      timersMap.clear();
    };
  }, []);

  const success = useCallback((message: string) => push("success", message), [push]);
  const error = useCallback((message: string) => push("error", message), [push]);
  const info = useCallback((message: string) => push("info", message), [push]);
  const value = useMemo(() => ({ success, error, info }), [success, error, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((t) => {
          const Icon = ICON_BY_TYPE[t.type];
          return (
            <div key={t.id} className={`toast toast-${t.type}`} role="status">
              <Icon size={18} strokeWidth={2.4} />
              <span>{t.message}</span>
              <button type="button" aria-label="Fermer la notification" onClick={() => dismiss(t.id)}>
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé à l'intérieur de <ToastProvider>");
  return ctx;
}
