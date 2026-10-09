/**
 * Pure reducer tests for `fanOutRuns` (child-run fan-out) and `fanOut` failure tolerance.
 * Events go straight to `Workflow.reduce`; no host or kernel.
 */

import { describe, expect, it } from "vitest";
import {
  defineWorkflow,
  fanOut,
  fanOutRuns,
  fanOutRunsResultsOf,
  resultOf,
  sequence,
  step,
  WorkflowFailure,
  type Command,
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
const CHILD = "example.read";

const research = (onFailure: "fail" | "continue") =>
  defineWorkflow(
    `research.${onFailure}`,
    sequence([
      step(plan),
      fanOutRuns(CHILD, (s) => resultOf(s, plan).items.map((item) => ({ item })), { concurrency: 2, onFailure }),
      step(finish, (s) => ({
        uppers: fanOutRunsResultsOf<{ upper: string }>(s, CHILD).map((r) => r.output?.upper ?? "-"),
        approvedBy: "fan",
      })),
    ]),
  );

function started(workflow: Workflow<SeqState, Json>, input: Json): ReductionWire {
  return workflow.reduce(null, { type: "started", ts_ms: 1, random: RANDOM, input, usage_total: NO_USAGE }, input);
}

function planned(workflow: Workflow<SeqState, Json>, items: string[]): ReductionWire {
  const begin = started(workflow, { n: Math.max(items.length, 1) });
  return workflow.reduce(begin.state, {
    type: "task_done",
    ts_ms: 2,
    random: RANDOM,
    step_id: "s1",
    attempt: 1,
    activity: plan.name,
    status: "succeeded",
    output: { items },
    usage: NO_USAGE,
    usage_total: NO_USAGE,
  });
}

function childDone(
  workflow: Workflow<SeqState, Json>,
  state: string,
  args: { step_id: string; status?: Status; output?: Json },
): ReductionWire {
  return workflow.reduce(state, {
    type: "child_done",
    ts_ms: 3,
    random: RANDOM,
    step_id: args.step_id,
    child_run_id: `run_${args.step_id}`,
    status: args.status ?? "succeeded",
    usage_total: NO_USAGE,
    ...(args.output !== undefined ? { output: args.output } : {}),
  });
}

const parse = (state: string): SeqState => JSON.parse(state) as SeqState;
const spawnIds = (commands: readonly Command[]): (string | undefined)[] =>
  commands.map((c) => (c.type === "spawn" ? c.id : undefined));

describe("fanOutRuns · dispatch", () => {
  const wf = research("fail");

  it("spawns at most `concurrency` children with `${workflow}#${index}` ids and the item as input", () => {
    const fan = planned(wf, ["a", "b", "c"]);

    expect(fan.commands).toMatchObject([
      { type: "spawn", workflow: CHILD, input: { item: "a" }, id: `${CHILD}#0` },
      { type: "spawn", workflow: CHILD, input: { item: "b" }, id: `${CHILD}#1` },
    ]);
    expect(parse(fan.state).fan).toMatchObject({ activity: CHILD, total: 3, next: 2, outstanding: [`${CHILD}#0`, `${CHILD}#1`] });
  });

  it("stores [] and moves on for an empty selection", () => {
    const fan = planned(wf, []);

    expect(fan.commands).toMatchObject([{ type: "task", activity: finish.name, input: { uppers: [], approvedBy: "fan" } }]);
    expect(parse(fan.state).results[CHILD]).toEqual([]);
  });

  it("settles out of order, refills the window and stores ChildResults in item order", () => {
    let current = planned(wf, ["a", "b", "c"]);

    current = childDone(wf, current.state, { step_id: `${CHILD}#1`, output: { upper: "B" } });
    expect(spawnIds(current.commands)).toEqual([`${CHILD}#2`]);

    current = childDone(wf, current.state, { step_id: `${CHILD}#2`, output: { upper: "C" } });
    expect(current.commands).toEqual([]);

    current = childDone(wf, current.state, { step_id: `${CHILD}#0`, output: { upper: "A" } });
    expect(current.commands).toMatchObject([{ type: "task", activity: finish.name, input: { uppers: ["A", "B", "C"], approvedBy: "fan" } }]);

    const results = fanOutRunsResultsOf<{ upper: string }>(parse(current.state), CHILD);
    expect(results).toEqual([
      { status: "succeeded", output: { upper: "A" }, child_run_id: `run_${CHILD}#0` },
      { status: "succeeded", output: { upper: "B" }, child_run_id: `run_${CHILD}#1` },
      { status: "succeeded", output: { upper: "C" }, child_run_id: `run_${CHILD}#2` },
    ]);
  });

  it("ignores a child_done nobody is waiting for", () => {
    const fan = planned(wf, ["a"]);
    const stray = childDone(wf, fan.state, { step_id: "other#0" });

    expect(stray.commands).toEqual([]);
    expect(parse(stray.state).fan?.outstanding).toEqual([`${CHILD}#0`]);
  });

  it("fails the run when select() is not pure", () => {
    let count = 2;
    const impure = defineWorkflow(
      "impure",
      sequence([step(plan), fanOutRuns(CHILD, () => Array.from({ length: count }, (_, i) => ({ i })), { concurrency: 1 })]),
    );
    const fan = planned(impure, ["a", "b"]);
    count = 0;

    expect(() => childDone(impure, fan.state, { step_id: `${CHILD}#0` })).toThrow(/not pure/);
  });
});

describe("fanOutRuns · failures", () => {
  it("fails the run on a failed child by default", () => {
    const wf = research("fail");
    const fan = planned(wf, ["a"]);

    expect(() => childDone(wf, fan.state, { step_id: `${CHILD}#0`, status: "failed" })).toThrow(WorkflowFailure);
  });

  it("records the status with a null output when told to continue", () => {
    const wf = research("continue");
    let current = planned(wf, ["a", "b"]);
    current = childDone(wf, current.state, { step_id: `${CHILD}#0`, status: "failed" });
    current = childDone(wf, current.state, { step_id: `${CHILD}#1`, status: "cancelled" });

    expect(current.commands).toMatchObject([{ type: "task", activity: finish.name, input: { uppers: ["-", "-"] } }]);
    expect(parse(current.state).results[CHILD]).toEqual([
      { status: "failed", output: null, child_run_id: `run_${CHILD}#0` },
      { status: "cancelled", output: null, child_run_id: `run_${CHILD}#1` },
    ]);
  });
});

describe("fanOut · onFailure", () => {
  const tolerant = defineWorkflow(
    "fan.tolerant",
    sequence([step(plan), fanOut(work, (s) => resultOf(s, plan).items.map((item) => ({ item })), { concurrency: 2, onFailure: "continue" })]),
  );

  it("stores null for the failed item and still completes", () => {
    let current = planned(tolerant, ["a", "b"]);
    const fail = (stepId: string, status: Status, output?: Json): ReductionWire =>
      tolerant.reduce(current.state, {
        type: "task_done",
        ts_ms: 4,
        random: RANDOM,
        step_id: stepId,
        attempt: 1,
        activity: work.name,
        status,
        usage: NO_USAGE,
        usage_total: NO_USAGE,
        ...(output !== undefined ? { output } : {}),
      });

    current = fail(`${work.name}#0`, "failed");
    current = fail(`${work.name}#1`, "succeeded", { upper: "B" });

    expect(current.commands).toEqual([{ type: "complete", output: { [plan.name]: { items: ["a", "b"] }, [work.name]: [null, { upper: "B" }] } }]);
  });
});
