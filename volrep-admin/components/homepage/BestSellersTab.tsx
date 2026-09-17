"use client";

import type { HomepageSection } from "@/lib/types";
import { t } from "@/lib/i18n";
import { Card, CardBody, CardHeader, Field, InlineError, Select, TextInput } from "@/components/ui";

// V1: expose exactly the current storefront behaviour — the "Meilleures
// ventes" section renders products from the catalogue API (limit N). No
// manual product selection (the backend schema does not support it in V1).
// This tab edits ONLY the `bestSellers` section's `source` on the working
// document; heading/eyebrow/body are edited in the Sections tab.
export function BestSellersTab({
  sections,
  onChange,
}: {
  sections: HomepageSection[];
  onChange: (next: HomepageSection[]) => void;
}) {
  const index = sections.findIndex((s) => s.type === "bestSellers");
  const section = index >= 0 ? sections[index] : undefined;

  if (!section || section.type !== "bestSellers") {
    return (
      <Card>
        <CardBody>
          <InlineError message={t.homepage.loadError} />
        </CardBody>
      </Card>
    );
  }

  const source = section.data.source;

  const setLimit = (limit: number) => {
    const clamped = Math.min(24, Math.max(1, limit || 1));
    onChange(
      sections.map((s, i) =>
        i === index && s.type === "bestSellers"
          ? { ...s, data: { ...s.data, source: { ...s.data.source, limit: clamped } } }
          : s,
      ),
    );
  };

  return (
    <Card>
      <CardHeader title={t.homepage.bestSellers.title} description={t.homepage.bestSellers.subtitle} />
      <CardBody className="space-y-4">
        <Field label={t.homepage.bestSellers.source} hint={t.homepage.bestSellers.sourceCatalogHint}>
          <Select value="catalog" disabled onChange={() => {}}>
            <option value="catalog">{t.homepage.bestSellers.sourceCatalog}</option>
          </Select>
        </Field>

        <Field label={t.homepage.bestSellers.limit} hint={t.homepage.bestSellers.limitHint}>
          <TextInput
            type="number"
            min={1}
            max={24}
            value={String(source.limit)}
            onChange={(e) => setLimit(Number.parseInt(e.target.value, 10))}
          />
        </Field>

        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {t.homepage.bestSellers.headingsNote}
        </p>
      </CardBody>
    </Card>
  );
}
