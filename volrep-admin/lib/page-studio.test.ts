import { describe, expect, it } from "vitest";
import type { PageSection } from "@/lib/types";
import {
  SECTION_META,
  SECTION_ORDER,
  duplicateSection,
  moveSection,
  nextSectionId,
  removeSection,
  sectionSummary,
  setSectionAt,
} from "@/lib/page-studio";

const mk = (id: string): PageSection =>
  ({ id, type: "stickyCta", enabled: true, data: { label: id } }) as PageSection;

describe("page-studio helpers", () => {
  it("has metadata for every section in SECTION_ORDER", () => {
    for (const type of SECTION_ORDER) {
      expect(SECTION_META[type]).toBeTruthy();
      expect(SECTION_META[type].label.length).toBeGreaterThan(0);
    }
    expect(SECTION_ORDER).toHaveLength(15);
    expect(SECTION_ORDER[0]).toBe("hero");
    expect(SECTION_ORDER[SECTION_ORDER.length - 1]).toBe("stickyCta");
  });

  it("moveSection reorders without mutating the input", () => {
    const list = [mk("a"), mk("b"), mk("c")];
    const moved = moveSection(list, 0, 2);
    expect(moved.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(list.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("moveSection is a no-op for out-of-range / equal indices", () => {
    const list = [mk("a"), mk("b")];
    expect(moveSection(list, 0, 0)).toBe(list);
    expect(moveSection(list, 0, 5)).toBe(list);
    expect(moveSection(list, -1, 1)).toBe(list);
  });

  it("nextSectionId avoids collisions", () => {
    const list = [mk("hero"), mk("hero-2")];
    expect(nextSectionId("hero", list)).toBe("hero-3");
  });

  it("duplicateSection deep-copies with a fresh id, inserted after", () => {
    const list: PageSection[] = [
      { id: "hero", type: "hero", enabled: true, data: { subtitle: "x" } } as PageSection,
      mk("stickyCta"),
    ];
    const dup = duplicateSection(list, 0);
    expect(dup.map((s) => s.id)).toEqual(["hero", "hero-2", "stickyCta"]);
    // mutating the clone's data must not touch the original
    (dup[1] as { data: { subtitle: string } }).data.subtitle = "changed";
    expect((dup[0] as { data: { subtitle: string } }).data.subtitle).toBe("x");
  });

  it("removeSection / setSectionAt are pure", () => {
    const list = [mk("a"), mk("b"), mk("c")];
    expect(removeSection(list, 1).map((s) => s.id)).toEqual(["a", "c"]);
    const toggled = setSectionAt(list, 1, (s) => ({ ...s, enabled: false }));
    expect(toggled[1]!.enabled).toBe(false);
    expect(list[1]!.enabled).toBe(true);
  });

  it("sectionSummary returns a non-crashing string per type", () => {
    const faq: PageSection = {
      id: "faq",
      type: "faq",
      enabled: true,
      data: { heading: "Q", defaultOpen: 0, items: [{ question: "a", answer: "b" }] },
    };
    expect(sectionSummary(faq)).toContain("1");
  });
});
