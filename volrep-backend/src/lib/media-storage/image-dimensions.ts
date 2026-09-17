import { AppError } from "../../lib/errors.js";
import { env } from "../../config/env.js";

// Header-only image dimension readers (security hardening — Step 3 §5).
//
// A tiny (few-KB) but highly-compressed image can decode to gigabytes of
// pixels ("decompression bomb") and DoS any consumer that decodes it — most
// relevantly the storefront's next/image optimizer. The backend stores
// image bytes VERBATIM and never decodes them, so it is not itself at risk;
// this guard protects the downstream consumers by refusing such a file at
// upload time.
//
// These functions read ONLY the format header (width/height fields) — never
// a scanline, never a full decode, never a large allocation. An unreadable
// or unrecognized header returns null and the caller falls back to the
// byte-size cap (which is always enforced regardless).

export type Dimensions = { width: number; height: number };

// ---- PNG : IHDR is always the first chunk, at a fixed offset ----------
function pngDimensions(buf: Buffer): Dimensions | null {
  // 8-byte signature, 4-byte length, "IHDR", width(4 BE), height(4 BE)
  if (buf.length < 24) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ---- GIF : logical screen descriptor, fixed offset -------------------
function gifDimensions(buf: Buffer): Dimensions | null {
  if (buf.length < 10) return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

// ---- JPEG : walk marker segments to the first Start-Of-Frame ---------
function jpegDimensions(buf: Buffer): Dimensions | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  // Bounded walk: a real SOF sits within the first megabyte of any sane
  // JPEG; stop there rather than scanning an attacker-sized file.
  const limit = Math.min(buf.length, 1_000_000);
  while (offset + 9 < limit) {
    if (buf[offset] !== 0xff) return null; // desync — not a JPEG we can read
    const marker = buf[offset + 1]!;
    // Standalone markers (no length): RSTn, SOI, EOI, TEM.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const segLength = buf.readUInt16BE(offset + 2);
    if (segLength < 2) return null;
    // SOF0..SOF15 except DHT(0xc4), JPG(0xc8), DAC(0xcc) carry the frame size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (offset + 9 >= buf.length) return null;
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + segLength;
  }
  return null;
}

// ---- WebP : VP8 / VP8L / VP8X inside the RIFF container --------------
function webpDimensions(buf: Buffer): Dimensions | null {
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourcc = buf.toString("ascii", 12, 16);

  if (fourcc === "VP8X") {
    // 24-bit little-endian (canvasWidth-1), then (canvasHeight-1), at +24.
    const w = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16));
    const h = 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16));
    return { width: w, height: h };
  }
  if (fourcc === "VP8 ") {
    // Lossy: 3-byte start code 0x9d 0x01 0x2a at +23, then 14-bit w, 14-bit h.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    const w = buf.readUInt16LE(26) & 0x3fff;
    const h = buf.readUInt16LE(28) & 0x3fff;
    return { width: w, height: h };
  }
  if (fourcc === "VP8L") {
    // Lossless: signature 0x2f at +20, then 14-bit (w-1), 14-bit (h-1).
    if (buf[20] !== 0x2f) return null;
    const b0 = buf[21]!;
    const b1 = buf[22]!;
    const b2 = buf[23]!;
    const b3 = buf[24]!;
    const w = 1 + (((b1 & 0x3f) << 8) | b0);
    const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width: w, height: h };
  }
  return null;
}

// ---- AVIF : bounded scan for the ISO-BMFF `ispe` box ----------------
function avifDimensions(buf: Buffer): Dimensions | null {
  const needle = Buffer.from("ispe", "ascii");
  const limit = Math.min(buf.length, 65_536);
  const idx = buf.subarray(0, limit).indexOf(needle);
  if (idx < 0 || idx + 12 > buf.length) return null;
  // ispe payload: 1 byte version + 3 bytes flags, then width(4 BE), height(4 BE).
  return { width: buf.readUInt32BE(idx + 4 + 4), height: buf.readUInt32BE(idx + 4 + 8) };
}

// `ext` is the extension our own byte-sniffer (image-detect.ts) assigned —
// it is trusted here because it came from the magic bytes, not the client.
export function readImageDimensions(buf: Buffer, ext: "jpg" | "png" | "webp" | "avif" | "gif"): Dimensions | null {
  switch (ext) {
    case "png":
      return pngDimensions(buf);
    case "gif":
      return gifDimensions(buf);
    case "jpg":
      return jpegDimensions(buf);
    case "webp":
      return webpDimensions(buf);
    case "avif":
      return avifDimensions(buf);
  }
}

// Throws AppError(400) when a raster image's header declares dimensions
// beyond the configured bounds. An unreadable header is allowed through —
// the byte-size cap is the backstop and is enforced separately.
export function assertImageDimensionsWithinLimits(
  buf: Buffer,
  ext: "jpg" | "png" | "webp" | "avif" | "gif",
): void {
  const dims = readImageDimensions(buf, ext);
  if (!dims) return;

  const { width, height } = dims;
  if (width <= 0 || height <= 0) {
    throw AppError.badRequest("Dimensions d’image invalides.");
  }
  if (width > env.MEDIA_IMAGE_MAX_DIMENSION || height > env.MEDIA_IMAGE_MAX_DIMENSION) {
    throw AppError.badRequest(
      `Image trop grande : ${width}×${height} px (maximum ${env.MEDIA_IMAGE_MAX_DIMENSION} px par côté).`,
    );
  }
  if (width * height > env.MEDIA_IMAGE_MAX_PIXELS) {
    throw AppError.badRequest(
      `Image trop lourde à afficher : ${width}×${height} px dépasse ${env.MEDIA_IMAGE_MAX_PIXELS} pixels.`,
    );
  }
}
