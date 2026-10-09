/**
 * The kernel's function surface: input and output types of every call, and the {@link Kernel}
 * interface the host programs against.
 */

import type {
  Cause,
  EventInput,
  Json,
  KernelState,
  Reduction,
  ReducerEvent,
  RetryPolicy,
} from "./protocol.ts";
import type { RunRef, Transition } from "./transition.ts";

/** Kernel build information; the host refuses a protocol number it does not speak. */
export interface KernelVersion {
  /** Kernel crate version. */
  version: string;
  /** Protocol number. */
  protocol: number;
  /** Feature flags the build supports. */
  features: string[];
}

/** An error returned by the kernel; errors are values, never exceptions. */
export interface KernelError {
  /** One of the kernel's closed set of error codes. */
  code: string;
  /** Human-readable detail. */
  message: string;
  /** Sequence number the error concerns, when there is one. */
  seq?: number;
  /** Step id the error concerns, when there is one. */
  step_id?: string;
}

/** Every kernel call returns either a value or a {@link KernelError}. */
export type KernelResult<T> = { ok: true; value: T } | { ok: false; error: KernelError };

/** Input of `prepareEvent`. */
export interface PrepareEventInput {
  /** The run row. */
  run: RunRef;
  /** Kernel state at the current checkpoint; absent before `started`. */
  kernel_state?: KernelState;
  /**
   * The current user-state checkpoint, byte-exact. Lifecycle transitions echo and hash
   * it without calling the reducer, so pass it for any event that is not `started`.
   */
  state?: string;
  /** The event to apply. */
  event: EventInput;
}

/** Output of `prepareEvent`: either call the reducer, or apply a lifecycle transition as is. */
export type Prepared =
  | {
      /** The reducer must run. */
      mode: "reduce";
      /** The event in reducer form. */
      reducer_event: ReducerEvent;
      /** The workflow input, on `started`. */
      init_input?: Json;
      /** Kernel state to reduce against. */
      kernel_state: KernelState;
    }
  | {
      /** No reducer call: the transition is complete. */
      mode: "lifecycle";
      /** The write-set to apply. */
      transition: Transition;
    };

/** Input of `reduceStep`: the reducer's output, to be validated and turned into a write-set. */
export interface ReduceStepInput {
  /** The run row. */
  run: RunRef;
  /** Kernel state the reducer ran against. */
  kernel_state: KernelState;
  /** The event that was reduced. */
  event: EventInput;
  /** What the reducer returned. */
  reduction: Reduction;
}

/** Input of `planRetry`. */
export interface PlanRetryInput {
  /** The activity's retry policy. */
  policy: RetryPolicy;
  /** The attempt that just failed. */
  attempt: number;
  /** Why it failed. */
  cause: Cause;
  /** Journaled randomness for jitter, as a hex string, so a re-fold plans the same delay. */
  random: string;
}

/** Output of `planRetry`. */
export type RetryPlan =
  | {
      /** Retry after `delay_ms`. */
      retry: true;
      /** The next attempt number. */
      next_attempt: number;
      /** Delay before it, in milliseconds. */
      delay_ms: number;
    }
  | {
      /** Give up. */
      retry: false;
      /** Never set. */
      next_attempt?: undefined;
      /** Never set. */
      delay_ms?: undefined;
    };

/** A state hash at a sequence number, as `refoldCheck` compares them. */
export interface HashAtSeq {
  /** Event sequence number. */
  seq: number;
  /** State hash after that event. */
  hash: string;
}

/** Output of `refoldCheck`. */
export type RefoldCheckOutput =
  | {
      /** Every hash matched. */
      matches: true;
      /** Never set. */
      seq?: undefined;
      /** Never set. */
      expected?: undefined;
      /** Never set. */
      actual?: undefined;
    }
  | {
      /** A hash diverged. */
      matches: false;
      /** First divergent sequence number. */
      seq: number;
      /** The journaled hash. */
      expected: string;
      /** The re-folded hash. */
      actual: string;
    };

/** Output of `deriveIds`. */
export interface DeriveIdsOutput {
  /** Task id for the step attempt. */
  task_id: string;
  /** Idempotency key for the step attempt. */
  idempotency_key: string;
  /** Child run id for the step. */
  child_run_id: string;
}

/**
 * The kernel as the host sees it. Implemented by the wasm loader (`load.ts`) and by a
 * test double. Every method is synchronous and pure.
 */
export interface Kernel {
  /** Kernel build, protocol number and feature flags; the host refuses a protocol mismatch. */
  version(): KernelVersion;
  /** Field and enum checks on an envelope, returning the normalised form. */
  validateEvent(event: EventInput): KernelResult<{ normalized: EventInput }>;
  /** Classifies an event: call the reducer, or apply a lifecycle transition without it. */
  prepareEvent(input: PrepareEventInput): KernelResult<Prepared>;
  /** Validates a reduction's commands and builds the write-set the journal applies. */
  reduceStep(input: ReduceStepInput): KernelResult<Transition>;
  /** Hash of kernel state plus user state, as stored on every checkpoint and event. */
  stateHash(input: { kernel_state: KernelState; state: string }): KernelResult<{ hash: string }>;
  /** Whether and when to retry an attempt, from the policy, cause and journaled randomness. */
  planRetry(input: PlanRetryInput): KernelResult<RetryPlan>;
  /** Compares a re-fold's hashes with the journal's and names the first divergent seq. */
  refoldCheck(input: { expected: HashAtSeq[]; actual: HashAtSeq[] }): KernelResult<RefoldCheckOutput>;
  /** Deterministic task id, idempotency key and child run id for a step attempt. */
  deriveIds(input: { run_id: string; step_id: string; attempt: number }): KernelResult<DeriveIdsOutput>;
}
