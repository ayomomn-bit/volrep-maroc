import { createHash } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import { db, closeDb } from "./client.js";
import { productImages } from "./schema/index.js";
import { getMediaStorage } from "../lib/media-storage/index.js";
import { detectImage } from "../lib/media-storage/image-detect.js";

// One-off, idempotent migration: pull every product image that still lives
// on cdn.shopify.com (storage_key IS NULL) onto Volrep-owned media storage.
//
//   npm run media:migrate-shopify -- --dry     # report only
//   npm run media:migrate-shopify              # do it
//
// Safe by construction: a row's URL is only rewritten AFTER its bytes are
// stored. A fetch/validation failure leaves that row untouched and is
// reported. The image id, position and any variant.image_id link are kept,
// so storefront ordering and per-variant images are preserved.
//
// For the VPS: deploy with MEDIA_STORAGE_DRIVER=s3 + MEDIA_S3_* set, then
// run this once. Nothing else changes.

const DRY = process.argv.includes("--dry");

async function main(): Promise<void> {
  const storage = getMediaStorage();

  const rows = await db
    .select()
    .from(productImages)
    .where(isNull(productImages.storageKey));

  const shopify = rows.filter((r) => /(^|\/\/)cdn\.shopify\.com\//.test(r.url) || r.url.includes("cdn.shopify.com"));

  console.log(`${rows.length} un-owned image row(s); ${shopify.length} on cdn.shopify.com.`);
  if (shopify.length === 0) {
    console.log("Nothing to migrate.");
    await closeDb();
    return;
  }

  let migrated = 0;
  const failures: { id: string; url: string; reason: string }[] = [];

  for (const row of shopify) {
    try {
      const res = await fetch(row.url);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      const detected = detectImage(bytes);
      if (!detected) throw new Error("not a supported image (byte sniff failed)");

      const checksum = createHash("sha256").update(bytes).digest("hex");
      const key = `products/${checksum}.${detected.ext}`;
      const url = storage.publicUrl(key);

      console.log(`  ${row.id.slice(0, 8)}  ${row.url.slice(0, 60)}…  ->  ${key} (${bytes.byteLength} B)`);
      if (DRY) continue;

      if (!(await storage.exists(key))) await storage.put(key, bytes, detected.contentType);
      await db
        .update(productImages)
        .set({ url, storageKey: key, contentType: detected.contentType, checksum, byteSize: bytes.byteLength })
        .where(eq(productImages.id, row.id));
      migrated++;
    } catch (err) {
      failures.push({ id: row.id, url: row.url, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log(DRY ? "\n(dry run — nothing written)" : `\nMigrated ${migrated}/${shopify.length}.`);
  if (failures.length) {
    console.log(`${failures.length} failure(s) — these rows still point at cdn.shopify.com:`);
    for (const f of failures) console.log(`  ${f.id}  ${f.reason}  ${f.url}`);
  }

  await closeDb();
  if (failures.length) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error("media:migrate-shopify failed:", err instanceof Error ? err.message : err);
  await closeDb();
  process.exit(1);
});
