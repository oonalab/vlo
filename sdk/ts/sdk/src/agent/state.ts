/**
 * The agent's durable state and the shapes that ride on it.
 *
 * Everything here is plain JSON: the reducer's state is journaled byte-exact, so no class,
 * `Map` or `Date` may appear, and a field added later must be optional.
 */

import type { Json, ReducerEvent } from "../index.ts";

/**
 * `Usage` as a type alias rather than the SDK's interface: only an alias gets the implicit
 * index signature that makes it assignable to `Json`.
 */
export type Spent = { cpu_ms: number; tokens: number; cost_micro_usd: number };

export const NO_USAGE: Spent = { cpu_ms: 0, tokens: 0, cost_micro_usd: 0 };

/** Ceilings the loop enforces. An absent field is unbounded. */
export interface Budget {
  tokens?: number;
  costMicroUsd?: number;
  steps?: number;
}

/** What `decide` returned: the next tool to run, or `"done"` with the final answer. */
export interface Decision {
  tool: string;
  args?: unknown;
  rationale?: string | undefined;
  final?: Json | undefined;
}

/** One journaled fact the next `decide` gets to read. */
export interface Observation {
  tool: string;
  args?: Json;
  output?: Json;
  error?: string;
  score?: number;
}

export type AgentPhase = "decide" | "tool" | "evaluate" | "parked" | "done";

export interface AgentState {
  phase: AgentPhase;
  goal: Json;
  /** Completed cycles, and the step-id suffix of the one in flight. */
  iteration: number;
  memory: Observation[];
  candidate?: Json;
  score?: number;
  /** The tool dispatched this iteration, so its result can be attributed to it. */
  pending?: { tool: string; args: Json };
  budget: Budget;
  spent: Spent;
}

/** The run's output. `exhausted` means the loop stopped on a ceiling, not on a verdict. */
export interface AgentResult {
  candidate: Json;
  score?: number;
  iterations: number;
  spent: Spent;
  exhausted?: true;
}

/** The run total the kernel banked, including the event that carries it. */
export function spentOf(event: ReducerEvent): Spent {
  return event.usage_total;
}

/** These shapes are JSON by construction; TypeScript cannot see it through optional keys. */
export function asJson(value: unknown): Json {
  return value as Json;
}
