/**
 * `cmd.*` — the only way a reducer asks the engine to do something. Commands are plain
 * data; the kernel validates them and turns them into tasks, timers, child runs and
 * signal waits.
 */

import type { Command, Json } from "../kernel/protocol.ts";
import type { Activity, SignalDef } from "./activity.ts";

/** Thrown synchronously by `cmd.task` when the input does not match the activity's schema. */
export class ActivityInputError extends Error {
  /** Name of the activity whose input schema rejected the value. */
  readonly activity: string;

  /** @param detail - The Zod issues, joined as `path: message; …`. */
  constructor(activity: string, detail: string) {
    super(`Invalid input for activity "${activity}": ${detail}`);
    this.name = "ActivityInputError";
    this.activity = activity;
  }
}

/** Per-call overrides for `cmd.task`. */
export interface TaskOptions {
  /** Step id. Defaults to a kernel-derived id; set it when a phase fans out. */
  id?: string;
  /** Queue for this task only. Defaults to the activity's `queue`. */
  queue?: string;
}

/** When a `cmd.timer` fires. Exactly one of `ms` / `atMs` is required. */
export interface TimerOptions {
  /** Delay in milliseconds, counted from the timestamp of the event being reduced. */
  ms?: number;
  /** Absolute epoch time in milliseconds. */
  atMs?: number;
  /** Step id. Defaults to a kernel-derived id. */
  id?: string;
}

/** Per-call overrides for `cmd.spawn`. */
export interface SpawnOptions {
  /** Step id of the child step. Defaults to a kernel-derived id. */
  id?: string;
}

/** Per-call overrides for `cmd.awaitSignal`. */
export interface AwaitSignalOptions {
  /** Step id of the wait. Defaults to a kernel-derived id. */
  id?: string;
  /**
   * Deadline for the wait, counted from the timestamp of the event being reduced. A `timer`
   * event with step id `<id>:timeout` reaches the reducer when the deadline passes; the
   * losing side of the race is cancelled by the kernel. Requires an explicit `id`.
   */
  timeoutMs?: number;
}

/**
 * Requests one attempt-tracked execution of `target` with `input`.
 *
 * `input` is parsed with the activity's Zod schema; the parsed value (defaults applied) is
 * what travels. The activity's `queue`, `retry`, `leaseMs` and `timeoutMs` are copied onto
 * the command; `options.queue` overrides the queue for this call.
 *
 * @throws {@link ActivityInputError} when the input does not match the activity's schema.
 */
function task<I, O>(target: Activity<I, O>, input: I, options?: TaskOptions): Command {
  const parsed = target.input.safeParse(input);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new ActivityInputError(target.name, detail);
  }

  return {
    type: "task",
    activity: target.name,
    schema_ref: target.schemaRef,
    input: parsed.data as Json,
    queue: options?.queue ?? target.queue,
    retry: target.retry,
    lease_ttl_ms: target.leaseMs,
    ...(target.timeoutMs !== undefined ? { timeout_ms: target.timeoutMs } : {}),
    ...(options?.id !== undefined ? { id: options.id } : {}),
  };
}

/**
 * Schedules a `timer` event for the run. `ms` is relative to the timestamp of the event
 * being reduced; `atMs` is absolute epoch milliseconds.
 *
 * Throws a `TypeError` synchronously when neither or both of `ms` / `atMs` are given.
 */
function timer(options: TimerOptions): Command {
  if (options.ms === undefined && options.atMs === undefined) {
    throw new TypeError("cmd.timer requires either `ms` or `atMs`");
  }
  if (options.ms !== undefined && options.atMs !== undefined) {
    throw new TypeError("cmd.timer takes either `ms` or `atMs`, not both");
  }

  return {
    type: "timer",
    ...(options.ms !== undefined ? { fire_in_ms: options.ms } : {}),
    ...(options.atMs !== undefined ? { fire_at_ms: options.atMs } : {}),
    ...(options.id !== undefined ? { id: options.id } : {}),
  };
}

/**
 * Starts a child run of `workflow` (a name, or anything with a `name` such as a
 * {@link Workflow}) with `input`. The child's terminal status and output come back to this
 * run as a `child_done` event on the spawn's step id. The workflow must be registered on
 * the host that dispatches the command.
 */
function spawn(workflow: string | { name: string }, input: Json, options?: SpawnOptions): Command {
  return {
    type: "spawn",
    workflow: typeof workflow === "string" ? workflow : workflow.name,
    input,
    ...(options?.id !== undefined ? { id: options.id } : {}),
  };
}

/**
 * Parks the run until a signal named after `definition` is delivered; the payload arrives
 * on a `signal` event. A signal that arrived before the wait was opened is buffered and
 * delivered immediately, oldest first. The run holds no compute while parked. With
 * `timeoutMs` the kernel also opens a timer step `<id>:timeout` and cancels whichever of
 * the two loses; see {@link signalTimeoutStepId}.
 */
function awaitSignal<T>(definition: SignalDef<T>, options?: AwaitSignalOptions): Command {
  return {
    type: "await_signal",
    name: definition.name,
    schema_ref: definition.schemaRef,
    ...(options?.timeoutMs !== undefined ? { timeout_ms: options.timeoutMs } : {}),
    ...(options?.id !== undefined ? { id: options.id } : {}),
  };
}

/**
 * Publishes `data` on a side channel. Emits never enter the run's history and never come
 * back to the reducer; the host forwards them to event-stream subscribers, which is where
 * progress ticks and UI hints belong.
 */
function emit(channel: string, data: Json): Command {
  return { type: "emit", channel, data };
}

/**
 * Closes the run as `completed` with `output`. It must be the last command of the reduction;
 * the kernel rejects any command after it.
 */
function complete(output: Json): Command {
  return { type: "complete", output };
}

/**
 * Closes the run as `continued`, carrying `input` as the start input of a successor run. It
 * must be the last command of the reduction. The host starts the successor (same workflow,
 * this `input`) in the same transaction and links the two runs by `continued_from` and
 * `continued_to`; a parent run is notified once, by the run that finally closes.
 */
function continueAsNew(input: Json): Command {
  return { type: "continue_as_new", input };
}

export interface AwaitHumanOptions {
  /** Step id of the wait. The deadline timer is `${id}:timeout`, so it is required. */
  id: string;
  /** Deadline for the reply. Without one the run waits forever. */
  timeoutMs?: number;
  /** Rendered by whatever asks the human — "context travels with the ask". */
  context?: Json;
}

/**
 * Step id of the timer the kernel pairs with a signal wait `id` that carries a
 * `timeoutMs`. A `timer` event with this step id means the deadline won the race.
 */
export function signalTimeoutStepId(id: string): string {
  return `${id}:timeout`;
}

/** @deprecated Use {@link signalTimeoutStepId}; same string. */
export const humanTimeoutStepId = signalTimeoutStepId;

/**
 * Ask a human. Sugar over `await_signal` (with its deadline) + `emit`: the wait reserves
 * `id` and the kernel opens `${id}:timeout` beside it, so whichever arrives first wins and
 * the kernel cancels the loser. Returns commands — spread it into a reduction.
 */
function awaitHuman<T>(definition: SignalDef<T>, options: AwaitHumanOptions): Command[] {
  const commands: Command[] = [
    awaitSignal(definition, {
      id: options.id,
      ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
    }),
  ];
  if (options.context !== undefined) {
    commands.push(
      emit("human", { signal: definition.name, id: options.id, context: options.context }),
    );
  }
  return commands;
}

/**
 * The command constructors a reducer returns to the engine. Each builds a plain
 * {@link Command}; nothing runs until the host applies the reduction. `task`, `timer`,
 * `spawn` and `awaitSignal` open a step, `emit` records a side effect, `complete` and
 * `continueAsNew` close the run and must come last.
 *
 * @example
 * ```ts
 * import { cmd, defineWorkflow } from "@vlo/sdk";
 * import { approve, work } from "./activities.ts";
 *
 * export default defineWorkflow("review", {
 *   init: (input: { item: string }) => ({ item: input.item, upper: null as string | null }),
 *   on: {
 *     started: (s) => [s, [cmd.task(work, { item: s.item })]],
 *     task_done: (s, e) => [
 *       { ...s, upper: (e.output as { upper: string }).upper },
 *       cmd.awaitHuman(approve, { id: "approval", timeoutMs: 86_400_000 }),
 *     ],
 *     signal: (s) => [s, [cmd.complete({ upper: s.upper })]],
 *     timer: (s) => [s, [cmd.complete(null)]],
 *   },
 * });
 * ```
 */
export const cmd = {
  /** Runs an activity once, with retries. Throws {@link ActivityInputError} on bad input. */
  task,
  /** Fires a `timer` event after `ms` or at `atMs`. */
  timer,
  /** Starts a child run; its result arrives as `child_done`. */
  spawn,
  /** Parks the run until the named signal is delivered. */
  awaitSignal,
  /** `awaitSignal` with a deadline + `emit("human", …)`; returns a `Command[]`. */
  awaitHuman,
  /** Publishes on a side channel; never journaled. */
  emit,
  /** Closes the run as `completed`. Must be last. */
  complete,
  /** Closes the run as `continued` with a fresh start input. Must be last. */
  continueAsNew,
} as const;
