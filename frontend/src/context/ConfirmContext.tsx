"use client";

import { ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";

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
 * Remplace `window.confirm()` par le dialogue accessible commun
 * (`components/ui/Dialog`) — monté une seule fois dans RootLayout. `useConfirm()`
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

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={() => settle(false)}
        role="alertdialog"
        size="sm"
        title={pending?.title ?? ""}
        description={pending?.message}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => settle(false)} data-autofocus={pending?.danger || undefined}>
              {pending?.cancelLabel ?? "Annuler"}
            </button>
            <button
              type="button"
              className={`btn ${pending?.danger ? "btn-danger" : "btn-primary"}`}
              onClick={() => settle(true)}
              data-autofocus={!pending?.danger || undefined}
            >
              {pending?.confirmLabel ?? "Confirmer"}
            </button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

/** Renvoie une fonction `confirm(options) => Promise<boolean>` (true = confirmé). */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm doit être utilisé à l'intérieur de <ConfirmProvider>");
  return ctx;
}
