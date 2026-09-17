"use client";

import { useCallback } from "react";
import { homepageApi } from "@/lib/homepage-api";
import { useResource } from "@/lib/hooks";
import { t } from "@/lib/i18n";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui";
import { HomepageStudio } from "@/components/homepage/HomepageStudio";

// Homepage Studio — the editable storefront homepage. Rendered inside the
// protected /(app) shell, so both staff and owner reach it (same tier as
// Product Studio's "Page produit"). Backend authorization (requireAdmin) is
// the real boundary.
export default function HomepageStudioPage() {
  const fetcher = useCallback(() => homepageApi.get(), []);
  const { data, error, loading, reload } = useResource(fetcher);

  return (
    <div>
      <PageHeader title={t.homepage.title} description={t.homepage.subtitle} />

      {loading && !data ? (
        <LoadingBlock label={t.homepage.loading} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : data ? (
        <HomepageStudio data={data} reload={reload} />
      ) : null}
    </div>
  );
}
