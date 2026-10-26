"use client";

import { ReactNode, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Pagination from "./Pagination";
import { SkeletonRows } from "./Skeleton";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Rend la colonne triable. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  width?: string;
  nowrap?: boolean;
  /** Colonne secondaire masquée sous 1280 px (l'information reste dans le détail). */
  secondary?: boolean;
}

type SortDirection = "asc" | "desc";

interface DataTableProps<T> {
  caption: string;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Rend chaque ligne cliquable (et activable au clavier). */
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  /** Rendu « carte » utilisé sous 768 px à la place du tableau. */
  renderCard?: (row: T) => ReactNode;
  highlightRow?: (row: T) => boolean;
  initialSort?: { id: string; direction: SortDirection };
  pageSize?: number;
  loading?: boolean;
  empty?: ReactNode;
  /** Change quand les filtres changent : ramène à la première page. */
  resetKey?: string;
}

/**
 * Tableau de données générique de l'administration : tri par colonne
 * (`aria-sort`), pagination côté client, ligne cliquable accessible au
 * clavier, et bascule automatique en liste de cartes sur mobile — jamais de
 * tableau de 8 colonnes sur un écran de téléphone.
 *
 * Volumes visés : un seul événement (quelques milliers de lignes au plus),
 * déjà chargés en mémoire par `AdminDataContext` — un tri/pagination côté
 * serveur ou une dépendance type TanStack Table ne se justifient pas ici.
 */
export default function DataTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  onRowClick,
  rowLabel,
  renderCard,
  highlightRow,
  initialSort,
  pageSize = 20,
  loading = false,
  empty,
  resetKey = "",
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ id: string; direction: SortDirection } | null>(initialSort ?? null);
  const [pageState, setPageState] = useState({ key: resetKey, page: 0 });

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return rows;
    const getValue = column.sortValue;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "fr", { sensitivity: "base" }) * factor;
    });
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const requestedPage = pageState.key === resetKey ? pageState.page : 0;
  const page = Math.min(requestedPage, pageCount - 1);
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);

  function toggleSort(id: string) {
    setSort((current) =>
      current?.id === id
        ? { id, direction: current.direction === "asc" ? "desc" : "asc" }
        : { id, direction: id === initialSort?.id ? initialSort.direction : "asc" },
    );
  }

  if (loading && rows.length === 0) return <SkeletonRows />;
  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className="data-view" data-has-cards={renderCard ? "true" : undefined}>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.id === column.id;
                const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={column.sortValue ? (ariaSort ?? "none") : undefined}
                    className={
                      [column.align === "right" ? "align-right" : "", column.secondary ? "col-secondary" : ""]
                        .join(" ")
                        .trim() || undefined
                    }
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.sortValue ? (
                      <button type="button" className="th-sort" onClick={() => toggleSort(column.id)}>
                        {column.header}
                        {active ? (
                          sort.direction === "asc" ? (
                            <ArrowUp size={13} strokeWidth={2.2} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={13} strokeWidth={2.2} aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown size={13} strokeWidth={2.2} aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                data-clickable={onRowClick ? "true" : undefined}
                data-highlight={highlightRow?.(row) || undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={
                      [
                        column.align === "right" ? "align-right" : "",
                        column.nowrap ? "nowrap" : "",
                        column.secondary ? "col-secondary" : "",
                      ]
                        .join(" ")
                        .trim() ||
                      undefined
                    }
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {renderCard && (
        <ul className="data-list" aria-label={caption}>
          {visible.map((row) => (
            <li key={rowKey(row)}>
              {onRowClick ? (
                <button
                  type="button"
                  className="data-list-item"
                  data-highlight={highlightRow?.(row) || undefined}
                  onClick={() => onRowClick(row)}
                  aria-label={rowLabel?.(row)}
                >
                  {renderCard(row)}
                </button>
              ) : (
                <div className="data-list-item" data-highlight={highlightRow?.(row) || undefined}>
                  {renderCard(row)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <Pagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          total={sorted.length}
          onPageChange={(next) => setPageState({ key: resetKey, page: next })}
        />
      )}
    </div>
  );
}
