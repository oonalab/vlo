/**
 * Typed reads over {@link SeqState}. `results` and `signals` are `Record<string, Json>`
 * because the state is stored as text; these helpers put the activity's and signal's
 * inferred types back without a cast at every call site.
 *
 * Precondition for all of them: only phases *earlier* in the sequence have a value. The
 * current phase's own output and anything after it are not there yet, and reading them
 * throws a `TypeError` naming the missing key, which fails the run.
 */

import type { Json } from "../../kernel/protocol.ts";
import type { Activity, SignalDef } from "../activity.ts";
import type { ChildResult, SeqState } from "./sequence-types.ts";

/**
 * The output of an earlier {@link step} on `target`, typed as the activity's output.
 *
 * @example
 * ```ts
 * step(finish, (state) => ({ uppers: resultOf(state, plan).items, approvedBy: "auto" }))
 * ```
 */
export function resultOf<I, O>(state: SeqState, target: Activity<I, O>): O {
  return stored(state.results, target.name, "result") as O;
}

/**
 * The outputs of an earlier {@link fanOut} on `target`, in item order. An empty
 * selection stored `[]`.
 *
 * @example
 * ```ts
 * step(finish, (state) => ({
 *   uppers: fanOutResultsOf(state, work).map((output) => output.upper),
 *   approvedBy: "auto",
 * }))
 * ```
 */
export function fanOutResultsOf<I, O>(state: SeqState, target: Activity<I, O>): O[] {
  return stored(state.results, target.name, "fan-out result") as O[];
}

/**
 * The outcomes of an earlier {@link fanOutRuns} on `target`, in item order: one
 * {@link ChildResult} per child, whose `output` is `null` unless the child completed. An
 * empty selection stored `[]`. `O` is the child workflow's completion output type.
 *
 * @example
 * ```ts
 * step(summarise, (state) => ({
 *   read: fanOutRunsResultsOf<{ ok: boolean }>(state, readSource).filter((r) => r.output?.ok).length,
 * }))
 * ```
 */
export function fanOutRunsResultsOf<O = Json>(
  state: SeqState,
  target: string | { readonly name: string },
): ChildResult<O>[] {
  const name = typeof target === "string" ? target : target.name;
  return stored(state.results, name, "fan-out runs result") as ChildResult<O>[];
}

/**
 * The payload an earlier {@link waitFor} on `definition` received, typed as the signal's
 * payload. After an `onTimeout: "continue"` deadline the stored value is `null`, which
 * this returns as-is; narrow it yourself when that option is in play.
 *
 * @example
 * ```ts
 * step(finish, (state) => ({ uppers: [], approvedBy: signalOf(state, approve).by }))
 * ```
 */
export function signalOf<T>(state: SeqState, definition: SignalDef<T>): T {
  return stored(state.signals, definition.name, "signal") as T;
}

function stored(store: Record<string, unknown>, key: string, what: string): unknown {
  const value = store[key];
  if (value === undefined) {
    throw new TypeError(
      `no ${what} for "${key}" yet: only phases earlier in the sequence have a value`,
    );
  }
  return value;
}
