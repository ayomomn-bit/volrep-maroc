import { env } from "../config/env.js";

// Fire-and-forget POST to the storefront's /api/revalidate. Never throws — a
// failed or unconfigured revalidation just means the change appears on the
// storefront's next scheduled revalidation instead of immediately.
async function postRevalidate(body: Record<string, unknown>, label: string): Promise<void> {
  if (!env.STOREFRONT_BASE_URL) return;

  const url = `${env.STOREFRONT_BASE_URL.replace(/\/+$/, "")}/api/revalidate`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-api-key": env.INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`storefront revalidate (${label}) returned ${res.status}`);
    }
  } catch (error) {
    console.warn(`storefront revalidate (${label}) failed:`, error);
  }
}

// Tell the storefront to drop its cached render of one product's page after a
// Product Studio publish.
export async function revalidateStorefrontProductPage(handle: string): Promise<void> {
  await postRevalidate({ handle }, `product "${handle}"`);
}

// Tell the storefront to drop its cached render of the homepage ("/") after a
// Homepage Studio publish. The storefront route treats `{ scope: "homepage" }`
// as a homepage revalidation; the existing `{ handle }` contract is unchanged.
// STEP 1: harmless — the storefront `/` does not consume the document yet.
export async function revalidateStorefrontHomepage(): Promise<void> {
  await postRevalidate({ scope: "homepage" }, "homepage");
}
