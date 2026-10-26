import Link from "next/link";
import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import Skeleton from "./Skeleton";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: "neutral" | "brand" | "success" | "warning" | "info";
  /** Met la carte en avant (ex. paiements à vérifier > 0). */
  highlight?: boolean;
  href?: string;
  loading?: boolean;
  children?: ReactNode;
}

export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  highlight = false,
  href,
  loading = false,
  children,
}: StatCardProps) {
  const content = (
    <>
      <div className="stat-card-head">
        <span>{label}</span>
        <span className="stat-card-icon" aria-hidden="true">
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>
      {loading ? (
        <>
          <Skeleton width="60%" height={30} />
          <Skeleton width="45%" height={12} />
        </>
      ) : (
        <>
          <div className="stat-card-value">{value}</div>
          {hint && <div className="stat-card-hint">{hint}</div>}
          {children}
        </>
      )}
    </>
  );

  const props = { className: "card stat-card", "data-tone": tone, "data-highlight": highlight || undefined };
  return href ? (
    <Link href={href} {...props}>
      {content}
    </Link>
  ) : (
    <article {...props}>{content}</article>
  );
}
