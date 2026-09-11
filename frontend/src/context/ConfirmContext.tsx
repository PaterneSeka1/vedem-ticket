"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, X } from "lucide-react";

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style rouge — à réserver aux actions destructives (suppression, etc.). */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Remplace `window.confirm()` par une modale cohérente avec le reste du
 * dashboard (mêmes classes `.modal`/`.modal-card` que CategoryModal, CashModal,
 * AdminTicketModal) — montée une seule fois dans RootLayout. `useConfirm()`
 * renvoie une fonction async : `if (!(await confirm({...}))) return;`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  // Écrit uniquement dans confirm()/settle() (hors rendu), jamais lu/modifié
  // pendant le rendu — pas de mirroring d'état dans un ref.
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setPending(options);
    });
  }, []);

  // Échap = annuler, comme la boîte de dialogue native qu'on remplace.
  useEffect(() => {
    if (!pending) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") settle(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="modal open" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="modal-card confirm-card">
            <div className="modal-head">
              <div>
                <span className={`confirm-icon${pending.danger ? " danger" : ""}`}>
                  {pending.danger ? (
                    <AlertTriangle size={20} strokeWidth={2.4} />
                  ) : (
                    <HelpCircle size={20} strokeWidth={2.4} />
                  )}
                </span>
                <h2 id="confirm-title">{pending.title}</h2>
                <p>{pending.message}</p>
              </div>
              <button className="modal-close" aria-label="Annuler" type="button" onClick={() => settle(false)}>
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                autoFocus={pending.danger}
                onClick={() => settle(false)}
              >
                {pending.cancelLabel ?? "Annuler"}
              </button>
              <button
                type="button"
                className={`primary${pending.danger ? " danger" : ""}`}
                autoFocus={!pending.danger}
                onClick={() => settle(true)}
              >
                {pending.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

/** Renvoie une fonction `confirm(options) => Promise<boolean>` (true = confirmé). */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm doit être utilisé à l'intérieur de <ConfirmProvider>");
  return ctx;
}
