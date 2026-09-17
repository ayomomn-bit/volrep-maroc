import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_DOCUMENT } from "./defaults.js";
import type { HomepageDocument, HomepageMediaSlot } from "./schema.js";
import {
  HOMEPAGE_MEDIA_MIGRATION_URLS,
  __setKnownUrlsForTest,
  collectAltTextByUrl,
  isKnownHomepageMigrationUrl,
  migrateHomepageDocumentMedia,
  migrateHomepageMediaSlot,
} from "./media-migration.js";

function cloneDefault(): HomepageDocument {
  return structuredClone(DEFAULT_HOMEPAGE_DOCUMENT) as HomepageDocument;
}

const KNOWN_URL = "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/Back-recovery.webp";
const UNKNOWN_URL = "https://cdn.shopify.com/s/files/1/1010/7476/4088/files/never-heard-of-it.webp";

describe("HOMEPAGE_MEDIA_MIGRATION_URLS", () => {
  it("has exactly the six known editorial assets: Recovery Philosophy background + 5 Recover Everywhere zones", () => {
    expect(HOMEPAGE_MEDIA_MIGRATION_URLS.size).toBe(6);
    const recoveryPhilosophy = DEFAULT_HOMEPAGE_DOCUMENT.sections.find((s) => s.type === "recoveryPhilosophy");
    const recoverEverywhere = DEFAULT_HOMEPAGE_DOCUMENT.sections.find((s) => s.type === "recoverEverywhere");
    if (recoveryPhilosophy?.type !== "recoveryPhilosophy" || recoverEverywhere?.type !== "recoverEverywhere") {
      throw new Error("unexpected section shape");
    }
    expect(HOMEPAGE_MEDIA_MIGRATION_URLS.has(recoveryPhilosophy.data.background.url)).toBe(true);
    for (const zone of recoverEverywhere.data.zones) {
      expect(HOMEPAGE_MEDIA_MIGRATION_URLS.has(zone.media.url)).toBe(true);
    }
  });

  it("does not include the hero's placeholder slot (no url to match)", () => {
    for (const url of HOMEPAGE_MEDIA_MIGRATION_URLS) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});

describe("isKnownHomepageMigrationUrl / __setKnownUrlsForTest", () => {
  afterEach(() => __setKnownUrlsForTest(null));

  it("matches real known URLs by default", () => {
    const [anyKnown] = HOMEPAGE_MEDIA_MIGRATION_URLS;
    expect(isKnownHomepageMigrationUrl(anyKnown!)).toBe(true);
    expect(isKnownHomepageMigrationUrl(UNKNOWN_URL)).toBe(false);
  });

  it("can be swapped for a test-controlled set", () => {
    __setKnownUrlsForTest(new Set([KNOWN_URL]));
    expect(isKnownHomepageMigrationUrl(KNOWN_URL)).toBe(true);
    expect(isKnownHomepageMigrationUrl(UNKNOWN_URL)).toBe(false);
  });
});

describe("migrateHomepageMediaSlot", () => {
  afterEach(() => __setKnownUrlsForTest(null));

  const urlSlot = (url: string, alt = "some alt"): HomepageMediaSlot => ({
    kind: "url",
    imageId: null,
    url,
    poster: "",
    alt,
    placeholderLabel: "",
    mediaType: "image",
    fileName: "",
  });

  it("converts a matched kind:url slot into kind:image, preserving alt and other fields", () => {
    __setKnownUrlsForTest(new Set([KNOWN_URL]));
    const slot = urlSlot(KNOWN_URL, "a person recovering");
    const result = migrateHomepageMediaSlot(slot, new Map([[KNOWN_URL, { id: "site-media-uuid" }]]));

    expect(result).toEqual({
      kind: "image",
      imageId: "site-media-uuid",
      url: "",
      poster: "",
      alt: "a person recovering",
      placeholderLabel: "",
      mediaType: "image",
      fileName: "",
    });
  });

  it("leaves a slot untouched when its URL is not in the known set", () => {
    __setKnownUrlsForTest(new Set([KNOWN_URL]));
    const slot = urlSlot(UNKNOWN_URL);
    const result = migrateHomepageMediaSlot(slot, new Map([[UNKNOWN_URL, { id: "x" }]]));
    expect(result).toBe(slot);
  });

  it("leaves a placeholder slot untouched", () => {
    const placeholder: HomepageMediaSlot = {
      kind: "placeholder",
      imageId: null,
      url: "",
      poster: "",
      alt: "",
      placeholderLabel: "",
      mediaType: "image",
      fileName: "",
    };
    const result = migrateHomepageMediaSlot(placeholder, new Map());
    expect(result).toBe(placeholder);
  });

  it("leaves an already-migrated kind:image slot untouched (idempotent)", () => {
    const already: HomepageMediaSlot = {
      kind: "image",
      imageId: "already-uuid",
      url: "",
      poster: "",
      alt: "x",
      placeholderLabel: "",
      mediaType: "image",
      fileName: "",
    };
    const result = migrateHomepageMediaSlot(already, new Map());
    expect(result).toBe(already);
  });

  it("leaves a matched URL untouched when the upload for it failed (not in the map)", () => {
    __setKnownUrlsForTest(new Set([KNOWN_URL]));
    const slot = urlSlot(KNOWN_URL);
    const result = migrateHomepageMediaSlot(slot, new Map());
    expect(result).toBe(slot);
  });
});

describe("collectAltTextByUrl", () => {
  it("collects alt text from the Recovery Philosophy background and Recover Everywhere zones", () => {
    const doc = cloneDefault();
    const byUrl = collectAltTextByUrl(doc);

    const recoveryPhilosophy = doc.sections.find((s) => s.type === "recoveryPhilosophy");
    if (recoveryPhilosophy?.type !== "recoveryPhilosophy") throw new Error("unexpected");
    expect(byUrl.get(recoveryPhilosophy.data.background.url)).toBe(recoveryPhilosophy.data.background.alt);
  });

  it("does not invent alt text for a slot with none", () => {
    const doc = cloneDefault();
    const recoverEverywhere = doc.sections.find((s) => s.type === "recoverEverywhere");
    if (recoverEverywhere?.type !== "recoverEverywhere") throw new Error("unexpected");
    const byUrl = collectAltTextByUrl(doc);
    // The default document's zone photos carry empty alt text today.
    expect(byUrl.get(recoverEverywhere.data.zones[0]!.media.url)).toBe("");
  });
});

describe("migrateHomepageDocumentMedia", () => {
  it("migrates only the six known slots, leaving every other field byte-identical", () => {
    const doc = cloneDefault();
    const uploaded = new Map<string, { id: string }>(
      [...HOMEPAGE_MEDIA_MIGRATION_URLS].map((url, i) => [url, { id: `uuid-${i}` }]),
    );

    const { doc: migrated, changed } = migrateHomepageDocumentMedia(doc, uploaded);
    expect(changed).toBe(true);

    const recoveryPhilosophy = migrated.sections.find((s) => s.type === "recoveryPhilosophy");
    const recoverEverywhere = migrated.sections.find((s) => s.type === "recoverEverywhere");
    if (recoveryPhilosophy?.type !== "recoveryPhilosophy" || recoverEverywhere?.type !== "recoverEverywhere") {
      throw new Error("unexpected section shape");
    }
    expect(recoveryPhilosophy.data.background.kind).toBe("image");
    expect(recoveryPhilosophy.data.background.imageId).toBeTruthy();
    for (const zone of recoverEverywhere.data.zones) {
      expect(zone.media.kind).toBe("image");
      expect(zone.media.imageId).toBeTruthy();
    }

    // The hero's placeholder slot is untouched — no image was invented.
    const hero = migrated.sections.find((s) => s.type === "hero");
    if (hero?.type !== "hero") throw new Error("unexpected");
    expect(hero.data.visual.media.kind).toBe("placeholder");

    // Non-media content is byte-identical to the original.
    const withoutMedia = (d: HomepageDocument) =>
      JSON.stringify(
        d.sections.map((s) => (s.type === "recoveryPhilosophy" || s.type === "recoverEverywhere" ? { id: s.id, type: s.type, enabled: s.enabled } : s)),
      );
    expect(withoutMedia(migrated)).toBe(withoutMedia(doc));

    // Section order, enabled states, and every other section untouched.
    expect(migrated.sections.map((s) => s.id)).toEqual(doc.sections.map((s) => s.id));
    expect(migrated.sections.map((s) => s.enabled)).toEqual(doc.sections.map((s) => s.enabled));
  });

  it("reports changed: false and leaves the document untouched when nothing matches (already migrated)", () => {
    const doc = cloneDefault();
    const { doc: migrated, changed } = migrateHomepageDocumentMedia(doc, new Map());
    expect(changed).toBe(false);
    expect(migrated).toEqual(doc);
  });

  it("is idempotent: migrating an already-migrated document a second time is a no-op", () => {
    const doc = cloneDefault();
    const uploaded = new Map<string, { id: string }>(
      [...HOMEPAGE_MEDIA_MIGRATION_URLS].map((url, i) => [url, { id: `uuid-${i}` }]),
    );
    const once = migrateHomepageDocumentMedia(doc, uploaded).doc;
    const twice = migrateHomepageDocumentMedia(once, uploaded);
    expect(twice.changed).toBe(false);
    expect(twice.doc).toEqual(once);
  });
});
