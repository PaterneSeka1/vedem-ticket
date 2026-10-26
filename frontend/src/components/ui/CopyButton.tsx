"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  value: string;
  label: string;
  /** Affiche un libellé texte à côté de l'icône. */
  withText?: boolean;
  className?: string;
}

/** Copie une valeur dans le presse-papiers, avec retour visuel et annonce. */
export default function CopyButton({ value, label, withText = false, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(event: React.MouseEvent) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission) : la
      // valeur reste affichée et sélectionnable.
    }
  }

  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      className={className ?? (withText ? "btn btn-secondary btn-sm" : "copy-button")}
      data-copied={copied || undefined}
      onClick={copy}
      aria-label={withText ? undefined : copied ? "Copié" : label}
      title={label}
    >
      <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
      {withText && (copied ? "Copié" : "Copier")}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copié dans le presse-papiers" : ""}
      </span>
    </button>
  );
}
