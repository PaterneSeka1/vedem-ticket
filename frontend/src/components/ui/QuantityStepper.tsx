import { Minus, Plus } from "lucide-react";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Nom de l'article, pour des libellés de boutons explicites au lecteur d'écran. */
  itemLabel: string;
  max?: number;
  disabled?: boolean;
}

export default function QuantityStepper({ value, onChange, itemLabel, max, disabled = false }: QuantityStepperProps) {
  const atMax = max !== undefined && value >= max;
  return (
    <div className="qty" role="group" aria-label={`Quantité — ${itemLabel}`}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 0}
        aria-label={`Retirer un billet ${itemLabel}`}
      >
        <Minus size={16} strokeWidth={2.2} />
      </button>
      <output aria-live="polite" aria-label={`${value} billet${value > 1 ? "s" : ""} ${itemLabel}`}>
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || atMax}
        aria-label={`Ajouter un billet ${itemLabel}`}
      >
        <Plus size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}
