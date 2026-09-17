"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import { t } from "@/lib/i18n";
import type { PageSection } from "@/lib/types";
import { duplicateSection, moveSection, removeSection, setSectionAt } from "@/lib/page-studio";
import { SectionCard } from "./SectionCard";
import type { MediaCtx } from "./SectionEditors";

export function SectionList({
  sections,
  onChange,
  media,
}: {
  sections: PageSection[];
  onChange: (next: PageSection[]) => void;
  media: MediaCtx;
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
      <p className="text-xs text-slate-400">{t.studio.page.dragHint}</p>
      {sections.map((section, index) => (
        <SectionCard
          key={section.id}
          section={section}
          index={index}
          total={sections.length}
          expanded={expanded === section.id}
          onToggleExpand={() => setExpanded((cur) => (cur === section.id ? null : section.id))}
          onToggleEnabled={(enabled) => onChange(setSectionAt(sections, index, (s) => ({ ...s, enabled }) as PageSection))}
          onMoveUp={() => commitMove(index, index - 1)}
          onMoveDown={() => commitMove(index, index + 1)}
          onDuplicate={() => onChange(duplicateSection(sections, index))}
          onDelete={() => {
            if (expanded === section.id) setExpanded(null);
            onChange(removeSection(sections, index));
          }}
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
