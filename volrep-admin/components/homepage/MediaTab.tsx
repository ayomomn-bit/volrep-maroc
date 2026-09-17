"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { homepageApi } from "@/lib/homepage-api";
import { useToast } from "@/components/Toast";
import { t } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import type { SiteMediaAsset } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DropZone,
  EmptyState,
  Icon,
  InlineError,
  LoadingBlock,
} from "@/components/ui";

// The Homepage Studio media library. site_media ONLY — this component never
// calls a product media endpoint and product gallery images never appear
// here. The asset list is owned by <HomepageStudio> (one fetch, shared with
// the section media pickers and the overview count).
export function MediaTab({
  assets,
  loading,
  error,
  reload,
}: {
  assets: SiteMediaAsset[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SiteMediaAsset | null>(null);

  async function doUpload(file: File) {
    setUploadErr(null);
    setUploading(true);
    try {
      const res = await homepageApi.uploadMedia(file);
      toast.success(res.deduped ? t.homepage.media.deduped : t.homepage.media.uploaded);
      reload();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t.homepage.media.uploadError;
      setUploadErr(msg);
      toast.error(t.homepage.media.uploadError, msg);
    } finally {
      setUploading(false);
    }
  }

  async function doDelete(asset: SiteMediaAsset) {
    setPending(true);
    try {
      await homepageApi.deleteMedia(asset.id);
      toast.success(t.homepage.media.deleted);
      reload();
    } catch (e) {
      toast.error(t.homepage.media.deleteError, e instanceof ApiError ? e.message : undefined);
    } finally {
      setPending(false);
      setConfirmDelete(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title={t.homepage.media.libraryTitle}
        description={t.homepage.media.librarySubtitle}
        action={
          assets.length > 0 ? (
            <span className="text-xs text-slate-400">{t.homepage.media.count(assets.length)}</span>
          ) : undefined
        }
      />

      <div className="space-y-4 px-4 py-4">
        <p className="rounded-md border border-slate-200 bg-[#e9f2fd] px-3 py-2 text-[11px] text-slate-600">
          {t.homepage.media.separationNote}
        </p>

        <DropZone
          onFile={doUpload}
          uploading={uploading}
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4"
          hint={t.homepage.media.uploadHint}
        />
        <InlineError message={uploadErr} />

        {loading && assets.length === 0 ? (
          <LoadingBlock />
        ) : error ? (
          <InlineError message={error} />
        ) : assets.length === 0 ? (
          <EmptyState title={t.homepage.media.empty} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {assets.map((asset) => (
              <li key={asset.id} className="flex gap-3 rounded-md border border-slate-200 p-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-slate-900/5 ring-1 ring-slate-200">
                  {asset.mediaType === "video" ? (
                    <span className="flex h-full w-full items-center justify-center bg-slate-900 text-white">▶</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt={asset.altText} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <Badge
                    tone={asset.mediaType === "video" ? "info" : asset.mediaType === "gif" ? "accent" : "neutral"}
                  >
                    {asset.mediaType === "video"
                      ? t.homepage.media.isVideo
                      : asset.mediaType === "gif"
                        ? t.homepage.media.isGif
                        : t.homepage.media.isImage}
                  </Badge>
                  <p className="truncate text-[12px] font-medium text-slate-700">
                    {asset.originalFilename || asset.altText || asset.id}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {asset.width && asset.height
                      ? `${t.homepage.media.dimensions(asset.width, asset.height)} · `
                      : ""}
                    {t.homepage.media.sizeKb(Math.round(asset.byteSize / 1024))}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {t.homepage.media.uploadedOn(formatDateShort(asset.createdAt))}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 self-start text-red-600"
                  disabled={pending}
                  onClick={() => setConfirmDelete(asset)}
                >
                  <Icon.trash className="h-3.5 w-3.5" /> {t.homepage.media.delete}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t.homepage.media.deleteTitle}
        body={t.homepage.media.deleteBody}
        danger
        confirmLabel={t.homepage.media.delete}
        loading={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void doDelete(confirmDelete);
        }}
      />
    </Card>
  );
}
