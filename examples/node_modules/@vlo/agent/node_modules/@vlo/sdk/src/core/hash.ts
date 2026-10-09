/**
 * Canonical JSON + SHA-256, used for activity / signal / workflow content hashes.
 *
 * The Rust kernel hashes run state, never schemas, so this encoder is independent of
 * `vlo-kernel`'s canonical JSON. It is nonetheless a protocol: a `schema_ref` computed by
 * any SDK must match one computed here for the same definition, so the encoding below and
 * the projection in `schema-projection.ts` are pinned by `fixtures/schema-hash/` and
 * documented in `docs/kernel-protocol.md`.
 */

import { createHash } from "node:crypto";

/** Hex characters kept from a SHA-256 digest when it is used as a content hash. */
export const HASH_CHARS = 16;

/**
 * Deterministic JSON: object keys sorted recursively, arrays in order, no whitespace.
 * Throws on anything JSON cannot represent losslessly (undefined, NaN, Infinity, bigint,
 * function, symbol) rather than silently dropping it, because a dropped field would make
 * two different schemas hash the same.
 */
export function canonicalJson(value: unknown): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`canonicalJson: non-finite number (${String(value)})`);
      }
      return JSON.stringify(value);
    case "object": {
      if (value === null) return "null";
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
      const record = value as Record<string, unknown>;
      const parts = Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
      return `{${parts.join(",")}}`;
    }
    default:
      throw new TypeError(`canonicalJson: unsupported value of type ${typeof value}`);
  }
}

/** Full SHA-256 of `data` as 64 lowercase hex characters; strings are hashed as UTF-8. */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** SHA-256 of the canonical encoding, truncated to `HASH_CHARS`. */
export function contentHash(value: unknown): string {
  return sha256Hex(canonicalJson(value)).slice(0, HASH_CHARS);
}
