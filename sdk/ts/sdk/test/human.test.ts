/**
 * `awaitHuman`: the wait with its deadline and the context emit. The kernel opens the
 * `<id>:timeout` timer beside the wait and cancels the loser; these are pure reducer tests
 * that synthesize both events, so a stray loser must still be folded and ignored.
 */

import { describe, expect, it } from "vitest";
import {
  cmd,
  defineWorkflow,
  humanTimeoutStepId,
  sequence,
  signalTimeoutStepId,
  step,
  waitFor,
  WorkflowFailure,
  type OnTimeout,
  type ReductionWire,
  type SeqState,
  type Usage,
} from "../src/index.ts";
import { approve, plan } from "./example/activities.ts";

const RANDOM = "0".repeat(32);
const NO_USAGE: Usage = { cpu_ms: 0, tokens: 0, cost_micro_usd: 0 };

const parse = (state: string): SeqState => JSON.parse(state) as SeqState;

describe("cmd.awaitHuman", () => {
  it("emits only the wait when neither a deadline nor context is given", () => {
    expect(cmd.awaitHuman(approve, { id: "ask" })).toEqual([
      { type: "await_signal", name: approve.name, schema_ref: approve.schemaRef, id: "ask" },
    ]);
  });

  it("puts the deadline on the wait itself, not on a separate timer command", () => {
    expect(cmd.awaitHuman(approve, { id: "ask", timeoutMs: 5_000 })).toEqual([
      {
        type: "await_signal",
        name: approve.name,
        schema_ref: approve.schemaRef,
        timeout_ms: 5_000,
        id: "ask",
      },
    ]);
    expect(signalTimeoutStepId("ask")).toBe("ask:timeout");
    expect(humanTimeoutStepId("ask")).toBe("ask:timeout");
  });
});

describe("sequence · waitFor with a deadline", () => {
  const ASK = { ask: "approve the cut?" };

  /** plan → wait on `approve` with a 60 s deadline. `wait#1` is the wait's step id. */
  function deadlineFlow(onTimeout?: OnTimeout) {
    return defineWorkflow(
      `deadline-${onTimeout ?? "default"}`,
      sequence([
        step(plan),
        waitFor(approve, {
          timeoutMs: 60_000,
          ...(onTimeout !== undefined ? { onTimeout } : {}),
          context: ASK,
        }),
      ]),
    );
  }

  type Flow = ReturnType<typeof deadlineFlow>;

  /** Drives plan → the run parked on the wait, and returns that state. */
  function parked(flow: Flow): ReductionWire {
    const begin = flow.reduce(
      null,
      { type: "started", ts_ms: 1, random: RANDOM, input: { n: 1 }, usage_total: NO_USAGE },
      { n: 1 },
    );
    return flow.reduce(begin.state, {
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

  function fire(flow: Flow, state: string, stepId: string): ReductionWire {
    return flow.reduce(state, {
      type: "timer",
      ts_ms: 9,
      random: RANDOM,
      step_id: stepId,
      usage_total: NO_USAGE,
    });
  }

  function reply(flow: Flow, state: string): ReductionWire {
    return flow.reduce(state, {
      type: "signal",
      ts_ms: 9,
      random: RANDOM,
      step_id: "wait#1",
      name: approve.name,
      payload: { by: "dc" },
      usage_total: NO_USAGE,
    });
  }

  it("asks for the wait with its deadline and the context emit", () => {
    expect(parked(deadlineFlow()).commands).toEqual([
      {
        type: "await_signal",
        name: approve.name,
        schema_ref: approve.schemaRef,
        timeout_ms: 60_000,
        id: "wait#1",
      },
      { type: "emit", channel: "human", data: { signal: approve.name, id: "wait#1", context: ASK } },
    ]);
  });

  it("fails the run when the deadline fires first (the default)", () => {
    const flow = deadlineFlow();
    const at = parked(flow);

    expect(() => fire(flow, at.state, "wait#1:timeout")).toThrow(WorkflowFailure);
    expect(() => fire(flow, at.state, "wait#1:timeout")).toThrow(/human timeout: example\.approve/);
  });

  it("advances with a null payload when onTimeout is `continue`", () => {
    const flow = deadlineFlow("continue");
    const at = parked(flow);

    const resumed = fire(flow, at.state, "wait#1:timeout");
    expect(parse(resumed.state).signals[approve.name]).toBeNull();
    expect(parse(resumed.state).phase).toBe(2);
    expect(resumed.commands).toEqual([
      { type: "complete", output: { "example.plan": { items: ["a"] } } },
    ]);
  });

  it("ignores a deadline that fires after the signal already won", () => {
    const flow = deadlineFlow();
    const at = parked(flow);
    const replied = reply(flow, at.state);
    expect(parse(replied.state).phase).toBe(2);

    const late = fire(flow, replied.state, "wait#1:timeout");
    expect(late.commands).toEqual([]);
    expect(parse(late.state)).toEqual(parse(replied.state));
  });

  it("ignores a signal that arrives after the deadline already continued", () => {
    const flow = deadlineFlow("continue");
    const at = parked(flow);
    const continued = fire(flow, at.state, "wait#1:timeout");

    const late = reply(flow, continued.state);
    expect(late.commands).toEqual([]);
    expect(parse(late.state).signals[approve.name]).toBeNull();
  });

  it("ignores a timer belonging to another phase's wait", () => {
    const flow = deadlineFlow("continue");
    const at = parked(flow);

    expect(fire(flow, at.state, "wait#7:timeout").commands).toEqual([]);
    expect(fire(flow, at.state, "sleep#1").commands).toEqual([]);
  });
});
