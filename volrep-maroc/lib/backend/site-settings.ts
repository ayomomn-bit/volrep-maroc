import { backendFetch } from "@/lib/backend/client";

// Read-only view of the store identity Volrep owns (backend
// `store_settings`, exposed at GET /api/store-settings). Server-to-server
// only — `lib/backend/client` is `server-only` and attaches the internal
// API key. This is a NEW storefront contract, additive: it never touches
// products / cart / checkout / orders.

export type BackendStoreSettings = {
  storeName: string;
  tagline: string;
  supportEmail: string;
  social: {
    instagram: string;
    tiktok: string;
    youtube: string;
  };
};

// Returns `null` on ANY problem (backend down, non-2xx, malformed body).
// Callers must treat `null` — and any empty field — as "use the
// code-owned fallback". No page may break because Settings is unavailable.
export async function getStoreSettings(): Promise<BackendStoreSettings | null> {
  try {
    const { settings } = await backendFetch<{ settings: BackendStoreSettings }>("/api/store-settings", {
      next: { revalidate: 600 },
    });
    if (!settings || typeof settings !== "object") return null;
    return {
      storeName: str(settings.storeName),
      tagline: str(settings.tagline),
      supportEmail: str(settings.supportEmail),
      social: {
        instagram: str(settings.social?.instagram),
        tiktok: str(settings.social?.tiktok),
        youtube: str(settings.social?.youtube),
      },
    };
  } catch (error) {
    console.error("Volrep backend getStoreSettings error:", error);
    return null;
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
