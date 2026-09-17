"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import { t } from "@/lib/i18n";
import type { PageSection } from "@/lib/types";
import { Button, ConfirmDialog, Icon, Toggle } from "@/components/ui";
import { sectionDescription, sectionLabel, sectionSummary } from "@/lib/page-studio";
import { SectionEditor, type MediaCtx } from "./SectionEditors";

export function SectionCard({
  section,
  index,
  total,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onChange,
  media,
  drag,
}: {
  section: PageSection;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onChange: (section: PageSection) => void;
  media: MediaCtx;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
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
          aria-label={t.studio.page.dragHint}
          title={t.studio.page.dragHint}
        >
          <Icon.grip className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-800">{label}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{section.type}</span>
            {!section.enabled && (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t.studio.page.hiddenTag}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">{sectionSummary(section) || sectionDescription(section.type)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" disabled={index === 0} onClick={onMoveUp} aria-label={t.studio.page.moveUp}>
            <Icon.arrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" disabled={index === total - 1} onClick={onMoveDown} aria-label={t.studio.page.moveDown}>
            <Icon.arrowDown className="h-3.5 w-3.5" />
          </Button>
          <Toggle checked={section.enabled} onChange={onToggleEnabled} label={section.enabled ? t.studio.page.hide : t.studio.page.show} />
          <Button size="sm" variant="ghost" onClick={onToggleExpand}>
            {expanded ? t.studio.page.close : t.studio.page.edit}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4">
          <SectionEditor section={section} media={media} onChange={onChange} />
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Button size="sm" variant="secondary" onClick={onDuplicate}>
              <Icon.plus className="h-3.5 w-3.5" /> {t.studio.page.duplicate}
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}>
              <Icon.trash className="h-3.5 w-3.5" /> {t.studio.page.delete}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t.studio.page.deleteConfirmTitle}
        body={t.studio.page.deleteConfirmBody(label)}
        danger
        confirmLabel={t.studio.page.delete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
      />
    </div>
  );
}
