"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { visibleGroups, isActive } from "@/lib/nav";
import { Icon } from "@/components/Icons";
import { API_BASE } from "@/lib/api";
import { t } from "@/lib/i18n";

const isLocal = /localhost|127\.0\.0\.1/.test(API_BASE);

export function Sidebar({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: Role;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = visibleGroups(role);

  return (
    <nav className="scroll-slim flex h-full flex-col overflow-y-auto">
      <div className={`flex items-center gap-2 px-4 pb-2 pt-4 ${collapsed ? "justify-center px-0" : ""}`}>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-volt text-[11px] font-bold text-white">
          V
        </span>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-slate-900">{t.common.brand}</p>
            <p className="text-[11px] text-slate-400">{t.sidebar.tagline}</p>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 px-3 py-3">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const IconCmp = Icon[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                      collapsed ? "justify-center" : ""
                    } ${active ? "bg-volt-soft text-volt-deep" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                  >
                    <IconCmp className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {isLocal && !collapsed && (
        <div className="px-4 pb-4">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t.sidebar.localEnv}
          </span>
        </div>
      )}
    </nav>
  );
}
