/** The budget that parks rather than fails, the top-up that resumes it, and the bounded
 * memory that keeps the checkpoint small. */

import { describe, expect, it } from "vitest";
import { build, done, parse, scored, scoring, start, topUp, type Agent } from "./driver.ts";
import { decide, rewrite, topup } from "./example.ts";

/** A cycle whose evaluator pushes the run over its 100-token ceiling. */
function parked(agent: Agent) {
  return scored(agent, scoring(agent, 40).state, 0.4, 140);
}

describe("agentLoop · budget", () => {
  it("parks on the top-up signal when a ceiling is reached", () => {
    const at = parked(build());

    expect(at.commands).toEqual([
      {
        type: "emit",
        channel: "agent",
        data: {
          parked: {
            iteration: 1,
            budget: { tokens: 100 },
            spent: { cpu_ms: 0, tokens: 140, cost_micro_usd: 0 },
            candidate: { text: "a draft" },
            score: 0.4,
          },
        },
      },
      { type: "await_signal", name: topup.name, schema_ref: topup.schemaRef, id: "topup#1" },
    ]);
    expect(parse(at.state).phase).toBe("parked");
  });

  it("resumes with a raised ceiling when the top-up arrives", () => {
    const agent = build();

    const resumed = topUp(agent, parked(agent).state, { tokens: 200 }, 140);

    expect(resumed.commands).toMatchObject([
      { type: "task", activity: decide.name, id: "decide#1" },
    ]);
    expect(parse(resumed.state)).toMatchObject({ phase: "decide", budget: { tokens: 300 } });
  });

  it("parks on a step ceiling and leaves an unbounded one unbounded", () => {
    const agent = build({ budget: { steps: 1 } }, "agent-steps");
    const stopped = scored(agent, scoring(agent).state, 0.4);
    expect(parse(stopped.state).phase).toBe("parked");

    const resumed = topUp(agent, stopped.state, { tokens: 50, steps: 2 });

    expect(parse(resumed.state).budget).toEqual({ steps: 3 });
  });

  it("completes rather than fails once maxIterations is reached", () => {
    const agent = build({ maxIterations: 1 }, "agent-one-shot");

    const finished = scored(agent, scoring(agent, 5).state, 0.4, 5);

    expect(finished.commands).toEqual([
      {
        type: "complete",
        output: {
          candidate: { text: "a draft" },
          score: 0.4,
          iterations: 1,
          spent: { cpu_ms: 0, tokens: 5, cost_micro_usd: 0 },
          exhausted: true,
        },
      },
    ]);
  });
});

describe("agentLoop · memory", () => {
  it("keeps only the most recent `memoryLimit` observations", () => {
    const agent = build({ evaluate: undefined, threshold: undefined }, "agent-memory");
    let at = start(agent);

    for (let iteration = 0; iteration < 3; iteration += 1) {
      at = done(agent, at.state, {
        step_id: `decide#${iteration}`,
        activity: decide.name,
        output: { tool: "rewrite", args: { text: `pass ${iteration}` } },
      });
      at = done(agent, at.state, {
        step_id: `tool#${iteration}`,
        activity: rewrite.name,
        output: { text: `pass ${iteration}` },
      });
    }

    const memory = parse(at.state).memory;
    expect(memory).toHaveLength(2);
    expect(memory.map((observation) => observation.output)).toEqual([
      { text: "pass 1" },
      { text: "pass 2" },
    ]);
  });
});
