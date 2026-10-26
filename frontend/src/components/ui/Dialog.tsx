"use client";

import { ReactNode, RefObject, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Pile des dialogues ouverts : seule la couche du dessus réagit à Échap et
// garde le focus (ex. confirmation ouverte par-dessus la vérification Wave).
const openStack: string[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** `drawer` : panneau latéral sur desktop/tablette. Sur mobile, tout dialogue devient une feuille en bas d'écran. */
  variant?: "dialog" | "drawer";
  size?: "sm" | "md" | "lg" | "xl";
  role?: "dialog" | "alertdialog";
  /** Occupe tout l'écran sur mobile (parcours longs : vente espèces). */
  fullscreenMobile?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Empêche la fermeture (Échap, clic extérieur) pendant un traitement. */
  busy?: boolean;
}

/**
 * Dialogue accessible unique de l'application (remplace les anciennes
 * modales `.modal` ad hoc) : rendu dans un portail, focus piégé puis
 * restitué à la fermeture, défilement de la page bloqué, Échap et clic
 * extérieur pour fermer, `aria-labelledby`/`aria-describedby` reliés.
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  eyebrow,
  children,
  footer,
  variant = "dialog",
  size = "md",
  role = "dialog",
  fullscreenMobile = false,
  initialFocusRef,
  busy = false,
}: DialogProps) {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openStack.push(id);
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const target =
      initialFocusRef?.current ?? panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel;
    target?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (openStack[openStack.length - 1] !== id || !panel) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openStack.lastIndexOf(id);
      if (index !== -1) openStack.splice(index, 1);
      if (openStack.length === 0) document.body.style.overflow = "";
      previouslyFocused?.focus?.({ preventScroll: true });
    };
    // `initialFocusRef` est lu une seule fois à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  if (!open || typeof document === "undefined") return null;

  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;

  return createPortal(
    <div
      className="overlay"
      data-variant={variant}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="dialog"
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-size={size}
        data-fullscreen-mobile={fullscreenMobile || undefined}
        tabIndex={-1}
      >
        <header className="dialog-header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="dialog-description">
                {description}
              </p>
            )}
          </div>
          <button type="button" className="dialog-close" aria-label="Fermer" onClick={onClose} disabled={busy}>
            <X size={18} strokeWidth={2} />
          </button>
        </header>
        {children !== undefined && <div className="dialog-body">{children}</div>}
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
