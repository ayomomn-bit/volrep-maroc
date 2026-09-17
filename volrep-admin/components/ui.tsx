"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import type { Tone } from "@/lib/format";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/Icons";
import { Modal } from "@/components/Modal";

// Re-export the shared primitives so `@/components/ui` stays the single
// import surface for screens.
export { Icon } from "@/components/Icons";
export { Modal } from "@/components/Modal";
export { ToastProvider, useToast } from "@/components/Toast";
export { Skeleton, SkeletonText, StatCardSkeleton, TableSkeleton } from "@/components/Skeleton";
export { DataTable, RowActions, CellLink } from "@/components/DataTable";
export type { Column, SortState, SortDir } from "@/components/DataTable";

// ---- Badge --------------------------------------------------------

const TONE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  success: "bg-green-50 text-green-700 ring-green-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  accent: "bg-volt-soft text-volt-deep ring-blue-200",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

// A status dot + label, denser than a badge — for table cells.
export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const dot: Record<Tone, string> = {
    neutral: "bg-slate-400",
    info: "bg-blue-500",
    success: "bg-green-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
    accent: "bg-volt",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-700">
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
      {children}
    </span>
  );
}

// ---- Button ------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const styles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-volt text-white hover:bg-volt-deep shadow-sm",
    secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  const sizes = { sm: "h-7 px-2 text-[12px]", md: "h-9 px-3 text-[13px]" };
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${styles[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

// ---- Card ------------------------------------------------------

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-slate-200 bg-white ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold text-slate-800">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 py-3 ${className}`}>{children}</div>;
}

// ---- Stat card -------------------------------------------------

export function StatCard({
  label,
  value,
  sub,
  tone,
  href,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "warning" | "danger" | "success";
  href?: string;
  icon?: ReactNode;
}) {
  const valueTone =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "success"
          ? "text-green-600"
          : "text-slate-900";
  const body = (
    <div
      className={`group h-full rounded-lg border border-slate-200 bg-white p-4 transition-colors ${
        href ? "hover:border-slate-300 hover:bg-slate-50/60" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className="text-slate-300 group-hover:text-slate-400">{icon}</span> : null}
      </div>
      <p className={`tnum mt-2 text-2xl font-semibold ${valueTone}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

// ---- Form fields ---------------------------------------------

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-red-600">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-volt disabled:cursor-not-allowed disabled:bg-slate-50";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-volt ${props.className ?? ""}`}
    />
  );
}

// Search box with a leading icon — used by every list FilterBar.
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
        <Icon.search className="h-4 w-4" />
      </span>
      <input {...props} className={`${inputBase} pl-8 ${props.className ?? ""}`} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-volt" : "bg-slate-300"}`}
    >
      <span className={`m-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

// ---- Feedback ------------------------------------------------

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-current ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
  );
}

export function LoadingBlock({ label = t.common.loading }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Spinner className="h-5 w-5" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span className="mt-0.5 shrink-0 text-base">
        <Icon.alert />
      </span>
      <div>
        <p className="font-medium">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold underline">
            <Icon.refresh className="h-3 w-3" /> {t.common.retry}
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-red-600">
      <Icon.alert className="h-3.5 w-3.5" />
      {message}
    </p>
  );
}

// ---- Confirm dialog (built on Modal) -----------------------

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = t.common.confirm,
  cancelLabel = t.common.cancel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={loading}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{body}</div>
    </Modal>
  );
}

// ---- Table (simple) ---------------------------------------
// Retained for detail-page sub-tables (line items, variants). List pages
// use <DataTable> instead.

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="scroll-slim overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {head}
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-4 py-2 font-semibold ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-middle text-slate-700 ${className}`}>{children}</td>;
}

// ---- Pagination -------------------------------------------

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between px-1 text-[13px] text-slate-500">
      <span className="tnum">
        {total === 0
          ? t.pagination.noResults
          : t.pagination.range(offset + 1, Math.min(offset + limit, total), total)}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))}>
          {t.common.previous}
        </Button>
        <span className="tnum text-xs text-slate-400">{t.pagination.pageOf(page, pages)}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
          {t.common.next}
        </Button>
      </div>
    </div>
  );
}

// ---- Tabs -------------------------------------------------

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: ReactNode; count?: number }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="scroll-slim flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
              on ? "border-volt text-volt" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`tnum rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  on ? "bg-volt-soft text-volt-deep" : "bg-slate-100 text-slate-500"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---- Breadcrumbs / page header ---------------------------

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-slate-400">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <Icon.chevronRight className="h-3 w-3" />}
          {c.href && i < items.length - 1 ? (
            <Link href={c.href} className="hover:text-slate-600">
              {c.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? "text-slate-500" : ""}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-5">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className={`flex flex-wrap items-start justify-between gap-3 ${breadcrumbs ? "mt-1.5" : ""}`}>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {description ? <p className="mt-0.5 text-[13px] text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

// A toolbar row that wraps filter controls above a table.
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">{children}</div>
  );
}

// ---- Product Studio shared primitives -----------------------------
// Introduced in Phase 7C-3.5 to make every editor section feel like one
// workspace: the same field grouping, the same save affordance, the same
// upload control, the same readiness language.

export const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,image/avif";
// UGC ("Vidéos clients") slots additionally accept a browser-playable MP4.
export const ACCEPT_IMAGE_OR_VIDEO = `${ACCEPT_IMAGE},video/mp4`;

// A titled group of fields inside an editor Card — turns a long flat form
// into scannable sections ("IDENTITÉ", "CONTENU", "MÉDIAS"…).
export function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="border-b border-slate-100 pb-1.5">
        <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-slate-400">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

// The one save affordance for every editor. Always answers "is this saved?"
// — amber dot + "non enregistrées" while dirty, green dot + "à jour" once
// clean. Works for both <form onSubmit> (type="submit") and click handlers.
export function SaveBar({
  dirty,
  saving,
  error,
  label = t.common.saveChanges,
  type = "button",
  disabled,
  onSave,
  extra,
}: {
  dirty: boolean;
  saving?: boolean;
  error?: string | null;
  label?: string;
  type?: "submit" | "button";
  disabled?: boolean;
  onSave?: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <InlineError message={error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type={type}
          variant="primary"
          loading={saving}
          disabled={disabled ?? !dirty}
          onClick={onSave}
        >
          {label}
        </Button>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            dirty ? "text-amber-600" : "text-slate-400"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dirty ? "bg-amber-500" : "bg-green-500"}`} />
          {dirty ? t.studio.saveBar.unsaved : t.studio.saveBar.saved}
        </span>
        {extra}
      </div>
    </div>
  );
}

// Selectable cards with a title + one-line explanation. Used for the
// "add a content block" type picker so each type explains itself.
export function RadioCardGroup<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; description: string }[];
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              on
                ? "border-volt bg-volt-soft ring-1 ring-volt"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
              <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-volt" : "bg-slate-300"}`} />
              {o.label}
            </span>
            <span className="mt-1 block text-xs leading-snug text-slate-500">{o.description}</span>
          </button>
        );
      })}
    </div>
  );
}

// A horizontal readiness bar — "4/6" sections ready, green at 100%.
export function ReadinessMeter({ ready, total, label }: { ready: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((ready / total) * 100) : 0;
  const done = pct === 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-semibold text-slate-800">{label}</span>
        <span className={`tnum font-semibold ${done ? "text-green-600" : "text-slate-500"}`}>
          {ready}/{total}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${done ? "bg-green-500" : "bg-volt"}`}
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>
    </div>
  );
}

// Character counter that warns as it approaches / passes a limit.
export function CharCount({ value, max }: { value: number; max: number }) {
  const tone = value > max ? "text-red-600" : value > max * 0.9 ? "text-amber-600" : "text-slate-400";
  return <span className={`tnum text-xs font-medium ${tone}`}>{value}/{max}</span>;
}

// Drag-and-drop + click-to-browse image upload target with explicit
// idle / uploading state. The parent owns the actual upload + success /
// error feedback (toast + inline).
export function DropZone({
  onFile,
  uploading,
  disabled,
  hint,
  compact,
  accept = ACCEPT_IMAGE,
}: {
  onFile: (file: File) => void;
  uploading?: boolean;
  disabled?: boolean;
  hint: string;
  compact?: boolean;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = Boolean(uploading || disabled);

  return (
    <div
      onDragOver={(e) => {
        if (busy) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (busy) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`rounded-lg border-2 border-dashed text-center transition-colors ${
        over ? "border-volt bg-volt-soft" : "border-slate-300 bg-slate-50/60"
      } ${compact ? "px-4 py-4" : "px-4 py-8"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-2">
        <span className="text-slate-400">
          <Icon.upload className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </span>
        <Button
          size="sm"
          variant="secondary"
          loading={uploading}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? t.studio.media.state.uploading : t.studio.media.chooseFile}
        </Button>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
    </div>
  );
}
