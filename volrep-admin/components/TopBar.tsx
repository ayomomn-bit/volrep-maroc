"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { currentNavLabel } from "@/lib/nav";
import { Badge, ConfirmDialog } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { t, roleLabel } from "@/lib/i18n";

export function TopBar({
  onMenu,
  onToggleCollapse,
  collapsed,
}: {
  onMenu: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
}) {
  const { state, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const admin = state.status === "authenticated" ? state.admin : null;
  const title = currentNavLabel(pathname);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-1">
        <button
          onClick={onMenu}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label={t.topbar.openMenu}
        >
          <Icon.menu className="h-5 w-5" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="hidden rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:block"
          aria-label={collapsed ? t.topbar.expandSidebar : t.topbar.collapseSidebar}
        >
          <Icon.sidebarCollapse className="h-5 w-5" />
        </button>
        <h1 className="truncate text-sm font-semibold text-slate-800">{title}</h1>
      </div>

      <div className="relative flex items-center gap-2" ref={menuRef}>
        {admin && (
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-slate-100"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-[11px] font-semibold uppercase text-slate-600">
              {admin.email.slice(0, 1)}
            </span>
            <span className="hidden text-slate-600 sm:inline">{admin.email}</span>
            <Badge tone={admin.role === "owner" ? "accent" : "neutral"}>{roleLabel(admin.role)}</Badge>
            <Icon.chevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        )}

        {menuOpen && admin && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-[13px] font-medium text-slate-800">{admin.email}</p>
              <p className="text-xs text-slate-400">{t.topbar.accountSuffix(roleLabel(admin.role))}</p>
            </div>
            <button
              onClick={() => {
                setMenuOpen(false);
                setConfirming(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-600 hover:bg-slate-50"
            >
              <Icon.logout className="h-4 w-4" /> {t.topbar.signOut}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={t.topbar.signOutConfirmTitle}
        body={t.topbar.signOutConfirmBody}
        confirmLabel={t.topbar.signOut}
        loading={loggingOut}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setLoggingOut(true);
          await logout();
        }}
      />
    </header>
  );
}
