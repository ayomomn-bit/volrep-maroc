import { describe, expect, it } from "vitest";
import { detectImage, detectGif, detectVideo } from "./image-detect.js";
import { PNG_1PX, JPEG_1PX, GIF_1PX, MP4_TINY, NOT_AN_IMAGE } from "../../test/media.js";

// Security hardening — Step 3 §2 / §7 / §10.
// The bytes decide the type. Filename and Content-Type are never consulted
// by these functions.

describe("detectImage — magic bytes only", () => {
  it("accepts real JPEG and PNG", () => {
    expect(detectImage(JPEG_1PX)).toEqual({ contentType: "image/jpeg", ext: "jpg" });
    expect(detectImage(PNG_1PX)).toEqual({ contentType: "image/png", ext: "png" });
  });

  it("accepts a real WebP header", () => {
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0x1a, 0, 0, 0]),
      Buffer.from("WEBP"),
      Buffer.from("VP8 "),
      Buffer.alloc(10),
    ]);
    expect(detectImage(webp)).toEqual({ contentType: "image/webp", ext: "webp" });
  });

  it("rejects HTML that is named like an image (no image magic)", () => {
    const html = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>' + " ".repeat(40));
    expect(detectImage(html)).toBeNull();
  });

  it("rejects an SVG document (SVG is never an accepted upload type)", () => {
    const svg = Buffer.from(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(detectImage(svg)).toBeNull();
    expect(detectGif(svg)).toBeNull();
    expect(detectVideo(svg)).toBeNull();
  });

  it("rejects plain bytes", () => {
    expect(detectImage(NOT_AN_IMAGE)).toBeNull();
  });

  it("does not misclassify a GIF as a still image (gallery stays GIF-free)", () => {
    expect(detectImage(GIF_1PX)).toBeNull();
  });
});

describe("detectGif — magic bytes only", () => {
  it("accepts GIF87a and GIF89a", () => {
    expect(detectGif(Buffer.concat([Buffer.from("GIF87a"), Buffer.alloc(10)]))).toEqual({
      contentType: "image/gif",
      ext: "gif",
    });
    expect(detectGif(GIF_1PX)).toEqual({ contentType: "image/gif", ext: "gif" });
  });

  it("rejects a PNG renamed to .gif (bytes are PNG, not GIF)", () => {
    expect(detectGif(PNG_1PX)).toBeNull();
  });

  it("accepts a GIF/HTML polyglot as a GIF (valid GIF magic) — it is served image/gif + nosniff", () => {
    const polyglot = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(6), Buffer.from("<html><script>alert(1)</script>")]);
    expect(detectGif(polyglot)).toEqual({ contentType: "image/gif", ext: "gif" });
  });
});

describe("detectVideo — MP4 signature + structure", () => {
  it("accepts a well-formed ftyp+mdat MP4", () => {
    expect(detectVideo(MP4_TINY)).toEqual({ contentType: "video/mp4", ext: "mp4" });
  });

  it("rejects an arbitrary file that merely starts with 'ftypisom' then garbage", () => {
    const fake = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]),
      Buffer.from("ftypisom"),
      Buffer.from([0, 0, 2, 0]),
      Buffer.from("isommp42"),
      Buffer.from("\x7fELF\x02\x01\x01\x00 not a box at all"), // where a box type should be
    ]);
    expect(detectVideo(fake)).toBeNull();
  });

  it("rejects an ftyp box whose declared size lies past the end of the file", () => {
    const lying = Buffer.concat([Buffer.from([0, 0, 1, 0]), Buffer.from("ftypisom"), Buffer.alloc(16)]); // size 256, file 28
    expect(detectVideo(lying)).toBeNull();
  });

  it("rejects AVIF / HEIF (ISO-BMFF but not a video)", () => {
    const avif = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypavif"), Buffer.alloc(16)]);
    expect(detectVideo(avif)).toBeNull();
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(16)]);
    expect(detectVideo(heic)).toBeNull();
  });

  it("rejects an unknown major brand", () => {
    const weird = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypXXXX"), Buffer.from("moovmdat")]);
    expect(detectVideo(weird)).toBeNull();
  });
});
