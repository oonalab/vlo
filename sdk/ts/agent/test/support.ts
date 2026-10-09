/** A throwaway SQLite journal and blob directory per test. */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Sandbox {
  dir: string;
  journalUrl: string;
  blobUrl: string;
  cleanup(): Promise<void>;
}

export async function sandbox(): Promise<Sandbox> {
  const dir = await mkdtemp(join(tmpdir(), "vlo-agent-"));
  return {
    dir,
    journalUrl: `sqlite://${join(dir, "journal.db")}`,
    blobUrl: `file://${join(dir, "blobs")}`,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
