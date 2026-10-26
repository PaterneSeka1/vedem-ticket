import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Steps } from "@/components/ui/Steps";

export const PURCHASE_STEPS = ["Billets", "Coordonnées", "Paiement"];

/** Bandeau du parcours d'achat : retour + étape courante. */
export default function PurchaseHeader({ current, backHref, backLabel }: { current: number; backHref: string; backLabel: string }) {
  return (
    <div className="flow-header">
      <div className="container flow-header-inner">
        <Link href={backHref} className="flow-back">
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> {backLabel}
        </Link>
        <Steps steps={PURCHASE_STEPS} current={current} label="Étapes de la commande" />
      </div>
    </div>
  );
}
