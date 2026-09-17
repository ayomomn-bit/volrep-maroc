"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ShopifyMoney, ShopifyProduct } from "@/lib/backend/products";
import { formatMoney } from "@/lib/backend/money";
import { findVariantBySelectedOptions } from "@/lib/backend/variant";
import { submitInlineOrderAction, type InlineOrderInput } from "@/lib/backend/inline-order-actions";
import type { PlacedOrder } from "@/lib/backend/checkout-actions";

// Reference `.order-section` — the inline Cash-on-Delivery order form with
// pack-quantity cards. Wired to submitInlineOrderAction, which runs the SAME
// backend endpoints as the normal cart → /checkout flow (POST /api/cart/lines
// then POST /api/checkout/session); no API contract changes.
//
// Pack prices are strictly unitPrice × quantity — exactly what the backend
// charges — so the confirmation total always matches. The struck-through
// "old" price is compareAtPrice × quantity; "Économisez" is the real
// per-unit saving multiplied out. No fabricated bundle discounts.
//
// Layout: a single grid (`.order-grid`) that is one column on mobile
// (product card → offers → fields → summary → submit, matching the
// reference's mobile order) and a two-column form on desktop (offers +
// fields left, product card + summary + submit right).

const MOROCCAN_PHONE = /^(?:0|\+212|00212)[67]\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Pack = { quantity: number; label: string; note?: string; badge?: string };

const PACKS: Pack[] = [
  { quantity: 1, label: "1 VOLREP PRM™", badge: "★ RECOMMANDÉ" },
  { quantity: 2, label: "2 VOLREP PRM™", note: "✔ Idéal pour toute la maison" },
  { quantity: 3, label: "3 VOLREP PRM™", note: "✔ Le meilleur prix pour offrir" },
];

function multiply(money: ShopifyMoney, factor: number): ShopifyMoney {
  return { amount: String(Math.round(Number(money.amount) * factor)), currencyCode: money.currencyCode };
}

type FieldErrors = Partial<Record<"fullname" | "email" | "phone" | "city" | "address", string>>;

export function LpOrderForm({ product }: { product: ShopifyProduct }) {
  // Only options with more than one real value are worth showing (Shopify's
  // single "Default Title" option renders nothing).
  const pickableOption = product.options.find((option) => option.values.length > 1) ?? null;

  const [selectedValue, setSelectedValue] = useState(
    () => product.variants[0]?.selectedOptions.find((o) => o.name === pickableOption?.name)?.value ?? "",
  );

  const selectedVariant = useMemo(() => {
    if (!pickableOption) return product.variants[0] ?? null;
    return findVariantBySelectedOptions(product.variants, { [pickableOption.name]: selectedValue });
  }, [product.variants, pickableOption, selectedValue]);

  const variantId = selectedVariant?.id ?? product.variants[0]?.id ?? "";
  const unitPrice = selectedVariant?.price ?? product.price;
  const unitCompareAt = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const thumb = selectedVariant?.image ?? product.images[0] ?? product.featuredImage ?? null;

  const [quantity, setQuantity] = useState(1);
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);

  const packPricing = useMemo(() => {
    return PACKS.map((pack) => {
      const total = multiply(unitPrice, pack.quantity);
      const oldTotal = unitCompareAt ? multiply(unitCompareAt, pack.quantity) : null;
      const save =
        unitCompareAt && Number(unitCompareAt.amount) > Number(unitPrice.amount)
          ? multiply(
              {
                amount: String(Number(unitCompareAt.amount) - Number(unitPrice.amount)),
                currencyCode: unitPrice.currencyCode,
              },
              pack.quantity,
            )
          : null;
      return { ...pack, total, oldTotal, save };
    });
  }, [unitPrice, unitCompareAt]);

  const selected = packPricing.find((p) => p.quantity === quantity) ?? packPricing[0];
  const totalLabel = formatMoney(selected.total) ?? "";
  const oldLabel = selected.oldTotal ? formatMoney(selected.oldTotal) : null;

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (fullname.trim().length < 2) next.fullname = "Saisissez votre nom complet.";
    if (!EMAIL.test(email.trim())) next.email = "Saisissez une adresse e-mail valide.";
    if (!MOROCCAN_PHONE.test(phone.replace(/\s/g, ""))) next.phone = "Numéro de téléphone marocain invalide.";
    if (city.trim().length < 2) next.city = "Saisissez votre ville.";
    if (address.trim().length < 4) next.address = "Saisissez votre adresse.";
    return next;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;
    if (!variantId) {
      setFormError("Ce produit n’est pas disponible à la commande pour le moment.");
      return;
    }

    const payload: InlineOrderInput = {
      variantId,
      quantity,
      fullName: fullname.trim(),
      email: email.trim(),
      phone: phone.trim(),
      city: city.trim(),
      address: address.trim(),
    };

    setPending(true);
    try {
      const result = await submitInlineOrderAction(payload);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setPlacedOrder(result.order);
      requestAnimationFrame(() => {
        document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      setFormError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setPending(false);
    }
  }

  if (placedOrder) {
    const total = formatMoney(placedOrder.totalAmount) ?? formatMoney(placedOrder.subtotalAmount) ?? "";
    return (
      <div className="order-confirmation">
        <h3>Commande confirmée&nbsp;!</h3>
        <p>
          Merci {fullname.split(" ")[0] || ""}. Nous vous appelons très vite au {phone} pour confirmer votre
          commande&nbsp;<strong>{placedOrder.orderNumber}</strong>.
        </p>
        <span className="oc-badge">Paiement à la livraison</span>
        <p className="oc-total">Total à payer à la livraison : {total}</p>
        <Link href="/track-order" className="oc-track">
          Suivre ma commande →
        </Link>
      </div>
    );
  }

  const productCard = (
    <>
      <div className="order-product-img">
        {thumb && <Image src={thumb.url} alt={product.title} fill sizes="60px" className="object-cover" />}
      </div>
      <div className="order-product-info">
        <p className="order-product-name">
          {selected.label} — {product.title}
        </p>
        <div className="order-product-price">
          <span className="op-new">{totalLabel}</span>
          {oldLabel && <span className="op-old">{oldLabel}</span>}
        </div>
        <p className="order-product-meta">🚚 Livraison GRATUITE</p>
      </div>
    </>
  );

  return (
    <form className="order-form" onSubmit={handleSubmit} noValidate>
      {/* product card — shown at the top on mobile (reference order) */}
      <div className="og-product og-product--mobile">{productCard}</div>

      <div className="order-cols">
        <div className="order-col-main">
        {/* ---- offer selection ---- */}
        <div className="og-offers">
          <h3 className="section-title-center pack-title">
            Choisissez votre <em>offre</em>
          </h3>
          <p className="pack-subtitle">La majorité de nos clients choisissent le pack 1 unité</p>

          {pickableOption && (
            <div className="lp-variant">
              <span className="lp-variant-label">{pickableOption.name}</span>
              <div className="lp-variant-options">
                {pickableOption.values.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={value === selectedValue}
                    className={`lp-variant-option ${value === selectedValue ? "lp-variant-option--selected" : ""}`}
                    onClick={() => setSelectedValue(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pack-cards">
            {packPricing.map((pack) => {
              const isSelected = pack.quantity === quantity;
              return (
                <div
                  key={pack.quantity}
                  className={`option-card ${isSelected ? "option-card--selected" : ""}`}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => setQuantity(pack.quantity)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setQuantity(pack.quantity);
                    }
                  }}
                >
                  {pack.badge && <div className="option-badge">{pack.badge}</div>}
                  <div className="option-left">
                    <div className="option-radio">
                      <div className="option-radio-inner" />
                    </div>
                    <div className="option-text">
                      <span className="option-text-line">{pack.label}</span>
                      {pack.note && <span className="option-text-line option-text-line--small">{pack.note}</span>}
                      {pack.quantity > 1 && pack.save && (
                        <span className="option-text-line option-text-line--small">
                          Économisez {formatMoney(pack.save)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="option-pricing">
                    <span className="option-price">{formatMoney(pack.total)}</span>
                    {pack.oldTotal && <span className="option-old-price">{formatMoney(pack.oldTotal)}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="pack-social-proof">
            🔥 <strong>68%</strong> de nos clients choisissent le pack 1 unité
          </p>
          <div className="order-urgency">⏰ Offre spéciale aujourd’hui — Stock limité</div>
        </div>

        {/* ---- contact / delivery fields ---- */}
        <div className="og-fields">
          <div className="form-fields-row">
            <div className="form-group">
              <label htmlFor="lp-fullname">Nom complet *</label>
              <input
                id="lp-fullname"
                type="text"
                autoComplete="name"
                placeholder="Votre nom et prénom"
                value={fullname}
                onChange={(e) => setFullname(e.target.value.replace(/[^\p{L}\s'-]/gu, ""))}
                disabled={pending}
                required
              />
              {errors.fullname && <p className="form-error">{errors.fullname}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="lp-phone">Téléphone *</label>
              <input
                id="lp-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="06 XX XX XX XX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s]/g, ""))}
                disabled={pending}
                required
              />
              {errors.phone && <p className="form-error">{errors.phone}</p>}
            </div>
          </div>

          <div className="form-fields-row">
            <div className="form-group">
              <label htmlFor="lp-email">E-mail *</label>
              <input
                id="lp-email"
                type="email"
                autoComplete="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                required
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="lp-city">Ville *</label>
              <input
                id="lp-city"
                type="text"
                autoComplete="address-level2"
                placeholder="Ex : Casablanca"
                value={city}
                onChange={(e) => setCity(e.target.value.replace(/[^\p{L}\s'-]/gu, ""))}
                disabled={pending}
                required
              />
              {errors.city && <p className="form-error">{errors.city}</p>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="lp-address">Adresse *</label>
            <textarea
              id="lp-address"
              autoComplete="address-line1"
              placeholder="Rue, quartier, numéro…"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={pending}
              required
            />
            {errors.address && <p className="form-error">{errors.address}</p>}
          </div>
        </div>
        </div>

        <div className="order-col-side">
          {/* product card — appears in the sticky rail on desktop */}
          <div className="og-product og-product--desktop">{productCard}</div>

          {/* ---- summary ---- */}
          <div className="og-summary">
            <div className="order-summary">
              <div className="summary-row">
                <span>Produit ({selected.quantity})</span>
                <span>{totalLabel}</span>
              </div>
              {oldLabel && selected.save && (
                <div className="summary-row">
                  <span>Remise</span>
                  <span style={{ color: "var(--success)", fontWeight: 700 }}>−{formatMoney(selected.save)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Livraison</span>
                <span style={{ color: "var(--success)", fontWeight: 700 }}>Gratuite 🚚</span>
              </div>
              <div className="summary-row summary-total">
                <span>TOTAL</span>
                <span>{totalLabel}</span>
              </div>
            </div>
          </div>

          {/* ---- submit ---- */}
          <div className="og-submit">
            <button type="submit" className="submit-btn" disabled={pending}>
              {pending ? "Envoi en cours…" : "Confirmer la commande"}
            </button>
            {formError && (
              <p className="form-error" role="alert" style={{ textAlign: "center" }}>
                {formError}
              </p>
            )}
            <div className="payment-info">
              <span aria-hidden="true">💵</span>
              <span>Paiement à la livraison — aucun paiement en ligne</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
