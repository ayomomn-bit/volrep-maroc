import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, closeDb } from "./client.js";
import { homepage, siteMedia, HOMEPAGE_ID } from "./schema/index.js";
import { getMediaStorage } from "../lib/media-storage/index.js";
import { detectImage } from "../lib/media-storage/image-detect.js";
import { assertImageDimensionsWithinLimits, readImageDimensions } from "../lib/media-storage/image-dimensions.js";
import { parseHomepageDocument, type HomepageDocument } from "../lib/homepage/schema.js";
import {
  HOMEPAGE_MEDIA_MIGRATION_URLS,
  collectAltTextByUrl,
  migrateHomepageDocumentMedia,
  type UploadedHomepageAsset,
} from "../lib/homepage/media-migration.js";

// One-off, idempotent migration: move the six Homepage Studio editorial
// images that still point at cdn.shopify.com (the Recovery Philosophy
// background + the five Recover Everywhere zone photos — read straight off
// the code-owned default document, see src/lib/homepage/media-migration.ts)
// onto Volrep-owned media storage, as `site_media` rows — NEVER
// `product_images`. Homepage Studio's `draft` and `published` columns are
// then updated in place to reference those rows.
//
//   npm run media:migrate-homepage -- --dry     # report only
//   npm run media:migrate-homepage              # do it
//
// Safe by construction:
//  - only a `kind:"url"` slot whose url is EXACTLY one of the six known
//    URLs is touched; anything else (already migrated, or an admin has
//    since hand-edited that slot) is left untouched and reported.
//  - draft and published are migrated independently, keeping every other
//    field — copy, section order, enabled state, CTAs, the other seven
//    sections — byte-identical. This does NOT go through the normal
//    publish flow (which would copy the whole draft over published) and
//    does NOT touch unrelated draft-vs-published differences.
//  - the code-owned default document (src/lib/homepage/defaults.ts) is
//    deliberately NOT touched — a site_media id is only meaningful in the
//    database it was created in, so the fallback used when the row is
//    missing entirely must keep the environment-independent external URLs.
//  - each of the six URLs is fetched once and reused for draft + published;
//    a second run is a no-op (site_media dedupes on checksum, and a slot
//    already `kind:"image"` no longer matches a known URL).

const DRY = process.argv.includes("--dry");

async function uploadOnce(
  url: string,
  altText: string,
  cache: Map<string, UploadedHomepageAsset>,
): Promise<UploadedHomepageAsset> {
  const cached = cache.get(url);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());

  const detected = detectImage(bytes);
  if (!detected) throw new Error("not a supported image (byte sniff failed)");
  assertImageDimensionsWithinLimits(bytes, detected.ext);
  const dims = readImageDimensions(bytes, detected.ext);
  const checksum = createHash("sha256").update(bytes).digest("hex");

  console.log(
    `  ${url.slice(0, 70)}…  ${bytes.byteLength} B  ${dims ? `${dims.width}×${dims.height}` : "(dimensions unreadable)"}`,
  );

  const [existing] = await db.select().from(siteMedia).where(eq(siteMedia.checksum, checksum)).limit(1);
  if (existing) {
    console.log(`    already in site_media (checksum match) -> ${existing.id}`);
    const asset = { id: existing.id };
    cache.set(url, asset);
    return asset;
  }

  if (DRY) {
    const asset = { id: "(dry-run — not created)" };
    cache.set(url, asset);
    return asset;
  }

  const storage = getMediaStorage();
  const key = `site/${checksum}.${detected.ext}`;
  const filename = (() => {
    try {
      return new URL(url).pathname.split("/").pop() ?? "";
    } catch {
      return "";
    }
  })();

  if (!(await storage.exists(key))) await storage.put(key, bytes, detected.contentType);

  const [row] = await db
    .insert(siteMedia)
    .values({
      url: storage.publicUrl(key),
      storageKey: key,
      contentType: detected.contentType,
      checksum,
      byteSize: bytes.byteLength,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      mediaType: "image",
      originalFilename: filename,
      altText,
    })
    .onConflictDoNothing({ target: siteMedia.storageKey })
    .returning();

  // A concurrent run uploaded the identical bytes first — fetch its row.
  const media = row ?? (await db.select().from(siteMedia).where(eq(siteMedia.storageKey, key)).limit(1))[0];
  if (!media) throw new Error(`site_media insert returned no row for ${key}`);

  console.log(`    -> site_media ${media.id}  (site/${checksum}.${detected.ext})`);
  const asset = { id: media.id };
  cache.set(url, asset);
  return asset;
}

function safeParse(label: string, value: unknown): HomepageDocument | null {
  if (!value) {
    console.log(`  ${label}: none — skipped.`);
    return null;
  }
  try {
    return parseHomepageDocument(value);
  } catch (err) {
    console.log(`  ${label}: fails schema validation, left untouched (${err instanceof Error ? err.message : err}).`);
    return null;
  }
}

async function main(): Promise<void> {
  const [row] = await db.select().from(homepage).where(eq(homepage.id, HOMEPAGE_ID)).limit(1);
  if (!row) {
    console.log("No homepage row exists yet (Homepage Studio has never been opened) — nothing to migrate.");
    await closeDb();
    return;
  }

  console.log(`${HOMEPAGE_MEDIA_MIGRATION_URLS.size} known homepage editorial asset URL(s).\n`);

  const draft = safeParse("draft", row.draft);
  const published = safeParse("published", row.published);

  // Collect the alt text currently on each known slot (draft preferred,
  // falling back to published) BEFORE uploading, so the site_media row is
  // created with a meaningful label the first time — never invented.
  const altByUrl = new Map<string, string>();
  for (const doc of [published, draft].filter((d): d is HomepageDocument => d != null)) {
    for (const [url, alt] of collectAltTextByUrl(doc)) {
      if (alt) altByUrl.set(url, alt);
    }
  }

  console.log("Uploading:");
  const uploaded = new Map<string, UploadedHomepageAsset>();
  const failures: { url: string; reason: string }[] = [];
  for (const url of HOMEPAGE_MEDIA_MIGRATION_URLS) {
    try {
      await uploadOnce(url, altByUrl.get(url) ?? "", uploaded);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.log(`  ${url}\n    FAILED: ${reason}`);
      failures.push({ url, reason });
    }
  }

  console.log("\nUpdating homepage document(s):");
  const patch: Record<string, unknown> = {};

  if (draft) {
    const result = migrateHomepageDocumentMedia(draft, uploaded);
    console.log(`  draft: ${result.changed ? "updated" : "no matching slots — unchanged"}`);
    if (result.changed) patch.draft = result.doc;
  }
  if (published) {
    const result = migrateHomepageDocumentMedia(published, uploaded);
    console.log(`  published: ${result.changed ? "updated" : "no matching slots — unchanged"}`);
    if (result.changed) patch.published = result.doc;
  }

  if (DRY) {
    console.log("\n(dry run — no site_media rows created, no homepage row updated)");
    await closeDb();
    if (failures.length) process.exitCode = 1;
    return;
  }

  if (Object.keys(patch).length > 0) {
    await db.update(homepage).set(patch).where(eq(homepage.id, HOMEPAGE_ID));
    console.log(`\nUpdated homepage row: ${Object.keys(patch).join(", ")}.`);
  } else {
    console.log("\nNothing to update — homepage row left untouched.");
  }

  if (failures.length) {
    console.log(`\n${failures.length} failure(s) — these URLs are still external:`);
    for (const f of failures) console.log(`  ${f.reason}  ${f.url}`);
  }

  await closeDb();
  if (failures.length) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error("media:migrate-homepage failed:", err instanceof Error ? err.message : err);
  await closeDb();
  process.exit(1);
});
