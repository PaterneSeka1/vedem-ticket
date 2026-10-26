import { CSSProperties } from "react";

interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
  style?: CSSProperties;
}

/** Bloc de chargement neutre (animation désactivée si `prefers-reduced-motion`). */
export default function Skeleton({ width = "100%", height = 14, radius, style }: SkeletonProps) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** Lignes de chargement d'une liste/tableau. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Chargement" style={{ display: "grid", gap: 14, padding: "20px" }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Skeleton width={36} height={36} radius={8} />
          <div style={{ flex: 1, display: "grid", gap: 6 }}>
            <Skeleton width={`${50 + ((i * 17) % 35)}%`} height={12} />
            <Skeleton width={`${25 + ((i * 11) % 20)}%`} height={10} />
          </div>
          <Skeleton width={72} height={22} radius={999} />
        </div>
      ))}
    </div>
  );
}
