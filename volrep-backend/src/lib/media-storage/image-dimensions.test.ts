import { describe, expect, it } from "vitest";
import { readImageDimensions, assertImageDimensionsWithinLimits } from "./image-dimensions.js";
import { PNG_1PX, JPEG_1PX, GIF_1PX } from "../../test/media.js";

// --- header-only fixture builders (never a real encoder) --------------
function be32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}
function le16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff);
  return b;
}
function le24(n: number): Buffer {
  return Buffer.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]);
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fakePng(width: number, height: number): Buffer {
  return Buffer.concat([
    PNG_SIG,
    be32(13),
    Buffer.from("IHDR"),
    be32(width),
    be32(height),
    Buffer.from([8, 6, 0, 0, 0]), // bit depth, colour type, …
    be32(0), // CRC (unchecked)
    Buffer.from("\x00\x00\x00\x00IEND"),
  ]);
}

function fakeGif(width: number, height: number): Buffer {
  return Buffer.concat([Buffer.from("GIF89a"), le16(width), le16(height), Buffer.from([0xf7, 0x00, 0x00])]);
}

function fakeJpeg(width: number, height: number): Buffer {
  const h = Buffer.alloc(2);
  h.writeUInt16BE(height);
  const w = Buffer.alloc(2);
  w.writeUInt16BE(width);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]),
    h,
    w,
    Buffer.from([0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function fakeWebpVP8X(width: number, height: number): Buffer {
  return Buffer.concat([
    Buffer.from("RIFF"),
    be32(26),
    Buffer.from("WEBP"),
    Buffer.from("VP8X"),
    Buffer.from([10, 0, 0, 0]), // chunk size (LE)
    Buffer.from([0x10, 0, 0, 0]), // flags + reserved
    le24(width - 1),
    le24(height - 1),
  ]);
}

describe("readImageDimensions", () => {
  it("reads PNG / GIF / JPEG / WebP headers", () => {
    expect(readImageDimensions(fakePng(1234, 5678), "png")).toEqual({ width: 1234, height: 5678 });
    expect(readImageDimensions(fakeGif(640, 480), "gif")).toEqual({ width: 640, height: 480 });
    expect(readImageDimensions(fakeJpeg(1920, 1080), "jpg")).toEqual({ width: 1920, height: 1080 });
    expect(readImageDimensions(fakeWebpVP8X(800, 600), "webp")).toEqual({ width: 800, height: 600 });
  });

  it("returns null for an unreadable header (caller falls back to the byte cap)", () => {
    expect(readImageDimensions(Buffer.from("not an image"), "webp")).toBeNull();
    expect(readImageDimensions(Buffer.alloc(4), "png")).toBeNull();
  });
});

describe("assertImageDimensionsWithinLimits", () => {
  // test env leaves defaults: MAX_PIXELS=40_000_000, MAX_DIMENSION=12_000

  it("passes real 1×1 fixtures untouched", () => {
    expect(() => assertImageDimensionsWithinLimits(PNG_1PX, "png")).not.toThrow();
    expect(() => assertImageDimensionsWithinLimits(JPEG_1PX, "jpg")).not.toThrow();
    expect(() => assertImageDimensionsWithinLimits(GIF_1PX, "gif")).not.toThrow();
  });

  it("passes a normal large product photo (4000×3000 = 12 MP)", () => {
    expect(() => assertImageDimensionsWithinLimits(fakePng(4000, 3000), "png")).not.toThrow();
  });

  it("rejects an over-dimension image (13000 px on a side)", () => {
    expect(() => assertImageDimensionsWithinLimits(fakePng(13000, 10), "png")).toThrow(/trop grande/i);
  });

  it("rejects an over-pixel-budget image (8000×6000 = 48 MP, each side under the limit)", () => {
    expect(() => assertImageDimensionsWithinLimits(fakeJpeg(8000, 6000), "jpg")).toThrow(/trop lourde/i);
  });

  it("rejects a classic decompression-bomb GIF (20000×20000)", () => {
    expect(() => assertImageDimensionsWithinLimits(fakeGif(20000, 20000), "gif")).toThrow();
  });

  it("allows a file whose header cannot be parsed (byte-size cap is the backstop)", () => {
    expect(() => assertImageDimensionsWithinLimits(Buffer.from("xxxx"), "webp")).not.toThrow();
  });
});
