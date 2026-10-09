/** The agent reducer's cycle: decide → tool → evaluate → complete, and what it does when
 * a step goes wrong. Budget and memory live in `budget.test.ts`. */

import { describe, expect, it } from "vitest";
import { build, done, drafting, parse, scored, scoring, start, topUp } from "./driver.ts";
import { decide, draft, evaluate } from "./example.ts";

describe("agentLoop · the cycle", () => {
  it("asks the decider first, with the goal and an empty memory", () => {
    const begun = start(build());

    expect(begun.commands).toMatchObject([
      {
        type: "task",
        activity: decide.name,
        id: "decide#0",
        input: { goal: { topic: "kernels" }, memory: [], candidate: null, score: null },
      },
    ]);
    expect(parse(begun.state)).toMatchObject({ phase: "decide", iteration: 0, memory: [] });
  });

  it("dispatches the tool the decider picked, with validated args", () => {
    const at = drafting(build());

    expect(at.commands).toMatchObject([
      { type: "task", activity: draft.name, id: "tool#0", input: { topic: "kernels" } },
    ]);
    expect(parse(at.state)).toMatchObject({
      phase: "tool",
      pending: { tool: "draft", args: { topic: "kernels" } },
    });
  });

  it("evaluates the tool's output and records it as an observation", () => {
    const at = scoring(build());

    expect(at.commands).toMatchObject([
      {
        type: "task",
        activity: evaluate.name,
        id: "evaluate#0",
        input: { goal: { topic: "kernels" }, candidate: { text: "a draft" } },
      },
    ]);
    const state = parse(at.state);
    expect(state.phase).toBe("evaluate");
    expect(state.candidate).toEqual({ text: "a draft" });
    expect(state.memory).toEqual([
      { tool: "draft", args: { topic: "kernels" }, output: { text: "a draft" } },
    ]);
  });

  it("completes once the score reaches the threshold", () => {
    const agent = build();

    const finished = scored(agent, scoring(agent, 30).state, 0.8, 30);

    expect(finished.commands).toEqual([
      {
        type: "complete",
        output: {
          candidate: { text: "a draft" },
          score: 0.8,
          iterations: 1,
          spent: { cpu_ms: 0, tokens: 30, cost_micro_usd: 0 },
        },
      },
    ]);
    expect(parse(finished.state).phase).toBe("done");
  });

  it("loops back to the decider when the score is below the threshold", () => {
    const agent = build();

    const again = scored(agent, scoring(agent).state, 0.4);

    expect(again.commands).toMatchObject([{ type: "task", activity: decide.name, id: "decide#1" }]);
    const state = parse(again.state);
    expect(state).toMatchObject({ phase: "decide", iteration: 1, score: 0.4 });
    // The score is folded into the observation that produced the candidate.
    expect(state.memory[0]).toMatchObject({ tool: "draft", score: 0.4 });
    expect(state.pending).toBeUndefined();
  });

  it("goes straight back to the decider when no evaluator is configured", () => {
    const agent = build({ evaluate: undefined }, "agent-no-eval");
    const at = drafting(agent);

    const again = done(agent, at.state, {
      step_id: "tool#0",
      activity: draft.name,
      output: { text: "a draft" },
    });

    expect(again.commands).toMatchObject([{ type: "task", activity: decide.name, id: "decide#1" }]);
    expect(parse(again.state).candidate).toEqual({ text: "a draft" });
  });

  it("completes when the decider says `done`", () => {
    const agent = build();

    const finished = done(agent, start(agent).state, {
      step_id: "decide#0",
      activity: decide.name,
      output: { tool: "done", final: { text: "ship it" }, rationale: "good enough" },
      total: 12,
    });

    expect(finished.commands).toEqual([
      {
        type: "complete",
        output: {
          candidate: { text: "ship it" },
          iterations: 1,
          spent: { cpu_ms: 0, tokens: 12, cost_micro_usd: 0 },
        },
      },
    ]);
  });
});

describe("agentLoop · routing around trouble", () => {
  it("turns a failed task into an observation and decides again", () => {
    const agent = build();

    const again = done(agent, drafting(agent).state, {
      step_id: "tool#0",
      activity: draft.name,
      status: "failed",
      error: "the model refused",
    });

    expect(again.commands).toMatchObject([{ type: "task", activity: decide.name, id: "decide#1" }]);
    expect(parse(again.state).memory).toEqual([{ tool: "draft", error: "the model refused" }]);
  });

  it("turns args the tool's schema rejects into an observation", () => {
    const agent = build();

    const again = done(agent, start(agent).state, {
      step_id: "decide#0",
      activity: decide.name,
      output: { tool: "draft", args: { topic: 42 } },
    });

    expect(again.commands).toMatchObject([{ type: "task", activity: decide.name, id: "decide#1" }]);
    const observation = parse(again.state).memory[0];
    expect(observation).toMatchObject({ tool: "draft", args: { topic: 42 } });
    expect(observation?.error).toMatch(/^invalid args:/);
  });

  it("turns a tool nobody registered into an observation", () => {
    const agent = build();

    const again = done(agent, start(agent).state, {
      step_id: "decide#0",
      activity: decide.name,
      output: { tool: "teleport", args: {} },
    });

    expect(again.commands).toMatchObject([{ type: "task", activity: decide.name, id: "decide#1" }]);
    expect(parse(again.state).memory).toEqual([
      { tool: "teleport", error: 'unknown tool "teleport"' },
    ]);
  });

  it("ignores a result from a step the loop is not waiting for", () => {
    const agent = build();
    const at = drafting(agent);

    const stale = done(agent, at.state, {
      step_id: "tool#7",
      activity: draft.name,
      output: { text: "from another iteration" },
    });

    expect(stale.commands).toEqual([]);
    expect(stale.state).toBe(at.state);
  });

  it("ignores a top-up that arrives while the run is not parked", () => {
    const agent = build();

    const ignored = topUp(agent, drafting(agent).state, { tokens: 500 });

    expect(ignored.commands).toEqual([]);
    expect(parse(ignored.state).budget).toEqual({ tokens: 100 });
  });
});
