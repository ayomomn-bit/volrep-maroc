"use client";

import type { HomepageSection } from "@/lib/types";
import { t } from "@/lib/i18n";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { HomepageSectionList } from "./HomepageSectionList";
import type { HomepageMediaCtx } from "./HomepageSectionEditors";

export function SectionsTab({
  sections,
  onChange,
  media,
}: {
  sections: HomepageSection[];
  onChange: (next: HomepageSection[]) => void;
  media: HomepageMediaCtx;
}) {
  const hidden = sections.filter((s) => !s.enabled).length;

  return (
    <Card>
      <CardHeader
        title={t.homepage.sections.title}
        description={t.homepage.sections.subtitle}
        action={
          <span className="text-xs text-slate-400">
            {t.homepage.sections.count(sections.length)}
            {hidden > 0 ? ` · ${t.homepage.sections.hiddenCount(hidden)}` : ""}
          </span>
        }
      />
      <CardBody>
        <HomepageSectionList sections={sections} onChange={onChange} media={media} />
      </CardBody>
    </Card>
  );
}
