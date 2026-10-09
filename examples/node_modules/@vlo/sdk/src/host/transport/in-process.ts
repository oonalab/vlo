/**
 * The in-process transport: the worker lives in this process, so "push" is a scheduled
 * call. It still goes through the same accept-then-report contract as HTTP push, which is
 * what makes the outbox and the crash-recovery paths identical for both.
 */

import type { Worker } from "../worker/registry.ts";
import { handleTask, type TaskReporter } from "../worker/handle-task.ts";
import type { PushedTask, PushResult, TaskTransport } from "./types.ts";

/**
 * Counts handlers this process still owes a result for. One tracker is shared by every
 * in-process transport a host builds, because `Host.drain` has to tell "the dispatcher
 * moved nothing" apart from "the dispatcher moved nothing *yet*: a handler is running and
 * its result will schedule the next task".
 */
export class InProcessTracker {
  private running = 0;
  private done = 0;
  private readonly waiting = new Set<() => void>();

  /** Handlers started and not yet reported. */
  get inFlight(): number {
    return this.running;
  }

  /** Monotonic count of handlers that reported. A change across a tick means work landed. */
  get finished(): number {
    return this.done;
  }

  /** Counts a handler as started. */
  enter(): void {
    this.running += 1;
  }

  /** Counts a handler as reported; wakes `settled()` waiters when none are left. */
  leave(): void {
    this.running -= 1;
    this.done += 1;
    if (this.running > 0) return;
    for (const resolve of this.waiting) resolve();
    this.waiting.clear();
  }

  /** Resolves once no in-process handler is outstanding. */
  settled(): Promise<void> {
    if (this.running === 0) return Promise.resolve();
    return new Promise<void>((resolve) => this.waiting.add(resolve));
  }
}

/** Knobs for {@link InProcessTransport}. */
export interface InProcessOptions {
  /** Shared with the host, so `Host.drain` can wait for handlers this transport started. */
  tracker?: InProcessTracker;
  /**
   * Where a failure to *report* goes. The handler's own throw is a task failure and the
   * reporter turns it into one; this is the reporter itself failing — a journal that closed
   * under a shutdown, typically — and without a home it would be an unhandled rejection.
   */
  onError?: (error: unknown) => void;
}

/** Runs tasks on a worker in this process. Built by the dispatcher for each `worker:<queue>` role. */
export class InProcessTransport implements TaskTransport {
  /** Always `in-process`. */
  readonly kind = "in-process";

  /** `reporter` is where the handler's result goes; usually `localReporter(ctx)`. */
  constructor(
    private readonly worker: Worker,
    private readonly reporter: TaskReporter,
    private readonly options: InProcessOptions = {},
  ) {}

  /** Always accepts. The handler starts on the next macrotask, after the dispatcher has committed `running`. */
  async push(task: PushedTask): Promise<PushResult> {
    const tracker = this.options.tracker;
    // Counted before the accept returns, so a drain that ticks right after the push still
    // sees the handler as outstanding.
    tracker?.enter();
    // Deferred so the dispatcher commits `running` + `markDispatched` before the handler
    // can report a result — the same ordering a remote worker gives us for free.
    setImmediate(() => {
      void handleTask(this.worker, task, this.reporter)
        .catch((error: unknown) => this.options.onError?.(error))
        .finally(() => tracker?.leave());
    });
    return { accepted: true };
  }
}
