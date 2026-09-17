"use client";

import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import type {
  PageAccordionData,
  PageBenefitsData,
  PageBigResultData,
  PageComparisonData,
  PageCompState,
  PageEndorsementData,
  PageHeroData,
  PageOrderData,
  PageProblemSolutionData,
  PageProfessionalsData,
  PageReviewsData,
  PageSayGoodbyeData,
  PageSection,
  PageStickyCtaData,
  PageTrustData,
  PageUgcData,
  ProductImage,
} from "@/lib/types";
import { Button, Field, Icon, Select, TextInput } from "@/components/ui";
import { MediaField } from "./MediaField";

export type MediaCtx = {
  productId: string;
  images: ProductImage[];
};

// ---- shared primitives ------------------------------------------------

function TextRow({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <TextInput value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function AreaRow({
  label,
  value,
  onChange,
  hint,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-900 focus:border-volt"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function Repeater<T>({
  label,
  items,
  onChange,
  newItem,
  render,
  addLabel = t.studio.page.fields.addItem,
  min = 0,
}: {
  label: string;
  items: T[];
  onChange: (next: T[]) => void;
  newItem: () => T;
  render: (item: T, set: (v: T) => void, index: number) => ReactNode;
  addLabel?: string;
  min?: number;
}) {
  const setAt = (i: number, v: T) => onChange(items.map((it, idx) => (idx === i ? v : it)));
  const removeAt = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j] as T, next[i] as T];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-md border border-slate-200 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400">#{i + 1}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t.studio.page.moveUp}>
                  <Icon.arrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={t.studio.page.moveDown}
                >
                  <Icon.arrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  disabled={items.length <= min}
                  onClick={() => removeAt(i)}
                  aria-label={t.studio.page.fields.remove}
                >
                  <Icon.trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {render(item, (v) => setAt(i, v), i)}
          </div>
        ))}
      </div>
      <Button size="sm" variant="secondary" onClick={() => onChange([...items, newItem()])}>
        <Icon.plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}

const EMPH = t.studio.page.fields.emphasisHint;
const PRICE = t.studio.page.fields.priceTokenHint;

function ph(label: string) {
  return {
    kind: "placeholder" as const,
    imageId: null,
    url: "",
    poster: "",
    alt: "",
    placeholderLabel: label,
    mediaType: "image" as const,
    fileName: "",
  };
}

// ---- per-type editors ----------------------------------------------

function HeroEditor({ data, onChange, media }: { data: PageHeroData; onChange: (d: PageHeroData) => void; media: MediaCtx }) {
  const set = <K extends keyof PageHeroData>(k: K, v: PageHeroData[K]) => onChange({ ...data, [k]: v });
  const ba = data.beforeAfter;
  const setBa = <K extends keyof PageHeroData["beforeAfter"]>(k: K, v: PageHeroData["beforeAfter"][K]) =>
    onChange({ ...data, beforeAfter: { ...ba, [k]: v } });
  return (
    <div className="space-y-4">
      <TextRow label={t.studio.page.fields.subtitle} value={data.subtitle} onChange={(v) => set("subtitle", v)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextRow
          label={t.studio.page.fields.reviewsFallbackLabel}
          value={data.reviewsFallbackLabel}
          onChange={(v) => set("reviewsFallbackLabel", v)}
        />
        <TextRow
          label={t.studio.page.fields.reviewsCountSuffix}
          value={data.reviewsCountSuffix}
          onChange={(v) => set("reviewsCountSuffix", v)}
        />
      </div>
      <TextRow label={t.studio.page.fields.ctaLabel} value={data.ctaLabel} onChange={(v) => set("ctaLabel", v)} hint={PRICE} />
      <TextRow label={t.studio.page.fields.ctaSubtext} value={data.ctaSubtext} onChange={(v) => set("ctaSubtext", v)} />
      <TextRow
        label={t.studio.page.fields.ctaSubtextSmall}
        value={data.ctaSubtextSmall}
        onChange={(v) => set("ctaSubtextSmall", v)}
        hint={PRICE}
      />

      <Repeater
        label={t.studio.page.fields.features}
        items={data.features}
        onChange={(v) => set("features", v)}
        newItem={() => ({ icon: "", label: "" })}
        render={(it, s) => (
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <TextInput value={it.icon} placeholder="🖐️" onChange={(e) => s({ ...it, icon: e.target.value })} />
            <TextInput value={it.label} onChange={(e) => s({ ...it, label: e.target.value })} />
          </div>
        )}
      />

      <Repeater
        label={t.studio.page.fields.guarantees}
        items={data.guarantees}
        onChange={(v) => set("guarantees", v)}
        newItem={() => ({ icon: "", text: "" })}
        render={(it, s) => (
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <TextInput value={it.icon} onChange={(e) => s({ ...it, icon: e.target.value })} />
            <TextInput value={it.text} onChange={(e) => s({ ...it, text: e.target.value })} />
          </div>
        )}
      />

      <div className="rounded-md border border-slate-200 p-2.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t.studio.page.fields.guaranteeBox}
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <TextInput value={data.guaranteeBox.icon} onChange={(e) => set("guaranteeBox", { ...data.guaranteeBox, icon: e.target.value })} />
            <TextInput value={data.guaranteeBox.title} onChange={(e) => set("guaranteeBox", { ...data.guaranteeBox, title: e.target.value })} />
          </div>
          <AreaRow
            label={t.studio.page.fields.text}
            value={data.guaranteeBox.body}
            onChange={(v) => set("guaranteeBox", { ...data.guaranteeBox, body: v })}
            hint={EMPH}
            rows={2}
          />
        </div>
      </div>

      <Repeater
        label={t.studio.page.fields.paragraphs}
        items={data.description}
        onChange={(v) => set("description", v)}
        newItem={() => ""}
        addLabel={t.studio.page.fields.addParagraph}
        render={(it, s) => (
          <textarea
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[13px] focus:border-volt"
            rows={2}
            value={it}
            onChange={(e) => s(e.target.value)}
          />
        )}
      />

      <div className="rounded-md border border-slate-200 p-3">
        <label className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
          <input type="checkbox" checked={ba.enabled} onChange={(e) => setBa("enabled", e.target.checked)} />
          {t.studio.page.fields.beforeAfterEnabled}
        </label>
        {ba.enabled && (
          <div className="mt-3 space-y-3">
            <TextRow label={t.studio.page.fields.title} value={ba.title} onChange={(v) => setBa("title", v)} />
            <TextRow label={t.studio.page.fields.subtitle} value={ba.subtitle} onChange={(v) => setBa("subtitle", v)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextRow label={t.studio.page.fields.beforeLabel} value={ba.beforeLabel} onChange={(v) => setBa("beforeLabel", v)} />
              <TextRow label={t.studio.page.fields.afterLabel} value={ba.afterLabel} onChange={(v) => setBa("afterLabel", v)} />
            </div>
            <Repeater
              label={t.studio.page.fields.zones}
              items={ba.zones}
              onChange={(v) => setBa("zones", v)}
              newItem={() => ({ name: "", media: ph("") })}
              render={(z, s) => (
                <div className="space-y-2">
                  <TextRow label={t.studio.page.fields.zoneName} value={z.name} onChange={(v) => s({ ...z, name: v })} />
                  <MediaField
                    slot={z.media}
                    onChange={(m) => s({ ...z, media: m })}
                    productId={media.productId}
                    images={media.images}
                    allowGif
                  />
                </div>
              )}
            />
            <AreaRow label={t.studio.page.fields.disclaimer} value={ba.disclaimer} onChange={(v) => setBa("disclaimer", v)} hint={EMPH} rows={2} />
          </div>
        )}
      </div>
    </div>
  );
}

function AccordionEditor({ data, onChange, isFaq }: { data: PageAccordionData; onChange: (d: PageAccordionData) => void; isFaq: boolean }) {
  return (
    <div className="space-y-4">
      {isFaq && <TextRow label={t.studio.page.fields.heading} value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} hint={EMPH} />}
      <Field label={t.studio.page.fields.defaultOpen}>
        <TextInput
          type="number"
          value={String(data.defaultOpen)}
          onChange={(e) => onChange({ ...data, defaultOpen: Number.parseInt(e.target.value, 10) || -1 })}
        />
      </Field>
      <Repeater
        label={t.studio.page.fields.items}
        items={data.items}
        onChange={(v) => onChange({ ...data, items: v })}
        newItem={() => ({ question: "", answer: "" })}
        min={1}
        render={(it, s) => (
          <div className="space-y-2">
            <TextRow label={t.studio.page.fields.question} value={it.question} onChange={(v) => s({ ...it, question: v })} />
            <AreaRow label={t.studio.page.fields.answer} value={it.answer} onChange={(v) => s({ ...it, answer: v })} rows={3} />
          </div>
        )}
      />
    </div>
  );
}

function UgcEditor({ data, onChange, media }: { data: PageUgcData; onChange: (d: PageUgcData) => void; media: MediaCtx }) {
  return (
    <div className="space-y-4">
      <TextRow label={t.studio.page.fields.heading} value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} hint={EMPH} />
      <Repeater
        label={t.studio.page.fields.videoSlots}
        items={data.videos}
        onChange={(v) => onChange({ ...data, videos: v })}
        newItem={() => ({ media: ph("Vidéo client · à venir") })}
        render={(v, s) => (
          <MediaField
            slot={v.media}
            onChange={(m) => s({ media: m })}
            productId={media.productId}
            images={media.images}
            withPoster
            allowVideo
            allowGif
          />
        )}
      />
    </div>
  );
}

function ProfessionalsEditor({ data, onChange }: { data: PageProfessionalsData; onChange: (d: PageProfessionalsData) => void }) {
  return (
    <div className="space-y-4">
      <TextRow label={t.studio.page.fields.title} value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
      <Repeater
        label={t.studio.page.fields.labels}
        items={data.labels}
        onChange={(v) => onChange({ ...data, labels: v })}
        newItem={() => ""}
        render={(it, s) => <TextInput value={it} onChange={(e) => s(e.target.value)} />}
      />
    </div>
  );
}

function BigResultEditor({ data, onChange, media }: { data: PageBigResultData; onChange: (d: PageBigResultData) => void; media: MediaCtx }) {
  return (
    <div className="space-y-4">
      <TextRow label={t.studio.page.fields.heading} value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} hint={EMPH} />
      <MediaField slot={data.media} onChange={(m) => onChange({ ...data, media: m })} productId={media.productId} images={media.images} allowGif />
      <AreaRow label={t.studio.page.fields.disclaimer} value={data.disclaimer} onChange={(v) => onChange({ ...data, disclaimer: v })} hint={EMPH} rows={2} />
    </div>
  );
}

function BenefitsEditor({ data, onChange, media }: { data: PageBenefitsData; onChange: (d: PageBenefitsData) => void; media: MediaCtx }) {
  return (
    <div className="space-y-4">
      <MediaField slot={data.media} onChange={(m) => onChange({ ...data, media: m })} productId={media.productId} images={media.images} allowGif />
      <TextRow label={t.studio.page.fields.heading} value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} hint={EMPH} />
      <AreaRow label={t.studio.page.fields.subtitle} value={data.subtitle} onChange={(v) => onChange({ ...data, subtitle: v })} hint={EMPH} rows={2} />
      <Repeater
        label={t.studio.page.fields.items}
        items={data.blocks}
        onChange={(v) => onChange({ ...data, blocks: v })}
        newItem={() => ({ title: "", desc: "", tags: [] })}
        render={(b, s) => (
          <div className="space-y-2">
            <TextRow label={t.studio.page.fields.title} value={b.title} onChange={(v) => s({ ...b, title: v })} />
            <AreaRow label={t.studio.page.fields.text} value={b.desc} onChange={(v) => s({ ...b, desc: v })} hint={EMPH} rows={2} />
            <TextRow
              label={t.studio.page.fields.tags}
              value={b.tags.join(", ")}
              onChange={(v) => s({ ...b, tags: v.split(",").map((x) => x.trim()).filter(Boolean) })}
            />
          </div>
        )}
      />
    </div>
  );
}

function SayGoodbyeEditor({ data, onChange, media }: { data: PageSayGoodbyeData; onChange: (d: PageSayGoodbyeData) => void; media: MediaCtx }) {
  return (
    <div className="space-y-4">
      <MediaField slot={data.media} onChange={(m) => onChange({ ...data, media: m })} productId={media.productId} images={media.images} allowGif />
      <TextRow label={t.studio.page.fields.title} value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
      <Repeater
        label={t.studio.page.fields.items}
        items={data.items}
        onChange={(v) => onChange({ ...data, items: v })}
        newItem={() => ""}
        render={(it, s) => <TextInput value={it} onChange={(e) => s(e.target.value)} />}
      />
      <AreaRow label={t.studio.page.fields.text} value={data.desc} onChange={(v) => onChange({ ...data, desc: v })} hint={EMPH} rows={3} />
    </div>
  );
}

function EndorsementEditor({ data, onChange }: { data: PageEndorsementData; onChange: (d: PageEndorsementData) => void }) {
  const set = <K extends keyof PageEndorsementData>(k: K, v: PageEndorsementData[K]) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-4">
      <TextRow label={t.studio.page.fields.avatar} value={data.avatar} onChange={(v) => set("avatar", v)} />
      <AreaRow label={t.studio.page.fields.quote} value={data.quote} onChange={(v) => set("quote", v)} hint={EMPH} rows={3} />
      <TextRow label={t.studio.page.fields.name} value={data.name} onChange={(v) => set("name", v)} hint={EMPH} />
      <TextRow label={t.studio.page.fields.title} value={data.title} onChange={(v) => set("title", v)} hint={EMPH} />
      <AreaRow label={t.studio.page.fields.text} value={data.desc} onChange={(v) => set("desc", v)} hint={EMPH} rows={3} />
      <div className="rounded-md border border-slate-200 p-2.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.studio.page.fields.proTip}</p>
        <div className="space-y-2">
          <TextRow label={t.studio.page.fields.badge} value={data.proTip.badge} onChange={(v) => set("proTip", { ...data.proTip, badge: v })} />
          <AreaRow label={t.studio.page.fields.text} value={data.proTip.text} onChange={(v) => set("proTip", { ...data.proTip, text: v })} hint={EMPH} rows={2} />
        </div>
      </div>
    </div>
  );
}

const COMP_STATES: PageCompState[] = ["yes", "no", "partial"];
function compStateLabel(s: PageCompState) {
  return s === "yes" ? t.studio.page.fields.stateYes : s === "no" ? t.studio.page.fields.stateNo : t.studio.page.fields.statePartial;
}

function ComparisonEditor({
  data,
  onChange,
  media,
}: {
  data: PageComparisonData;
  onChange: (d: PageComparisonData) => void;
  media: MediaCtx;
}) {
  // Keep every row's competitor-cell count in sync with the column list.
  const setCompetitors = (labels: string[]) => {
    const rows = data.rows.map((r) => {
      const cells = labels.map((_, i) => r.competitors[i] ?? "no");
      return { ...r, competitors: cells };
    });
    onChange({ ...data, competitors: labels, rows });
  };
  return (
    <div className="space-y-4">
      <TextRow label={t.studio.page.fields.heading} value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} hint={EMPH} />
      <TextRow label={t.studio.page.fields.subtitle} value={data.subtitle} onChange={(v) => onChange({ ...data, subtitle: v })} />
      <TextRow label={t.studio.page.fields.productName} value={data.productName} onChange={(v) => onChange({ ...data, productName: v })} />
      <MediaField
        label={t.studio.page.fields.comparisonImage}
        hint={t.studio.page.fields.comparisonImageHint}
        slot={data.media ?? ph("Visuel produit")}
        onChange={(m) => onChange({ ...data, media: m })}
        productId={media.productId}
        images={media.images}
      />
      <Repeater
        label={t.studio.page.fields.competitors}
        items={data.competitors}
        onChange={setCompetitors}
        newItem={() => ""}
        min={1}
        render={(it, s) => <TextInput value={it} onChange={(e) => s(e.target.value)} />}
      />
      <Repeater
        label={t.studio.page.fields.rows}
        items={data.rows}
        onChange={(v) => onChange({ ...data, rows: v })}
        newItem={() => ({ label: "", product: "yes" as PageCompState, competitors: data.competitors.map(() => "no" as PageCompState) })}
        render={(row, s) => (
          <div className="space-y-2">
            <TextRow label={t.studio.page.fields.rowLabel} value={row.label} onChange={(v) => s({ ...row, label: v })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={data.productName || "Produit"}>
                <Select value={row.product} onChange={(e) => s({ ...row, product: e.target.value as PageCompState })}>
                  {COMP_STATES.map((st) => (
                    <option key={st} value={st}>
                      {compStateLabel(st)}
                    </option>
                  ))}
                </Select>
              </Field>
              {data.competitors.map((name, ci) => (
                <Field key={ci} label={name || `Concurrent ${ci + 1}`}>
                  <Select
                    value={row.competitors[ci] ?? "no"}
                    onChange={(e) => {
                      const cells = [...row.competitors];
                      cells[ci] = e.target.value as PageCompState;
                      s({ ...row, competitors: cells });
                    }}
                  >
                    {COMP_STATES.map((st) => (
                      <option key={st} value={st}>
                        {compStateLabel(st)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </div>
        )}
      />
    </div>
  );
}

function ReviewsEditor({ data, onChange }: { data: PageReviewsData; onChange: (d: PageReviewsData) => void }) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {t.studio.page.fields.reviewsNote}
      </p>
      <TextRow label={t.studio.page.fields.heading} value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} hint={EMPH} />
      <Field label={t.studio.page.fields.maxCount}>
        <TextInput
          type="number"
          value={String(data.maxCount)}
          onChange={(e) => onChange({ ...data, maxCount: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })}
        />
      </Field>
      <AreaRow label={t.studio.page.fields.emptyText} value={data.emptyText} onChange={(v) => onChange({ ...data, emptyText: v })} hint={EMPH} rows={2} />
    </div>
  );
}

function TrustEditor({ data, onChange }: { data: PageTrustData; onChange: (d: PageTrustData) => void }) {
  return (
    <Repeater
      label={t.studio.page.fields.items}
      items={data.items}
      onChange={(v) => onChange({ ...data, items: v })}
      newItem={() => ({ icon: "", title: "", desc: "" })}
      render={(it, s) => (
        <div className="space-y-2">
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <TextInput value={it.icon} onChange={(e) => s({ ...it, icon: e.target.value })} />
            <TextInput value={it.title} onChange={(e) => s({ ...it, title: e.target.value })} />
          </div>
          <TextInput value={it.desc} onChange={(e) => s({ ...it, desc: e.target.value })} />
        </div>
      )}
    />
  );
}

function ProblemSolutionEditor({ data, onChange }: { data: PageProblemSolutionData; onChange: (d: PageProblemSolutionData) => void }) {
  const set = <K extends keyof PageProblemSolutionData>(k: K, v: PageProblemSolutionData[K]) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[80px_1fr] gap-2">
        <TextInput value={data.warningIcon} onChange={(e) => set("warningIcon", e.target.value)} />
        <TextInput value={data.warningText} onChange={(e) => set("warningText", e.target.value)} />
      </div>
      <TextRow label={t.studio.page.fields.title} value={data.title} onChange={(v) => set("title", v)} hint={EMPH} />
      <Repeater
        label={t.studio.page.fields.problems}
        items={data.problems}
        onChange={(v) => set("problems", v)}
        newItem={() => ({ icon: "", title: "", text: "" })}
        render={(p, s) => (
          <div className="space-y-2">
            <div className="grid grid-cols-[80px_1fr] gap-2">
              <TextInput value={p.icon} onChange={(e) => s({ ...p, icon: e.target.value })} />
              <TextInput value={p.title} onChange={(e) => s({ ...p, title: e.target.value })} />
            </div>
            <AreaRow label={t.studio.page.fields.text} value={p.text} onChange={(v) => s({ ...p, text: v })} hint={EMPH} rows={2} />
          </div>
        )}
      />
      <TextRow label={t.studio.page.fields.solutionLabel} value={data.solutionLabel} onChange={(v) => set("solutionLabel", v)} />
      <div className="rounded-md border border-slate-200 p-2.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.studio.page.fields.solution}</p>
        <div className="space-y-2">
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <TextInput value={data.solution.icon} onChange={(e) => set("solution", { ...data.solution, icon: e.target.value })} />
            <TextInput value={data.solution.title} onChange={(e) => set("solution", { ...data.solution, title: e.target.value })} />
          </div>
          <AreaRow label={t.studio.page.fields.text} value={data.solution.text} onChange={(v) => set("solution", { ...data.solution, text: v })} hint={EMPH} rows={2} />
        </div>
      </div>
    </div>
  );
}

function OrderEditor({ data, onChange }: { data: PageOrderData; onChange: (d: PageOrderData) => void }) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">{t.studio.page.fields.orderNote}</p>
      <TextRow label={t.studio.page.fields.title} value={data.title} onChange={(v) => onChange({ ...data, title: v })} hint={EMPH} />
      <TextRow label={t.studio.page.fields.subtitle} value={data.subtitle} onChange={(v) => onChange({ ...data, subtitle: v })} />
    </div>
  );
}

function StickyCtaEditor({ data, onChange }: { data: PageStickyCtaData; onChange: (d: PageStickyCtaData) => void }) {
  return <TextRow label={t.studio.page.fields.label} value={data.label} onChange={(v) => onChange({ ...data, label: v })} />;
}

// ---- dispatcher ----------------------------------------------------

export function SectionEditor({
  section,
  onChange,
  media,
}: {
  section: PageSection;
  onChange: (section: PageSection) => void;
  media: MediaCtx;
}) {
  switch (section.type) {
    case "hero":
      return <HeroEditor data={section.data} media={media} onChange={(d) => onChange({ ...section, data: d })} />;
    case "ugc":
      return <UgcEditor data={section.data} media={media} onChange={(d) => onChange({ ...section, data: d })} />;
    case "descriptionFaq":
      return <AccordionEditor data={section.data} isFaq={false} onChange={(d) => onChange({ ...section, data: d })} />;
    case "faq":
      return <AccordionEditor data={section.data} isFaq onChange={(d) => onChange({ ...section, data: d })} />;
    case "professionals":
      return <ProfessionalsEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "bigResult":
      return <BigResultEditor data={section.data} media={media} onChange={(d) => onChange({ ...section, data: d })} />;
    case "benefits":
      return <BenefitsEditor data={section.data} media={media} onChange={(d) => onChange({ ...section, data: d })} />;
    case "sayGoodbye":
      return <SayGoodbyeEditor data={section.data} media={media} onChange={(d) => onChange({ ...section, data: d })} />;
    case "endorsement":
      return <EndorsementEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "comparison":
      return <ComparisonEditor data={section.data} media={media} onChange={(d) => onChange({ ...section, data: d })} />;
    case "reviews":
      return <ReviewsEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "trust":
      return <TrustEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "problemSolution":
      return <ProblemSolutionEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "order":
      return <OrderEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "stickyCta":
      return <StickyCtaEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    default:
      return null;
  }
}
