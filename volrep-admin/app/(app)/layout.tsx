"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { LoadingBlock } from "@/components/ui";
import { t } from "@/lib/i18n";

const COLLAPSE_KEY = "volrep-admin:sidebar-collapsed";

// The protected shell. Every screen under /(app) renders here, so the auth
// gate lives in exactly one place. Backend authorization is still the real
// boundary — this only controls what the browser bothers to render.
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Read the persisted preference from localStorage (an external store)
    // once on mount — SSR can't know it, so a client effect is correct.
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY) === "1";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(stored);
    } catch {
      /* private mode / disabled storage — default expanded */
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  useEffect(() => {
    if (state.status === "unauthenticated") router.replace("/login");
  }, [state.status, router]);

  if (state.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingBlock label={t.authGate.checkingSession} />
      </div>
    );
  }
  if (state.status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex h-full bg-slate-100">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-slate-200 bg-white transition-[width] duration-150 lg:block ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <Sidebar role={state.admin.role} collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white" onClick={(e) => e.stopPropagation()}>
            <Sidebar role={state.admin.role} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMenuOpen(true)} onToggleCollapse={toggleCollapse} collapsed={collapsed} />
        <main className="scroll-slim flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
