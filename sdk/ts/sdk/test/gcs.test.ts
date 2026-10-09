/**
 * The GCS blob store.
 *
 * The unit half injects a fake client, so the addressing rules — digest as the name, two-hex
 * fan-out, prefix, and no second upload for bytes already there — are asserted without a
 * network. The live half runs the same shape against a real bucket when one is named in
 * `VLO_TEST_GCS_BUCKET`.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GcsBlobStore,
  openBlobStore,
  type GcsBucketLike,
  type GcsClientLike,
  type GcsFileLike,
} from "../src/host.ts";

interface FakeGcs extends GcsClientLike {
  objects: Map<string, Uint8Array>;
  saves: string[];
  buckets: string[];
}

function fakeClient(): FakeGcs {
  const objects = new Map<string, Uint8Array>();
  const saves: string[] = [];
  const buckets: string[] = [];

  const file = (name: string): GcsFileLike => ({
    exists: () => Promise.resolve([objects.has(name)]),
    save: (data) => {
      saves.push(name);
      objects.set(name, data);
      return Promise.resolve(undefined);
    },
    download: () => {
      const stored = objects.get(name);
      if (stored === undefined) return Promise.reject(new Error(`no such object: ${name}`));
      return Promise.resolve([stored] as [Uint8Array]);
    },
  });

  const bucket = (name: string): GcsBucketLike => {
    buckets.push(name);
    return { file };
  };

  return { bucket, objects, saves, buckets };
}

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const sha256 = (text: string): string => createHash("sha256").update(bytes(text)).digest("hex");

describe("gcs blob store", () => {
  it("addresses objects by digest and skips an upload it already has", async () => {
    const client = fakeClient();
    const store = new GcsBlobStore({ bucket: "vlo-test", prefix: "vlo/blobs", client });

    const digest = await store.put(bytes("hello blobs"));
    expect(digest).toBe(sha256("hello blobs"));
    expect([...client.objects.keys()]).toEqual([
      `vlo/blobs/${digest.slice(0, 2)}/${digest}`,
    ]);

    expect(await store.put(bytes("hello blobs"))).toBe(digest);
    expect(client.saves).toHaveLength(1);

    expect(new TextDecoder().decode(await store.get(digest))).toBe("hello blobs");
    expect(client.buckets).toEqual(["vlo-test"]);
  });

  it("drops the prefix segment when there is none", async () => {
    const client = fakeClient();
    const store = new GcsBlobStore({ bucket: "vlo-test", client });
    const digest = await store.put(bytes("bare"));
    expect([...client.objects.keys()]).toEqual([`${digest.slice(0, 2)}/${digest}`]);
  });

  it("opens from a gcs:// url", async () => {
    expect(openBlobStore("gcs://bucket-only")).toBeInstanceOf(GcsBlobStore);
    expect(openBlobStore("gcs://bucket/deep/prefix")).toBeInstanceOf(GcsBlobStore);
    expect(() => openBlobStore("gcs://")).toThrow(/no bucket/);
    expect(() => openBlobStore("s3://bucket")).toThrow(/unsupported/);
  });
});

const liveBucket = process.env.VLO_TEST_GCS_BUCKET;

describe.skipIf(liveBucket === undefined || liveBucket.length === 0)("gcs blob store (live)", () => {
  it("round-trips a blob through a real bucket", async () => {
    const store = new GcsBlobStore({
      bucket: liveBucket as string,
      prefix: "vlo-test",
      ...(process.env.GCP_PROJECT_ID !== undefined
        ? { projectId: process.env.GCP_PROJECT_ID }
        : {}),
    });

    const payload = `vlo gcs conformance ${new Date().toISOString()}`;
    const digest = await store.put(bytes(payload));
    expect(digest).toBe(sha256(payload));
    expect(new TextDecoder().decode(await store.get(digest))).toBe(payload);
  });
});
