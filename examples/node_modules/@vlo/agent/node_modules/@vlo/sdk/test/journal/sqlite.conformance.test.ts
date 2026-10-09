import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { openJournal } from "../../src/journal/open.ts";
import { journalConformance } from "../../src/testing.ts";

const dir = mkdtempSync(join(tmpdir(), "vlo-sqlite-"));
let index = 0;

journalConformance("sqlite journal", async () =>
  openJournal(`sqlite://${join(dir, `journal-${++index}.db`)}`),
);

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
