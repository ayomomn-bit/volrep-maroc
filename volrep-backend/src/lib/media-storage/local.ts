import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { MediaStorage } from "./types.js";

// Development / single-VPS-disk implementation. Files land under
// MEDIA_LOCAL_DIR and are served back by @fastify/static at /media/*
// (wired in src/app.ts, local driver only).
export class LocalMediaStorage implements MediaStorage {
  private readonly root: string;
  private readonly publicBase: string;

  constructor(opts: { dir: string; publicBaseUrl: string }) {
    this.root = resolve(opts.dir);
    this.publicBase = opts.publicBaseUrl.replace(/\/+$/, "");
  }

  // Resolve `key` under root and refuse anything that escapes it.
  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`media key "${key}" escapes the storage root`);
    }
    return full;
  }

  // contentType is part of the MediaStorage contract (S3 needs it); the
  // local filesystem infers it from the extension, so it is accepted and
  // ignored here.
  async put(key: string, bytes: Buffer, _contentType?: string): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/media/${key}`;
  }
}
