import Image from "next/image";
import Link from "next/link";
import type { ShopifyProductSummary } from "@/lib/backend/products";
import { t } from "@/lib/i18n";

// Shopify's Product Type field is the correct, data-driven source for the
// category line and isn't set yet for any product in the catalog. This is a
// temporary display fallback keyed by handle, not invented copy — it mirrors
// the descriptor already used elsewhere on the site (Hero, metadata). Once
// Product Type is set in Shopify admin, productType wins automatically and
// this entry becomes a no-op.
const CATEGORY_FALLBACKS: Record<string, string> = {
  "volrep-prm": "Masseur de récupération percussive",
};

function formatPrice(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (Number.isNaN(value)) return null;

  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

const LINK_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function ProductCard({ product }: { product: ShopifyProductSummary }) {
  const price = formatPrice(
    product.priceRange.minVariantPrice.amount,
    product.priceRange.minVariantPrice.currencyCode,
  );
  const category = product.productType || CATEGORY_FALLBACKS[product.handle];
  const href = `/products/${product.handle}`;

  // Driven by a real Shopify tag, not assumed for every product. Add a
  // "best-seller" tag to any product in Shopify admin and this appears
  // automatically — nothing here is hardcoded to VOLREP PRM™ specifically.
  const isBestSeller = product.tags.some((tag) => tag.toLowerCase() === "best-seller");

  return (
    // Not a single <Link> this time: the quick-action below needs its own
    // link, and anchors can't nest. Image zone and text zone are two
    // sibling links to the same product instead, sharing one hover group
    // so the whole card still reacts together.
    <div className="group relative">
      {/* Media zone: a single square box matching the source photo's own
          aspect exactly (it was previously nested inside a taller 4:5
          frame, which added dead vertical space beyond what the photo
          itself needed — that outer shape, not the zoom level, was the
          main source of the "floating in empty space" feeling). Fully
          transparent — no colored box, just the page's own background
          showing through, including around the product itself now that
          the asset is a real transparent cutout. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-[16px] border border-border bg-white shadow-[0_2px_10px_rgba(55,143,253,0.06)] transition-shadow duration-300 ease-out group-hover:shadow-[0_10px_30px_-8px_rgba(55,143,253,0.14)]">
        {product.featuredImage ? (
          <>
            <Link href={href} className={`absolute inset-0 block ${LINK_FOCUS}`}>
              {/* This asset is a true transparent cutout (verified: real
                  alpha channel, no baked-in backdrop), so the page's own
                  off-white shows directly around the product — genuine
                  breathing room, not an illusion. Its own bounding box
                  still reaches ~85% of the frame width at native scale, so
                  the zoom below is intentionally conservative: enough to
                  read as noticeably larger without risking clipping the
                  product on its widest (diagonal) axis. */}
              <Image
                src={product.featuredImage.url}
                alt={product.featuredImage.altText ?? product.title}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 85vw"
                className="scale-[1.08] object-contain transition-transform duration-300 ease-out group-hover:scale-[1.11]"
              />
            </Link>

            {/* Soft contact shadow beneath the product's actual visible
                base (the surrounding area is genuinely transparent now,
                so this reads as sitting under the product itself). */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[28%] bottom-[15%] h-2.5 rounded-full bg-ink/10 blur-md"
            />

            {isBestSeller ? (
              <span className="pointer-events-none absolute bottom-4 left-4 rounded bg-paper px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink shadow-sm">
                {t.productCard.bestSeller}
              </span>
            ) : null}

            <Link
              href={href}
              aria-label={t.productCard.shopAria(product.title)}
              className={`absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 bg-paper text-ink transition-all duration-300 ease-out group-hover:border-ink/30 hover:border-volt hover:text-volt lg:h-9 lg:w-9 ${LINK_FOCUS}`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                +
              </span>
            </Link>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-center">
            <span className="text-sm font-medium tracking-tight text-muted-foreground">{product.title}</span>
          </div>
        )}
      </div>

      <Link href={href} className={`mt-6 block rounded-sm ${LINK_FOCUS}`}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-base font-medium tracking-tight text-foreground">{product.title}</p>
          {price ? <p className="shrink-0 text-base font-medium text-foreground">{price}</p> : null}
        </div>

        {category ? (
          <p className="mt-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">{category}</p>
        ) : null}

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 transition-colors duration-300 group-hover:text-volt group-hover:underline">
          {t.productCard.shopNow}
          <span aria-hidden="true" className="transition-transform duration-300 ease-out group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </Link>
    </div>
  );
}
