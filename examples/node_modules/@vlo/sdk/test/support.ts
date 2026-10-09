/** A throwaway SQLite journal and blob directory per test. */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Sandbox {
  dir: string;
  journalUrl: string;
  dbPath: string;
  blobUrl: string;
  cleanup(): Promise<void>;
}

export async function sandbox(): Promise<Sandbox> {
  const dir = await mkdtemp(join(tmpdir(), "vlo-host-"));
  const dbPath = join(dir, "journal.db");
  return {
    dir,
    dbPath,
    journalUrl: `sqlite://${dbPath}`,
    blobUrl: `file://${join(dir, "blobs")}`,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls `check` until it returns a value, so tests never race the dispatcher's tick. */
export async function until<T>(
  check: () => Promise<T | null> | (T | null),
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value !== null) return value;
    if (Date.now() >= deadline) throw new Error(`condition not met within ${timeoutMs}ms`);
    await sleep(10);
  }
}
