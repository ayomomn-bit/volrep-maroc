import { DEFAULT_HOMEPAGE_DOCUMENT } from "./defaults.js";
import { mapDocumentMediaSlots, type HomepageDocument, type HomepageMediaSlot } from "./schema.js";

// ---------------------------------------------------------------------------
// Pure, DB/network-free helpers for the Step 3B homepage media migration
// (src/db/migrate-homepage-media.ts). Kept separate from the script so the
// matching / transform logic is unit-testable without a database or a real
// fetch — the script itself only wires these to I/O (fetch the bytes,
// upload to site_media, write the homepage row), mirroring
// src/db/migrate-shopify-media.ts.
// ---------------------------------------------------------------------------

// The six existing homepage editorial assets, read from the code-owned
// default document itself (never re-typed by hand) so this list can never
// drift from what the default document actually says the current homepage
// uses: the Recovery Philosophy background + the five Recover Everywhere
// zone photos.
function collectKnownUrls(doc: HomepageDocument): Set<string> {
  const urls = new Set<string>();
  for (const section of doc.sections) {
    if (section.type === "recoveryPhilosophy" && section.data.background.kind === "url") {
      urls.add(section.data.background.url);
    }
    if (section.type === "recoverEverywhere") {
      for (const zone of section.data.zones) {
        if (zone.media.kind === "url") urls.add(zone.media.url);
      }
    }
  }
  return urls;
}

export const HOMEPAGE_MEDIA_MIGRATION_URLS: ReadonlySet<string> = collectKnownUrls(DEFAULT_HOMEPAGE_DOCUMENT);

// Test seam: HOMEPAGE_MEDIA_MIGRATION_URLS is derived from the real default
// document, so exercising "an unknown URL is left untouched" against the
// live six production URLs would be awkward in a unit test. Tests may swap
// in their own known-URL set; production code never calls this.
let testOverrideUrls: ReadonlySet<string> | null = null;
export function __setKnownUrlsForTest(urls: ReadonlySet<string> | null): void {
  testOverrideUrls = urls;
}

export function isKnownHomepageMigrationUrl(url: string): boolean {
  return (testOverrideUrls ?? HOMEPAGE_MEDIA_MIGRATION_URLS).has(url);
}

export type UploadedHomepageAsset = { id: string };

// Every slot in the document that references one of the known migration
// URLs, keyed by that URL, with the alt text currently on the slot — used to
// carry a meaningful label onto the site_media row at upload time. When two
// slots share a URL (unexpected, but not impossible) the first one found
// wins; this is display-only in the media library and never changes what
// the storefront renders.
export function collectAltTextByUrl(doc: HomepageDocument): Map<string, string> {
  const byUrl = new Map<string, string>();
  const record = (slot: HomepageMediaSlot) => {
    if (slot.kind === "url" && isKnownHomepageMigrationUrl(slot.url) && !byUrl.has(slot.url)) {
      byUrl.set(slot.url, slot.alt);
    }
  };
  for (const section of doc.sections) {
    if (section.type === "recoveryPhilosophy") record(section.data.background);
    if (section.type === "recoverEverywhere") {
      for (const zone of section.data.zones) record(zone.media);
    }
  }
  return byUrl;
}

// Transform one media slot: a `kind:"url"` slot whose URL is a known
// migration URL AND has already been uploaded becomes a `kind:"image"` slot
// referencing that site_media row. Every other slot — a URL this script
// doesn't recognise (already migrated, or an admin has since hand-edited
// it), a placeholder, or one whose upload failed — passes through
// unchanged. `alt`, `placeholderLabel` and every other field are preserved
// verbatim; only `kind`, `imageId` and `url` change.
export function migrateHomepageMediaSlot(
  slot: HomepageMediaSlot,
  uploadedByUrl: ReadonlyMap<string, UploadedHomepageAsset>,
): HomepageMediaSlot {
  if (slot.kind !== "url" || !isKnownHomepageMigrationUrl(slot.url)) return slot;
  const asset = uploadedByUrl.get(slot.url);
  if (!asset) return slot;

  return {
    ...slot,
    kind: "image",
    imageId: asset.id,
    url: "",
    mediaType: "image",
  };
}

// Apply migrateHomepageMediaSlot across every media slot in the document
// (hero visual, Recovery Philosophy background, every Recover Everywhere
// zone — via mapDocumentMediaSlots, the same helper the storefront read and
// the admin service already use, so this can never miss a slot type they
// know about). Returns the new document plus whether anything changed, so
// the caller can skip writing an unmodified draft/published column.
export function migrateHomepageDocumentMedia(
  doc: HomepageDocument,
  uploadedByUrl: ReadonlyMap<string, UploadedHomepageAsset>,
): { doc: HomepageDocument; changed: boolean } {
  let changed = false;
  const next = mapDocumentMediaSlots(doc, (slot) => {
    const migrated = migrateHomepageMediaSlot(slot, uploadedByUrl);
    if (migrated !== slot) changed = true;
    return migrated;
  });
  return { doc: next, changed };
}
