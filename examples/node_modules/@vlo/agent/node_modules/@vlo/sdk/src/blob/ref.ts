/** Blob references as they appear in `*_ref` columns. */

const PREFIX = "blob://sha256/";
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** `blob://sha256/<hex>` for a lowercase sha256 digest. Throws a plain `Error` on anything else. */
export function toBlobRef(sha256Hex: string): string {
  if (!SHA256_HEX.test(sha256Hex)) throw new Error(`not a sha256 hex digest: ${sha256Hex}`);
  return PREFIX + sha256Hex;
}

/** The digest, or null when `ref` is not a blob reference. */
export function parseBlobRef(ref: string): string | null {
  if (!ref.startsWith(PREFIX)) return null;
  const digest = ref.slice(PREFIX.length);
  return SHA256_HEX.test(digest) ? digest : null;
}
