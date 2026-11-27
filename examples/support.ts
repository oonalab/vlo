/** A throwaway directory per test, for a SQLite journal and file blobs. */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Sandbox {
  journal: string;
  blob: string;
  cleanup(): Promise<void>;
}

export async function sandbox(): Promise<Sandbox> {
  const dir = await mkdtemp(join(tmpdir(), "vlo-example-"));
  return {
    journal: `sqlite://${join(dir, "journal.db")}`,
    blob: `file://${join(dir, "blobs")}`,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}
