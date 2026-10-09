/**
 * The Google Cloud Storage blob store: `gs://<bucket>/<prefix>/<first two hex chars>/<sha256>`.
 *
 * Content addressing does the deduplication a bucket cannot: the object name *is* the digest,
 * so `put` checks existence and skips the upload instead of rewriting the same bytes. That
 * also makes a retried offload free, which matters because every oversized payload passes
 * through here on the write path.
 *
 * `@google-cloud/storage` is an optional peer dependency, loaded on first use: a host that
 * stores blobs on disk should not have to install a cloud SDK.
 */

import { createHash } from "node:crypto";
import type { BlobStore } from "./types.ts";

/** The slice of `@google-cloud/storage` used here, so a fake client needs nothing more. */
export interface GcsFileLike {
  /** `[true]` when the object exists. */
  exists(): Promise<[boolean]>;
  /** Uploads the bytes. The store passes `resumable: false` and an octet-stream content type. */
  save(data: Uint8Array, options?: { resumable?: boolean; contentType?: string }): Promise<unknown>;
  /** Downloads the object's bytes. */
  download(): Promise<[Uint8Array]>;
}

/** The slice of a GCS bucket handle used here. */
export interface GcsBucketLike {
  /** A handle for the object at `name`. */
  file(name: string): GcsFileLike;
}

/** The slice of a GCS client used here. */
export interface GcsClientLike {
  /** A handle for the bucket. */
  bucket(name: string): GcsBucketLike;
}

/** Where a {@link GcsBlobStore} writes. */
export interface GcsBlobStoreOptions {
  /** Bucket name. Required. */
  bucket: string;
  /** Key prefix inside the bucket, e.g. `vlo/blobs`. */
  prefix?: string;
  /** GCP project for the default client. Absent ⇒ the credentials' project. */
  projectId?: string;
  /** Injected client. Absent ⇒ `@google-cloud/storage` with ADC. */
  client?: GcsClientLike;
}

/**
 * The Google Cloud Storage {@link BlobStore}. Opened by `openBlobStore("gcs://…")`. Needs
 * the optional peer dependency `@google-cloud/storage` unless a `client` is injected.
 */
export class GcsBlobStore implements BlobStore {
  private readonly bucketName: string;
  private readonly prefix: string;
  private readonly projectId: string | undefined;
  private bucket: Promise<GcsBucketLike> | undefined;

  /** Throws a plain `Error` when `bucket` is empty. No network call is made here. */
  constructor(options: GcsBlobStoreOptions) {
    if (!options.bucket) throw new Error("GcsBlobStore: a bucket name is required");
    this.bucketName = options.bucket;
    this.prefix = trim(options.prefix ?? "");
    this.projectId = options.projectId;
    if (options.client !== undefined) {
      this.bucket = Promise.resolve(options.client.bucket(this.bucketName));
    }
  }

  /** Uploads unless an object with that digest already exists; returns the sha256 hex digest. */
  async put(bytes: Uint8Array): Promise<string> {
    const digest = createHash("sha256").update(bytes).digest("hex");
    const file = (await this.open()).file(this.keyFor(digest));
    const [exists] = await file.exists();
    if (!exists) await file.save(bytes, { resumable: false, contentType: "application/octet-stream" });
    return digest;
  }

  /** Downloads the blob; rejects with the client's error when it is missing. */
  async get(sha256Hex: string): Promise<Uint8Array> {
    const [contents] = await (await this.open()).file(this.keyFor(sha256Hex)).download();
    return contents instanceof Uint8Array ? contents : new Uint8Array(contents);
  }

  private keyFor(sha256Hex: string): string {
    const path = `${sha256Hex.slice(0, 2)}/${sha256Hex}`;
    return this.prefix.length > 0 ? `${this.prefix}/${path}` : path;
  }

  private open(): Promise<GcsBucketLike> {
    this.bucket ??= loadStorage(this.projectId).then((client) => client.bucket(this.bucketName));
    return this.bucket;
  }
}

interface StorageModule {
  Storage: new (options: {
    projectId?: string;
    credentials?: { client_email: string; private_key: string };
  }) => GcsClientLike;
}

/**
 * Application Default Credentials by default; `GCP_SERVICE_ACCOUNT_KEY_BASE64` when the
 * runtime has no metadata server to ask (Vercel, a laptop, CI).
 */
async function loadStorage(projectId: string | undefined): Promise<GcsClientLike> {
  let storage: StorageModule;
  try {
    storage = (await import("@google-cloud/storage")) as unknown as StorageModule;
  } catch (error) {
    throw new Error(
      "gcs blob store: install the optional peer dependency @google-cloud/storage (^7) " +
        `to use gcs:// urls (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const encoded = process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64;
  const credentials =
    encoded === undefined
      ? undefined
      : (JSON.parse(Buffer.from(encoded, "base64").toString()) as {
          client_email: string;
          private_key: string;
        });

  return new storage.Storage({
    ...(projectId !== undefined ? { projectId } : {}),
    ...(credentials !== undefined ? { credentials } : {}),
  });
}

function trim(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}
