/**
 * `sequence` — the pipeline helper. It compiles a list of phases ({@link step}, {@link fanOut},
 * {@link fanOutRuns}, {@link waitFor}, {@link sleep}) into the same `WorkflowDef` a hand-written
 * reducer produces; there is no extra runtime. Phases run in order; outputs land in `results`
 * keyed by activity or workflow name and signal payloads in `signals` keyed by signal name, so
 * two phases on the same target share a key. After the last phase the run completes with
 * `results`, or with `output(state)` when given. A task or child that did not succeed throws
 * {@link WorkflowFailure} unless its phase says `onFailure: "continue"`. Events that do not
 * belong to the current phase (stale or duplicate deliveries, a signal nobody waits for) are
 * ignored.
 */

import type { Json } from "../../kernel/protocol.ts";
import type { Activity, SignalDef } from "../activity.ts";
import type { WorkflowDef } from "../workflow.ts";
import {
  enterPhase,
  onChildDone,
  onSignal,
  onTaskDone,
  onTimer,
  withUsage,
} from "./sequence-reduce.ts";
import type {
  ErasedActivity,
  FanOutOptions,
  FanOutRunsOptions,
  SeqState,
  SeqStep,
  SequenceOptions,
  StepOptions,
  WaitForOptions,
} from "./sequence-types.ts";

export type {
  ChildResult,
  ChildStatus,
  ErasedActivity,
  FanOutOptions,
  FanOutRunsOptions,
  FanState,
  OnFailure,
  OnTimeout,
  SeqState,
  SeqStep,
  SequenceOptions,
  StepOptions,
  WaitForOptions,
} from "./sequence-types.ts";

/**
 * A {@link sequence} phase that runs `target` once.
 *
 * Without `mapInput` the task input is the run's start input for phase 0 and the previous
 * phase's stored value afterwards (sleeps are skipped). The output is stored in
 * `results[target.name]`. A task that does not succeed fails the run, unless
 * `onFailure: "continue"` stores `null` instead; `when` returning `false` also stores `null`
 * and skips the task. `id` pins the step id for handlers that key on it.
 *
 * @example
 * ```ts
 * import { defineWorkflow, resultOf, sequence, step } from "@oona/vlo";
 * import { finish, notify, plan } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   step(finish, (state) => ({ uppers: resultOf(state, plan).items, approvedBy: "auto" })),
 *   step(notify, undefined, { onFailure: "continue", when: (s) => resultOf(s, plan).items.length > 0 }),
 * ]));
 * ```
 */
export function step<I, O>(
  target: Activity<I, O>,
  mapInput?: (state: SeqState) => I,
  options: StepOptions = {},
): SeqStep {
  return {
    kind: "step",
    key: target.name,
    activity: target as unknown as ErasedActivity,
    ...(mapInput !== undefined
      ? { mapInput: mapInput as unknown as (state: SeqState) => Json }
      : {}),
    ...(options.id !== undefined ? { id: options.id } : {}),
    ...(options.onFailure !== undefined ? { onFailure: options.onFailure } : {}),
    ...(options.when !== undefined ? { when: options.when } : {}),
  };
}

/**
 * A {@link sequence} phase that runs `target` once per item `select` returns, at most
 * `concurrency` at a time, with step ids `${target.name}#${index}`.
 *
 * `select` must be pure and read only state written by earlier phases: it is re-evaluated
 * on every event of the phase and the run fails if it returns a different count. Outputs
 * are stored in `results[target.name]` in item order; an empty selection stores `[]` and
 * moves on. A task that does not succeed fails the run, unless `onFailure: "continue"`
 * stores `null` for that item.
 *
 * Throws a `TypeError` synchronously unless `concurrency` is an integer ≥ 1.
 *
 * @example
 * ```ts
 * import { defineWorkflow, fanOut, resultOf, sequence, step } from "@oona/vlo";
 * import { plan, work } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   fanOut(work, (state) => resultOf(state, plan).items.map((item) => ({ item })), { concurrency: 2 }),
 * ]));
 * ```
 */
export function fanOut<I, O>(
  target: Activity<I, O>,
  select: (state: SeqState) => I[],
  options: FanOutOptions,
): SeqStep {
  assertConcurrency("fanOut", options.concurrency);
  return {
    kind: "fan_out",
    key: target.name,
    activity: target as unknown as ErasedActivity,
    select: select as unknown as (state: SeqState) => Json[],
    concurrency: options.concurrency,
    ...(options.onFailure !== undefined ? { onFailure: options.onFailure } : {}),
  };
}

/**
 * A {@link sequence} phase that spawns one child run of `target` per item `select` returns,
 * at most `concurrency` at a time, with step ids `${workflow}#${index}`.
 *
 * `select` has the same purity rule as {@link fanOut}. Each item is the child's start input.
 * The phase stores a {@link ChildResult} per item in `results[workflow]`, in item order;
 * read it with {@link fanOutRunsResultsOf}. An empty selection stores `[]` and moves on.
 * A child that did not complete fails the run, unless `onFailure: "continue"` records its
 * status and moves on. The child workflow must be registered on the same host.
 *
 * Throws a `TypeError` synchronously unless `concurrency` is an integer ≥ 1.
 *
 * @example
 * ```ts
 * import { defineWorkflow, fanOutRuns, fanOutRunsResultsOf, resultOf, sequence, step } from "@oona/vlo";
 * import { plan, summarise } from "./activities.ts";
 * import { readSource } from "./read-source.workflow.ts";
 *
 * export default defineWorkflow("research", sequence([
 *   step(plan),
 *   fanOutRuns(readSource, (s) => resultOf(s, plan).sourceIds.map((sourceId) => ({ sourceId })), {
 *     concurrency: 5,
 *     onFailure: "continue",
 *   }),
 *   step(summarise, (s) => ({ read: fanOutRunsResultsOf(s, readSource).filter((r) => r.status === "succeeded").length })),
 * ]));
 * ```
 */
export function fanOutRuns<I extends Json = Json>(
  target: string | { readonly name: string },
  select: (state: SeqState) => I[],
  options: FanOutRunsOptions,
): SeqStep {
  assertConcurrency("fanOutRuns", options.concurrency);
  return {
    kind: "fan_out_runs",
    key: nameOf(target),
    workflow: nameOf(target),
    select: select as unknown as (state: SeqState) => Json[],
    concurrency: options.concurrency,
    ...(options.onFailure !== undefined ? { onFailure: options.onFailure } : {}),
  };
}

/**
 * A {@link sequence} phase that parks the run until `definition` is delivered.
 *
 * The payload is stored in `signals[definition.name]`. With `timeoutMs` the wait races the
 * kernel's paired deadline timer (the loser is cancelled): `onTimeout: "fail"` (default)
 * fails the run, `"continue"` stores `null` and advances. `context` is emitted on the
 * `human` channel when the wait opens. A signal or deadline arriving for a phase already
 * left behind is ignored.
 *
 * @example
 * ```ts
 * import { defineWorkflow, sequence, signalOf, step, waitFor } from "@oona/vlo";
 * import { approve, finish, plan } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   waitFor(approve, { timeoutMs: 86_400_000, onTimeout: "fail", context: { what: "plan" } }),
 *   step(finish, (state) => ({ uppers: [], approvedBy: signalOf(state, approve).by })),
 * ]));
 * ```
 */
export function waitFor<T>(definition: SignalDef<T>, options: WaitForOptions = {}): SeqStep {
  return {
    kind: "wait_for",
    key: definition.name,
    signal: definition as unknown as SignalDef<Json>,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    ...(options.onTimeout !== undefined ? { onTimeout: options.onTimeout } : {}),
    ...(options.context !== undefined ? { context: options.context } : {}),
  };
}

/**
 * A {@link sequence} phase that parks the run on a timer for `ms` milliseconds. It stores
 * nothing: the phase after it receives the value of the last phase that stored one.
 *
 * @example
 * ```ts
 * import { defineWorkflow, sequence, sleep, step } from "@oona/vlo";
 * import { plan, finish } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   sleep(60_000),
 *   step(finish, (state) => ({ uppers: [], approvedBy: "timer" })),
 * ]));
 * ```
 */
export function sleep(ms: number): SeqStep {
  return { kind: "sleep", ms };
}

/**
 * Compiles an ordered list of phases into a {@link WorkflowDef} for {@link defineWorkflow}.
 *
 * Phases run one after another: {@link step}, {@link fanOut}, {@link fanOutRuns},
 * {@link waitFor} and {@link sleep}. Outputs go to `results` keyed by activity or workflow
 * name and signal payloads to `signals` keyed by signal name, so two phases on the same
 * target share a key. After the last phase the run completes with `results`, or with
 * `options.output(state)`. `state.usage` always holds the run's banked usage as of the
 * last event. Events that do not belong to the current phase are ignored: state
 * unchanged, no commands.
 *
 * @example
 * ```ts
 * import {
 *   defineWorkflow, fanOut, fanOutResultsOf, resultOf, sequence, signalOf, step, waitFor,
 * } from "@oona/vlo";
 * import { approve, finish, plan, work } from "./activities.ts";
 *
 * export default defineWorkflow("example", sequence([
 *   step(plan),
 *   fanOut(work, (s) => resultOf(s, plan).items.map((item) => ({ item })), { concurrency: 2 }),
 *   waitFor(approve),
 *   step(finish, (s) => ({
 *     uppers: fanOutResultsOf(s, work).map((o) => o.upper),
 *     approvedBy: signalOf(s, approve).by,
 *   })),
 * ], { output: (s) => ({ report: resultOf(s, finish).report, tokens: s.usage?.tokens ?? 0 }) }));
 * ```
 */
export function sequence(
  steps: readonly SeqStep[],
  options: SequenceOptions = {},
): WorkflowDef<SeqState, Json> {
  return {
    init: (input) => ({ phase: 0, input, results: {}, signals: {} }),
    on: {
      started: (state, event) => enterPhase(steps, options, withUsage(state, event), 0),
      task_done: (state, event) => onTaskDone(steps, options, withUsage(state, event), event),
      child_done: (state, event) => onChildDone(steps, options, withUsage(state, event), event),
      signal: (state, event) => onSignal(steps, options, withUsage(state, event), event),
      timer: (state, event) => onTimer(steps, options, withUsage(state, event), event),
    },
  };
}

function assertConcurrency(helper: string, concurrency: number): void {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError(`${helper}: concurrency must be an integer >= 1`);
  }
}

function nameOf(target: string | { readonly name: string }): string {
  return typeof target === "string" ? target : target.name;
}
