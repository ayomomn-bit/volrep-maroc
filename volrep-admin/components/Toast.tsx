"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icons";
import { t } from "@/lib/i18n";

// Lightweight toast stack. One provider at the app shell; call `useToast()`
// anywhere below it. No dependency, no portal library — a fixed viewport
// in the top-right that survives route changes.
type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; title: string; description?: string };

type ToastApi = {
  toast: (t: { kind?: ToastKind; title: string; description?: string }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLES: Record<ToastKind, { ring: string; icon: ReactNode }> = {
  success: { ring: "ring-green-200", icon: <Icon.check className="text-green-600" /> },
  error: { ring: "ring-red-200", icon: <Icon.alert className="text-red-600" /> },
  info: { ring: "ring-slate-200", icon: <Icon.info className="text-slate-500" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: { kind?: ToastKind; title: string; description?: string }) => {
      const id = nextId.current++;
      const toast: Toast = { id, kind: t.kind ?? "info", title: t.title, description: t.description };
      setToasts((list) => [...list, toast].slice(-4));
      window.setTimeout(() => dismiss(id), t.kind === "error" ? 7000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: push,
      success: (title, description) => push({ kind: "success", title, description }),
      error: (title, description) => push({ kind: "error", title, description }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((item) => {
          const style = KIND_STYLES[item.kind];
          return (
            <div
              key={item.id}
              role="status"
              className={`animate-toast-in pointer-events-auto flex gap-3 rounded-lg bg-white p-3 shadow-lg ring-1 ${style.ring}`}
            >
              <span className="mt-0.5 shrink-0 text-base">{style.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                {item.description ? <p className="mt-0.5 text-xs text-slate-500">{item.description}</p> : null}
              </div>
              <button
                onClick={() => dismiss(item.id)}
                className="-m-1 h-6 w-6 shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={t.common.dismiss}
              >
                <Icon.x />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
