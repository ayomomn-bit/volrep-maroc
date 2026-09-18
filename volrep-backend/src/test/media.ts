import type { MediaStorage } from "../lib/media-storage/types.js";

// In-memory MediaStorage for tests — no filesystem, deterministic. Wire it
// with __setMediaStorage(new InMemoryMediaStorage()) in beforeEach and
// __setMediaStorage(null) in afterEach.
export class InMemoryMediaStorage implements MediaStorage {
  readonly objects = new Map<string, { bytes: Buffer; contentType: string }>();

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { bytes, contentType });
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }
  publicUrl(key: string): string {
    return `http://media.test/${key}`;
  }
}

// A real 1×1 transparent PNG (69 bytes) — passes byte-sniffing.
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// A real 1×1 JPEG.
export const JPEG_1PX = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8Qf//Z",
  "base64",
);

// Not an image at all.
export const NOT_AN_IMAGE = Buffer.from("this is definitely not an image file, just plain text padding.".repeat(4));

// A real 1×1 GIF (GIF89a header) — passes detectGif() byte-sniffing.
export const GIF_1PX = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

// A minimal MP4: a well-formed `ftyp` box (major brand "isom") followed by
// an empty `mdat` box. Not a playable clip, but it passes detectVideo()
// byte-sniffing exactly as the real thing would.
export const MP4_TINY = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]), // ftyp box size = 24
  Buffer.from("ftyp", "ascii"),
  Buffer.from("isom", "ascii"), // major brand
  Buffer.from([0x00, 0x00, 0x02, 0x00]), // minor version
  Buffer.from("isommp42", "ascii"), // compatible brands
  Buffer.from([0x00, 0x00, 0x00, 0x08]), // mdat box size = 8
  Buffer.from("mdat", "ascii"),
]);

// A minimal WebM: the EBML magic number followed by a DocType element
// (id 0x4282, size 4) whose value is "webm" — mirrors the real header shape
// browsers and detectVideo() key off, without a playable track.
export const WEBM_TINY = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), // EBML magic
  Buffer.from([0x42, 0x82, 0x84]), // DocType element id + size(4)
  Buffer.from("webm", "ascii"),
  Buffer.alloc(8),
]);

// Same EBML magic, but a generic Matroska DocType — a real .mkv is not a
// WebM and detectVideo() must reject it.
export const MKV_TINY = Buffer.concat([
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), // EBML magic
  Buffer.from([0x42, 0x82, 0x88]), // DocType element id + size(8)
  Buffer.from("matroska", "ascii"),
  Buffer.alloc(8),
]);

// Build a single-file multipart/form-data body for app.inject().
export function multipartFile(opts: {
  fieldName?: string;
  filename: string;
  contentType: string;
  content: Buffer;
}): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----volreptest${Math.random().toString(16).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${opts.fieldName ?? "file"}"; filename="${opts.filename}"\r\n` +
      `Content-Type: ${opts.contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, opts.content, tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}
