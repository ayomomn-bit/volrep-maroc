"use client";

import type { HomepageResponse, HomepageSection } from "@/lib/types";
import { t } from "@/lib/i18n";
import { formatDate, formatRelative } from "@/lib/format";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { hasUnpublishedChanges, homepageOverviewStats } from "@/lib/homepage-studio";
import type { HomepageStudioTab } from "./HomepageStudio";

function Row({ label, value, tone }: { label: string; value: string; tone?: "amber" | "green" | "slate" }) {
  const valueClass =
    tone === "amber" ? "text-amber-600" : tone === "green" ? "text-green-600" : "text-slate-800";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`text-[13px] font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

export function OverviewTab({
  res,
  sections,
  dirty,
  mediaCount,
  onNavigate,
}: {
  res: HomepageResponse;
  sections: HomepageSection[];
  dirty: boolean;
  mediaCount: number | undefined;
  onNavigate: (tab: HomepageStudioTab) => void;
}) {
  const stats = homepageOverviewStats({ version: 1, settings: {}, sections });
  const unpublished = hasUnpublishedChanges(res, dirty);

  const publicationStatus = !res.hasPublished
    ? t.homepage.statusNeverPublished
    : unpublished
      ? t.homepage.statusDraftAhead
      : t.homepage.statusPublished;

  return (
    <Card>
      <CardHeader
        title={t.homepage.overview.title}
        description={t.homepage.subtitle}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => onNavigate("sections")}>
              {t.homepage.tabs.sections}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onNavigate("media")}>
              {t.homepage.tabs.media}
            </Button>
          </div>
        }
      />
      <CardBody>
        <Row
          label={t.homepage.overview.publicationStatus}
          value={publicationStatus}
          tone={!res.hasPublished ? "amber" : unpublished ? "amber" : "green"}
        />
        <Row
          label={t.homepage.overview.lastDraftUpdate}
          value={formatRelative(res.updatedAt)}
        />
        <Row
          label={t.homepage.overview.lastPublication}
          value={res.publishedAt ? formatDate(res.publishedAt) : t.homepage.overview.neverPublished}
        />
        <Row
          label={t.homepage.overview.sectionCount}
          value={t.homepage.overview.sectionCountValue(stats.sectionCount, stats.enabledCount)}
        />
        <Row
          label={t.homepage.overview.mediaCount}
          value={
            mediaCount === undefined
              ? t.common.loading
              : t.homepage.overview.mediaCountValue(mediaCount)
          }
        />
        <Row
          label={t.homepage.overview.unpublishedChanges}
          value={
            unpublished
              ? `${t.homepage.overview.hasUnpublished}${dirty ? ` (${t.homepage.overview.unsavedLocal})` : ""}`
              : t.homepage.overview.noUnpublished
          }
          tone={unpublished ? "amber" : "green"}
        />

        <p className="mt-4 text-xs text-slate-400">{t.homepage.overview.note}</p>
      </CardBody>
    </Card>
  );
}
