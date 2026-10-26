import { ReactNode } from "react";
import { formatNumber, money } from "@/lib/format";

export interface SummaryLine {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface PaymentSummaryProps {
  lines: SummaryLine[];
  /** Frais Wave à la charge de l'acheteur (0 = ligne masquée). */
  waveFees?: number;
  /** Libellé du total (ex. « Total à payer via Wave »). */
  totalLabel?: string;
  /** Total affiché à la place de la somme des lignes (ex. invitation : « Offert »). */
  totalOverride?: ReactNode;
  feesNote?: ReactNode;
}

/**
 * Récapitulatif de commande : une ligne par catégorie, sous-total, frais
 * Wave éventuels, total. Le total = prix des billets + frais Wave, comme le
 * montant pré-rempli sur le lien de paiement (voir CLAUDE.md §4).
 */
export default function PaymentSummary({
  lines,
  waveFees = 0,
  totalLabel = "Total",
  totalOverride,
  feesNote,
}: PaymentSummaryProps) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  return (
    <div className="summary">
      {lines.map((line) => (
        <div className="summary-line" key={line.key}>
          <span>
            <span className="summary-item-name">{line.name}</span>
            <span className="summary-item-detail">
              {line.quantity} × {money(line.unitPrice)}
            </span>
          </span>
          <span className="tabular">{money(line.unitPrice * line.quantity)}</span>
        </div>
      ))}
      <div className="summary-divider" />
      {waveFees > 0 && (
        <>
          <div className="summary-line">
            <span>Sous-total billets</span>
            <span className="tabular">{money(subtotal)}</span>
          </div>
          <div className="summary-line">
            <span>
              Frais Wave (1 %)
              {feesNote && <span className="summary-item-detail">{feesNote}</span>}
            </span>
            <span className="tabular">{formatNumber(waveFees)} FCFA</span>
          </div>
          <div className="summary-divider" />
        </>
      )}
      <div className="summary-total">
        <span>{totalLabel}</span>
        <span className="tabular">{totalOverride ?? money(subtotal + waveFees)}</span>
      </div>
    </div>
  );
}
