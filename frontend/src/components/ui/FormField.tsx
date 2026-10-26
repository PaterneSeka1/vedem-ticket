import { cloneElement, isValidElement, ReactElement, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface FormFieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  /** Le contrôle (input/select/textarea) : reçoit `id`, `aria-describedby` et `aria-invalid`. */
  children: ReactElement<Record<string, unknown>>;
}

/**
 * Champ de formulaire accessible : libellé relié, aide et erreur annoncées
 * via `aria-describedby`, `aria-invalid` positionné quand une erreur existe.
 */
export default function FormField({ id, label, hint, error, optional = false, className = "", children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className={`field ${className}`.trim()}>
      <label className="field-label" htmlFor={id}>
        {label}
        {optional && <span className="field-optional">(facultatif)</span>}
      </label>
      {control}
      {error ? (
        <p className="field-error" id={errorId}>
          <AlertCircle size={13} strokeWidth={2.2} aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={hintId}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
