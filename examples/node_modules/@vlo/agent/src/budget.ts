/**
 * The budget: ceilings on what one run may spend, and the signal that raises them.
 *
 * Exhaustion parks the run rather than failing it, so the work already paid
 * for survives while a human decides whether to keep going.
 */

import { signal, type SignalDef } from "@vlo/sdk";
import { z } from "zod";
import type { Budget, Spent } from "./state.ts";

export const DEFAULT_TOPUP_SIGNAL = "agent.budget_topup";

/** What a top-up grants. Every field is added to the matching ceiling. */
export interface BudgetTopup {
  tokens?: number | undefined;
  costMicroUsd?: number | undefined;
  steps?: number | undefined;
}

const TOPUP_SCHEMA = z.object({
  tokens: z.number().nonnegative().optional(),
  costMicroUsd: z.number().nonnegative().optional(),
  steps: z.number().int().nonnegative().optional(),
});

/** The signal a parked agent waits on. Pass the result to `agentLoop({ topup })`. */
export function budgetTopup(name: string = DEFAULT_TOPUP_SIGNAL): SignalDef<BudgetTopup> {
  return signal(name, TOPUP_SCHEMA);
}

/** True once any configured ceiling is reached. Absent ceilings never bind. */
export function isExhausted(budget: Budget, spent: Spent, iteration: number): boolean {
  if (budget.tokens !== undefined && spent.tokens >= budget.tokens) return true;
  if (budget.costMicroUsd !== undefined && spent.cost_micro_usd >= budget.costMicroUsd) return true;
  if (budget.steps !== undefined && iteration >= budget.steps) return true;
  return false;
}

/**
 * Raises the ceilings a top-up names. A ceiling that was never set stays unbounded —
 * granting 100 tokens to an unlimited budget must not turn it into a limit of 100.
 */
export function grant(budget: Budget, topup: BudgetTopup): Budget {
  return {
    ...(budget.tokens !== undefined ? { tokens: budget.tokens + (topup.tokens ?? 0) } : {}),
    ...(budget.costMicroUsd !== undefined
      ? { costMicroUsd: budget.costMicroUsd + (topup.costMicroUsd ?? 0) }
      : {}),
    ...(budget.steps !== undefined ? { steps: budget.steps + (topup.steps ?? 0) } : {}),
  };
}
