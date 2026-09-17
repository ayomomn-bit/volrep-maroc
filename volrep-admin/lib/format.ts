import type { Money, OrderStatus, PaymentStatus, ProductStatus, ReviewStatus } from "@/lib/types";

// Moroccan-style grouping (thin space) with a trailing currency code:
// "1 099,00 MAD". Falls back to a generic currency format for anything
// that is not MAD (there is nothing else in the catalog today).
const MAD_MONEY = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "MAD",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
});
const MAD_MONEY_COMPACT = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "MAD",
  currencyDisplay: "code",
  maximumFractionDigits: 0,
});
const NUMBER = new Intl.NumberFormat("fr-FR");

function moneyValue(money: Money | null | undefined): number | null {
  if (!money) return null;
  const value = Number(money.amount);
  return Number.isFinite(value) ? value : null;
}

export function formatMoney(money: Money | null | undefined): string {
  const value = moneyValue(money);
  if (value === null) return "—";
  if (!money?.currencyCode || money.currencyCode === "MAD") return MAD_MONEY.format(value);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: money.currencyCode,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
  }).format(value);
}

// For KPI tiles — drops the centimes so large figures stay scannable.
export function formatMoneyCompact(money: Money | null | undefined): string {
  const value = moneyValue(money);
  if (value === null) return "—";
  return MAD_MONEY_COMPACT.format(value);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return NUMBER.format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// Compact relative age for activity feeds: "à l’instant", "il y a 3 h", "il y a 2 j".
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 45) return "à l’instant";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return formatDateShort(iso);
}

// Generic enum-string humanizer — LAST-RESORT fallback only. Prefer the
// typed *Label() helpers in lib/i18n for known backend enums.
// "pending_payment" -> "Pending payment"
export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export function orderStatusTone(status: OrderStatus): Tone {
  switch (status) {
    case "pending_payment":
      return "warning";
    case "paid":
      return "info";
    case "fulfilled":
      return "success";
    case "partially_fulfilled":
      return "info";
    case "canceled":
      return "danger";
    case "refunded":
    case "partially_refunded":
      return "neutral";
  }
}

export function paymentStatusTone(status: PaymentStatus): Tone {
  return status === "paid" ? "success" : status === "refunded" ? "neutral" : "warning";
}

export function productStatusTone(status: ProductStatus): Tone {
  return status === "active" ? "success" : status === "draft" ? "warning" : "neutral";
}

export function reviewStatusTone(status: ReviewStatus): Tone {
  return status === "approved" ? "success" : status === "rejected" ? "danger" : "warning";
}
