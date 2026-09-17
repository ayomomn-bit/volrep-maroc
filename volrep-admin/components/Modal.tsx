"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icons";
import { t } from "@/lib/i18n";

// The one modal shell for the whole admin — confirm dialogs, editors,
// inventory adjustments all render inside this. Handles the overlay, Esc
// to close, click-outside, body scroll lock and a consistent header.
type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Block Esc / backdrop close while a request is in flight. */
  busy?: boolean;
};

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

export function Modal({ open, onClose, title, description, children, footer, size = "md", busy }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-6"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`my-4 w-full ${SIZES[size]} rounded-xl bg-white shadow-xl ring-1 ring-slate-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="-m-1.5 shrink-0 rounded-md p-1.5 text-base text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label={t.common.close}
          >
            <Icon.x />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}
