"use client";

import { ReactNode } from "react";
import { Search, X } from "lucide-react";

/** Rangée de filtres d'une liste (recherche, segments, sélecteurs, actions). */
export function FilterToolbar({ children, label = "Filtres" }: { children: ReactNode; label?: string }) {
  return (
    <div className="toolbar" role="search" aria-label={label}>
      {children}
    </div>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}

export function SearchInput({ value, onChange, placeholder, label }: SearchInputProps) {
  return (
    <div className="input-group toolbar-search">
      <Search size={16} strokeWidth={2} aria-hidden="true" />
      <input
        type="search"
        className="input"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {value && (
        <button type="button" className="input-group-action" aria-label="Effacer la recherche" onClick={() => onChange("")}>
          <X size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  count?: number;
  tone?: "warning";
}

interface SegmentedFilterProps<V extends string> {
  value: V;
  onChange: (value: V) => void;
  options: SegmentOption<V>[];
  label: string;
}

/** Filtre rapide par segments (statut…), avec compteurs. */
export function SegmentedFilter<V extends string>({ value, onChange, options, label }: SegmentedFilterProps<V>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="count" data-tone={option.count > 0 ? option.tone : undefined}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
