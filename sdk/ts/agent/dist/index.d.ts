import { Activity, Json, RetryOptions, SignalDef, WorkflowDef } from "@vlo/sdk";
import { z } from "zod";
//#region src/state.d.ts
/**
 * `Usage` as a type alias rather than the SDK's interface: only an alias gets the implicit
 * index signature that makes it assignable to `Json`.
 */
type Spent = {
  cpu_ms: number;
  tokens: number;
  cost_micro_usd: number;
};
/** Ceilings the loop enforces. An absent field is unbounded. */
interface Budget {
  tokens?: number;
  costMicroUsd?: number;
  steps?: number;
}
/** What `decide` returned: the next tool to run, or `"done"` with the final answer. */
interface Decision {
  tool: string;
  args?: unknown;
  rationale?: string | undefined;
  final?: Json | undefined;
}
/** One journaled fact the next `decide` gets to read. */
interface Observation {
  tool: string;
  args?: Json;
  output?: Json;
  error?: string;
  score?: number;
}
type AgentPhase = "decide" | "tool" | "evaluate" | "parked" | "done";
interface AgentState {
  phase: AgentPhase;
  goal: Json;
  /** Completed cycles, and the step-id suffix of the one in flight. */
  iteration: number;
  memory: Observation[];
  candidate?: Json;
  score?: number;
  /** The tool dispatched this iteration, so its result can be attributed to it. */
  pending?: {
    tool: string;
    args: Json;
  };
  budget: Budget;
  spent: Spent;
}
/** The run's output. `exhausted` means the loop stopped on a ceiling, not on a verdict. */
interface AgentResult {
  candidate: Json;
  score?: number;
  iterations: number;
  spent: Spent;
  exhausted?: true;
}
//#endregion
//#region src/decision.d.ts
/** Reserved tool name: the decider is finished and `final` (or the last candidate) is the answer. */
export declare const DONE = "done";
interface DecisionOptions<I extends z.ZodType> {
  /** What the decider is shown. `agentLoop` sends `{ goal, memory, candidate, score }`. */
  input: I;
  /** The tools it may pick from, keyed by the name it returns in `tool`. */
  tools: Record<string, Activity>;
  retry?: RetryOptions;
  queue?: string;
  /** Wall-clock ceiling for one decision; the host fails the task with `cause: "timeout"`. */
  timeoutMs?: number;
}
export declare function decision<I extends z.ZodType>(name: string, options: DecisionOptions<I>): Activity<z.infer<I>, Decision>;
//#endregion
//#region src/budget.d.ts
export declare const DEFAULT_TOPUP_SIGNAL = "agent.budget_topup";
/** What a top-up grants. Every field is added to the matching ceiling. */
interface BudgetTopup {
  tokens?: number | undefined;
  costMicroUsd?: number | undefined;
  steps?: number | undefined;
}
/** The signal a parked agent waits on. Pass the result to `agentLoop({ topup })`. */
export declare function budgetTopup(name?: string): SignalDef<BudgetTopup>;
//#endregion
//#region src/loop.d.ts
export declare const DEFAULT_MAX_ITERATIONS = 50;
export declare const DEFAULT_MEMORY_LIMIT = 20;
interface AgentLoopOptions {
  /** Picks the next tool. Build it with `decision(...)`, or hand-roll the same output shape. */
  decide: Activity;
  /** Dispatchable tools, keyed by the name `decide` returns. */
  tools: Record<string, Activity>;
  /** Scores the candidate a tool produced. Its output is `number` or `{ score: number }`. */
  evaluate?: Activity | undefined;
  /** Score at or above which the run completes. Without one, only `decide` can finish. */
  threshold?: number | undefined;
  budget: Budget;
  topup?: SignalDef<BudgetTopup> | undefined;
  maxIterations?: number | undefined;
  /** Observations kept in state; older ones are dropped so the checkpoint stays bounded. */
  memoryLimit?: number | undefined;
}
export declare function agentLoop(options: AgentLoopOptions): WorkflowDef<AgentState, Json>;
//#endregion
export type { AgentLoopOptions, AgentPhase, AgentResult, AgentState, Budget, BudgetTopup, Decision, DecisionOptions, Observation, Spent };