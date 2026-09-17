"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { LandingPageRole, LiryaPageSummary, LiryaPagesResponse } from "@/lib/types";
import { t, liryaStatusLabel, liryaRoleLabel } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import { Badge, Button, Field, InlineError, SearchInput, Select, Spinner } from "@/components/ui";
import { Modal } from "@/components/Modal";

// The Lirya page picker (V1). Reads GET /api/admin/lirya/pages — a
// server-side proxy that talks to Lirya with the API key the browser never
// sees — lists PUBLISHED LANDING pages only, cursor-paginated, with a
// client-side name filter (Lirya has no free-text search in V1). Draft and
// hidden pages are never offered. The chosen role is sent to the associate
// endpoint; the browser never sees or sends any Lirya token.
export function LiryaPagePicker({
  open,
  productId,
  availableRoles,
  onClose,
  onAssociated,
}: {
  open: boolean;
  productId: string;
  availableRoles: LandingPageRole[];
  onClose: () => void;
  onAssociated: () => void;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<LandingPageRole>(availableRoles[0] ?? "primary");
  const [pages, setPages] = useState<LiryaPageSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [associateError, setAssociateError] = useState<string | null>(null);
  const [associating, setAssociating] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(
    async (opts: { cursor?: string | null; q: string; append: boolean }) => {
      const mine = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<LiryaPagesResponse>("/api/admin/lirya/pages", {
          q: opts.q || undefined,
          cursor: opts.cursor || undefined,
        });
        if (mine !== reqId.current) return;
        setPages((prev) => (opts.append ? [...prev, ...res.pages] : res.pages));
        setNextCursor(res.nextCursor);
      } catch (err) {
        if (mine !== reqId.current) return;
        if (err instanceof ApiError && err.status === 401) return;
        setError(err instanceof Error ? err.message : t.studio.landingPages.picker.unavailable);
      } finally {
        if (mine === reqId.current) setLoading(false);
      }
    },
    [],
  );

  // Load on mount (the parent mounts this only while the picker is open, so
  // mounting == opening) and whenever the filter changes, debounced.
  useEffect(() => {
    const handle = setTimeout(() => void load({ q, append: false }), 250);
    return () => clearTimeout(handle);
  }, [q, load]);

  async function choose(page: LiryaPageSummary) {
    if (associating) return;
    setAssociateError(null);
    setAssociating(true);
    try {
      await api.post(`/api/admin/products/${productId}/landing-pages`, { liryaPageId: page.id, role });
      toast.success(t.studio.landingPages.toast.associated);
      onAssociated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      if (err instanceof ApiError && err.code === "LANDING_PAGE_ROLE_TAKEN") {
        setAssociateError(t.studio.landingPages.picker.roleTaken);
      } else if (err instanceof ApiError && err.code === "LANDING_PAGE_ALREADY_LINKED") {
        setAssociateError(t.studio.landingPages.picker.alreadyLinked);
      } else {
        const msg = err instanceof Error ? err.message : t.studio.landingPages.picker.unavailable;
        setAssociateError(msg);
        toast.error(t.studio.landingPages.toast.associateError, msg);
      }
    } finally {
      setAssociating(false);
    }
  }

  if (availableRoles.length === 0) {
    return (
      <Modal open={open} onClose={onClose} size="lg" title={t.studio.landingPages.picker.title}>
        <InlineError message={t.studio.landingPages.picker.allRolesUsed} />
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={associating}
      size="lg"
      title={t.studio.landingPages.picker.title}
      description={t.studio.landingPages.picker.intro}
    >
      <div className="space-y-3">
        <Field label={t.studio.landingPages.picker.role} hint={t.studio.landingPages.picker.roleHint}>
          <Select value={role} onChange={(e) => setRole(e.target.value as LandingPageRole)}>
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {liryaRoleLabel(r)}
              </option>
            ))}
          </Select>
        </Field>

        <SearchInput
          value={q}
          placeholder={t.studio.landingPages.picker.search}
          onChange={(e) => setQ(e.target.value)}
        />

        {error && <InlineError message={error} />}
        {associateError && <InlineError message={associateError} />}

        <div className="max-h-[50vh] overflow-y-auto rounded-md ring-1 ring-slate-200">
          {loading && pages.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
              <Spinner className="h-4 w-4" /> {t.common.loading}
            </div>
          ) : pages.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">{t.studio.landingPages.picker.empty}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pages.map((page) => (
                <li key={page.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">
                      {page.name || t.common.dash}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {page.slug}
                      {page.template ? ` · ${page.template}` : ""}
                      {page.updatedAt
                        ? ` · ${t.studio.landingPages.fields.updatedAt} ${formatDateShort(page.updatedAt)}`
                        : ""}
                    </p>
                  </div>
                  <Badge tone={page.status === "published" ? "success" : "neutral"}>
                    {liryaStatusLabel(page.status)}
                  </Badge>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={associating}
                    onClick={() => void choose(page)}
                  >
                    {t.studio.landingPages.picker.choose}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {nextCursor && (
          <div className="flex justify-center">
            <Button
              size="sm"
              variant="secondary"
              loading={loading}
              onClick={() => void load({ cursor: nextCursor, q, append: true })}
            >
              {t.studio.landingPages.picker.loadMore}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
