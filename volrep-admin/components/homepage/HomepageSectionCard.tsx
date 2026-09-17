"use client";

import type { DragEvent } from "react";
import { t } from "@/lib/i18n";
import type { HomepageSection } from "@/lib/types";
import { Button, Icon, Toggle } from "@/components/ui";
import { sectionDescription, sectionLabel, sectionSummary } from "@/lib/homepage-studio";
import { HomepageSectionEditor, type HomepageMediaCtx } from "./HomepageSectionEditors";

// One row in the Homepage Studio section list. Reorder + show/hide + inline
// edit. NO duplicate, NO delete — the V1 document requires exactly the 9
// section types, each present once.
export function HomepageSectionCard({
  section,
  index,
  total,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  onChange,
  media,
  drag,
}: {
  section: HomepageSection;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChange: (section: HomepageSection) => void;
  media: HomepageMediaCtx;
  drag: {
    isDragging: boolean;
    isOver: boolean;
    onDragStart: (e: DragEvent) => void;
    onDragEnter: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onDragEnd: (e: DragEvent) => void;
  };
}) {
  const label = sectionLabel(section.type);

  return (
    <div
      onDragEnter={drag.onDragEnter}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
      className={`rounded-lg border bg-white transition-colors ${
        drag.isOver ? "border-volt ring-1 ring-volt" : "border-slate-200"
      } ${drag.isDragging ? "opacity-40" : ""} ${!section.enabled ? "bg-slate-50/60" : ""}`}
    >
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          draggable
          onDragStart={drag.onDragStart}
          onDragEnd={drag.onDragEnd}
          className="mt-0.5 shrink-0 cursor-grab rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
          aria-label={t.homepage.sections.dragHint}
          title={t.homepage.sections.dragHint}
        >
          <Icon.grip className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-800">{label}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
              {section.type}
            </span>
            {!section.enabled && (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t.homepage.sections.hiddenTag}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {sectionSummary(section) || sectionDescription(section.type)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={index === 0}
            onClick={onMoveUp}
            aria-label={t.homepage.sections.moveUp}
          >
            <Icon.arrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={index === total - 1}
            onClick={onMoveDown}
            aria-label={t.homepage.sections.moveDown}
          >
            <Icon.arrowDown className="h-3.5 w-3.5" />
          </Button>
          <Toggle
            checked={section.enabled}
            onChange={onToggleEnabled}
            label={section.enabled ? t.homepage.sections.hide : t.homepage.sections.show}
          />
          <Button size="sm" variant="ghost" onClick={onToggleExpand}>
            {expanded ? t.homepage.sections.close : t.homepage.sections.edit}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          {!section.enabled && (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
              {t.homepage.sections.hiddenNote}
            </p>
          )}
          <HomepageSectionEditor section={section} media={media} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
