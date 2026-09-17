// Sniff the leading bytes of an upload to decide what it really is — the
// client's declared Content-Type and filename are never trusted.
export type DetectedImage = { contentType: string; ext: "jpg" | "png" | "webp" | "avif" };

// ---- animated GIF ----------------------------------------------------
// GIF is a distinct media type (`mediaType: "gif"`), NOT a still image: it
// is stored and served verbatim as image/gif so the animation is preserved
// (never transcoded to a static frame). Kept out of `detectImage` on
// purpose so the product gallery (images-only) never picks up a GIF.
export type DetectedGif = { contentType: "image/gif"; ext: "gif" };

export function detectGif(buf: Buffer): DetectedGif | null {
  if (buf.length < 10) return null;
  const magic = buf.toString("ascii", 0, 6);
  if (magic !== "GIF87a" && magic !== "GIF89a") return null;
  return { contentType: "image/gif", ext: "gif" };
}

const ALLOWED_GIF_EXT_BY_MIME: Record<string, string[]> = {
  "image/gif": ["gif"],
};

export function declaredGifPairLooksValid(mimetype: string, filename: string): boolean {
  const allowed = ALLOWED_GIF_EXT_BY_MIME[mimetype.toLowerCase()];
  if (!allowed) return false;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return allowed.includes(ext);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectImage(buf: Buffer): DetectedImage | null {
  if (buf.length < 16) return null;

  // JPEG — FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }

  // PNG — 89 50 4E 47 0D 0A 1A 0A
  if (buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return { contentType: "image/png", ext: "png" };
  }

  // WebP — "RIFF" .... "WEBP"
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { contentType: "image/webp", ext: "webp" };
  }

  // AVIF — ISO-BMFF box, "ftyp" at offset 4, brand "avif" / "avis"
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") {
      return { contentType: "image/avif", ext: "avif" };
    }
  }

  return null;
}

// Allowed <declared MIME, filename extension> pairs. Used to reject an
// upload BEFORE sniffing when the client's own metadata is already
// inconsistent (defence in depth — the byte sniff is authoritative).
const ALLOWED_EXT_BY_MIME: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
};

export function declaredPairLooksValid(mimetype: string, filename: string): boolean {
  const allowed = ALLOWED_EXT_BY_MIME[mimetype.toLowerCase()];
  if (!allowed) return false;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return allowed.includes(ext);
}

// ---- video (MP4 only) --------------------------------------------------
// Only the "Page produit" section-media upload accepts a video; the product
// gallery stays images-only. We support standard, browser-playable MP4
// (ISO base-media file format) and nothing else — no transcoding, no
// server-side thumbnail generation.
export type DetectedVideo = { contentType: "video/mp4"; ext: "mp4" };

// MP4 major brands we accept as a browser-playable .mp4. An ISO-BMFF file
// begins with a `ftyp` box: 4-byte size, "ftyp", then a 4-byte major brand.
const MP4_BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "m4v ", "mmp4"]);

// The box types that may legitimately follow `ftyp` at the top level of an
// MP4 / ISO-BMFF file. Used as a lightweight structural check so an
// arbitrary file with a hand-forged `ftyp…isom` prefix (an executable, an
// HTML page, …) is rejected rather than stored as video/mp4.
const MP4_NEXT_BOXES = new Set([
  "moov", "mdat", "moof", "mfra", "free", "skip", "wide",
  "meta", "pdin", "sidx", "ssix", "styp", "emsg", "uuid", "ftyp",
]);

export function detectVideo(buf: Buffer): DetectedVideo | null {
  if (buf.length < 16) return null;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return null;
  // AVIF / HEIF are also ISO-BMFF `ftyp` files — never mistake one for a video.
  const brand = buf.toString("ascii", 8, 12);
  if (brand === "avif" || brand === "avis" || brand === "heic" || brand === "mif1") return null;
  if (!MP4_BRANDS.has(brand)) return null;

  // Structural check: the `ftyp` box size must be sane and, when the file is
  // long enough to contain it, the following box must carry a known
  // top-level type. A too-short file (a legit tiny clip whose single box IS
  // the whole thing is not a thing — every MP4 has at least ftyp + moov +
  // mdat) still needs a valid second box.
  const ftypSize = buf.readUInt32BE(0);
  if (ftypSize < 16 || ftypSize % 4 !== 0) return null;
  if (ftypSize + 8 > buf.length) return null; // truncated / lying size
  const nextType = buf.toString("ascii", ftypSize + 4, ftypSize + 8);
  if (!MP4_NEXT_BOXES.has(nextType)) return null;

  return { contentType: "video/mp4", ext: "mp4" };
}

const ALLOWED_VIDEO_EXT_BY_MIME: Record<string, string[]> = {
  "video/mp4": ["mp4", "m4v"],
};

export function declaredVideoPairLooksValid(mimetype: string, filename: string): boolean {
  const allowed = ALLOWED_VIDEO_EXT_BY_MIME[mimetype.toLowerCase()];
  if (!allowed) return false;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return allowed.includes(ext);
}
