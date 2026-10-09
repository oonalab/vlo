/**
 * Content-addressed storage for anything too big to inline in the journal
 * (payloads and checkpoints over 256 KB).
 */
export interface BlobStore {
  /** Stores the bytes and returns their sha256, lowercase hex. Idempotent. */
  put(bytes: Uint8Array): Promise<string>;
  /** The bytes stored under that digest. Rejects when there are none. */
  get(sha256Hex: string): Promise<Uint8Array>;
}
