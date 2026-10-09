/**
 * The kernel's write-set. `reduceStep` and lifecycle transitions return a {@link Transition};
 * the journal applies every row of it in one transaction and never interprets commands.
 */

import type { Envelope, Json, KernelState, RetryPolicy, RunStatus, Status } from "./protocol.ts";

/** The run row as the kernel needs it to prepare or reduce an event. */
export interface RunRef {
  /** Run id. */
  run_id: string;
  /** Workflow name. */
  workflow: string;
  /** Digest of the workflow the run pinned when it started. */
  bundle_digest: string;
  /** Current run status. */
  status: RunStatus;
  /** Sequence number of the last journaled event; `0` before `started`. */
  last_seq: number;
  /** Parent run, for a child run. */
  parent_run_id?: string;
  /** The parent's `spawn` step, for a child run. */
  parent_step_id?: string;
}

/** Columns of the run row the transition updates. */
export interface RunPatch {
  /** Run status after the event. */
  status: RunStatus;
  /** Sequence number of the event just applied. */
  last_seq: number;
}

/** A task row to insert: the outbox entry a worker will receive. */
export interface NewTask {
  /** Deterministic task id, derived from run, step and attempt. */
  task_id: string;
  /** Step id inside the run. */
  step_id: string;
  /** Attempt number, starting at 1. */
  attempt: number;
  /** Activity name. */
  activity: string;
  /** Queue the task is pushed to or polled from. */
  queue: string;
  /** Schema reference for input validation, when the activity declares one. */
  schema_ref?: string;
  /** Task input. */
  input: Json;
  /** Idempotency key the worker echoes so a duplicate push is harmless. */
  idempotency_key: string;
  /** Retry policy the host applies on failure. */
  retry: RetryPolicy;
  /** Lease duration in milliseconds; the reaper reclaims a task past it. */
  lease_ttl_ms: number;
  /** Execution timeout in milliseconds; absent means no timeout. */
  timeout_ms?: number;
}

/** A status change on an existing task row. */
export interface TaskUpdate {
  /** Task id. */
  task_id: string;
  /** Attempt the update applies to. */
  attempt: number;
  /** New task status. */
  status: Status;
  /** Earliest time in milliseconds the task may run again; set on a retry. */
  not_before_ms?: number;
}

/** A timer row to insert. */
export interface NewTimer {
  /** Step id inside the run. */
  step_id: string;
  /** When the timer fires, in milliseconds since the epoch. */
  fire_at_ms: number;
}

/** A child run to start. */
export interface NewSpawn {
  /** The parent's step id. */
  step_id: string;
  /** Deterministic id of the child run. */
  child_run_id: string;
  /** Workflow the child runs. */
  workflow: string;
  /** The child's start input. */
  input: Json;
}

/** A signal wait row to insert: the run is parked until a signal with this name arrives. */
export interface SignalWait {
  /** Step id inside the run. */
  step_id: string;
  /** Signal name. */
  name: string;
  /** Schema reference for payload validation, when the signal declares one. */
  schema_ref?: string;
  /** Deadline in milliseconds since the epoch; absent means wait forever. */
  expires_at_ms?: number;
}

/** A side-channel emission; delivered in memory, never journaled. */
export interface Emit {
  /** Channel name. */
  channel: string;
  /** Payload. */
  data: Json;
}

/** The run's terminal outcome, present when the event closed the run. */
export interface Completion {
  /** Terminal status. */
  status: RunStatus;
  /** Output, when the run completed. */
  output?: Json;
}

/** The write-set. Journals apply it atomically and never interpret commands. */
export interface Transition {
  /** Run row patch. */
  run: RunPatch;
  /** Kernel state after the event. */
  kernel_state: KernelState;
  /** User state after the event, byte-exact JSON. */
  state: string;
  /** Hash of kernel state plus user state. */
  state_hash: string;
  /** Whether `state` is stored inline or offloaded to the blob store. */
  state_inline: boolean;
  /** Events to append: the triggering event plus any markers. */
  events: Envelope[];
  /** Tasks to insert. */
  tasks: NewTask[];
  /** Task rows to update. */
  task_updates: TaskUpdate[];
  /** Timers to insert. */
  timers: NewTimer[];
  /** Child runs to start. */
  spawns: NewSpawn[];
  /** Signal waits to open. */
  signal_waits: SignalWait[];
  /** Side-channel emissions. */
  emits: Emit[];
  /** Present when the run reached a terminal status. */
  completion?: Completion;
  /** Present when the run continued as new; carries the successor's input. */
  continue_as_new?: { input: Json };
}
