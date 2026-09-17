import { backendFetch, BackendError } from "@/lib/backend/client";

// Same shapes as the retired lib/shopify/products.ts, by design — the
// Volrep backend's product endpoints (see volrep-backend/src/mappers/
// product.ts) were built to return these exact field names so this file
// could be close to a pass-through instead of a mapper. Every product
// component keeps importing these type names unchanged; only the import
// path moves from "@/lib/shopify/products" to "@/lib/backend/products".

export type ShopifyMoney = {
  amount: string;
  currencyCode: string;
};

export type ShopifyImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

export type ShopifyProductOption = {
  id: string;
  name: string;
  values: string[];
};

export type ShopifySelectedOption = {
  name: string;
  value: string;
};

export type ShopifyProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: ShopifySelectedOption[];
  price: ShopifyMoney;
  compareAtPrice: ShopifyMoney | null;
  image: ShopifyImage | null;
};

export type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  featuredImage: ShopifyImage | null;
  images: ShopifyImage[];
  options: ShopifyProductOption[];
  variants: ShopifyProductVariant[];
  price: ShopifyMoney;
  compareAtPrice: ShopifyMoney | null;
};

export type ShopifyProductSummary = {
  id: string;
  title: string;
  handle: string;
  productType: string;
  tags: string[];
  featuredImage: { url: string; altText: string | null } | null;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
};

export async function getProducts(first = 8): Promise<ShopifyProductSummary[]> {
  try {
    const { products } = await backendFetch<{ products: ShopifyProductSummary[] }>("/api/products", {
      query: { limit: first },
      next: { revalidate: 300 },
    });
    return products;
  } catch (error) {
    console.error("Volrep backend getProducts error:", error);
    return [];
  }
}

// Returns null on a missing/unpublished handle, a backend error, or a
// request failure — page.tsx treats all three the same way (notFound()),
// matching the original Shopify-era contract exactly.
export async function getProduct(handle: string): Promise<ShopifyProduct | null> {
  try {
    const { product } = await backendFetch<{ product: ShopifyProduct }>(`/api/products/${encodeURIComponent(handle)}`, {
      next: { revalidate: 300 },
    });
    return product;
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null;
    console.error("Volrep backend getProduct error:", error);
    return null;
  }
}
