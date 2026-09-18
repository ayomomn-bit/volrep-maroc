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

// ---- video (MP4 + WebM) -------------------------------------------------
// Only the "Page produit" section-media upload and the Homepage Hero visual
// accept a video; the product gallery stays images-only. We support
// standard, browser-playable MP4 (ISO base-media file format) and WebM
// (EBML/Matroska) and nothing else — no transcoding, no server-side
// thumbnail generation.
export type DetectedVideo =
  | { contentType: "video/mp4"; ext: "mp4" }
  | { contentType: "video/webm"; ext: "webm" };

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

function detectMp4(buf: Buffer): DetectedVideo | null {
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

// WebM is an EBML/Matroska container: every file of this family begins with
// the EBML magic number 1A 45 DF A3. That magic alone isn't specific enough
// (a plain Matroska .mkv shares it), so we also require the EBML header's
// DocType element (ID 0x4282) to be immediately followed by a one-byte
// EBML-coded length and the ASCII value "webm" — the exact shape real
// encoders write, and the same shape that lets us reject a plain Matroska
// .mkv (DocType "matroska"). A loose "does 'webm' appear somewhere nearby"
// substring search would be spoofable by any file that merely contains that
// word in its opening bytes.
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const WEBM_DOCTYPE_ID = Buffer.from([0x42, 0x82]);
const WEBM_DOCTYPE_VALUE = Buffer.from("webm", "ascii");
const WEBM_HEADER_SEARCH_WINDOW = 256;

function detectWebm(buf: Buffer): DetectedVideo | null {
  if (buf.length < 4) return null;
  if (!buf.subarray(0, 4).equals(EBML_MAGIC)) return null;

  const window = buf.subarray(0, Math.min(buf.length, WEBM_HEADER_SEARCH_WINDOW));
  const idIndex = window.indexOf(WEBM_DOCTYPE_ID);
  if (idIndex === -1) return null;
  const valueStart = idIndex + WEBM_DOCTYPE_ID.length + 1; // + 1-byte EBML length
  if (!window.subarray(valueStart, valueStart + WEBM_DOCTYPE_VALUE.length).equals(WEBM_DOCTYPE_VALUE)) {
    return null;
  }

  return { contentType: "video/webm", ext: "webm" };
}

export function detectVideo(buf: Buffer): DetectedVideo | null {
  return detectMp4(buf) ?? detectWebm(buf);
}

const ALLOWED_VIDEO_EXT_BY_MIME: Record<string, string[]> = {
  "video/mp4": ["mp4", "m4v"],
  "video/webm": ["webm"],
};

export function declaredVideoPairLooksValid(mimetype: string, filename: string): boolean {
  const allowed = ALLOWED_VIDEO_EXT_BY_MIME[mimetype.toLowerCase()];
  if (!allowed) return false;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return allowed.includes(ext);
}
