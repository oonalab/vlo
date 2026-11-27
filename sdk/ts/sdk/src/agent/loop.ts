/**
 * `agentLoop` — decide → tool → evaluate, as a pure reducer.
 *
 * Nothing loops at runtime: every arrow below is one journaled event folded into state, so
 * the run survives a crash mid-thought and replays deterministically. The budget is a
 * reducer decision over the usage the kernel banks on each event — exhaustion parks the run
 * on a top-up signal instead of failing it.
 */

import {
  cmd,
  WorkflowFailure,
  type Activity,
  type Json,
  type Reduction,
  type ReducerEvent,
  type SignalDef,
  type WorkflowDef,
} from "../index.ts";
import { budgetTopup, grant, isExhausted, type BudgetTopup } from "./budget.ts";
import { DONE } from "./decision.ts";
import {
  asJson,
  NO_USAGE,
  spentOf,
  type AgentResult,
  type AgentState,
  type Budget,
  type Decision,
  type Observation,
} from "./state.ts";

export const DEFAULT_MAX_ITERATIONS = 50;
export const DEFAULT_MEMORY_LIMIT = 20;

export interface AgentLoopOptions {
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

/** Activities are stored with their types erased; Zod still validates every input. */
type ErasedActivity = Activity<Json, Json>;
type TaskDone = Extract<ReducerEvent, { type: "task_done" }>;
type SignalEvent = Extract<ReducerEvent, { type: "signal" }>;

interface Compiled {
  readonly decide: ErasedActivity;
  readonly tools: ReadonlyMap<string, ErasedActivity>;
  readonly evaluate: ErasedActivity | undefined;
  readonly threshold: number | undefined;
  readonly budget: Budget;
  readonly topup: SignalDef<BudgetTopup>;
  readonly maxIterations: number;
  readonly memoryLimit: number;
}

/** One step id per phase per iteration, so a replay asks the kernel for the same step. */
const STEP_ID = {
  decide: (i: number) => `decide#${i}`,
  tool: (i: number) => `tool#${i}`,
  evaluate: (i: number) => `evaluate#${i}`,
  topup: (i: number) => `topup#${i}`,
} as const;

export function agentLoop(options: AgentLoopOptions): WorkflowDef<AgentState, Json> {
  const cfg = compile(options);

  return {
    init: (goal) => ({
      phase: "decide",
      goal,
      iteration: 0,
      memory: [],
      budget: cfg.budget,
      spent: NO_USAGE,
    }),
    on: {
      started: (state) => decide(cfg, state),
      task_done: (state, event) => onTaskDone(cfg, state, event),
      signal: (state, event) => onSignal(cfg, state, event),
    },
  };
}

function compile(options: AgentLoopOptions): Compiled {
  const tools = new Map<string, ErasedActivity>(
    Object.entries(options.tools).map(([name, target]) => [name, erase(target)]),
  );
  if (tools.size === 0) throw new TypeError("agentLoop: no tools given");

  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const memoryLimit = options.memoryLimit ?? DEFAULT_MEMORY_LIMIT;
  if (maxIterations < 1) throw new TypeError("agentLoop: maxIterations must be >= 1");
  if (memoryLimit < 1) throw new TypeError("agentLoop: memoryLimit must be >= 1");

  return {
    decide: erase(options.decide),
    tools,
    evaluate: options.evaluate === undefined ? undefined : erase(options.evaluate),
    threshold: options.threshold,
    budget: options.budget,
    topup: options.topup ?? budgetTopup(),
    maxIterations,
    memoryLimit,
  };
}

const erase = (target: Activity): ErasedActivity => target as unknown as ErasedActivity;

function decide(cfg: Compiled, state: AgentState): Reduction<AgentState> {
  const at: AgentState = { ...clearPending(state), phase: "decide" };
  const input = asJson({
    goal: at.goal,
    memory: at.memory,
    candidate: at.candidate ?? null,
    score: at.score ?? null,
  });
  return [at, [cmd.task(cfg.decide, input, { id: STEP_ID.decide(at.iteration) })]];
}

/**
 * A result the loop is not waiting for — a duplicate delivery, or one from an iteration
 * already left behind — is folded and ignored, exactly as the `sequence` helper does.
 */
function onTaskDone(cfg: Compiled, state: AgentState, event: TaskDone): Reduction<AgentState> {
  if (state.phase === "parked" || state.phase === "done") return [state, []];
  if (event.step_id !== STEP_ID[state.phase](state.iteration)) return [state, []];

  const at: AgentState = { ...state, spent: spentOf(event) };
  if (event.status !== "succeeded") return observeFailure(cfg, at, event);
  if (state.phase === "decide") return onDecided(cfg, at, event);
  if (state.phase === "tool") return onToolDone(cfg, at, event);
  return onEvaluated(cfg, at, event);
}

/** Agents route around failures: a task that exhausted its retries becomes an observation. */
function observeFailure(cfg: Compiled, state: AgentState, event: TaskDone): Reduction<AgentState> {
  const tool = state.pending?.tool ?? event.activity;
  const error = event.error ?? event.status;
  return advance(cfg, remember(cfg, state, { tool, error }));
}

function onDecided(cfg: Compiled, state: AgentState, event: TaskDone): Reduction<AgentState> {
  const decision = readDecision(event.output ?? null);
  if (decision.tool === DONE) {
    return complete(state, decision.final ?? state.candidate ?? null, false);
  }

  const target = cfg.tools.get(decision.tool);
  if (target === undefined) {
    const error = `unknown tool "${decision.tool}"`;
    return advance(cfg, remember(cfg, state, { tool: decision.tool, error }));
  }

  // The decider is an LLM: bad arguments are an ordinary outcome, not a run failure.
  const parsed = target.input.safeParse(decision.args ?? null);
  if (!parsed.success) {
    const error = `invalid args: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`;
    return advance(
      cfg,
      remember(cfg, state, { tool: decision.tool, args: asJson(decision.args ?? null), error }),
    );
  }

  const args = parsed.data;
  const at: AgentState = { ...state, phase: "tool", pending: { tool: decision.tool, args } };
  return [at, [cmd.task(target, args, { id: STEP_ID.tool(state.iteration) })]];
}

function onToolDone(cfg: Compiled, state: AgentState, event: TaskDone): Reduction<AgentState> {
  const output = event.output ?? null;
  const pending = state.pending;
  const observed = remember(cfg, state, {
    tool: pending?.tool ?? event.activity,
    ...(pending !== undefined ? { args: pending.args } : {}),
    output,
  });
  const at: AgentState = { ...observed, candidate: output };

  if (cfg.evaluate === undefined) return advance(cfg, at);
  const input = asJson({ goal: at.goal, candidate: output });
  return [
    { ...at, phase: "evaluate" },
    [cmd.task(cfg.evaluate, input, { id: STEP_ID.evaluate(state.iteration) })],
  ];
}

function onEvaluated(cfg: Compiled, state: AgentState, event: TaskDone): Reduction<AgentState> {
  const score = readScore(event.output ?? null);
  // The score belongs to the observation that produced the candidate, so `decide` sees both.
  const at: AgentState = { ...state, score, memory: scoreLast(state.memory, score) };

  if (cfg.threshold !== undefined && score >= cfg.threshold) {
    return complete(at, at.candidate ?? null, false);
  }
  return advance(cfg, at);
}

function onSignal(cfg: Compiled, state: AgentState, event: SignalEvent): Reduction<AgentState> {
  if (state.phase !== "parked" || event.name !== cfg.topup.name) return [state, []];

  const granted = cfg.topup.schema.safeParse(event.payload);
  const at: AgentState = {
    ...state,
    spent: spentOf(event),
    budget: grant(state.budget, granted.success ? granted.data : {}),
  };
  // Resume unconditionally: a grant too small to help parks again next iteration, under a
  // fresh step id, rather than re-opening the wait this signal just closed.
  return decide(cfg, at);
}

/** One cycle is over: charge it against the ceilings, then decide again — or park. */
function advance(cfg: Compiled, state: AgentState): Reduction<AgentState> {
  const at: AgentState = { ...state, iteration: state.iteration + 1 };
  if (at.iteration >= cfg.maxIterations) return complete(at, at.candidate ?? null, true);
  if (isExhausted(at.budget, at.spent, at.iteration)) return park(cfg, at);
  return decide(cfg, at);
}

function park(cfg: Compiled, state: AgentState): Reduction<AgentState> {
  const at: AgentState = { ...clearPending(state), phase: "parked" };
  const parked = asJson({
    parked: {
      iteration: at.iteration,
      budget: at.budget,
      spent: at.spent,
      candidate: at.candidate ?? null,
      score: at.score ?? null,
    },
  });
  return [
    at,
    [cmd.emit("agent", parked), cmd.awaitSignal(cfg.topup, { id: STEP_ID.topup(at.iteration) })],
  ];
}

function complete(state: AgentState, candidate: Json, exhausted: boolean): Reduction<AgentState> {
  const result: AgentResult = {
    candidate,
    ...(state.score !== undefined ? { score: state.score } : {}),
    // Finishing mid-cycle counts the cycle in flight; exhaustion already advanced past it.
    iterations: exhausted ? state.iteration : state.iteration + 1,
    spent: state.spent,
    ...(exhausted ? { exhausted: true } : {}),
  };
  return [{ ...state, phase: "done", candidate }, [cmd.complete(asJson(result))]];
}

function remember(cfg: Compiled, state: AgentState, observation: Observation): AgentState {
  return { ...state, memory: [...state.memory, observation].slice(-cfg.memoryLimit) };
}

function scoreLast(memory: readonly Observation[], score: number): Observation[] {
  const last = memory[memory.length - 1];
  if (last === undefined) return [];
  return [...memory.slice(0, -1), { ...last, score }];
}

/** A new decision supersedes whatever the previous one dispatched. */
function clearPending(state: AgentState): AgentState {
  const next = { ...state };
  delete next.pending;
  return next;
}

function readDecision(output: Json): Decision {
  if (output === null || typeof output !== "object" || Array.isArray(output)) {
    throw new WorkflowFailure("agent: decide returned no decision object", output);
  }
  const tool = output["tool"];
  if (typeof tool !== "string") {
    throw new WorkflowFailure("agent: decide returned no `tool`", output);
  }
  return {
    tool,
    args: output["args"],
    rationale: typeof output["rationale"] === "string" ? output["rationale"] : undefined,
    final: output["final"],
  };
}

function readScore(output: Json): number {
  if (typeof output === "number") return output;
  if (output !== null && typeof output === "object" && !Array.isArray(output)) {
    const score = output["score"];
    if (typeof score === "number") return score;
  }
  throw new WorkflowFailure("agent: evaluate returned no numeric `score`", output);
}
