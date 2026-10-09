/**
 * Replays the schema-hash golden fixtures.
 *
 * `fixtures/schema-hash/*.json` pin the projection and the content hash every SDK must
 * reproduce for a definition. Each fixture lists one or more `cases` (schemas as an
 * emitter would produce them) that all project to `projected` and hash to `hash`; a
 * mismatch means the projection or the canonical encoding drifted, which re-versions
 * every `schema_ref` in the wild.
 */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  activity,
  contentHash,
  projectSchema,
  SCHEMA_HASH_VERSION,
  signal,
  type Json,
  type RetryPolicy,
} from "../src/index.ts";

const FIXTURES_DIR = new URL("../../../../fixtures/schema-hash/", import.meta.url);

interface ActivityFixture {
  kind: "activity";
  name: string;
  retry: RetryPolicy;
  cases: { input: Json; output: Json }[];
  projected: { input: Json; output: Json };
  hash: string;
  schema_ref: string;
}

interface SignalFixture {
  kind: "signal";
  name: string;
  cases: { schema: Json }[];
  projected: Json;
  hash: string;
  schema_ref: string;
}

type Fixture = ActivityFixture | SignalFixture;

const fixtures = readdirSync(FIXTURES_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => ({
    file: name,
    ...(JSON.parse(readFileSync(new URL(name, FIXTURES_DIR), "utf8")) as Fixture),
  }));

describe("schema-hash fixtures", () => {
  it("found the committed fixtures", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  for (const fixture of fixtures) {
    describe(fixture.file, () => {
      it("projects every case to the pinned schema", () => {
        for (const c of fixture.cases) {
          if (fixture.kind === "activity") {
            const { input, output } = c as { input: Json; output: Json };
            expect({ input: projectSchema(input), output: projectSchema(output) }).toEqual(
              fixture.projected,
            );
          } else {
            expect(projectSchema((c as { schema: Json }).schema)).toEqual(fixture.projected);
          }
        }
      });

      it("hashes the projection to the pinned hash", () => {
        const envelope =
          fixture.kind === "activity"
            ? {
                v: SCHEMA_HASH_VERSION,
                name: fixture.name,
                input: fixture.projected.input,
                output: fixture.projected.output,
                retry: fixture.retry,
              }
            : { v: SCHEMA_HASH_VERSION, name: fixture.name, schema: fixture.projected };
        expect(contentHash(envelope)).toBe(fixture.hash);
        expect(fixture.schema_ref).toBe(`${fixture.name}@${fixture.hash}`);
      });
    });
  }

  it("agrees with activity() and signal() on a zod-emitted schema", () => {
    const work = activity("example.work", {
      input: z.object({ item: z.string().describe("The item").default("x") }),
      output: z.object({ upper: z.string() }),
    });
    const pinned = fixtures.find((f) => f.file === "activity__annotations_are_hash_neutral.json");
    expect(work.hash).toBe(pinned?.hash);

    const nudge = signal("example.nudge", z.object({}));
    const pinnedSignal = fixtures.find((f) => f.file === "signal__empty_payload.json");
    expect(nudge.hash).toBe(pinnedSignal?.hash);
  });
});

describe("projectSchema", () => {
  it("strips annotations at every depth and keeps semantics", () => {
    const projected = projectSchema({
      $schema: "x",
      title: "t",
      type: "object",
      properties: { a: { type: "string", description: "d", default: "v" } },
      anyOf: [{ type: "null", $comment: "c" }],
      additionalProperties: false,
      minimum: 1,
    });
    expect(projected).toEqual({
      type: "object",
      properties: { a: { type: "string" } },
      anyOf: [{ type: "null" }],
      additionalProperties: false,
      minimum: 1,
    });
  });

  it("keeps property names that collide with annotation keywords", () => {
    const projected = projectSchema({
      type: "object",
      properties: { default: { type: "string", default: "v" }, title: { type: "number" } },
      $defs: { description: { type: "boolean", description: "d" } },
    });
    expect(projected).toEqual({
      type: "object",
      properties: { default: { type: "string" }, title: { type: "number" } },
      $defs: { description: { type: "boolean" } },
    });
  });

  it("does not mutate its input", () => {
    const input: Json = { type: "string", description: "d" };
    projectSchema(input);
    expect(input).toEqual({ type: "string", description: "d" });
  });
});
