/** Types for the {@link sequence} helper: state, the phase description and its options. */

import type { Json, Usage } from "../../kernel/protocol.ts";
import type { Activity, SignalDef } from "../activity.ts";

/** Progress of a {@link fanOut} or {@link fanOutRuns} phase in flight; absent from {@link SeqState} otherwise. */
export interface FanState {
  /** Name of the activity or workflow being fanned out. */
  activity: string;
  /** Number of items `select` returned. */
  total: number;
  /** Index of the next item to dispatch. */
  next: number;
  /** Step ids currently in flight. */
  outstanding: string[];
  /** Outputs by item index; `null` until that item's task or child run settles. */
  outputs: Json[];
}

/**
 * State of a workflow built by {@link sequence}. `mapInput`, `select`, `when` and `output`
 * callbacks read it; the run completes with `results` (or `output(state)`) as its output.
 */
export interface SeqState {
  /** Index of the phase currently in flight. */
  phase: number;
  /** The run's start input. */
  input: Json;
  /** Outputs of finished {@link step}, {@link fanOut} and {@link fanOutRuns} phases, keyed by activity or workflow name. */
  results: Record<string, Json>;
  /** Payloads of finished {@link waitFor} phases, keyed by signal name; `null` after a `"continue"` timeout. */
  signals: Record<string, Json>;
  /** Present only while a {@link fanOut} or {@link fanOutRuns} phase is in flight. */
  fan?: FanState;
  /**
   * The run's banked usage as of the last folded event (`event.usage_total`). Absent on a
   * checkpoint written before any event was folded with this field.
   */
  usage?: Usage;
}

/** An activity with its input and output types erased, as `sequence` stores it; Zod still validates every input. */
export type ErasedActivity = Activity<Json, Json>;

/** What a phase does when its task or child run did not succeed. Default: `"fail"`. */
export type OnFailure = "fail" | "continue";

/** Options for {@link step}. */
export interface StepOptions {
  /** Explicit step id; default: the kernel-derived `task#n`. Set it when a handler keys on the step id. */
  id?: string;
  /** `"fail"` (default) fails the run on a task that did not succeed; `"continue"` stores `null` and advances. */
  onFailure?: OnFailure;
  /** Pure gate evaluated when the phase is entered; `false` stores `null` and advances without a task. */
  when?: (state: SeqState) => boolean;
}

/** Options for {@link fanOut}. */
export interface FanOutOptions {
  /** Maximum tasks in flight at once; an integer ≥ 1. */
  concurrency: number;
  /** `"fail"` (default) fails the run on any task that did not succeed; `"continue"` stores `null` for that item. */
  onFailure?: OnFailure;
}

/** Options for {@link fanOutRuns}. */
export interface FanOutRunsOptions {
  /** Maximum child runs in flight at once; an integer ≥ 1. */
  concurrency: number;
  /** `"fail"` (default) fails the run on any child that did not complete; `"continue"` records its status and moves on. */
  onFailure?: OnFailure;
}

/** The terminal status a child run reports to its parent, mapped from the child's run status. */
export type ChildStatus = "succeeded" | "failed" | "cancelled";

/** One child's outcome as {@link fanOutRuns} stores it. */
export interface ChildResult<O = Json> {
  /** `succeeded` for a completed child, else `failed` or `cancelled`. */
  status: ChildStatus;
  /** The child's completion output; `null` unless it completed. */
  output: O | null;
  /** The child's run id, for a journal read of its own events. */
  child_run_id: string;
}

/** Options for {@link sequence}. */
export interface SequenceOptions {
  /** Shapes the completion output; default: `state.results`. Pure. */
  output?: (state: SeqState) => Json;
}

/**
 * One phase of a {@link sequence}, as built by {@link step}, {@link fanOut}, {@link fanOutRuns},
 * {@link waitFor} or {@link sleep}. Treat it as opaque; the shape is exposed for inspection only.
 */
export type SeqStep =
  | {
      /** A single task. */
      readonly kind: "step";
      /** Key in `results`: the activity name. */
      readonly key: string;
      /** The activity to run. */
      readonly activity: ErasedActivity;
      /** Builds the task input from state; absent means "the previous phase's value". */
      readonly mapInput?: (state: SeqState) => Json;
      /** Explicit step id; absent means kernel-derived. */
      readonly id?: string;
      /** What a task that did not succeed does; absent means `"fail"`. */
      readonly onFailure?: OnFailure;
      /** Gate evaluated on phase entry; absent means always run. */
      readonly when?: (state: SeqState) => boolean;
    }
  | {
      /** One task per selected item. */
      readonly kind: "fan_out";
      /** Key in `results`: the activity name. */
      readonly key: string;
      /** The activity to run per item. */
      readonly activity: ErasedActivity;
      /** Pure selector of the items; re-evaluated on every event of the phase. */
      readonly select: (state: SeqState) => Json[];
      /** Maximum tasks in flight at once. */
      readonly concurrency: number;
      /** What a task that did not succeed does; absent means `"fail"`. */
      readonly onFailure?: OnFailure;
    }
  | {
      /** One child run per selected item. */
      readonly kind: "fan_out_runs";
      /** Key in `results`: the workflow name. */
      readonly key: string;
      /** The workflow to spawn per item. */
      readonly workflow: string;
      /** Pure selector of the child inputs; re-evaluated on every event of the phase. */
      readonly select: (state: SeqState) => Json[];
      /** Maximum child runs in flight at once. */
      readonly concurrency: number;
      /** What a child that did not complete does; absent means `"fail"`. */
      readonly onFailure?: OnFailure;
    }
  | {
      /** A parked wait for a signal. */
      readonly kind: "wait_for";
      /** Key in `signals`: the signal name. */
      readonly key: string;
      /** The signal to wait for. */
      readonly signal: SignalDef<Json>;
      /** Deadline in milliseconds; absent means wait forever. */
      readonly timeoutMs?: number;
      /** What the deadline does; absent means `"fail"`. */
      readonly onTimeout?: OnTimeout;
      /** Emitted on the `human` channel when the wait opens. */
      readonly context?: Json;
    }
  | {
      /** A timer that stores nothing. */
      readonly kind: "sleep";
      /** Duration in milliseconds. */
      readonly ms: number;
    };

/** What a `waitFor` deadline does when it fires first. Default: `"fail"`. */
export type OnTimeout = "fail" | "continue";

/** Deadline and presentation options for {@link waitFor}. */
export interface WaitForOptions {
  /** Deadline in milliseconds, counted from when the wait opens. Absent: the run waits forever. */
  timeoutMs?: number;
  /** `"fail"` (default) fails the run at the deadline; `"continue"` advances with a `null` payload. */
  onTimeout?: OnTimeout;
  /** Emitted on the `human` channel alongside the wait, for whatever renders the ask. */
  context?: Json;
}
