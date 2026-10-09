/**
 * `resultOf`, `fanOutResultsOf` and `signalOf` give back the activity's and signal's
 * inferred types, so a `mapInput` / `select` callback needs no cast. Type-level only:
 * vitest's typecheck runner compiles this file and reports `expectTypeOf` failures.
 */

import { describe, expectTypeOf, it } from "vitest";
import { fanOutResultsOf, fanOutRunsResultsOf, resultOf, signalOf, type ChildResult, type SeqState } from "../src/index.ts";
import { approve, finish, plan, work } from "./example/activities.ts";

const state: SeqState = { phase: 0, input: null, results: {}, signals: {} };

describe("typed sequence access", () => {
  it("resultOf is the activity's output type", () => {
    expectTypeOf(resultOf(state, plan)).toEqualTypeOf<{ items: string[] }>();
    expectTypeOf(resultOf(state, finish)).toEqualTypeOf<{ report: string }>();
  });

  it("fanOutResultsOf is an array of the activity's output type", () => {
    expectTypeOf(fanOutResultsOf(state, work)).toEqualTypeOf<{ upper: string }[]>();
  });

  it("fanOutRunsResultsOf is an array of ChildResult over the given output type", () => {
    expectTypeOf(fanOutRunsResultsOf<{ ok: boolean }>(state, "child")).toEqualTypeOf<ChildResult<{ ok: boolean }>[]>();
    expectTypeOf(fanOutRunsResultsOf(state, { name: "child" })[0]?.status).toEqualTypeOf<
      "succeeded" | "failed" | "cancelled" | undefined
    >();
  });

  it("signalOf is the signal's payload type", () => {
    expectTypeOf(signalOf(state, approve)).toEqualTypeOf<{ by: string }>();
  });

  it("rejects anything that is not an activity or a signal", () => {
    // @ts-expect-error a signal is not an activity
    resultOf(state, approve);
    // @ts-expect-error an activity is not a signal
    signalOf(state, plan);
  });
});
