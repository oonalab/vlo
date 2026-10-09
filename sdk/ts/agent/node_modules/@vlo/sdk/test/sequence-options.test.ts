/**
 * Pure reducer tests for the `sequence` step options (`id`, `when`, `onFailure`), the
 * `output` shaper and `state.usage`. Events go straight to `Workflow.reduce`.
 */

import { describe, expect, it } from "vitest";
import {
  defineWorkflow,
  resultOf,
  sequence,
  step,
  WorkflowFailure,
  type Json,
  type ReductionWire,
  type SeqState,
  type Status,
  type Usage,
  type Workflow,
} from "../src/index.ts";
import { finish, plan, work } from "./example/activities.ts";

const RANDOM = "0".repeat(32);
const NO_USAGE: Usage = { cpu_ms: 0, tokens: 0, cost_micro_usd: 0 };
const SPENT: Usage = { cpu_ms: 5, tokens: 42, cost_micro_usd: 7 };

function started(workflow: Workflow<SeqState, Json>, input: Json, usage = NO_USAGE): ReductionWire {
  return workflow.reduce(null, { type: "started", ts_ms: 1, random: RANDOM, input, usage_total: usage }, input);
}

function taskDone(
  workflow: Workflow<SeqState, Json>,
  state: string,
  args: { step_id: string; activity: string; output?: Json; status?: Status; usage?: Usage },
): ReductionWire {
  return workflow.reduce(state, {
    type: "task_done",
    ts_ms: 2,
    random: RANDOM,
    step_id: args.step_id,
    attempt: 1,
    activity: args.activity,
    status: args.status ?? "succeeded",
    usage: NO_USAGE,
    usage_total: args.usage ?? NO_USAGE,
    ...(args.output !== undefined ? { output: args.output } : {}),
  });
}

const parse = (state: string): SeqState => JSON.parse(state) as SeqState;

describe("step · id", () => {
  const pinned = defineWorkflow("pinned", sequence([step(plan, undefined, { id: "the-plan" })]));

  it("uses the explicit step id and only answers to it", () => {
    const begin = started(pinned, { n: 1 });
    expect(begin.commands).toMatchObject([{ type: "task", activity: plan.name, id: "the-plan" }]);

    const stray = taskDone(pinned, begin.state, { step_id: "task#1", activity: plan.name, output: { items: [] } });
    expect(stray.commands).toEqual([]);

    const done = taskDone(pinned, begin.state, { step_id: "the-plan", activity: plan.name, output: { items: [] } });
    expect(done.commands).toMatchObject([{ type: "complete" }]);
  });
});

describe("step · when", () => {
  const gated = defineWorkflow(
    "gated",
    sequence([
      step(plan),
      step(work, () => ({ item: "x" }), { when: (s) => resultOf(s, plan).items.length > 0 }),
      step(finish, () => ({ uppers: [], approvedBy: "gate" })),
    ]),
  );

  it("skips the task, stores null and advances when the gate is false", () => {
    const begin = started(gated, { n: 1 });
    const skipped = taskDone(gated, begin.state, { step_id: "s1", activity: plan.name, output: { items: [] } });

    expect(skipped.commands).toMatchObject([{ type: "task", activity: finish.name }]);
    const state = parse(skipped.state);
    expect(state.phase).toBe(2);
    expect(state.results[work.name]).toBeNull();
  });

  it("runs the task when the gate is true", () => {
    const begin = started(gated, { n: 1 });
    const ran = taskDone(gated, begin.state, { step_id: "s1", activity: plan.name, output: { items: ["a"] } });

    expect(ran.commands).toMatchObject([{ type: "task", activity: work.name, input: { item: "x" } }]);
  });
});

describe("step · onFailure", () => {
  const tolerant = defineWorkflow(
    "tolerant",
    sequence([step(plan, undefined, { onFailure: "continue" }), step(finish, () => ({ uppers: [], approvedBy: "x" }))]),
  );
  const strict = defineWorkflow("strict", sequence([step(plan)]));

  it("stores null and advances on a tolerated failure", () => {
    const begin = started(tolerant, { n: 1 });
    const failed = taskDone(tolerant, begin.state, { step_id: "s1", activity: plan.name, status: "failed" });

    expect(failed.commands).toMatchObject([{ type: "task", activity: finish.name }]);
    expect(parse(failed.state).results[plan.name]).toBeNull();
  });

  it("fails the run by default", () => {
    const begin = started(strict, { n: 1 });
    expect(() => taskDone(strict, begin.state, { step_id: "s1", activity: plan.name, status: "failed" })).toThrow(
      WorkflowFailure,
    );
  });

  it("ignores a failed task from a phase already left behind", () => {
    const begin = started(tolerant, { n: 1 });
    const advanced = taskDone(tolerant, begin.state, { step_id: "s1", activity: plan.name, output: { items: [] } });
    const stale = taskDone(tolerant, advanced.state, { step_id: "s1", activity: plan.name, status: "failed" });

    expect(stale.commands).toEqual([]);
    expect(parse(stale.state).phase).toBe(1);
  });
});

describe("sequence · output and usage", () => {
  const shaped = defineWorkflow(
    "shaped",
    sequence([step(plan)], { output: (s) => ({ count: resultOf(s, plan).items.length, tokens: s.usage?.tokens ?? 0 }) }),
  );

  it("tracks the banked usage on every event", () => {
    const begin = started(shaped, { n: 2 });
    expect(parse(begin.state).usage).toEqual(NO_USAGE);

    const done = taskDone(shaped, begin.state, { step_id: "s1", activity: plan.name, output: { items: ["a", "b"] }, usage: SPENT });
    expect(parse(done.state).usage).toEqual(SPENT);
  });

  it("completes with the shaped output instead of results", () => {
    const begin = started(shaped, { n: 2 });
    const done = taskDone(shaped, begin.state, { step_id: "s1", activity: plan.name, output: { items: ["a", "b"] }, usage: SPENT });

    expect(done.commands).toEqual([{ type: "complete", output: { count: 2, tokens: 42 } }]);
  });
});
