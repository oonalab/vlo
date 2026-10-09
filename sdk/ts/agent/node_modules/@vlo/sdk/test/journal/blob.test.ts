import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { offloadIfOversized, readBlobText } from "../../src/blob/offload.ts";
import { openBlobStore } from "../../src/blob/open.ts";
import { parseBlobRef, toBlobRef } from "../../src/blob/ref.ts";

const dir = mkdtempSync(join(tmpdir(), "vlo-blob-"));
const store = openBlobStore(`file://${dir}`);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("file blob store", () => {
  it("round-trips bytes under their sha256", async () => {
    const bytes = new TextEncoder().encode('{"hello":"world"}');
    const digest = await store.put(bytes);

    expect(digest).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(await store.get(digest)).toEqual(bytes);
    expect(readdirSync(join(dir, digest.slice(0, 2)))).toEqual([digest]);
  });

  it("is idempotent and leaves no temporary files", async () => {
    const bytes = new TextEncoder().encode("same content");
    const [a, b] = await Promise.all([store.put(bytes), store.put(bytes)]);

    expect(a).toBe(b);
    expect(readdirSync(join(dir, a.slice(0, 2)))).toEqual([a]);
  });

  it("rejects an unknown scheme", () => {
    expect(() => openBlobStore("gs://bucket")).toThrow(/unsupported blob store url/);
  });
});

describe("offload", () => {
  it("keeps small payloads inline", async () => {
    expect(await offloadIfOversized(store, JSON.stringify({ small: true }))).toBeNull();
  });

  it("offloads oversized payloads byte-exactly", async () => {
    const text = JSON.stringify({ big: "x".repeat(300_000) });
    const ref = await offloadIfOversized(store, text);

    expect(ref).toMatch(/^blob:\/\/sha256\/[0-9a-f]{64}$/);
    expect(await readBlobText(store, ref as string)).toBe(text);
  });

  it("honours a custom limit and rejects a non-ref", async () => {
    const ref = await offloadIfOversized(store, "0123456789", 4);
    expect(ref).not.toBeNull();
    await expect(readBlobText(store, "nope")).rejects.toThrow(/not a blob ref/);
  });
});

describe("blob refs", () => {
  it("round-trips a digest", () => {
    const digest = "a".repeat(64);
    expect(toBlobRef(digest)).toBe(`blob://sha256/${digest}`);
    expect(parseBlobRef(toBlobRef(digest))).toBe(digest);
  });

  it("rejects anything that is not a sha256 blob ref", () => {
    expect(() => toBlobRef("nope")).toThrow(/not a sha256/);
    expect(parseBlobRef("blob://sha256/nope")).toBeNull();
    expect(parseBlobRef("https://example.com/x")).toBeNull();
  });
});
