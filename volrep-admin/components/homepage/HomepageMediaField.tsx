"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { homepageApi } from "@/lib/homepage-api";
import { useToast } from "@/components/Toast";
import { t } from "@/lib/i18n";
import type { HomepageMediaSlot, SiteMediaAsset } from "@/lib/types";
import { Button, DropZone, Field, InlineError, Modal, TextInput } from "@/components/ui";

// A media position on the homepage. It resolves ONLY against `site_media`:
//   - placeholder : the storefront renders the section's empty-state
//   - image       : an id of a `site_media` row (uploaded through the
//                   Homepage Studio media library) — NEVER product_images
//   - url         : an external / pasted URL (existing Shopify CDN URLs keep
//                   working); `mediaType` says image / gif / video
//
// This component never calls a product media endpoint and never shows a
// product gallery image.

const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,image/avif";
const ACCEPT_GIF = "image/gif";
const ACCEPT_MP4 = "video/mp4";

function acceptFor(allowGif?: boolean, allowVideo?: boolean): string {
  return [ACCEPT_IMAGE, allowGif !== false && ACCEPT_GIF, allowVideo && ACCEPT_MP4]
    .filter(Boolean)
    .join(",");
}

function emptyPlaceholder(label: string): HomepageMediaSlot {
  return {
    kind: "placeholder",
    imageId: null,
    url: "",
    poster: "",
    alt: "",
    placeholderLabel: label,
    mediaType: "image",
    fileName: "",
  };
}

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url, "http://x").pathname.split("/").pop() ?? "");
  } catch {
    return "";
  }
}

function resolvedUrl(slot: HomepageMediaSlot, assets: SiteMediaAsset[]): string {
  if (slot.kind === "image" && slot.imageId) {
    return assets.find((a) => a.id === slot.imageId)?.url ?? slot.url;
  }
  return slot.url;
}

export function HomepageMediaField({
  slot,
  onChange,
  assets,
  onUploaded,
  label,
  hint,
  allowGif,
  allowVideo,
}: {
  slot: HomepageMediaSlot;
  onChange: (next: HomepageMediaSlot) => void;
  assets: SiteMediaAsset[];
  onUploaded: () => void;
  label?: string;
  hint?: string;
  allowGif?: boolean;
  allowVideo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const url = resolvedUrl(slot, assets);
  const filled = slot.kind !== "placeholder" && !!url;
  const isVideo = slot.mediaType === "video";
  const isGif = slot.mediaType === "gif";

  return (
    <Field label={label ?? t.homepage.media.current} hint={hint}>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50/60 p-2.5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-slate-900/5 ring-1 ring-slate-200">
          {!filled ? (
            <div className="flex h-full w-full items-center justify-center bg-[#e9f2fd] px-1 text-center text-[8px] font-bold uppercase leading-tight tracking-wider text-slate-500">
              {slot.placeholderLabel || "—"}
            </div>
          ) : isVideo ? (
            <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white">▶</div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-slate-700">
            {slot.kind === "placeholder"
              ? t.homepage.media.placeholder
              : isVideo
                ? t.homepage.media.isVideo
                : isGif
                  ? t.homepage.media.isGif
                  : slot.kind === "image"
                    ? t.homepage.media.fromLibrary
                    : t.homepage.media.fromUrl}
          </p>
          <p className="truncate text-[11px] text-slate-400">
            {slot.kind === "image"
              ? (slot.fileName || slot.alt || slot.imageId || "—")
              : slot.kind === "url"
                ? slot.fileName || fileNameFromUrl(slot.url) || slot.url || "—"
                : slot.placeholderLabel || "—"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {filled ? t.homepage.media.replace : t.homepage.media.choose}
          </Button>
          {filled && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600"
              onClick={() => onChange(emptyPlaceholder(slot.placeholderLabel))}
            >
              {t.homepage.media.remove}
            </Button>
          )}
        </div>
      </div>

      {slot.kind !== "placeholder" && (
        <div className="mt-2">
          <Field label={t.homepage.fields.altText}>
            <TextInput
              value={slot.alt}
              onChange={(e) => onChange({ ...slot, alt: e.target.value })}
            />
          </Field>
        </div>
      )}

      {open && (
        <HomepagePickerModal
          slot={slot}
          assets={assets}
          allowGif={allowGif}
          allowVideo={allowVideo}
          onUploaded={onUploaded}
          onClose={() => setOpen(false)}
          onPick={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      )}
    </Field>
  );
}

type PickerTab = "library" | "url" | "upload" | "none";

function HomepagePickerModal({
  slot,
  assets,
  allowGif,
  allowVideo,
  onUploaded,
  onClose,
  onPick,
}: {
  slot: HomepageMediaSlot;
  assets: SiteMediaAsset[];
  allowGif?: boolean;
  allowVideo?: boolean;
  onUploaded: () => void;
  onClose: () => void;
  onPick: (slot: HomepageMediaSlot) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<PickerTab>(slot.kind === "url" ? "url" : "library");
  const [url, setUrl] = useState(slot.kind === "url" ? slot.url : "");
  const [alt, setAlt] = useState(slot.alt);
  const [phLabel, setPhLabel] = useState(slot.placeholderLabel);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const tabs: { key: PickerTab; label: string }[] = [
    { key: "library", label: t.homepage.media.tabLibrary },
    { key: "url", label: t.homepage.media.tabUrl },
    { key: "upload", label: t.homepage.media.tabUpload },
    { key: "none", label: t.homepage.media.tabNone },
  ];

  function pickAsset(asset: SiteMediaAsset) {
    onPick({
      kind: "image",
      imageId: asset.id,
      url: "",
      poster: slot.poster,
      alt: slot.alt || asset.altText,
      placeholderLabel: slot.placeholderLabel,
      mediaType:
        asset.mediaType === "video" ? "video" : asset.mediaType === "gif" ? "gif" : "image",
      fileName: asset.originalFilename,
    });
  }

  async function doUpload(file: File) {
    setUploadErr(null);
    setUploading(true);
    try {
      // Site-media upload ONLY. Never a product endpoint.
      const res = await homepageApi.uploadMedia(file);
      toast.success(res.deduped ? t.homepage.media.deduped : t.homepage.media.uploaded);
      onUploaded();
      pickAsset(res.media);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.homepage.media.uploadError;
      setUploadErr(msg);
      toast.error(t.homepage.media.uploadError, msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.homepage.media.pickerTitle} size="lg" busy={uploading}>
      <div className="space-y-4">
        <p className="rounded-md bg-[#e9f2fd] px-3 py-2 text-[11px] text-slate-600">
          {t.homepage.media.pickerNote}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${
                tab === tb.key ? "bg-volt text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === "library" &&
          (assets.length === 0 ? (
            <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
              {t.homepage.media.libraryEmpty}
            </p>
          ) : (
            <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {assets.map((asset) => {
                const on = slot.kind === "image" && slot.imageId === asset.id;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => pickAsset(asset)}
                    className={`relative overflow-hidden rounded-md ring-2 ${
                      on ? "ring-volt" : "ring-transparent hover:ring-slate-300"
                    }`}
                  >
                    {asset.mediaType === "video" ? (
                      <span className="flex aspect-square w-full items-center justify-center bg-slate-900 text-white">
                        ▶
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.url} alt={asset.altText} className="aspect-square w-full object-cover" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

        {tab === "url" && (
          <div className="space-y-3">
            <Field label={t.homepage.media.fromUrl} hint={t.homepage.media.urlHint}>
              <TextInput
                value={url}
                placeholder={t.homepage.media.urlPlaceholder}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field>
            <Field label={t.homepage.fields.altText}>
              <TextInput value={alt} onChange={(e) => setAlt(e.target.value)} />
            </Field>
            <Button
              variant="primary"
              disabled={!url.trim()}
              onClick={() => {
                const clean = url.trim();
                const isMp4 = /\.mp4(\?|#|$)/i.test(clean);
                const isGif = /\.gif(\?|#|$)/i.test(clean);
                onPick({
                  kind: "url",
                  imageId: null,
                  url: clean,
                  poster: slot.poster,
                  alt: alt.trim(),
                  placeholderLabel: slot.placeholderLabel,
                  mediaType: allowVideo && isMp4 ? "video" : allowGif !== false && isGif ? "gif" : "image",
                  fileName: fileNameFromUrl(clean),
                });
              }}
            >
              {t.homepage.media.select}
            </Button>
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-3">
            <DropZone
              onFile={doUpload}
              uploading={uploading}
              accept={acceptFor(allowGif, allowVideo)}
              hint={t.homepage.media.uploadHint}
            />
            <InlineError message={uploadErr} />
          </div>
        )}

        {tab === "none" && (
          <div className="space-y-3">
            <Field label={t.homepage.media.placeholderLabel}>
              <TextInput value={phLabel} onChange={(e) => setPhLabel(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={() => onPick(emptyPlaceholder(phLabel))}>
              {t.homepage.media.select}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
