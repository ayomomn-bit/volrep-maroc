// The storage boundary for Volrep-owned product media.
//
// Everything above this interface (the media service, the product editor)
// is storage-agnostic. The dev implementation writes to the local
// filesystem (src/lib/media-storage/local.ts); a VPS deployment implements
// the same interface against S3-compatible object storage and flips
// MEDIA_STORAGE_DRIVER — no caller changes.
export interface MediaStorage {
  /**
   * Persist `bytes` at `key`. Keys are content-addressed, so writing the
   * same key twice with the same bytes is a harmless no-op.
   */
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;

  /** Remove the object at `key`. A missing key is NOT an error. */
  delete(key: string): Promise<void>;

  /** Whether an object exists at `key`. */
  exists(key: string): Promise<boolean>;

  /** Absolute, publicly fetchable URL for `key`. */
  publicUrl(key: string): string;
}
