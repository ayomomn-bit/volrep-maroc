import { env } from "../../config/env.js";
import { LocalMediaStorage } from "./local.js";
import type { MediaStorage } from "./types.js";

export type { MediaStorage } from "./types.js";

let instance: MediaStorage | null = null;

// Lazily builds the configured driver. Add the S3 driver here — the media
// service and every route stay untouched.
export function getMediaStorage(): MediaStorage {
  if (instance) return instance;

  switch (env.MEDIA_STORAGE_DRIVER) {
    case "local":
      instance = new LocalMediaStorage({
        dir: env.MEDIA_LOCAL_DIR,
        publicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      });
      break;
    case "s3":
      // Not implemented in 7C-2 — the adapter interface is in place so this
      // is a self-contained addition (new file + this case), no editor or
      // service changes.
      throw new Error(
        "MEDIA_STORAGE_DRIVER=s3 is not implemented yet. 7C-2 ships the local driver behind the MediaStorage interface.",
      );
  }

  return instance;
}

// Test seam — swap in an in-memory fake, then restore with null.
export function __setMediaStorage(next: MediaStorage | null): void {
  instance = next;
}
