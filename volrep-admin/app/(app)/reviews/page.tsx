"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useMutation, useResource } from "@/lib/hooks";
import type { AdminReview, Paginated, ReviewStatus } from "@/lib/types";
import { formatDate, reviewStatusTone } from "@/lib/format";
import { t, reviewStatusLabel } from "@/lib/i18n";
import { Badge, Button, EmptyState, ErrorBlock, InlineError, LoadingBlock, PageHeader, Pagination } from "@/components/ui";

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "pending", label: t.reviews.tabs.pending },
  { key: "approved", label: t.reviews.tabs.approved },
  { key: "rejected", label: t.reviews.tabs.rejected },
];
const LIMIT = 20;

function ReviewsView() {
  const router = useRouter();
  const params = useSearchParams();
  const status = (params.get("status") as ReviewStatus | null) ?? "pending";
  const offset = Number(params.get("offset") ?? 0) || 0;

  const fetcher = useCallback(
    () => api.get<Paginated<"reviews", AdminReview>>("/api/admin/reviews", { status, limit: LIMIT, offset }),
    [status, offset],
  );
  const { data, error, loading, reload } = useResource(fetcher);

  const moderate = useMutation((id: string, next: ReviewStatus) =>
    api.patch(`/api/admin/reviews/${id}`, { status: next }),
  );

  function setStatus(next: ReviewStatus) {
    router.push(`/reviews?status=${next}`);
  }

  async function act(id: string, next: ReviewStatus) {
    const ok = await moderate.run(id, next);
    if (ok !== undefined) reload();
  }

  return (
    <div>
      <PageHeader title={t.reviews.title} description={t.reviews.subtitle} />

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              status === tab.key ? "border-volt text-volt" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <InlineError message={moderate.error} />
      {loading && !data && <LoadingBlock />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && (data.reviews.length === 0 ? (
        <EmptyState title={t.reviews.emptyByStatus(status)} />
      ) : (
        <>
          <div className="space-y-3">
            {data.reviews.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{r.author}</span>
                    <span className="text-amber-500">{"★".repeat(r.rating)}<span className="text-slate-300">{"★".repeat(5 - r.rating)}</span></span>
                    <Badge tone={reviewStatusTone(r.status)}>{reviewStatusLabel(r.status)}</Badge>
                    {/* verified purchase is display-only; the backend owns this value */}
                    {r.verifiedPurchase && <Badge tone="success">{t.reviews.verifiedPurchase}</Badge>}
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(r.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{r.body}</p>
                <p className="mt-1 text-xs text-slate-400">{r.email ?? t.reviews.noContactEmail}</p>
                <div className="mt-3 flex gap-2">
                  {r.status !== "approved" && (
                    <Button variant="primary" loading={moderate.pending} onClick={() => act(r.id, "approved")}>
                      {t.reviews.approve}
                    </Button>
                  )}
                  {r.status !== "rejected" && (
                    <Button variant="danger" loading={moderate.pending} onClick={() => act(r.id, "rejected")}>
                      {r.status === "approved" ? t.reviews.unpublish : t.reviews.reject}
                    </Button>
                  )}
                  {r.status !== "pending" && (
                    <Button variant="ghost" loading={moderate.pending} onClick={() => act(r.id, "pending")}>
                      {t.reviews.moveToPending}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={(o) => router.push(`/reviews?status=${status}&offset=${o}`)} />
        </>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ReviewsView />
    </Suspense>
  );
}
