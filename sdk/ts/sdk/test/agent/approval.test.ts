/** Gated tools: the reducer waits for a person before dispatching, and what each answer does. */

import { describe, expect, it } from "vitest";
import { approvalSignal, type AgentState } from "../../src/agent/index.ts";
import type { Json, ReductionWire } from "../../src/index.ts";
import { build, done, NONE, parse, RANDOM, start, type Agent } from "./driver.ts";
import { decide, draft, topup } from "./example.ts";

const gated = (overrides = {}) => build({ approval: { tools: ["draft"], ...overrides } });

/** started → the decider picked the gated `draft` → the run waits for a person. */
function asking(agent: Agent): ReductionWire {
  return done(agent, start(agent).state, {
    step_id: "decide#0",
    activity: decide.name,
    output: { tool: "draft", args: { topic: "kernels" }, rationale: "need a first draft" },
  });
}

function reply(agent: Agent, state: string, payload: Json, stepId = "approve#0"): ReductionWire {
  return agent.reduce(state, {
    type: "signal",
    ts_ms: 3,
    random: RANDOM,
    step_id: stepId,
    name: approvalSignal(0).name,
    payload,
    usage_total: NONE,
  });
}

function deadline(agent: Agent, state: string, stepId = "approve#0:timeout"): ReductionWire {
  return agent.reduce(state, { type: "timer", ts_ms: 4, random: RANDOM, step_id: stepId, usage_total: NONE });
}

describe("agentLoop · tool approval", () => {
  it("waits on the call's own signal instead of dispatching a gated tool", () => {
    const at = asking(gated());

    expect(at.commands).toEqual([
      {
        type: "await_signal",
        name: "agent.tool_approval:0",
        schema_ref: approvalSignal(0).schemaRef,
        id: "approve#0",
      },
      {
        type: "emit",
        channel: "human",
        data: {
          signal: "agent.tool_approval:0",
          id: "approve#0",
          context: {
            tool: "draft",
            args: { topic: "kernels" },
            iteration: 0,
            rationale: "need a first draft",
          },
        },
      },
    ]);
    expect(parse(at.state)).toMatchObject({
      phase: "approval",
      pending: { tool: "draft", args: { topic: "kernels" } },
    });
  });

  it("dispatches a tool that is not gated straight away", () => {
    const agent = build({ approval: { tools: ["rewrite"] } });

    const at = done(agent, start(agent).state, {
      step_id: "decide#0",
      activity: decide.name,
      output: { tool: "draft", args: { topic: "kernels" } },
    });

    expect(at.commands).toMatchObject([{ type: "task", activity: draft.name, id: "tool#0" }]);
  });

  it.each([
    ["an explicit yes", { approved: true, by: "dana" }],
    ["an empty reply, as a signed link's form sends", {}],
    ["no payload at all", null],
  ])("runs the tool on %s", (_label, payload) => {
    const agent = gated();

    const at = reply(agent, asking(agent).state, payload);

    expect(at.commands).toMatchObject([
      { type: "task", activity: draft.name, id: "tool#0", input: { topic: "kernels" } },
    ]);
    expect(parse(at.state).phase).toBe("tool");
  });

  it("turns a rejection into an observation and decides again", () => {
    const agent = gated();

    const at = reply(agent, asking(agent).state, { approved: false, by: "dana", reason: "too early" });

    expect(at.commands).toMatchObject([{ type: "task", activity: decide.name, id: "decide#1" }]);
    const state: AgentState = parse(at.state);
    expect(state.phase).toBe("decide");
    expect(state.pending).toBeUndefined();
    expect(state.memory).toEqual([
      { tool: "draft", args: { topic: "kernels" }, error: "rejected by dana: too early" },
    ]);
  });

  it("rejects on a reply it cannot read, rather than approving by accident", () => {
    const agent = gated();

    const at = reply(agent, asking(agent).state, { approved: "yes" });

    expect(parse(at.state).memory).toMatchObject([
      { tool: "draft", error: "rejected: the approval reply was not valid" },
    ]);
  });

  it("asks with a deadline when one is configured", () => {
    const at = asking(gated({ timeoutMs: 60_000 }));

    expect(at.commands[0]).toMatchObject({ type: "await_signal", id: "approve#0", timeout_ms: 60_000 });
  });

  it("treats a missed deadline as a rejection by default", () => {
    const agent = gated({ timeoutMs: 60_000 });

    const at = deadline(agent, asking(agent).state);

    expect(at.commands).toMatchObject([{ type: "task", id: "decide#1" }]);
    expect(parse(at.state).memory).toEqual([
      { tool: "draft", args: { topic: "kernels" }, error: "approval timed out" },
    ]);
  });

  it("fails the run on a missed deadline when asked to", () => {
    const agent = gated({ timeoutMs: 60_000, onTimeout: "fail" });

    expect(() => deadline(agent, asking(agent).state)).toThrow('approval timed out for "draft"');
  });

  it("ignores a reply or a deadline it is not waiting for", () => {
    const agent = gated({ timeoutMs: 60_000 });
    const waiting = asking(agent);

    expect(reply(agent, waiting.state, {}, "approve#7").commands).toEqual([]);
    expect(deadline(agent, waiting.state, "approve#7:timeout").commands).toEqual([]);
    // A task result cannot move a run that is waiting for a person.
    const stray = done(agent, waiting.state, { step_id: "tool#0", activity: draft.name, output: { text: "x" } });
    expect(stray.commands).toEqual([]);
    expect(parse(stray.state).phase).toBe("approval");
  });

  it("gives every gated call its own signal, so an approval is single-use", () => {
    const agent = gated();
    const rejected = reply(agent, asking(agent).state, { approved: false });

    const again = done(agent, rejected.state, {
      step_id: "decide#1",
      activity: decide.name,
      output: { tool: "draft", args: { topic: "kernels" } },
    });

    expect(again.commands[0]).toMatchObject({ name: "agent.tool_approval:1", id: "approve#1" });
  });

  it("refuses to gate a tool the loop does not have", () => {
    expect(() => build({ approval: { tools: ["publish"] } })).toThrow('unknown tool "publish"');
  });

  it("waits on a custom signal name when one is given", () => {
    const agent = gated({ name: "ops.sign_off" });
    const at = asking(agent);

    expect(at.commands[0]).toMatchObject({
      type: "await_signal",
      name: "ops.sign_off:0",
      schema_ref: approvalSignal(0, "ops.sign_off").schemaRef,
    });
    expect(approvalSignal(0, "ops.sign_off").name).toBe("ops.sign_off:0");
  });

  describe("with a budget", () => {
    it("parks on the budget when a rejection uses up the last step", () => {
      const agent = build({ budget: { steps: 1 }, approval: { tools: ["draft"] } });

      const at = reply(agent, asking(agent).state, { approved: false, reason: "no" });

      // The rejected cycle counted: the run now waits for a top-up, not for the decider.
      expect(at.commands).toMatchObject([
        { type: "emit", channel: "agent" },
        { type: "await_signal", name: topup.name, id: "topup#1" },
      ]);
      const state = parse(at.state);
      expect(state.phase).toBe("parked");
      expect(state.pending).toBeUndefined();
      expect(state.memory).toMatchObject([{ tool: "draft", error: "rejected: no" }]);
    });

    it("parks on the budget when a missed deadline uses up the last step", () => {
      const agent = build({ budget: { steps: 1 }, approval: { tools: ["draft"], timeoutMs: 60_000 } });

      const at = deadline(agent, asking(agent).state);

      expect(parse(at.state).phase).toBe("parked");
    });

    it("does not take a top-up for an approval, or an approval for a top-up", () => {
      const agent = build({ budget: { steps: 1 }, approval: { tools: ["draft"] } });
      const waiting = asking(agent);

      // A top-up while a person is being asked changes nothing.
      const early = agent.reduce(waiting.state, {
        type: "signal", ts_ms: 3, random: RANDOM, step_id: "topup#0", name: topup.name,
        payload: { steps: 5 }, usage_total: NONE,
      });
      expect(early.commands).toEqual([]);
      expect(parse(early.state).phase).toBe("approval");

      // An approval for the call that was rejected cannot resume the parked run.
      const parked = reply(agent, waiting.state, { approved: false });
      const stale = reply(agent, parked.state, { approved: true });
      expect(stale.commands).toEqual([]);
      expect(parse(stale.state).phase).toBe("parked");
    });

    it("asks again after a top-up, under the next call's signal", () => {
      const agent = build({ budget: { steps: 1 }, approval: { tools: ["draft"] } });
      const parked = reply(agent, asking(agent).state, { approved: false });

      const resumed = agent.reduce(parked.state, {
        type: "signal", ts_ms: 5, random: RANDOM, step_id: "topup#1", name: topup.name,
        payload: { steps: 2 }, usage_total: NONE,
      });
      const again = done(agent, resumed.state, {
        step_id: "decide#1",
        activity: decide.name,
        output: { tool: "draft", args: { topic: "kernels" } },
      });

      expect(again.commands[0]).toMatchObject({ name: "agent.tool_approval:1", id: "approve#1" });
    });

    it("keeps the spend an approval was answered with", () => {
      const agent = build({ budget: { tokens: 100 }, approval: { tools: ["draft"] } });
      const waiting = asking(agent);

      const at = agent.reduce(waiting.state, {
        type: "signal", ts_ms: 3, random: RANDOM, step_id: "approve#0", name: approvalSignal(0).name,
        payload: {}, usage_total: { cpu_ms: 0, tokens: 40, cost_micro_usd: 0 },
      });

      expect(parse(at.state).spent.tokens).toBe(40);
    });
  });
});
