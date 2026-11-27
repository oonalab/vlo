/**
 * Drives the agent reducer by hand: events in, the returned state string fed straight back
 * in, exactly as the host will do. No journal, no kernel, no host.
 */

import { defineWorkflow, type Json, type ReductionWire, type Usage, type Workflow } from "../../src/index.ts";
import { agentLoop, type AgentLoopOptions, type AgentState } from "../../src/agent/index.ts";
import { decide, draft, evaluate, tools, topup } from "./example.ts";

export const RANDOM = "0".repeat(32);
export const NONE: Usage = { cpu_ms: 0, tokens: 0, cost_micro_usd: 0 };
export const spent = (tokens: number): Usage => ({ cpu_ms: 0, tokens, cost_micro_usd: 0 });

export type Agent = Workflow<AgentState, Json>;

export function build(overrides: Partial<AgentLoopOptions> = {}, name = "agent"): Agent {
  return defineWorkflow(
    name,
    agentLoop({
      decide,
      tools,
      evaluate,
      threshold: 0.7,
      budget: { tokens: 100 },
      topup,
      maxIterations: 5,
      memoryLimit: 2,
      ...overrides,
    }),
  );
}

export function start(agent: Agent, goal: Json = { topic: "kernels" }): ReductionWire {
  return agent.reduce(
    null,
    { type: "started", ts_ms: 1, random: RANDOM, input: goal, usage_total: NONE },
    goal,
  );
}

export interface DoneArgs {
  step_id: string;
  activity: string;
  output?: Json;
  status?: "succeeded" | "failed";
  error?: string;
  /** The run's banked `usage_total` as of this event. */
  total?: number;
}

export function done(agent: Agent, state: string, args: DoneArgs): ReductionWire {
  return agent.reduce(state, {
    type: "task_done",
    ts_ms: 2,
    random: RANDOM,
    step_id: args.step_id,
    attempt: 1,
    activity: args.activity,
    status: args.status ?? "succeeded",
    usage: NONE,
    usage_total: spent(args.total ?? 0),
    ...(args.output !== undefined ? { output: args.output } : {}),
    ...(args.error !== undefined ? { error: args.error } : {}),
  });
}

export function topUp(agent: Agent, state: string, payload: Json, total = 0): ReductionWire {
  return agent.reduce(state, {
    type: "signal",
    ts_ms: 3,
    random: RANDOM,
    step_id: "topup#1",
    name: topup.name,
    payload,
    usage_total: spent(total),
  });
}

export const parse = (state: string): AgentState => JSON.parse(state) as AgentState;

/** started → the decider picked `draft` → the draft task is in flight. */
export function drafting(agent: Agent, total = 0): ReductionWire {
  const begun = start(agent);
  return done(agent, begun.state, {
    step_id: "decide#0",
    activity: decide.name,
    output: { tool: "draft", args: { topic: "kernels" } },
    total,
  });
}

/** …and the draft came back, so `evaluate` is in flight. */
export function scoring(agent: Agent, total = 0): ReductionWire {
  const drafted = drafting(agent, total);
  return done(agent, drafted.state, {
    step_id: "tool#0",
    activity: draft.name,
    output: { text: "a draft" },
    total,
  });
}

/** The evaluator's verdict for the cycle in flight. */
export function scored(agent: Agent, state: string, score: number, total = 0): ReductionWire {
  return done(agent, state, {
    step_id: "evaluate#0",
    activity: evaluate.name,
    output: { score },
    total,
  });
}
