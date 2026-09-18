import { describe, expect, it } from "vitest";
import { posterSeekTime, posterSize } from "@/lib/video-poster";

describe("posterSeekTime", () => {
  it("uses ~0.1s for a normal clip", () => {
    expect(posterSeekTime(8.27)).toBe(0.1);
  });

  it("never seeks past the middle of a very short clip", () => {
    expect(posterSeekTime(0.12)).toBeCloseTo(0.06);
    expect(posterSeekTime(0.04)).toBeCloseTo(0.02);
  });

  it("stays on the first frame when the duration is unknown or zero", () => {
    expect(posterSeekTime(0)).toBe(0);
    expect(posterSeekTime(NaN)).toBe(0);
    expect(posterSeekTime(Infinity)).toBe(0);
  });
});

describe("posterSize", () => {
  it("scales a 720x1080 UGC clip to 360 wide, keeping the aspect ratio", () => {
    expect(posterSize(720, 1080)).toEqual({ width: 360, height: 540 });
  });

  it("never upscales a smaller video", () => {
    expect(posterSize(240, 320)).toEqual({ width: 240, height: 320 });
  });

  it("returns null when the video has no decoded dimensions", () => {
    expect(posterSize(0, 0)).toBeNull();
    expect(posterSize(720, 0)).toBeNull();
  });
});
