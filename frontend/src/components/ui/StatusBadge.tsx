import { Banknote, Gift } from "lucide-react";
import { methodLabel, Tone } from "@/lib/payments";
import { PaymentMethod } from "@/lib/types";

export function StatusBadge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) {
  return <span className={`badge${dot ? " badge-dot" : ""}${tone !== "neutral" ? ` badge-${tone}` : ""}`}>{children}</span>;
}

/** Moyen de paiement : pastille de couleur + libellé (Wave, Espèces, Invitation). */
export function MethodTag({ method, compact = false }: { method: PaymentMethod; compact?: boolean }) {
  const kind = method === "WAVE" ? "wave" : method === "CASH" ? "cash" : method === "INVITATION" ? "invitation" : "";
  return (
    <span className="method">
      <span className={`method-mark ${kind}`} aria-hidden="true">
        {method === "WAVE" ? "W" : method === "CASH" ? <Banknote size={13} strokeWidth={2.4} /> : <Gift size={12} strokeWidth={2.4} />}
      </span>
      {compact ? <span className="sr-only">{methodLabel(method)}</span> : methodLabel(method)}
    </span>
  );
}
