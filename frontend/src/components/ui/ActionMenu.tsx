"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LucideIcon, MoreHorizontal } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
}

/**
 * Menu d'actions secondaires d'une ligne (bouton « … ») : ouverture au clic
 * ou au clavier, navigation aux flèches, Échap/clic extérieur pour fermer,
 * focus rendu au bouton déclencheur.
 */
export default function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === "Tab") {
      close(false);
    }
  }

  return (
    <div className="menu" ref={rootRef} onKeyDown={onKeyDown} onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-ghost btn-sm btn-icon"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} strokeWidth={2} />
      </button>
      {open && (
        <div className="menu-list" role="menu" id={id} ref={listRef}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="menu-item"
                data-danger={item.danger || undefined}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
