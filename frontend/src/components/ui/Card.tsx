import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  id?: string;
  "aria-labelledby"?: string;
}

export function Card({ children, className = "", as: Tag = "section", ...rest }: CardProps) {
  return (
    <Tag className={`card ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  bordered?: boolean;
}

/** En-tête d'une carte/section : titre, description facultative, actions à droite. */
export function SectionHeader({ title, description, actions, id, bordered = false }: SectionHeaderProps) {
  return (
    <div className={`card-header${bordered ? " bordered" : ""}`}>
      <div style={{ minWidth: 0 }}>
        <h2 className="card-title" id={id}>
          {title}
        </h2>
        {description && <p className="card-description">{description}</p>}
      </div>
      {actions && <div className="card-actions">{actions}</div>}
    </div>
  );
}
