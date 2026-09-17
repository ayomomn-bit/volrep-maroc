"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { t } from "@/lib/i18n";
import type { PageMediaSlot, ProductImage } from "@/lib/types";
import { ACCEPT_IMAGE, Button, DropZone, Field, InlineError, Modal, TextInput } from "@/components/ui";

// Reuses the existing 7C-2 media pipeline — it never introduces a second
// media store. A slot is one of:
//   - placeholder : the storefront renders the ".lp-ph — visuel à venir" box
//   - image       : an id of a product_images row (uploaded / owned) — always
//                   an image
//   - url         : a section-scoped uploaded asset (image OR MP4) or an
//                   external URL. `mediaType` says which.
//
// `allowGif` lets the picker accept an animated GIF; `allowVideo` (UGC
// "Vidéos clients" cards) additionally accepts a browser-playable MP4. Every
// uploaded asset is stored on the same content-addressed media storage as an
// image and referenced by URL — it is NEVER written to product_images, so it
// can never appear in the product gallery, and re-using the same file in
// several sections never duplicates the physical object.

const ACCEPT_GIF = "image/gif";
const ACCEPT_MP4 = "video/mp4";

function acceptFor(allowGif?: boolean, allowVideo?: boolean): string {
  return [ACCEPT_IMAGE, allowGif && ACCEPT_GIF, allowVideo && ACCEPT_MP4].filter(Boolean).join(",");
}

function emptyPlaceholder(label: string): PageMediaSlot {
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
    const path = new URL(url, "http://x").pathname;
    return decodeURIComponent(path.split("/").pop() ?? "");
  } catch {
    return "";
  }
}

function isVideoSlot(slot: PageMediaSlot): boolean {
  return slot.kind === "url" && slot.mediaType === "video" && !!slot.url;
}

function isGifSlot(slot: PageMediaSlot): boolean {
  return slot.kind === "url" && slot.mediaType === "gif" && !!slot.url;
}

export function MediaField({
  slot,
  onChange,
  productId,
  images,
  withPoster,
  label,
  hint,
  allowVideo,
  allowGif,
}: {
  slot: PageMediaSlot;
  onChange: (next: PageMediaSlot) => void;
  productId: string;
  images: ProductImage[];
  withPoster?: boolean;
  label?: string;
  hint?: string;
  allowVideo?: boolean;
  allowGif?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentImage = slot.kind === "image" && slot.imageId ? images.find((i) => i.id === slot.imageId) : undefined;
  const video = isVideoSlot(slot);
  const gif = isGifSlot(slot);
  const filled = slot.kind !== "placeholder" && (!!slot.url || !!currentImage);

  return (
    <Field label={label ?? t.studio.page.media.current} hint={hint}>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50/60 p-2.5">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-slate-900/5 ring-1 ring-slate-200">
          {!filled ? (
            <div className="flex h-full w-full items-center justify-center bg-[#e9f2fd] px-1 text-center text-[8px] font-bold uppercase leading-tight tracking-wider text-slate-500">
              {slot.placeholderLabel || "—"}
            </div>
          ) : video ? (
            <>
              <video
                src={slot.url}
                poster={slot.poster || undefined}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <span className="text-[13px] leading-none text-white drop-shadow">▶</span>
              </div>
            </>
          ) : gif ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slot.url} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[7px] font-bold uppercase leading-[1.4] tracking-wide text-white">
                {t.studio.page.media.gifBadge}
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentImage?.url ?? slot.url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-slate-700">
            {slot.kind === "placeholder"
              ? t.studio.page.media.placeholder
              : video
                ? t.studio.page.media.isVideo
                : gif
                  ? t.studio.page.media.isGif
                  : slot.kind === "image"
                    ? t.studio.page.media.fromImage
                    : t.studio.page.media.fromUrl}
          </p>
          <p className="truncate text-[11px] text-slate-400">
            {slot.kind === "image"
              ? (currentImage?.altText ?? currentImage?.url ?? slot.imageId ?? "—")
              : slot.kind === "url"
                ? slot.fileName || fileNameFromUrl(slot.url) || slot.url || "—"
                : slot.placeholderLabel || "—"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {!filled
              ? allowVideo
                ? t.studio.page.media.chooseVideo
                : t.studio.page.media.choose
              : t.studio.page.media.replace}
          </Button>
          {filled && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600"
              onClick={() => onChange(emptyPlaceholder(slot.placeholderLabel))}
            >
              {t.studio.page.media.remove}
            </Button>
          )}
        </div>
      </div>

      {withPoster && slot.kind === "url" && (
        <div className="mt-2">
          <Field label={t.studio.page.fields.posterUrl}>
            <TextInput
              value={slot.poster}
              placeholder={t.studio.page.media.urlPlaceholder}
              onChange={(e) => onChange({ ...slot, poster: e.target.value })}
            />
          </Field>
        </div>
      )}

      {open && (
        <MediaPickerModal
          slot={slot}
          productId={productId}
          images={images}
          allowVideo={allowVideo}
          allowGif={allowGif}
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

type PickerTab = "product" | "url" | "upload" | "none";

function MediaPickerModal({
  slot,
  productId,
  images,
  allowVideo,
  allowGif,
  onClose,
  onPick,
}: {
  slot: PageMediaSlot;
  productId: string;
  images: ProductImage[];
  allowVideo?: boolean;
  allowGif?: boolean;
  onClose: () => void;
  onPick: (slot: PageMediaSlot) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<PickerTab>(slot.kind === "url" ? "url" : "product");
  const [url, setUrl] = useState(slot.kind === "url" ? slot.url : "");
  const [alt, setAlt] = useState(slot.alt);
  const [phLabel, setPhLabel] = useState(slot.placeholderLabel);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const tabs: { key: PickerTab; label: string }[] = [
    { key: "product", label: t.studio.page.media.tabProduct },
    { key: "url", label: t.studio.page.media.tabUrl },
    { key: "upload", label: t.studio.page.media.tabUpload },
    { key: "none", label: t.studio.page.media.tabNone },
  ];

  async function doUpload(file: File) {
    setUploadErr(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // Section-scoped upload: stored on media storage and referenced by
      // URL. It is NOT added to product_images / the product gallery — the
      // "Médias" tab (POST .../media) is the only way to do that. The server
      // sniffs the bytes and tells us whether it stored an image or a video.
      const res = await api.upload<{ url: string; mediaType?: "image" | "video" | "gif" }>(
        `/api/admin/products/${productId}/page/media`,
        form,
      );
      toast.success(t.studio.page.media.uploadSuccess);
      onPick({
        kind: "url",
        imageId: null,
        url: res.url,
        poster: slot.poster,
        alt: slot.alt,
        placeholderLabel: slot.placeholderLabel,
        mediaType: res.mediaType ?? "image",
        fileName: file.name,
      });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.studio.page.media.uploadError;
      setUploadErr(msg);
      toast.error(t.studio.page.media.uploadError, msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t.studio.page.media.pickerTitle} size="lg" busy={uploading}>
      <div className="space-y-4">
        <p className="rounded-md bg-[#e9f2fd] px-3 py-2 text-[11px] text-slate-600">
          {t.studio.page.media.sectionOnlyNote}
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

        {tab === "product" &&
          (images.length === 0 ? (
            <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
              {t.studio.page.media.noProductImages}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((img) => {
                const on = slot.kind === "image" && slot.imageId === img.id;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() =>
                      onPick({
                        kind: "image",
                        imageId: img.id,
                        url: "",
                        poster: slot.poster,
                        alt: img.altText ?? "",
                        placeholderLabel: slot.placeholderLabel,
                        mediaType: "image",
                        fileName: "",
                      })
                    }
                    className={`relative overflow-hidden rounded-md ring-2 ${
                      on ? "ring-volt" : "ring-transparent hover:ring-slate-300"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.altText ?? ""} className="aspect-square w-full object-cover" />
                  </button>
                );
              })}
            </div>
          ))}

        {tab === "url" && (
          <div className="space-y-3">
            <Field
              label={t.studio.page.media.fromUrl}
              hint={
                allowVideo
                  ? t.studio.page.media.urlHintVideo
                  : allowGif
                    ? t.studio.page.media.urlHintGif
                    : t.studio.page.media.urlHint
              }
            >
              <TextInput value={url} placeholder={t.studio.page.media.urlPlaceholder} onChange={(e) => setUrl(e.target.value)} />
            </Field>
            <Field label={t.studio.page.media.altText}>
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
                  mediaType: allowVideo && isMp4 ? "video" : allowGif && isGif ? "gif" : "image",
                  fileName: fileNameFromUrl(clean),
                });
              }}
            >
              {t.studio.page.media.select}
            </Button>
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-3">
            <DropZone
              onFile={doUpload}
              uploading={uploading}
              accept={acceptFor(allowGif, allowVideo)}
              hint={
                allowVideo
                  ? t.studio.page.media.uploadHintVideo
                  : allowGif
                    ? t.studio.page.media.uploadHintGif
                    : t.studio.page.media.uploadHint
              }
            />
            <InlineError message={uploadErr} />
          </div>
        )}

        {tab === "none" && (
          <div className="space-y-3">
            <Field label={t.studio.page.media.placeholderLabel}>
              <TextInput value={phLabel} onChange={(e) => setPhLabel(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={() => onPick(emptyPlaceholder(phLabel))}>
              {t.studio.page.media.select}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
