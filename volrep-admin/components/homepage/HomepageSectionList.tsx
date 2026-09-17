"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import { t } from "@/lib/i18n";
import type { HomepageSection } from "@/lib/types";
import { moveSection, setSectionAt } from "@/lib/homepage-studio";
import { HomepageSectionCard } from "./HomepageSectionCard";
import type { HomepageMediaCtx } from "./HomepageSectionEditors";

export function HomepageSectionList({
  sections,
  onChange,
  media,
}: {
  sections: HomepageSection[];
  onChange: (next: HomepageSection[]) => void;
  media: HomepageMediaCtx;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const commitMove = (from: number, to: number) => {
    if (from === to) return;
    onChange(moveSection(sections, from, to));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">{t.homepage.sections.dragHint}</p>
      {sections.map((section, index) => (
        <HomepageSectionCard
          key={section.id}
          section={section}
          index={index}
          total={sections.length}
          expanded={expanded === section.id}
          onToggleExpand={() => setExpanded((cur) => (cur === section.id ? null : section.id))}
          onToggleEnabled={(enabled) =>
            onChange(setSectionAt(sections, index, (s) => ({ ...s, enabled }) as HomepageSection))
          }
          onMoveUp={() => commitMove(index, index - 1)}
          onMoveDown={() => commitMove(index, index + 1)}
          onChange={(next) => onChange(setSectionAt(sections, index, () => next))}
          media={media}
          drag={{
            isDragging: dragIndex === index,
            isOver: overIndex === index && dragIndex !== null && dragIndex !== index,
            onDragStart: (e: DragEvent) => {
              setDragIndex(index);
              e.dataTransfer.effectAllowed = "move";
              try {
                e.dataTransfer.setData("text/plain", String(index));
              } catch {
                /* some browsers require this in a try */
              }
            },
            onDragEnter: (e: DragEvent) => {
              e.preventDefault();
              setOverIndex(index);
            },
            onDragOver: (e: DragEvent) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            },
            onDrop: (e: DragEvent) => {
              e.preventDefault();
              if (dragIndex !== null) commitMove(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            },
            onDragEnd: () => {
              setDragIndex(null);
              setOverIndex(null);
            },
          }}
        />
      ))}
    </div>
  );
}
