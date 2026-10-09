/**
 * The 256 KB rule: JSON text rides inline in the journal while it fits, and
 * moves to the blob store otherwise. The journal stores the resulting
 * `blob://sha256/<hex>` in the matching `*_ref` column.
 */

import { INLINE_LIMIT_BYTES } from "../kernel/protocol.ts";
import { parseBlobRef, toBlobRef } from "./ref.ts";
import type { BlobStore } from "./types.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A blob reference when `text` is too big to inline, otherwise null. */
export async function offloadIfOversized(
  store: BlobStore,
  text: string,
  limit: number = INLINE_LIMIT_BYTES,
): Promise<string | null> {
  const bytes = encoder.encode(text);
  if (bytes.byteLength <= limit) return null;
  return toBlobRef(await store.put(bytes));
}

/** Reads back what `offloadIfOversized` wrote, byte-exact. */
export async function readBlobText(store: BlobStore, ref: string): Promise<string> {
  const digest = parseBlobRef(ref);
  if (digest === null) throw new Error(`not a blob ref: ${ref}`);
  return decoder.decode(await store.get(digest));
}
