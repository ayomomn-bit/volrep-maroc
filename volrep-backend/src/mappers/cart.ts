import { toMoney, type Money } from "../lib/money.js";
import type { ApiImage } from "./product.js";

export type ApiCartLine = {
  id: string;
  quantity: number;
  cost: { totalAmount: Money };
  merchandise: {
    id: string;
    title: string;
    selectedOptions: { name: string; value: string }[];
    image: ApiImage | null;
    price: Money;
    product: { title: string; handle: string };
  };
};

export type ApiCart = {
  id: string;
  totalQuantity: number;
  cost: { subtotalAmount: Money; totalAmount: Money };
  lines: ApiCartLine[];
};

// Input row shape: one joined record per cart line (line + its variant +
// the variant's product + the variant's image). Kept as a plain type here
// rather than importing Drizzle's inferred join type, since the service
// builds this shape explicitly from three separate queries.
export type CartLineJoinRow = {
  lineId: string;
  quantity: number;
  variantId: string;
  variantTitle: string;
  selectedOptions: { name: string; value: string }[];
  priceAmount: string;
  priceCurrency: string;
  productTitle: string;
  productHandle: string;
  image: { url: string; altText: string | null; width: number | null; height: number | null } | null;
};

export function mapCart(cartId: string, currency: string, rows: CartLineJoinRow[]): ApiCart {
  const lines: ApiCartLine[] = rows.map((row) => {
    const lineTotal = Number(row.priceAmount) * row.quantity;
    return {
      id: row.lineId,
      quantity: row.quantity,
      cost: { totalAmount: toMoney(lineTotal.toFixed(2), row.priceCurrency) },
      merchandise: {
        id: row.variantId,
        title: row.variantTitle,
        selectedOptions: row.selectedOptions,
        image: row.image,
        price: toMoney(row.priceAmount, row.priceCurrency),
        product: { title: row.productTitle, handle: row.productHandle },
      },
    };
  });

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const subtotal = rows.reduce((sum, row) => sum + Number(row.priceAmount) * row.quantity, 0);

  return {
    id: cartId,
    totalQuantity,
    // No shipping/discount applied yet at the cart stage — that's decided
    // at checkout once a destination country is known (Architecture §06;
    // Phase 4 checkout computes the real total from this subtotal).
    cost: { subtotalAmount: toMoney(subtotal.toFixed(2), currency), totalAmount: toMoney(subtotal.toFixed(2), currency) },
    lines,
  };
}
