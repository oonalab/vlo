/**
 * The file blob store: `<dir>/<first two hex chars>/<sha256>`.
 *
 * Writes land on a temporary file in the same directory and are renamed into
 * place, so a reader never sees a partial blob and two concurrent writers of the
 * same content cannot corrupt it.
 */

import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BlobStore } from "./types.ts";

/** The on-disk {@link BlobStore}. Opened by `openBlobStore("file://…")`. */
export class FileBlobStore implements BlobStore {
  /** `dir` is created on the first `put`. */
  constructor(private readonly dir: string) {}

  /** Writes atomically (temp file + rename) and returns the sha256 hex digest. */
  async put(bytes: Uint8Array): Promise<string> {
    const digest = createHash("sha256").update(bytes).digest("hex");
    const target = this.pathFor(digest);
    await mkdir(dirname(target), { recursive: true });
    const temp = `${target}.${randomBytes(8).toString("hex")}.tmp`;
    await writeFile(temp, bytes);
    await rename(temp, target);
    return digest;
  }

  /** Reads the blob; rejects with the `node:fs` error when it is missing. */
  async get(sha256Hex: string): Promise<Uint8Array> {
    const buffer = await readFile(this.pathFor(sha256Hex));
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  private pathFor(sha256Hex: string): string {
    return join(this.dir, sha256Hex.slice(0, 2), sha256Hex);
  }
}
