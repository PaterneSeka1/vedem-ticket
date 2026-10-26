import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";

interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageCount, pageSize, total, onPageChange }: PaginationProps) {
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary">
        {formatNumber(from)}–{formatNumber(to)} sur {formatNumber(total)}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-icon"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          aria-label="Page précédente"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <span className="pagination-page" aria-live="polite">
          {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-icon"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Page suivante"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
}
