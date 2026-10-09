/** Blob store selection by URL scheme: `file://` on disk, `gcs://` in a bucket. */

import { FileBlobStore } from "./file.ts";
import { GcsBlobStore } from "./gcs.ts";
import type { BlobStore } from "./types.ts";

const FILE_PREFIX = "file://";
const GCS_PREFIX = "gcs://";

/**
 * Opens a blob store by URL: `file://<dir>` (relative to the working directory when the
 * path is) or `gcs://<bucket>/<prefix>`. The GCS client is only loaded on first use.
 * Throws a plain `Error` on any other scheme or an empty directory or bucket.
 */
export function openBlobStore(url: string): BlobStore {
  if (url.startsWith(FILE_PREFIX)) {
    const dir = url.slice(FILE_PREFIX.length);
    if (dir.length === 0) throw new Error(`blob store url has no directory: ${url}`);
    return new FileBlobStore(dir);
  }

  if (url.startsWith(GCS_PREFIX)) {
    const [bucket, ...rest] = url.slice(GCS_PREFIX.length).split("/");
    if (bucket === undefined || bucket.length === 0) {
      throw new Error(`blob store url has no bucket: ${url}`);
    }
    const prefix = rest.join("/");
    return new GcsBlobStore({ bucket, ...(prefix.length > 0 ? { prefix } : {}) });
  }

  throw new Error(`unsupported blob store url: ${url}`);
}
