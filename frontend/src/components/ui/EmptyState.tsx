import { ReactNode } from "react";
import { AlertTriangle, Inbox, LucideIcon, RotateCw } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
}

export default function EmptyState({ title, description, icon: Icon = Inbox, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? " compact" : ""}`}>
      <span className="empty-state-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ title = "Impossible de charger les données", message, onRetry, compact = false }: ErrorStateProps) {
  return (
    <div className={`empty-state${compact ? " compact" : ""}`} data-tone="danger" role="alert">
      <span className="empty-state-icon" aria-hidden="true">
        <AlertTriangle size={20} strokeWidth={2} />
      </span>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          <RotateCw size={14} strokeWidth={2} /> Réessayer
        </button>
      )}
    </div>
  );
}
