/**
 * `@oona/vlo/agent` — the agent layer, built on the authoring surface of `@oona/vlo`.
 *
 * An agent is the reducer model in its purest form: state is memory plus budget, the event
 * is an observation, the command is the next tool call. Nothing here does I/O; `agentLoop`
 * returns a `WorkflowDef` you hand to `defineWorkflow`.
 */

export { decision, DONE, type DecisionOptions } from "./decision.ts";

export {
  budgetTopup,
  DEFAULT_TOPUP_SIGNAL,
  type BudgetTopup,
} from "./budget.ts";

export {
  agentLoop,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_MEMORY_LIMIT,
  type AgentLoopOptions,
} from "./loop.ts";

export type {
  AgentPhase,
  AgentResult,
  AgentState,
  Budget,
  Decision,
  Observation,
  Spent,
} from "./state.ts";
