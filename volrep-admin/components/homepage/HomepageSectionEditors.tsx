"use client";

import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import type {
  HomepageBestSellersData,
  HomepageCta,
  HomepageFaqData,
  HomepageFinalCtaData,
  HomepageFinalCtaIcon,
  HomepageHeroData,
  HomepageNewsletterData,
  HomepageRecoverEverywhereData,
  HomepageRecoveryPhilosophyData,
  HomepageSection,
  HomepageTestimonialsData,
  HomepageWhyVolrepData,
  HomepageWhyVolrepIcon,
  SiteMediaAsset,
} from "@/lib/types";
import { Field, Select, TextInput } from "@/components/ui";
import { HomepageMediaField } from "./HomepageMediaField";

export type HomepageMediaCtx = {
  assets: SiteMediaAsset[];
  onUploaded: () => void;
};

// ---- shared field primitives ----------------------------------------

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

function CtaRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: HomepageCta;
  onChange: (v: HomepageCta) => void;
}) {
  return (
    <div className="rounded-md border border-slate-200 p-2.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="space-y-2">
        <TextRow label={t.homepage.fields.ctaLabel} value={value.label} onChange={(v) => onChange({ ...value, label: v })} />
        <TextRow
          label={t.homepage.fields.ctaHref}
          value={value.href}
          onChange={(v) => onChange({ ...value, href: v })}
          hint={t.homepage.fields.ctaHrefHint}
        />
      </div>
    </div>
  );
}

// A fixed-length list: content editable, count + order frozen for V1.
function LockedList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
        {t.homepage.fields.lockedListNote}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ItemCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 p-2.5">
      <p className="mb-1.5 text-[11px] font-medium text-slate-400">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function updateAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((it, i) => (i === index ? { ...it, ...patch } : it));
}

// ---- per-section editors -------------------------------------------

function HeroEditor({
  data,
  onChange,
  media,
}: {
  data: HomepageHeroData;
  onChange: (d: HomepageHeroData) => void;
  media: HomepageMediaCtx;
}) {
  return (
    <div className="space-y-4">
      <TextRow
        label={t.homepage.fields.eyebrow}
        value={data.eyebrow}
        onChange={(v) => onChange({ ...data, eyebrow: v })}
        hint={t.homepage.fields.eyebrowHint}
      />
      <TextRow label={t.homepage.fields.heading} value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} />
      <AreaRow label={t.homepage.fields.body} value={data.body} onChange={(v) => onChange({ ...data, body: v })} />
      <CtaRow label={t.homepage.fields.primaryCta} value={data.primaryCta} onChange={(v) => onChange({ ...data, primaryCta: v })} />
      <CtaRow label={t.homepage.fields.secondaryCta} value={data.secondaryCta} onChange={(v) => onChange({ ...data, secondaryCta: v })} />

      <div className="rounded-md border border-slate-200 p-2.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.homepage.fields.visual}</p>
        <div className="space-y-2">
          <HomepageMediaField
            slot={data.visual.media}
            onChange={(m) => onChange({ ...data, visual: { ...data.visual, media: m } })}
            assets={media.assets}
            onUploaded={media.onUploaded}
            allowVideo
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <TextRow
              label={t.homepage.fields.badge}
              value={data.visual.badge}
              onChange={(v) => onChange({ ...data, visual: { ...data.visual, badge: v } })}
            />
            <TextRow
              label={t.homepage.fields.productName}
              value={data.visual.productName}
              onChange={(v) => onChange({ ...data, visual: { ...data.visual, productName: v } })}
            />
          </div>
          <TextRow
            label={t.homepage.fields.caption}
            value={data.visual.caption}
            onChange={(v) => onChange({ ...data, visual: { ...data.visual, caption: v } })}
          />
        </div>
      </div>
    </div>
  );
}

function BestSellersEditor({
  data,
  onChange,
}: {
  data: HomepageBestSellersData;
  onChange: (d: HomepageBestSellersData) => void;
}) {
  return (
    <div className="space-y-4">
      <TextRow
        label={t.homepage.fields.eyebrow}
        value={data.eyebrow}
        onChange={(v) => onChange({ ...data, eyebrow: v })}
        hint={t.homepage.fields.eyebrowHint}
      />
      <TextRow label={t.homepage.fields.heading} value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} />
      <AreaRow label={t.homepage.fields.body} value={data.body} onChange={(v) => onChange({ ...data, body: v })} rows={2} />
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {t.homepage.bestSellers.headingsNote} {t.homepage.bestSellers.sourceCatalogHint}
      </p>
    </div>
  );
}

function RecoveryPhilosophyEditor({
  data,
  onChange,
  media,
}: {
  data: HomepageRecoveryPhilosophyData;
  onChange: (d: HomepageRecoveryPhilosophyData) => void;
  media: HomepageMediaCtx;
}) {
  return (
    <div className="space-y-4">
      <TextRow
        label={t.homepage.fields.eyebrow}
        value={data.eyebrow}
        onChange={(v) => onChange({ ...data, eyebrow: v })}
        hint={t.homepage.fields.eyebrowHint}
      />
      <TextRow
        label={t.homepage.fields.heading}
        value={data.heading}
        onChange={(v) => onChange({ ...data, heading: v })}
        hint={t.homepage.fields.headingMultilineHint}
      />
      <AreaRow label={t.homepage.fields.body} value={data.body} onChange={(v) => onChange({ ...data, body: v })} rows={2} />
      <CtaRow label={t.homepage.fields.cta} value={data.cta} onChange={(v) => onChange({ ...data, cta: v })} />
      <HomepageMediaField
        label={t.homepage.fields.background}
        slot={data.background}
        onChange={(m) => onChange({ ...data, background: m })}
        assets={media.assets}
        onUploaded={media.onUploaded}
      />
    </div>
  );
}

function RecoverEverywhereEditor({
  data,
  onChange,
  media,
}: {
  data: HomepageRecoverEverywhereData;
  onChange: (d: HomepageRecoverEverywhereData) => void;
  media: HomepageMediaCtx;
}) {
  return (
    <div className="space-y-4">
      <TextRow
        label={t.homepage.fields.heading}
        value={data.heading}
        onChange={(v) => onChange({ ...data, heading: v })}
        hint={t.homepage.fields.headingMultilineHint}
      />
      <AreaRow label={t.homepage.fields.subtitle} value={data.subtitle} onChange={(v) => onChange({ ...data, subtitle: v })} rows={2} />
      <div className="grid gap-2 sm:grid-cols-2">
        <TextRow label={t.homepage.fields.ctaLabel} value={data.ctaLabel} onChange={(v) => onChange({ ...data, ctaLabel: v })} />
        <TextRow
          label={t.homepage.fields.ctaHref}
          value={data.ctaHref}
          onChange={(v) => onChange({ ...data, ctaHref: v })}
          hint={t.homepage.fields.ctaHrefHint}
        />
      </div>
      <LockedList label={t.homepage.fields.zone(data.zones.length)}>
        {data.zones.map((zone, i) => (
          <ItemCard key={i} title={t.homepage.fields.zone(i + 1)}>
            <TextRow
              label={t.homepage.fields.zoneTitle}
              value={zone.title}
              onChange={(v) => onChange({ ...data, zones: updateAt(data.zones, i, { title: v }) })}
            />
            <AreaRow
              label={t.homepage.fields.zoneDescription}
              value={zone.description}
              onChange={(v) => onChange({ ...data, zones: updateAt(data.zones, i, { description: v }) })}
              rows={2}
            />
            <HomepageMediaField
              slot={zone.media}
              onChange={(m) => onChange({ ...data, zones: updateAt(data.zones, i, { media: m }) })}
              assets={media.assets}
              onUploaded={media.onUploaded}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <TextRow
                label={t.homepage.fields.objectPosition}
                value={zone.objectPosition}
                onChange={(v) => onChange({ ...data, zones: updateAt(data.zones, i, { objectPosition: v }) })}
                hint={t.homepage.fields.cssTokenHint}
              />
              <TextRow
                label={t.homepage.fields.span}
                value={zone.span}
                onChange={(v) => onChange({ ...data, zones: updateAt(data.zones, i, { span: v }) })}
                hint={t.homepage.fields.cssTokenHint}
              />
            </div>
          </ItemCard>
        ))}
      </LockedList>
    </div>
  );
}

const WHY_ICONS: HomepageWhyVolrepIcon[] = ["shield", "wave", "soundwave", "check"];

function WhyVolrepEditor({
  data,
  onChange,
}: {
  data: HomepageWhyVolrepData;
  onChange: (d: HomepageWhyVolrepData) => void;
}) {
  return (
    <div className="space-y-4">
      <TextRow
        label={t.homepage.fields.eyebrow}
        value={data.eyebrow}
        onChange={(v) => onChange({ ...data, eyebrow: v })}
        hint={t.homepage.fields.eyebrowHint}
      />
      <TextRow
        label={t.homepage.fields.heading}
        value={data.heading}
        onChange={(v) => onChange({ ...data, heading: v })}
        hint={t.homepage.fields.headingMultilineHint}
      />
      <AreaRow label={t.homepage.fields.subtitle} value={data.subtitle} onChange={(v) => onChange({ ...data, subtitle: v })} rows={2} />

      <LockedList label={t.homepage.fields.feature(data.features.length)}>
        {data.features.map((f, i) => (
          <ItemCard key={i} title={t.homepage.fields.feature(i + 1)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextRow
                label={t.homepage.fields.featureNumber}
                value={f.number}
                onChange={(v) => onChange({ ...data, features: updateAt(data.features, i, { number: v }) })}
              />
              <Field label={t.homepage.fields.featureIcon}>
                <Select
                  value={f.icon}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      features: updateAt(data.features, i, { icon: e.target.value as HomepageWhyVolrepIcon }),
                    })
                  }
                >
                  {WHY_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {t.homepage.fields.whyIcons[ic]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <TextRow
              label={t.homepage.fields.featureTitle}
              value={f.title}
              onChange={(v) => onChange({ ...data, features: updateAt(data.features, i, { title: v }) })}
            />
            <AreaRow
              label={t.homepage.fields.featureDescription}
              value={f.description}
              onChange={(v) => onChange({ ...data, features: updateAt(data.features, i, { description: v }) })}
              rows={2}
            />
          </ItemCard>
        ))}
      </LockedList>

      <LockedList label={t.homepage.fields.stat(data.stats.length)}>
        {data.stats.map((s, i) => (
          <ItemCard key={i} title={t.homepage.fields.stat(i + 1)}>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={t.homepage.fields.statValue}>
                <TextInput
                  type="number"
                  value={String(s.value)}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      stats: updateAt(data.stats, i, { value: Math.max(0, Number.parseInt(e.target.value, 10) || 0) }),
                    })
                  }
                />
              </Field>
              <TextRow
                label={t.homepage.fields.statSuffix}
                value={s.suffix}
                onChange={(v) => onChange({ ...data, stats: updateAt(data.stats, i, { suffix: v }) })}
              />
              <TextRow
                label={t.homepage.fields.statLabel}
                value={s.label}
                onChange={(v) => onChange({ ...data, stats: updateAt(data.stats, i, { label: v }) })}
              />
            </div>
          </ItemCard>
        ))}
      </LockedList>
    </div>
  );
}

function TestimonialsEditor({
  data,
  onChange,
}: {
  data: HomepageTestimonialsData;
  onChange: (d: HomepageTestimonialsData) => void;
}) {
  return (
    <div className="space-y-4">
      <TextRow
        label={t.homepage.fields.eyebrow}
        value={data.eyebrow}
        onChange={(v) => onChange({ ...data, eyebrow: v })}
        hint={t.homepage.fields.eyebrowHint}
      />
      <TextRow
        label={t.homepage.fields.heading}
        value={data.heading}
        onChange={(v) => onChange({ ...data, heading: v })}
        hint={t.homepage.fields.headingMultilineHint}
      />
      <AreaRow label={t.homepage.fields.body} value={data.body} onChange={(v) => onChange({ ...data, body: v })} rows={2} />

      <div className="rounded-md border border-slate-200 p-2.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.homepage.fields.ratingLabel}</p>
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <TextRow
              label={t.homepage.fields.ratingStars}
              value={data.rating.stars}
              onChange={(v) => onChange({ ...data, rating: { ...data.rating, stars: v } })}
            />
            <TextRow
              label={t.homepage.fields.ratingLabel}
              value={data.rating.label}
              onChange={(v) => onChange({ ...data, rating: { ...data.rating, label: v } })}
            />
          </div>
          <TextRow
            label={t.homepage.fields.ratingDescription}
            value={data.rating.description}
            onChange={(v) => onChange({ ...data, rating: { ...data.rating, description: v } })}
          />
        </div>
      </div>

      <TextRow
        label={t.homepage.fields.verifiedLabel}
        value={data.verifiedLabel}
        onChange={(v) => onChange({ ...data, verifiedLabel: v })}
      />

      <LockedList label={t.homepage.fields.testimonial(data.cards.length)}>
        {data.cards.map((c, i) => (
          <ItemCard key={i} title={t.homepage.fields.testimonial(i + 1)}>
            <TextRow
              label={t.homepage.fields.testimonialName}
              value={c.name}
              onChange={(v) => onChange({ ...data, cards: updateAt(data.cards, i, { name: v }) })}
            />
            <AreaRow
              label={t.homepage.fields.testimonialQuote}
              value={c.quote}
              onChange={(v) => onChange({ ...data, cards: updateAt(data.cards, i, { quote: v }) })}
              rows={3}
            />
          </ItemCard>
        ))}
      </LockedList>

      <div className="rounded-md border border-slate-200 p-2.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.homepage.fields.trustlineLabel}</p>
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <TextRow
              label={t.homepage.fields.trustlineRating}
              value={data.trustline.rating}
              onChange={(v) => onChange({ ...data, trustline: { ...data.trustline, rating: v } })}
            />
            <TextRow
              label={t.homepage.fields.trustlineLabel}
              value={data.trustline.label}
              onChange={(v) => onChange({ ...data, trustline: { ...data.trustline, label: v } })}
            />
          </div>
          <TextRow
            label={t.homepage.fields.trustlineAudiences}
            value={data.trustline.audiences.join(", ")}
            onChange={(v) =>
              onChange({
                ...data,
                trustline: {
                  ...data.trustline,
                  audiences: v.split(",").map((x) => x.trim()).filter(Boolean),
                },
              })
            }
          />
        </div>
      </div>

      <LockedList label={t.homepage.fields.trustItem(data.trustItems.length)}>
        {data.trustItems.map((it, i) => (
          <ItemCard key={i} title={t.homepage.fields.trustItem(i + 1)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextRow
                label={t.homepage.fields.trustItemValue}
                value={it.value}
                onChange={(v) => onChange({ ...data, trustItems: updateAt(data.trustItems, i, { value: v }) })}
              />
              <TextRow
                label={t.homepage.fields.trustItemLabel}
                value={it.label}
                onChange={(v) => onChange({ ...data, trustItems: updateAt(data.trustItems, i, { label: v }) })}
              />
            </div>
          </ItemCard>
        ))}
      </LockedList>
    </div>
  );
}

function FaqEditor({ data, onChange }: { data: HomepageFaqData; onChange: (d: HomepageFaqData) => void }) {
  return (
    <div className="space-y-4">
      <TextRow
        label={t.homepage.fields.eyebrow}
        value={data.eyebrow}
        onChange={(v) => onChange({ ...data, eyebrow: v })}
        hint={t.homepage.fields.eyebrowHint}
      />
      <TextRow label={t.homepage.fields.heading} value={data.heading} onChange={(v) => onChange({ ...data, heading: v })} />
      <AreaRow label={t.homepage.fields.subtitle} value={data.subtitle} onChange={(v) => onChange({ ...data, subtitle: v })} rows={2} />
      <Field label={t.homepage.fields.defaultOpen}>
        <TextInput
          type="number"
          value={String(data.defaultOpen)}
          onChange={(e) => onChange({ ...data, defaultOpen: Number.parseInt(e.target.value, 10) || -1 })}
        />
      </Field>
      <LockedList label={t.homepage.fields.faqItem(data.items.length)}>
        {data.items.map((it, i) => (
          <ItemCard key={i} title={t.homepage.fields.faqItem(i + 1)}>
            <TextRow
              label={t.homepage.fields.question}
              value={it.question}
              onChange={(v) => onChange({ ...data, items: updateAt(data.items, i, { question: v }) })}
            />
            <AreaRow
              label={t.homepage.fields.answer}
              value={it.answer}
              onChange={(v) => onChange({ ...data, items: updateAt(data.items, i, { answer: v }) })}
              rows={3}
            />
          </ItemCard>
        ))}
      </LockedList>
    </div>
  );
}

const BADGE_ICONS: HomepageFinalCtaIcon[] = ["truck", "shield", "return"];

function FinalCtaEditor({
  data,
  onChange,
}: {
  data: HomepageFinalCtaData;
  onChange: (d: HomepageFinalCtaData) => void;
}) {
  return (
    <div className="space-y-4">
      <TextRow
        label={t.homepage.fields.eyebrow}
        value={data.eyebrow}
        onChange={(v) => onChange({ ...data, eyebrow: v })}
        hint={t.homepage.fields.eyebrowHint}
      />
      <TextRow
        label={t.homepage.fields.heading}
        value={data.heading}
        onChange={(v) => onChange({ ...data, heading: v })}
        hint={t.homepage.fields.headingMultilineHint}
      />
      <AreaRow label={t.homepage.fields.body} value={data.body} onChange={(v) => onChange({ ...data, body: v })} rows={2} />
      <CtaRow label={t.homepage.fields.primaryCta} value={data.primaryCta} onChange={(v) => onChange({ ...data, primaryCta: v })} />
      <CtaRow label={t.homepage.fields.secondaryCta} value={data.secondaryCta} onChange={(v) => onChange({ ...data, secondaryCta: v })} />
      <div className="grid gap-2 sm:grid-cols-2">
        <TextRow
          label={t.homepage.fields.ratingStars}
          value={data.rating.stars}
          onChange={(v) => onChange({ ...data, rating: { ...data.rating, stars: v } })}
        />
        <TextRow
          label={t.homepage.fields.ratingLabel}
          value={data.rating.label}
          onChange={(v) => onChange({ ...data, rating: { ...data.rating, label: v } })}
        />
      </div>
      <LockedList label={t.homepage.fields.badgeItem(data.badges.length)}>
        {data.badges.map((b, i) => (
          <ItemCard key={i} title={t.homepage.fields.badgeItem(i + 1)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t.homepage.fields.badgeIcon}>
                <Select
                  value={b.icon}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      badges: updateAt(data.badges, i, { icon: e.target.value as HomepageFinalCtaIcon }),
                    })
                  }
                >
                  {BADGE_ICONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {t.homepage.fields.badgeIcons[ic]}
                    </option>
                  ))}
                </Select>
              </Field>
              <TextRow
                label={t.homepage.fields.badgeLabel}
                value={b.label}
                onChange={(v) => onChange({ ...data, badges: updateAt(data.badges, i, { label: v }) })}
              />
            </div>
          </ItemCard>
        ))}
      </LockedList>
    </div>
  );
}

function NewsletterEditor({
  data,
  onChange,
}: {
  data: HomepageNewsletterData;
  onChange: (d: HomepageNewsletterData) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {t.homepage.fields.newsletterNote}
      </p>
      <TextRow
        label={t.homepage.fields.eyebrow}
        value={data.eyebrow}
        onChange={(v) => onChange({ ...data, eyebrow: v })}
        hint={t.homepage.fields.eyebrowHint}
      />
      <TextRow
        label={t.homepage.fields.heading}
        value={data.heading}
        onChange={(v) => onChange({ ...data, heading: v })}
        hint={t.homepage.fields.headingMultilineHint}
      />
      <AreaRow label={t.homepage.fields.body} value={data.body} onChange={(v) => onChange({ ...data, body: v })} rows={2} />
      <div className="grid gap-2 sm:grid-cols-2">
        <TextRow label={t.homepage.fields.emailLabel} value={data.emailLabel} onChange={(v) => onChange({ ...data, emailLabel: v })} />
        <TextRow
          label={t.homepage.fields.emailPlaceholder}
          value={data.emailPlaceholder}
          onChange={(v) => onChange({ ...data, emailPlaceholder: v })}
        />
      </div>
      <TextRow label={t.homepage.fields.submitLabel} value={data.submitLabel} onChange={(v) => onChange({ ...data, submitLabel: v })} />
      <AreaRow
        label={t.homepage.fields.successMessage}
        value={data.successMessage}
        onChange={(v) => onChange({ ...data, successMessage: v })}
        rows={2}
      />
    </div>
  );
}

// ---- dispatcher ---------------------------------------------------

export function HomepageSectionEditor({
  section,
  onChange,
  media,
}: {
  section: HomepageSection;
  onChange: (section: HomepageSection) => void;
  media: HomepageMediaCtx;
}) {
  switch (section.type) {
    case "hero":
      return <HeroEditor data={section.data} media={media} onChange={(d) => onChange({ ...section, data: d })} />;
    case "bestSellers":
      return <BestSellersEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "recoveryPhilosophy":
      return (
        <RecoveryPhilosophyEditor data={section.data} media={media} onChange={(d) => onChange({ ...section, data: d })} />
      );
    case "recoverEverywhere":
      return (
        <RecoverEverywhereEditor data={section.data} media={media} onChange={(d) => onChange({ ...section, data: d })} />
      );
    case "whyVolrep":
      return <WhyVolrepEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "testimonials":
      return <TestimonialsEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "faq":
      return <FaqEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "finalCta":
      return <FinalCtaEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    case "newsletter":
      return <NewsletterEditor data={section.data} onChange={(d) => onChange({ ...section, data: d })} />;
    default:
      return null;
  }
}
