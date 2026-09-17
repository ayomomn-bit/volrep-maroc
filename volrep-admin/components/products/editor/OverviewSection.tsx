"use client";

import type { ReactNode } from "react";
import type { ProductStudio, Variant } from "@/lib/types";
import { formatMoney, productStatusTone } from "@/lib/format";
import { t, productStatusLabel } from "@/lib/i18n";
import { Badge, Button, Card, CardBody, CardHeader, Icon, ReadinessMeter } from "@/components/ui";
import { productReadiness } from "@/lib/product-readiness";
import type { StudioTab } from "./ProductStudio";

function minPrice(variants: Variant[]) {
  const priced = variants.filter((v) => Number(v.price.amount) > 0);
  if (priced.length === 0) return null;
  return priced.reduce((lo, v) => (Number(v.price.amount) < Number(lo.price.amount) ? v : lo));
}

type CardStatus = "ready" | "partial" | "empty" | "info";

const STATUS_META: Record<CardStatus, { dot: string; label: string }> = {
  ready: { dot: "bg-green-500", label: t.studio.overview.statusReady },
  partial: { dot: "bg-amber-500", label: t.studio.overview.statusPartial },
  empty: { dot: "bg-slate-300", label: t.studio.overview.statusEmpty },
  info: { dot: "bg-blue-400", label: t.studio.overview.statusInfo },
};

function IndicatorCard({
  title,
  hint,
  status,
  lines,
  onOpen,
}: {
  title: string;
  hint: string;
  status: CardStatus;
  lines: string[];
  onOpen: () => void;
}) {
  const meta = STATUS_META[status];
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-800">{title}</p>
          <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>
      <ul className="mt-2.5 flex-1 space-y-1">
        {lines.map((line, i) => (
          <li key={i} className="text-xs text-slate-500">
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Button size="sm" variant="secondary" onClick={onOpen}>
          {t.studio.overview.openTab}
        </Button>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-[13px] text-slate-800">{children}</p>
    </div>
  );
}

export function OverviewSection({
  studio,
  onNavigate,
}: {
  studio: ProductStudio;
  onNavigate: (tab: StudioTab) => void;
}) {
  const { product, completeness: c } = studio;
  const lead = minPrice(product.variants);
  const compareAt = product.variants.find((v) => v.compareAtPrice)?.compareAtPrice ?? null;
  const mainImage = product.images[0] ?? null;
  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
  const optionNames = product.options.map((o) => o.name).join(", ");

  // ---- per-section status + lines --------------------------------
  const identity = {
    status: (product.variants.length > 0 ? "ready" : "partial") as CardStatus,
    lines: [
      t.studio.overview.variantsValue(product.variants.length),
      t.studio.overview.optionsValue(optionNames),
    ],
  };

  const media = {
    status: (c.media.total > 0 ? "ready" : "empty") as CardStatus,
    lines: [c.media.total > 0 ? t.studio.overview.media.value(c.media.total, c.media.owned) : t.studio.overview.media.none],
  };

  const commerce = {
    status: (c.commerce.priced && c.commerce.published
      ? "ready"
      : c.commerce.priced
        ? "partial"
        : "empty") as CardStatus,
    lines: [] as string[],
  };
  commerce.lines.push(
    c.commerce.published
      ? t.studio.overview.commerce.published
      : product.status === "archived"
        ? t.studio.overview.commerce.archived
        : t.studio.overview.commerce.draft,
  );
  if (c.commerce.variants === 0) commerce.lines.push(t.studio.overview.commerce.noVariants);
  else if (!c.commerce.priced) commerce.lines.push(t.studio.overview.commerce.noPrice);

  const landing = {
    status: (c.landingPages.needsAttention
      ? "partial"
      : c.landingPages.total === 0
        ? "info"
        : "ready") as CardStatus,
    lines:
      c.landingPages.total === 0
        ? [t.studio.overview.landingPages.none]
        : [
            t.studio.overview.landingPages.some(c.landingPages.linked),
            c.landingPages.needsAttention
              ? t.studio.overview.landingPages.needsAttention
              : t.studio.overview.landingPages.verified(c.landingPages.verified, c.landingPages.total),
          ],
  };

  // ---- readiness verdict: only what a Volrep-PDP sale requires (price +
  // media). A Lirya marketing page is an optional acquisition channel, not
  // a prerequisite — it stays visible as its own indicator card below.
  const readiness = productReadiness(c);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title={t.studio.overview.title} description={t.studio.overview.subtitle} />
        <CardBody>
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="h-40 w-40 shrink-0 overflow-hidden rounded-md ring-1 ring-slate-200">
              {mainImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mainImage.url} alt={mainImage.altText ?? product.title} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-50 text-xs text-slate-400">
                  {t.studio.overview.noImage}
                </div>
              )}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
              <Fact label={t.studio.overview.priceLabel}>
                {lead ? formatMoney(lead.price) : t.studio.overview.noPrice}
              </Fact>
              <Fact label={t.studio.overview.compareAtLabel}>
                {compareAt ? <span className="text-slate-500 line-through">{formatMoney(compareAt)}</span> : t.common.dash}
              </Fact>
              <Fact label={t.studio.overview.statusLabel}>
                <Badge tone={productStatusTone(product.status)}>{productStatusLabel(product.status)}</Badge>
              </Fact>
              <Fact label={t.studio.overview.variantsLabel}>
                {t.studio.overview.variantsValue(product.variants.length)}
              </Fact>
              <Fact label={t.products.options.title}>{optionNames || t.common.none}</Fact>
              <Fact label={t.studio.overview.stockLabel}>{t.studio.overview.stockValue(totalStock)}</Fact>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Readiness verdict */}
      <Card>
        <CardBody className="space-y-3">
          <ReadinessMeter ready={readiness.ready} total={readiness.total} label={t.studio.overview.readinessLabel} />
          <div
            className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] ${
              readiness.isReady
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {readiness.isReady ? <Icon.check className="h-4 w-4" /> : <Icon.alert className="h-4 w-4" />}
            </span>
            <div>
              <p className="font-semibold">
                {readiness.isReady ? t.studio.overview.readyTitle : t.studio.overview.notReadyTitle(readiness.missing)}
              </p>
              <p className="mt-0.5 text-xs opacity-90">
                {readiness.isReady ? t.studio.overview.readyBody : t.studio.overview.notReadyBody}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <IndicatorCard title={t.studio.overview.cards.identity} hint={t.studio.overview.cardHints.identity} status={identity.status} lines={identity.lines} onOpen={() => onNavigate("info")} />
        <IndicatorCard title={t.studio.overview.cards.media} hint={t.studio.overview.cardHints.media} status={media.status} lines={media.lines} onOpen={() => onNavigate("media")} />
        <IndicatorCard title={t.studio.overview.cards.commerce} hint={t.studio.overview.cardHints.commerce} status={commerce.status} lines={commerce.lines} onOpen={() => onNavigate("info")} />
        <IndicatorCard title={t.studio.overview.cards.landingPages} hint={t.studio.overview.cardHints.landingPages} status={landing.status} lines={landing.lines} onOpen={() => onNavigate("landing-pages")} />
      </div>
    </div>
  );
}
