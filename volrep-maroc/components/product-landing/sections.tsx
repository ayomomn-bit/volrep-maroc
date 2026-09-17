import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import type {
  AccordionData,
  BenefitsData,
  BigResultData,
  CompState,
  ComparisonData,
  EndorsementData,
  HeroData,
  OrderData,
  ProblemSolutionData,
  ProfessionalsData,
  ReviewsData,
  SayGoodbyeData,
  StickyCtaData,
  TrustData,
  UgcData,
} from "@/lib/product-page/types";
import { Reveal } from "@/components/product-landing/Reveal";
import { LpAccordion } from "@/components/product-landing/LpAccordion";
import { LpGallery } from "@/components/product-landing/LpGallery";
import { LpVideoSlider } from "@/components/product-landing/LpVideoSlider";
import { LpStickyCta } from "@/components/product-landing/LpStickyCta";
import { LpOrderForm } from "@/components/product-landing/LpOrderForm";
import { LpBuyBox } from "@/components/product-landing/LpBuyBox";
import { MediaSlot } from "@/components/product-landing/MediaSlot";
import { renderRich } from "@/components/product-landing/rich-text";
import { STARS, type SectionContext } from "@/components/product-landing/context";

// One renderer per section type in the "Page produit" document. Each block
// is a verbatim copy of what components/product-landing/ProductLanding.tsx
// hard-coded on 2026-09-01, with the literal strings/arrays swapped for the
// section's `data` and the emphasis notation run through renderRich(). DOM,
// class names and dynamic bindings are unchanged — see
// docs/product-page-inventory.md.

// Renders a template containing "{price}" with the price as its own text
// node — preserving the exact node structure (and React's SSR "<!-- -->"
// separators) the previous JSX produced from `text {price}`.
function withPrice(template: string, price: string): ReactNode {
  const [before, after = ""] = template.split("{price}");
  return (
    <>
      {before}
      {price}
      {after}
    </>
  );
}

function CompCell({ state }: { state: CompState }) {
  if (state === "yes") return <div className="comp-new-cell-center comp-yes">✓</div>;
  if (state === "partial") return <div className="comp-new-cell-center comp-partial">⚠️</div>;
  return <div className="comp-new-cell-center comp-no">✕</div>;
}

// ---- hero (+ nested before/after) --------------------------------------

export function HeroSection({ data, ctx }: { data: HeroData; ctx: SectionContext }) {
  const { product, reviewSummary, price, oldPrice, discountPercent } = ctx;
  const hasReviews = reviewSummary.reviewCount > 0;

  return (
    <section className="lp-hero">
      <div className="container">
        <div className="lp-hero-grid">
          <div className="lp-hero-media">
            <LpGallery images={product.images} title={product.title} />
          </div>

          <div className="lp-hero-info">
            <div className="rating-row">
              <span className="rating-stars" aria-hidden="true">
                {STARS}
              </span>
              <span className="rating-count">
                {hasReviews
                  ? `${reviewSummary.reviewCount} ${data.reviewsCountSuffix}`
                  : data.reviewsFallbackLabel}
              </span>
            </div>

            <h1 className="product-title">{product.title}</h1>
            <p className="product-subtitle">{data.subtitle}</p>

            <div className="price-block">
              <span className="price-new">{price}</span>
              {oldPrice && <span className="price-old">{oldPrice}</span>}
              {discountPercent ? <span className="price-save">-{discountPercent}%</span> : null}
            </div>

            <div className="features-row">
              {data.features.map((feature) => (
                <div key={feature.label} className="feature-item">
                  <div className="feature-icon" aria-hidden="true">
                    {feature.icon}
                  </div>
                  <span>{feature.label}</span>
                </div>
              ))}
            </div>

            {/* Purchase CTA layer (Phase A): "Commander maintenant" (primary,
                keeps the Studio-owned ctaLabel + price) + "Ajouter au panier"
                (secondary, existing cart + drawer). Replaces the single
                scroll-only <a class="main-cta"> anchor. */}
            <LpBuyBox product={product} orderNowLabel={withPrice(data.ctaLabel, price)} />
            <p className="cta-subtext">{data.ctaSubtext}</p>
            <p className="cta-subtext-small">{withPrice(data.ctaSubtextSmall, price)}</p>

            <div className="guarantees">
              {data.guarantees.map((guarantee) => (
                <div key={guarantee.text} className="guarantee-item">
                  <span className="guarantee-icon" aria-hidden="true">
                    {guarantee.icon}
                  </span>
                  <span>
                    <strong>{guarantee.text}</strong>
                  </span>
                </div>
              ))}
            </div>

            <div className="guarantee-box">
              <span className="guarantee-box-icon" aria-hidden="true">
                {data.guaranteeBox.icon}
              </span>
              <div>
                <strong>{data.guaranteeBox.title}</strong>
                <p>{renderRich(data.guaranteeBox.body, "hero-gb")}</p>
              </div>
            </div>

            <div className="description-text">
              {data.description.map((paragraph, index) => (
                <p key={index}>{renderRich(paragraph, `hero-desc-${index}`)}</p>
              ))}
            </div>
          </div>
        </div>

        {data.beforeAfter.enabled && <HeroBeforeAfter data={data.beforeAfter} />}
      </div>
    </section>
  );
}

function HeroBeforeAfter({ data }: { data: HeroData["beforeAfter"] }) {
  return (
    <div className="lp-hero-results">
      <h2 className="hero-title">{data.title}</h2>
      <p className="hero-subtitle">{data.subtitle}</p>

      <div className="results-grid">
        {data.zones.map((zone) => (
          <div key={zone.name} className="result-card">
            <div className="result-image">
              <MediaSlot slot={zone.media} fallbackLabel={`${zone.name} · avant / après`} />
              <div className="result-labels">
                <span className="label-before">{data.beforeLabel}</span>
                <span className="label-after">{data.afterLabel}</span>
              </div>
            </div>
            <div className="result-info">
              <span className="result-name">{zone.name}</span>
              <span className="result-stars" aria-hidden="true">
                {STARS}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="results-disclaimer">{renderRich(data.disclaimer, "hero-ba-disc")}</p>
    </div>
  );
}

// ---- UGC video slider -------------------------------------------------

// A UGC card shows real motion content only when its slot resolves to a
// playable MP4 or an animated GIF: an explicit mediaType, or (back-compat
// with slots authored before that field existed) a URL that ends in a
// matching extension. Anything else keeps the "Vidéo client · à venir"
// placeholder — the card never tries to render a still image.
type UgcMedia = UgcData["videos"][number]["media"];

function ugcVideoSrc(media: UgcMedia): string | undefined {
  if (media.kind === "placeholder" || !media.url) return undefined;
  if (media.mediaType === "video") return media.url;
  if (media.mediaType === "gif") return undefined;
  if (/\.(mp4|m4v|webm|mov)(\?|#|$)/i.test(media.url)) return media.url;
  return undefined;
}

function ugcGifSrc(media: UgcMedia): string | undefined {
  if (media.kind === "placeholder" || !media.url) return undefined;
  if (media.mediaType === "gif") return media.url;
  if (media.mediaType === "video") return undefined;
  if (/\.gif(\?|#|$)/i.test(media.url)) return media.url;
  return undefined;
}

export function UgcSection({ data }: { data: UgcData }) {
  return (
    <section className="customer-say-section">
      <div className="container">
        <h2 className="section-title">{renderRich(data.heading, "ugc-h")}</h2>
        <LpVideoSlider
          videos={data.videos.map((video, index) => ({
            id: String(index),
            src: ugcVideoSrc(video.media),
            gifSrc: ugcGifSrc(video.media),
            poster: video.media.poster || undefined,
            emptyLabel: video.media.placeholderLabel || undefined,
          }))}
        />
      </div>
    </section>
  );
}

// ---- accordion (mini "Description" + full FAQ) -----------------------

export function AccordionSection({
  data,
  sectionClass,
  withHeading,
}: {
  data: AccordionData;
  sectionClass: string;
  withHeading: boolean;
}) {
  return (
    <section className={sectionClass}>
      <div className="container">
        {withHeading && (
          <h2 className="section-title-center">{renderRich(data.heading, "acc-h")}</h2>
        )}
        <LpAccordion items={data.items} defaultOpen={data.defaultOpen} />
      </div>
    </section>
  );
}

// ---- professionals strip -------------------------------------------

export function ProfessionalsSection({ data }: { data: ProfessionalsData }) {
  return (
    <section className="as-seen-section">
      <div className="container">
        <p className="as-seen-title">{data.title}</p>
        <div className="press-logos">
          {data.labels.map((label) => (
            <span key={label} className="press-logo">
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- big result ---------------------------------------------------

export function BigResultSection({ data }: { data: BigResultData }) {
  return (
    <section className="real-results-section">
      <div className="container">
        <Reveal as="h2" className="section-title-center">
          {renderRich(data.heading, "br-h")}
        </Reveal>
        <div className="real-result-big">
          <div className="big-result-img">
            <MediaSlot slot={data.media} />
          </div>
        </div>
        <p className="results-disclaimer">{renderRich(data.disclaimer, "br-disc")}</p>
      </div>
    </section>
  );
}

// ---- benefit blocks --------------------------------------------

export function BenefitsSection({ data }: { data: BenefitsData }) {
  return (
    <section className="smooth-skin-section">
      <div className="container">
        <div className="smooth-split">
          <div className="smooth-img">
            <MediaSlot slot={data.media} />
          </div>
          <div className="smooth-split-copy">
            <h2 className="section-title-center">{renderRich(data.heading, "ben-h")}</h2>
            <p className="section-subtitle">{renderRich(data.subtitle, "ben-sub")}</p>
          </div>
        </div>

        <div className="benefit-grid">
          {data.blocks.map((block) => (
            <Reveal key={block.title} className="benefit-block">
              <h3 className="benefit-title">{block.title}</h3>
              <p className="benefit-desc">{renderRich(block.desc, `ben-${block.title}`)}</p>
              <div className="benefit-tags">
                {block.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- "Dites adieu à" -------------------------------------------

export function SayGoodbyeSection({ data }: { data: SayGoodbyeData }) {
  return (
    <section className="no-cuts-section">
      <div className="container">
        <div className="no-cuts-grid">
          <div className="no-cuts-img">
            <MediaSlot slot={data.media} />
          </div>
          <div className="no-cuts-content">
            <p className="no-cuts-title">{data.title}</p>
            <h2 className="no-cuts-list">
              {data.items.map((item, index) => (
                <Fragment key={item}>
                  {index > 0 && <br />}
                  <span className="strike-item">{item}</span>
                </Fragment>
              ))}
            </h2>
            <p className="no-cuts-desc">{renderRich(data.desc, "sg-desc")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- kiné endorsement ----------------------------------------

export function EndorsementSection({ data }: { data: EndorsementData }) {
  return (
    <section className="derm-section">
      <div className="container">
        <div className="derm-card">
          <div className="derm-avatar" aria-hidden="true">
            {data.avatar}
          </div>
          <p className="derm-quote">{renderRich(data.quote, "end-q")}</p>
          <p className="derm-name">{renderRich(data.name, "end-n")}</p>
        </div>
        <h2 className="derm-title">{renderRich(data.title, "end-t")}</h2>
        <p className="derm-desc">{renderRich(data.desc, "end-d")}</p>
        <div className="pro-tip">
          <span className="pro-tip-badge">{data.proTip.badge}</span>
          <p>{renderRich(data.proTip.text, "end-pt")}</p>
        </div>
      </div>
    </section>
  );
}

// ---- comparison ----------------------------------------------

export function ComparisonSection({ data, ctx }: { data: ComparisonData; ctx: SectionContext }) {
  const { product } = ctx;
  // A filled Product Studio media slot wins; otherwise fall back to the
  // product's featured/first gallery image exactly as before.
  const custom = data.media && data.media.kind !== "placeholder" && data.media.url ? data.media : null;
  const fallbackImage = product.featuredImage ?? product.images[0] ?? null;

  return (
    <section className="comparison-section">
      <div className="container">
        <h2 className="section-title-center">{renderRich(data.heading, "cmp-h")}</h2>
        <p className="section-subtitle">{data.subtitle}</p>

        <div className="comparison-new">
          <div className="comp-new-header">
            <div className="comp-new-cell-empty" />
            <div className="comp-new-cell comp-new-product">
              <div className="comp-product-img">
                {custom ? (
                  // A section media slot can point at an arbitrary host, so
                  // render it with a plain <img> (same rationale as MediaSlot).
                  // `.comp-product-img img` already sizes it to the box.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={custom.url} alt={custom.alt || product.title} loading="lazy" decoding="async" />
                ) : (
                  fallbackImage && (
                    <Image
                      src={fallbackImage.url}
                      alt={product.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  )
                )}
              </div>
              <p className="comp-product-name">{data.productName}</p>
            </div>
            {data.competitors.map((name) => (
              <div key={name} className="comp-new-cell">
                <p className="comp-alt-name">{name}</p>
              </div>
            ))}
          </div>

          {data.rows.map((row) => (
            <div key={row.label} className="comp-new-row">
              <div className="comp-new-label">{row.label}</div>
              <CompCell state={row.product} />
              {row.competitors.map((state, index) => (
                <CompCell key={index} state={state} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- reviews (display controls only — real review data) ----------

export function ReviewsSection({ data, ctx }: { data: ReviewsData; ctx: SectionContext }) {
  const { reviewSummary } = ctx;
  const reviews = reviewSummary.reviews.slice(0, data.maxCount);
  const hasReviews = reviewSummary.reviewCount > 0;

  return (
    <section className="reviews-section">
      <div className="container">
        <h2 className="section-title-center">{renderRich(data.heading, "rev-h")}</h2>

        {hasReviews ? (
          <div className="reviews-grid">
            {reviews.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <span className="review-stars" aria-hidden="true">
                    {"★"
                      .repeat(Math.max(0, Math.min(5, Math.round(review.rating || 0))))
                      .padEnd(5, "☆")}
                  </span>
                  {review.verifiedPurchase && <span className="verified-badge">✓ Achat vérifié</span>}
                </div>
                <p className="review-name">
                  <strong>{review.author}</strong>
                </p>
                <p className="review-text">{review.body}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="reviews-empty">{renderRich(data.emptyText, "rev-empty")}</p>
        )}
      </div>
    </section>
  );
}

// ---- trust grid ---------------------------------------------

export function TrustSection({ data }: { data: TrustData }) {
  return (
    <section className="trust-section">
      <div className="container">
        <div className="trust-grid">
          {data.items.map((item) => (
            <div key={item.title} className="trust-item">
              <div className="trust-icon" aria-hidden="true">
                {item.icon}
              </div>
              <p className="trust-title">{item.title}</p>
              <p className="trust-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---- problem -> solution -----------------------------------

export function ProblemSolutionSection({ data }: { data: ProblemSolutionData }) {
  return (
    <section className="prob-sol-section">
      <div className="container">
        <div className="prob-sol-warning">
          <span className="warning-icon" aria-hidden="true">
            {data.warningIcon}
          </span>
          <p>{data.warningText}</p>
        </div>

        <h2 className="section-title-center prob-sol-title">{renderRich(data.title, "ps-t")}</h2>

        <div className="problems-list">
          {data.problems.map((problem) => (
            <div key={problem.title} className="problem-item">
              <div className="problem-icon" aria-hidden="true">
                {problem.icon}
              </div>
              <div className="problem-text">
                <strong>{problem.title}</strong>
                <p>{renderRich(problem.text, `ps-${problem.title}`)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="solution-arrow">
          <div className="solution-arrow-line" />
          <div className="solution-arrow-label">{data.solutionLabel}</div>
          <div className="solution-arrow-line" />
        </div>

        <div className="solution-box">
          <div className="solution-icon" aria-hidden="true">
            {data.solution.icon}
          </div>
          <div className="solution-text">
            <strong>{data.solution.title}</strong>
            <p>{renderRich(data.solution.text, "ps-sol")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- inline COD order form (form logic unchanged) -----------

export function OrderSection({ data, ctx }: { data: OrderData; ctx: SectionContext }) {
  return (
    <section className="order-section" id="order">
      <div className="container">
        <h2 className="order-title">{renderRich(data.title, "ord-t")}</h2>
        <p className="order-subtitle">{data.subtitle}</p>
        <LpOrderForm product={ctx.product} />
      </div>
    </section>
  );
}

// ---- sticky mobile CTA ------------------------------------

export function StickyCtaSection({ data, ctx }: { data: StickyCtaData; ctx: SectionContext }) {
  return (
    <LpStickyCta
      price={ctx.price}
      oldPrice={ctx.oldPrice}
      handle={ctx.product.handle}
      label={data.label}
    />
  );
}
