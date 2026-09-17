"use client";

import type { ReactNode } from "react";
import { EmptyState, ErrorBlock } from "@/components/ui";
import { Skeleton } from "@/components/Skeleton";
import { t } from "@/lib/i18n";

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir };

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  /** Tailwind width/min-width class, e.g. "w-32" or "min-w-[12rem]". */
  width?: string;
  sortable?: boolean;
  headerClassName?: string;
  cellClassName?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[] | undefined;
  getRowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  empty?: { title: string; hint?: string; action?: ReactNode };
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
  /** Rendered under the table — pagination lives here. */
  footer?: ReactNode;
  skeletonRows?: number;
  /** Minimum table width before horizontal scroll kicks in. */
  minWidth?: string;
};

const ALIGN: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  error,
  onRetry,
  onRowClick,
  empty,
  sort,
  onSortChange,
  footer,
  skeletonRows = 8,
  minWidth = "min-w-[720px]",
}: DataTableProps<T>) {
  const showSkeleton = loading && !rows;

  function toggleSort(key: string) {
    if (!onSortChange) return;
    const dir: SortDir = sort?.key === key && sort.dir === "asc" ? "desc" : "asc";
    onSortChange({ key, dir });
  }

  if (error && !rows) {
    return <ErrorBlock message={error} onRetry={onRetry} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="scroll-slim max-h-[calc(100vh-16rem)] overflow-auto">
        <table className={`w-full ${minWidth} border-separate border-spacing-0 text-left text-[13px]`}>
          <thead>
            <tr>
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={`sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                      col.align ? ALIGN[col.align] : "text-left"
                    } ${col.width ?? ""} ${col.headerClassName ?? ""}`}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-slate-800 ${active ? "text-slate-800" : ""}`}
                      >
                        {col.header}
                        <span className={`text-[10px] transition ${active ? "opacity-100" : "opacity-30"}`}>
                          {active && sort?.dir === "desc" ? "▼" : "▲"}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: skeletonRows }).map((_, r) => (
                <tr key={r}>
                  {columns.map((col) => (
                    <td key={col.key} className="border-b border-slate-100 px-4 py-3">
                      <Skeleton className={`h-3 ${col.align === "right" ? "ml-auto w-16" : "w-24"}`} />
                    </td>
                  ))}
                </tr>
              ))}

            {!showSkeleton &&
              rows?.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`${onRowClick ? "cursor-pointer" : ""} transition-colors hover:bg-slate-50`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`border-b border-slate-100 px-4 py-2.5 align-middle text-slate-700 ${
                        col.align ? ALIGN[col.align] : "text-left"
                      } ${col.cellClassName ?? ""}`}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!showSkeleton && rows && rows.length === 0 && (
        <div className="p-2">
          <EmptyState title={empty?.title ?? t.common.nothingHere} hint={empty?.hint} action={empty?.action} />
        </div>
      )}

      {footer ? <div className="border-t border-slate-200 px-3 py-2">{footer}</div> : null}
    </div>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

export function CellLink({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <span className={muted ? "text-slate-400" : "font-medium text-slate-900"}>{children}</span>;
}
