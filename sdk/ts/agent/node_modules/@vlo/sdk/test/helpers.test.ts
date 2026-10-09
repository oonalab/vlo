/**
 * Pure reducer tests: no journal, no kernel, no host. Events are handed to
 * `Workflow.reduce` directly and the returned state string is fed back in, exactly as the
 * host will do.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  activity,
  ActivityInputError,
  canonicalJson,
  cmd,
  defineWorkflow,
  sequence,
  sleep,
  step,
  WorkflowFailure,
  type Command,
  type Json,
  type ReductionWire,
  type SeqState,
  type Status,
  type Usage,
} from "../src/index.ts";
import { approve, finish, plan, work } from "./example/activities.ts";
import { exampleWorkflow } from "./example/example.workflow.ts";

const RANDOM = "0".repeat(32);
/** Every reducer event carries the run's banked usage; these pure tests never spend any. */
const NO_USAGE: Usage = { cpu_ms: 0, tokens: 0, cost_micro_usd: 0 };

function started(input: Json): ReductionWire {
  return exampleWorkflow.reduce(
    null,
    { type: "started", ts_ms: 1, random: RANDOM, input, usage_total: NO_USAGE },
    input,
  );
}

function taskDone(
  state: string,
  args: { step_id: string; activity: string; output?: Json; status?: Status; error?: string },
): ReductionWire {
  return exampleWorkflow.reduce(state, {
    type: "task_done",
    ts_ms: 2,
    random: RANDOM,
    step_id: args.step_id,
    attempt: 1,
    activity: args.activity,
    status: args.status ?? "succeeded",
    usage: NO_USAGE,
    usage_total: NO_USAGE,
    ...(args.output !== undefined ? { output: args.output } : {}),
    ...(args.error !== undefined ? { error: args.error } : {}),
  });
}

function signalEvent(state: string, name: string, payload: Json): ReductionWire {
  return exampleWorkflow.reduce(state, {
    type: "signal",
    ts_ms: 3,
    random: RANDOM,
    step_id: "await-1",
    name,
    payload,
    usage_total: NO_USAGE,
  });
}

function parse(state: string): SeqState {
  return JSON.parse(state) as SeqState;
}

function taskIds(commands: readonly Command[]): (string | undefined)[] {
  return commands.map((command) => (command.type === "task" ? command.id : undefined));
}

/** Drives plan → fan-out start, returning the state parked mid fan-out. */
function afterPlan(items: string[] = ["a", "b", "c"]): ReductionWire {
  const begin = started({ n: items.length });
  return taskDone(begin.state, { step_id: "s1", activity: plan.name, output: { items } });
}

describe("sequence · started", () => {
  it("emits exactly one task for the first step", () => {
    const first = started({ n: 3 });

    expect(first.commands).toHaveLength(1);
    expect(first.commands[0]).toMatchObject({
      type: "task",
      activity: "example.plan",
      schema_ref: plan.schemaRef,
      input: { n: 3 },
      queue: "default",
      retry: plan.retry,
    });
    expect(parse(first.state)).toEqual({ phase: 0, input: { n: 3 }, results: {}, signals: {}, usage: NO_USAGE });
  });
});

describe("sequence · fanOut", () => {
  it("starts at most `concurrency` tasks and stores the plan output", () => {
    const fan = afterPlan();

    expect(taskIds(fan.commands)).toEqual(["example.work#0", "example.work#1"]);
    const state = parse(fan.state);
    expect(state.phase).toBe(1);
    expect(state.results["example.plan"]).toEqual({ items: ["a", "b", "c"] });
    expect(state.fan).toMatchObject({ total: 3, next: 2, outstanding: ["example.work#0", "example.work#1"] });
  });

  it("validates each fanned-out task input against the activity schema", () => {
    const fan = afterPlan(["a", "b"]);

    for (const command of fan.commands) {
      expect(command.type).toBe("task");
      if (command.type === "task") expect(work.input.safeParse(command.input).success).toBe(true);
    }
  });

  it("never exceeds concurrency and completes after out-of-order task_done events", () => {
    let current = afterPlan(["a", "b", "c", "d"]);
    const order = ["example.work#1", "example.work#0", "example.work#3", "example.work#2"];
    const delivered = new Set(taskIds(current.commands));

    for (const stepId of order) {
      expect(delivered.has(stepId)).toBe(true);
      const index = Number(stepId.slice(stepId.indexOf("#") + 1));
      current = taskDone(current.state, {
        step_id: stepId,
        activity: work.name,
        output: { upper: ["A", "B", "C", "D"][index] ?? "" },
      });
      for (const id of taskIds(current.commands)) if (id !== undefined) delivered.add(id);
      const outstanding = parse(current.state).fan?.outstanding ?? [];
      expect(outstanding.length).toBeLessThanOrEqual(2);
    }

    const state = parse(current.state);
    expect(state.fan).toBeUndefined();
    expect(state.phase).toBe(2);
    expect(state.results["example.work"]).toEqual([
      { upper: "A" },
      { upper: "B" },
      { upper: "C" },
      { upper: "D" },
    ]);
    expect(current.commands).toEqual([
      { type: "await_signal", name: approve.name, schema_ref: approve.schemaRef, id: "wait#2" },
    ]);
  });
});

describe("sequence · waitFor", () => {
  it("ignores a signal nobody is waiting for and advances on the matching one", () => {
    const parked = drainFanOut();

    const ignored = signalEvent(parked.state, "example.other", { by: "nobody" });
    expect(ignored.commands).toEqual([]);
    expect(parse(ignored.state).phase).toBe(2);

    const resumed = signalEvent(parked.state, approve.name, { by: "dc" });
    expect(resumed.commands).toEqual([
      {
        type: "task",
        activity: "example.finish",
        schema_ref: expect.stringContaining("example.finish@"),
        input: { uppers: ["A", "B"], approvedBy: "dc" },
        queue: "default",
        retry: expect.anything(),
        lease_ttl_ms: expect.any(Number),
      },
    ]);
    expect(parse(resumed.state).signals["example.approve"]).toEqual({ by: "dc" });
  });
});

describe("sequence · sleep", () => {
  const napping = defineWorkflow(
    "napping",
    sequence([
      step(plan),
      sleep(150),
      step(finish, (state) => ({
        uppers: (state.results["example.plan"] as { items: string[] }).items,
        approvedBy: "the clock",
      })),
    ]),
  );

  /** plan done → the run is parked on the sleep phase's timer. */
  function parked(): ReductionWire {
    const begin = napping.reduce(null, { type: "started", ts_ms: 1, random: RANDOM, input: { n: 1 }, usage_total: NO_USAGE }, { n: 1 });
    return napping.reduce(begin.state, {
      type: "task_done",
      ts_ms: 2,
      random: RANDOM,
      step_id: "s1",
      attempt: 1,
      activity: plan.name,
      status: "succeeded",
      output: { items: ["a"] },
      usage: NO_USAGE,
      usage_total: NO_USAGE,
    });
  }

  function fire(state: string, stepId: string): ReductionWire {
    return napping.reduce(state, { type: "timer", ts_ms: 3, random: RANDOM, step_id: stepId, usage_total: NO_USAGE });
  }

  it("asks for a timer keyed by its phase", () => {
    const at = parked();

    expect(at.commands).toEqual([{ type: "timer", fire_in_ms: 150, id: "sleep#1" }]);
    expect(parse(at.state).phase).toBe(1);
  });

  it("ignores a timer from another step and advances on its own", () => {
    const at = parked();

    expect(fire(at.state, "sleep#9").commands).toEqual([]);

    const resumed = fire(at.state, "sleep#1");
    expect(resumed.commands).toMatchObject([{ type: "task", activity: finish.name }]);
    // A sleep stores nothing, so `finish` still reads the plan's output.
    expect(parse(resumed.state).results).toEqual({ "example.plan": { items: ["a"] } });
    expect(parse(resumed.state).phase).toBe(2);
  });
});

describe("sequence · completion", () => {
  it("completes with every stored result after the last step", () => {
    const parked = drainFanOut();
    const running = signalEvent(parked.state, approve.name, { by: "dc" });

    const done = taskDone(running.state, {
      step_id: "s9",
      activity: "example.finish",
      output: { report: "ok" },
    });

    expect(done.commands).toEqual([
      {
        type: "complete",
        output: {
          "example.plan": { items: ["a", "b"] },
          "example.work": [{ upper: "A" }, { upper: "B" }],
          "example.finish": { report: "ok" },
        },
      },
    ]);
  });

  it("fails the run when a task did not succeed", () => {
    const begin = started({ n: 1 });

    expect(() =>
      taskDone(begin.state, {
        step_id: "s1",
        activity: plan.name,
        status: "failed",
        error: "boom",
      }),
    ).toThrow(WorkflowFailure);
  });
});

describe("cmd.task", () => {
  it("rejects input that does not match the activity schema", () => {
    expect(() => cmd.task(plan, { n: -1 })).toThrow(ActivityInputError);
    expect(() => cmd.task(plan, { n: -1 })).toThrow(/example\.plan/);
  });

  it("carries schema_ref, retry and lease from the activity", () => {
    expect(cmd.task(work, { item: "a" }, { id: "x", queue: "gpu" })).toEqual({
      type: "task",
      activity: "example.work",
      schema_ref: work.schemaRef,
      input: { item: "a" },
      queue: "gpu",
      retry: work.retry,
      lease_ttl_ms: work.leaseMs,
      id: "x",
    });
  });
});

describe("activity hashing", () => {
  const input = z.object({ a: z.string() });

  it("is stable across calls", () => {
    const first = activity("t.same", { input, output: z.object({ b: z.number() }) });
    const second = activity("t.same", { input, output: z.object({ b: z.number() }) });

    expect(first.hash).toBe(second.hash);
    expect(first.schemaRef).toBe(`t.same@${first.hash}`);
    expect(first.hash).toHaveLength(16);
  });

  it("changes when the schema or the retry policy changes", () => {
    const base = activity("t.drift", { input, output: z.object({ b: z.number() }) });
    const widened = activity("t.drift", { input, output: z.object({ b: z.string() }) });
    const retried = activity("t.drift", {
      input,
      output: z.object({ b: z.number() }),
      retry: { maxAttempts: 7 },
    });

    expect(widened.hash).not.toBe(base.hash);
    expect(retried.hash).not.toBe(base.hash);
  });

  it("ignores annotations: describe() and default() do not re-version", () => {
    const base = activity("t.annot", { input, output: z.object({ b: z.number() }) });
    const described = activity("t.annot", {
      input: z.object({ a: z.string().describe("The a") }).describe("Input"),
      output: z.object({ b: z.number().default(1) }),
    });

    expect(described.hash).toBe(base.hash);
    expect(described.jsonSchema.input).not.toEqual(base.jsonSchema.input);
  });
});

describe("canonicalJson", () => {
  it("sorts object keys recursively and rejects non-JSON values", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
    expect(() => canonicalJson(undefined)).toThrow(TypeError);
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(TypeError);
  });
});

describe("defineWorkflow", () => {
  const counter = defineWorkflow<{ count: number }, { start: number }>("counter", {
    init: (input) => ({ count: input.start }),
    on: {
      started: (state) => [state, []],
      task_done: (state) => [{ count: state.count + 1 }, []],
    },
  });

  const done = {
    type: "task_done",
    ts_ms: 1,
    random: RANDOM,
    step_id: "s1",
    attempt: 1,
    activity: "noop",
    status: "succeeded",
    usage: NO_USAGE,
    usage_total: NO_USAGE,
  } as const;

  it("round-trips state through reduce", () => {
    const first = counter.reduce(null, { type: "started", ts_ms: 0, random: RANDOM, input: {}, usage_total: NO_USAGE }, { start: 5 });
    expect(first.state).toBe('{"count":5}');

    const second = counter.reduce(first.state, done);
    const third = counter.reduce(second.state, done);

    expect(JSON.parse(third.state)).toEqual({ count: 7 });
    expect(counter.digest).toHaveLength(16);
  });

  it("throws when no handler is registered for the event type", () => {
    const state = counter.reduce(null, { type: "started", ts_ms: 0, random: RANDOM, input: {}, usage_total: NO_USAGE }, { start: 0 });

    expect(() => counter.reduce(state.state, { type: "timer", ts_ms: 1, random: RANDOM, step_id: "t1", usage_total: NO_USAGE })).toThrow(
      /no handler for event "timer"/,
    );
  });

  it("requires a checkpoint or an init input", () => {
    expect(() => counter.reduce(null, done)).toThrow(/state checkpoint or initInput/);
  });
});

/** plan → both fan-out tasks done → parked on `await_signal`. */
function drainFanOut(): ReductionWire {
  let current = afterPlan(["a", "b"]);
  current = taskDone(current.state, {
    step_id: "example.work#0",
    activity: work.name,
    output: { upper: "A" },
  });
  return taskDone(current.state, {
    step_id: "example.work#1",
    activity: work.name,
    output: { upper: "B" },
  });
}
