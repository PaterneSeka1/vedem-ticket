import { ReactNode } from "react";
import { Check, X } from "lucide-react";

export type StepState = "done" | "current" | "upcoming" | "error";

/** Étapes horizontales compactes (parcours d'achat). */
export function Steps({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol className="steps" aria-label={label}>
      {steps.map((step, index) => {
        const state: StepState = index < current ? "done" : index === current ? "current" : "upcoming";
        return (
          <li key={step} data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="step-index" aria-hidden="true">
              {state === "done" ? <Check size={13} strokeWidth={2.6} /> : index + 1}
            </span>
            <span className="step-label">
              {step}
              {state === "done" && <span className="sr-only"> (terminé)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export interface TimelineStep {
  title: string;
  text?: ReactNode;
  state: StepState;
  body?: ReactNode;
}

/** Chronologie verticale (suivi d'une commande Wave). */
export function Timeline({ steps, label }: { steps: TimelineStep[]; label: string }) {
  return (
    <ol className="timeline" aria-label={label}>
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="timeline-item"
          data-state={step.state}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span className="timeline-marker" aria-hidden="true">
            {step.state === "done" ? (
              <Check size={15} strokeWidth={2.8} />
            ) : step.state === "error" ? (
              <X size={15} strokeWidth={2.8} />
            ) : (
              index + 1
            )}
          </span>
          <div className="timeline-content">
            <p className="timeline-title">
              {step.title}
              <span className="sr-only">
                {step.state === "done"
                  ? " — terminé"
                  : step.state === "current"
                    ? " — étape en cours"
                    : step.state === "error"
                      ? " — à reprendre"
                      : " — à venir"}
              </span>
            </p>
            {step.text && <p className="timeline-text">{step.text}</p>}
            {step.body && <div className="timeline-body">{step.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
