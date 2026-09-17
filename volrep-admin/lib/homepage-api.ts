import { api } from "@/lib/api";
import type {
  HomepagePreviewToken,
  HomepageResponse,
  HomepageSection,
  SiteMediaListResponse,
  SiteMediaUploadResponse,
} from "@/lib/types";
import { toHomepageDocument } from "@/lib/homepage-studio";

// The one place Homepage Studio talks to the backend. Extracted from the
// components so the endpoint paths / payloads are unit-testable.
//
// SECURITY / ARCHITECTURE: media goes EXCLUSIVELY to the site-media
// endpoints (/api/admin/homepage/media). It never touches
// /api/admin/products/:id/media — a homepage upload can never land in a
// product gallery.
export const HOMEPAGE_PATH = "/api/admin/homepage";
export const HOMEPAGE_MEDIA_PATH = "/api/admin/homepage/media";

export const homepageApi = {
  get: () => api.get<HomepageResponse>(HOMEPAGE_PATH),

  saveDraft: (sections: HomepageSection[]) =>
    api.put<HomepageResponse>(HOMEPAGE_PATH, { document: toHomepageDocument(sections) }),

  publish: () => api.post<HomepageResponse>(`${HOMEPAGE_PATH}/publish`),

  revert: () => api.post<HomepageResponse>(`${HOMEPAGE_PATH}/revert`),

  previewToken: () => api.post<HomepagePreviewToken>(`${HOMEPAGE_PATH}/preview-token`),

  listMedia: () => api.get<SiteMediaListResponse>(HOMEPAGE_MEDIA_PATH),

  uploadMedia: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<SiteMediaUploadResponse>(HOMEPAGE_MEDIA_PATH, form);
  },

  deleteMedia: (id: string) =>
    api.del<{ deleted: true; id: string }>(`${HOMEPAGE_MEDIA_PATH}/${encodeURIComponent(id)}`),
};
