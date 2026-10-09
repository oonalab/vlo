import { randomBytes } from "node:crypto";
import pg from "pg";
import { afterAll, describe } from "vitest";
import { PostgresJournal } from "../../src/journal/postgres.ts";
import { journalConformance } from "../../src/testing.ts";

const url = process.env.VLO_TEST_DATABASE_URL ?? "";

// One schema per journal, i.e. per test case, so cases never see each other's rows —
// the same isolation the SQLite runner gets from a fresh file. All schemas are dropped
// together at the end.
const schemas: string[] = [];

describe.skipIf(!url)("postgres", () => {
  journalConformance("postgres journal", async () => {
    const schema = `vlo_t_${randomBytes(4).toString("hex")}`;
    schemas.push(schema);
    return new PostgresJournal(url, { schema, max: 8 });
  });

  afterAll(async () => {
    const pool = new pg.Pool({ connectionString: url });
    try {
      for (const schema of schemas) {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      }
    } finally {
      await pool.end();
    }
  });
});
