/**
 * The outbox dispatcher: the only thing that turns durable rows into effects.
 *
 * Nothing here is on the write path. A transition commits rows — a `created` run, a
 * `scheduled` task, a closed child — and the dispatcher picks them up on its next tick.
 * That is what makes a crash between "persisted" and "pushed" recoverable: the row is
 * still there, unclaimed, and any process holding the `orchestrator` role will find it.
 *
 * Every stage is idempotent and claim results are unordered sets, so several orchestrators
 * can run at once.
 *
 * Five stages, in tick order:
 * 1. **start runs** — a `created` run row becomes a `started` event.
 * 2. **push tasks** — a `scheduled` task is handed to the transport that serves its queue.
 *    Queues configured `mode: "pull"` are skipped entirely: pollers own those rows, and a
 *    claim here would burn dispatch attempts on work this process is never going to deliver.
 * 3. **fire timers** — a due timer becomes a `timer/succeeded` event. The fired flag and the
 *    event commit together, so a timer fires exactly once however many orchestrators claim it.
 * 4. **reap leases** — a `running` task whose lease lapsed is failed with `heartbeat_lost`,
 *    which retries it on a fresh attempt or ends the run once the policy is spent.
 * 5. **reap timeouts** — a `running` task past its `timeout_ms` is failed with `timeout`. The
 *    worker arms the same deadline locally; this is the backstop for a worker that is gone.
 * 6. **notify parents** — a closed child run becomes a `child` event on its parent.
 *
 * Stages 1, 2, 3 and 6 take a claim for `claimHoldMs` so two orchestrators do not do the same
 * work at the same time. The reapers need no claim column: `failTask` reads the task first and
 * `liveTask` returns null once the attempt has moved on or the task is terminal, so a second
 * orchestrator reaping the same expired attempt writes nothing.
 *
 * Stages 3, 4 and 5 are driven by the clock rather than by a freshly written row; they live in
 * `deadlines.ts`.
 */

import { JournalClosed, type RunRow, type TaskRow } from "../journal/types.ts";
import type { HostContext } from "./context.ts";
import { fireTimers, reapLeases, reapTimeouts, type DeadlineOptions } from "./deadlines.ts";
import { childEvent, childStatusOf, randomHex, startedEvent, taskFailedEvent } from "./events.ts";
import { inlineOrBlob, markTaskRunning, toPushedTask } from "./task-dispatch.ts";
import { applyEvent } from "./transition.ts";
import { HttpPushTransport, type FetchLike } from "./transport/http-push.ts";
import { InProcessTransport } from "./transport/in-process.ts";
import type { TaskTransport } from "./transport/types.ts";
import { completeTask } from "./worker/complete.ts";
import { findWorker } from "./worker/registry.ts";
import { localReporter } from "./worker/reporters.ts";

/**
 * `loop` ticks on an interval and on every `kick()`. `manual` never does either: the
 * process it runs in has no long-lived timer to hang a tick on, so something outside —
 * a cron hitting `POST /v1/timers/tick` — decides when the outbox moves.
 *
 * `kick()` stays a no-op in `manual` mode on purpose. A kick is unattended and unbounded:
 * inside a serverless request it would start work the platform is free to freeze the moment
 * the response is sent, leaving tasks marked `running` with nobody behind them. `Host.drain`
 * (or `POST /v1/timers/tick?drain=1`) is the explicit, awaited, time-boxed form of the same
 * thing — the caller stays alive for it and knows when it stopped.
 */
export type DispatcherMode = "loop" | "manual";

/** Tuning for the outbox dispatcher. Every default suits a single laptop host. */
export interface DispatcherOptions {
  /** `loop` (default) ticks on a timer and on `kick()`; `manual` only ticks when asked. */
  mode?: DispatcherMode;
  /** Interval between passes in `loop` mode. Default 500 ms. */
  tickMs?: number;
  /** Rows one stage claims per pass. Default 50. */
  batch?: number;
  /** How long a claim is held before another orchestrator may take the row. */
  claimHoldMs?: number;
  /** First backoff step after a refused push; doubles per dispatch attempt. */
  backoffBaseMs?: number;
  /** Ceiling on the push backoff. Default 60 s. */
  maxBackoffMs?: number;
  /** Backoff used when no transport serves the task's queue at all. */
  unroutableBackoffMs?: number;
  /** `fetch` used for HTTP pushes. Default `globalThis.fetch`; injected by tests. */
  fetch?: FetchLike;
  /** Recorded as `worker_id` on tasks this process dispatches. Default `vlo-<8 hex>`. */
  workerId?: string;
}

/** What one tick moved, per stage. The tick route answers with exactly this. */
export interface TickCounts {
  /** `created` runs that received their `started` event. */
  started: number;
  /** Tasks a transport accepted and the journal recorded as running. */
  pushed: number;
  /** Timers that fired. */
  timers: number;
  /** Attempts failed for a lapsed lease. */
  reaped: number;
  /** Attempts the backstop failed for outliving `timeout_ms`. */
  timeouts: number;
  /** Closed child runs whose parent received its `child` event. */
  notified: number;
}

/**
 * The outbox dispatcher. `createHost` builds one per host holding the `orchestrator` role;
 * only tests and custom hosts construct it directly.
 */
export class Dispatcher {
  private readonly mode: DispatcherMode;
  private readonly tickMs: number;
  private readonly batch: number;
  private readonly claimHoldMs: number;
  private readonly backoffBaseMs: number;
  private readonly maxBackoffMs: number;
  private readonly unroutableBackoffMs: number;
  private readonly workerId: string;
  private readonly deadlines: DeadlineOptions;
  private readonly transports = new Map<string, TaskTransport | null>();
  /** Queues served by pollers: the push stage must leave their tasks unclaimed. */
  private readonly pullQueues: string[];

  private timer: ReturnType<typeof setInterval> | undefined;
  private current: Promise<void> | null = null;
  private again = false;
  private stopped = true;
  /** Passes still running, whoever started them — the loop, a tick route, a drain. */
  private readonly passes = new Set<Promise<unknown>>();

  /** Reads the options once; nothing runs until {@link Dispatcher.start}. */
  constructor(
    private readonly ctx: HostContext,
    private readonly options: DispatcherOptions = {},
  ) {
    this.mode = options.mode ?? "loop";
    this.tickMs = options.tickMs ?? 500;
    this.batch = options.batch ?? 50;
    this.claimHoldMs = options.claimHoldMs ?? 30_000;
    this.backoffBaseMs = options.backoffBaseMs ?? 1_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 60_000;
    this.unroutableBackoffMs = options.unroutableBackoffMs ?? 60_000;
    this.workerId = options.workerId ?? `vlo-${randomHex().slice(0, 8)}`;
    this.pullQueues = Object.entries(ctx.queues)
      .filter(([, queue]) => queue.mode === "pull")
      .map(([name]) => name);
    this.deadlines = {
      batch: this.batch,
      claimHoldMs: this.claimHoldMs,
      warn: (message, error) => this.warn(message, error),
    };
  }

  /** Begins ticking (`loop` mode) or merely arms `tick()` (`manual` mode). Idempotent. */
  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    if (this.mode === "manual") return;
    this.timer = setInterval(() => this.schedule(), this.tickMs);
    this.timer.unref();
    this.schedule();
  }

  /**
   * Stops ticking and waits for every pass still in flight. The wait is what makes shutdown
   * safe: the host closes the journal next, and a stage halfway through a claim must not be
   * left reading a connection that is gone.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    await this.current;
    while (this.passes.size > 0) await Promise.allSettled([...this.passes]);
  }

  /** Runs a tick soon. Safe to call from inside a tick: it queues one more pass. */
  kick(): void {
    if (this.stopped || this.mode === "manual") return;
    this.schedule();
  }

  /** One pass over every stage. The tick route and the tests drive the outbox with it. */
  async tick(): Promise<TickCounts> {
    const pass = this.pass();
    this.passes.add(pass);
    try {
      return await pass;
    } finally {
      this.passes.delete(pass);
    }
  }

  private async pass(): Promise<TickCounts> {
    return {
      started: await this.startRuns(),
      pushed: await this.pushTasks(),
      timers: await fireTimers(this.ctx, this.deadlines),
      reaped: await reapLeases(this.ctx, this.deadlines),
      timeouts: await reapTimeouts(this.ctx, this.deadlines),
      notified: await this.notifyParents(),
    };
  }

  private schedule(): void {
    if (this.stopped) return;
    if (this.current !== null) {
      this.again = true;
      return;
    }
    this.current = this.drain().finally(() => {
      this.current = null;
    });
  }

  private async drain(): Promise<void> {
    do {
      this.again = false;
      try {
        await this.tick();
      } catch (error) {
        this.warn("tick failed", error);
      }
    } while (this.again && !this.stopped);
  }

  // ------------------------------------------------------------- stage 1: start runs

  private async startRuns(): Promise<number> {
    const nowMs = this.ctx.now();
    const runs = await this.ctx.journal.transaction((tx) =>
      tx.claimCreatedRuns(nowMs, this.batch, this.claimHoldMs),
    );
    let started = 0;
    for (const run of runs) {
      try {
        const input = await inlineOrBlob(this.ctx, run.input, run.input_ref);
        await applyEvent(
          this.ctx,
          run.run_id,
          startedEvent({ runId: run.run_id, nowMs: this.ctx.now() }, input ?? "null"),
        );
        started += 1;
      } catch (error) {
        this.warn(`could not start run ${run.run_id}`, error);
      }
    }
    return started;
  }

  // ------------------------------------------------------------- stage 2: push tasks

  private async pushTasks(): Promise<number> {
    const nowMs = this.ctx.now();
    const tasks = await this.ctx.journal.transaction((tx) =>
      tx.claimUndispatchedTasks(nowMs, this.batch, this.claimHoldMs, {
        excludeQueues: this.pullQueues,
      }),
    );
    const results = await Promise.all(
      tasks.map((task) =>
        this.pushOne(task).catch((error: unknown) => {
          this.warn(`could not push task ${task.task_id}`, error);
          return false;
        }),
      ),
    );
    return results.filter(Boolean).length;
  }

  /** True when the task was accepted by a worker and recorded as running. */
  private async pushOne(task: TaskRow): Promise<boolean> {
    const transport = this.transportFor(task);
    if (transport === null) {
      this.warn(`no transport for queue "${task.queue}"; deferring task ${task.task_id}`);
      await this.defer(task, this.unroutableBackoffMs);
      return false;
    }

    const result = await transport.push(await toPushedTask(this.ctx, task));
    if (!result.accepted) {
      if (result.fatal === true) {
        await applyEvent(
          this.ctx,
          task.run_id,
          taskFailedEvent(
            { runId: task.run_id, nowMs: this.ctx.now() },
            task.step_id,
            task.attempt,
            "schema_violation",
            `worker rejected the push: ${result.reason}`,
          ),
        );
        return false;
      }
      await this.defer(task, this.backoff(task.dispatch_attempts));
      return false;
    }

    await markTaskRunning(this.ctx, task, this.workerId);

    if (result.inlineOutput !== undefined) {
      await completeTask(this.ctx, task.task_id, task.attempt, result.inlineOutput);
    }
    return true;
  }

  private backoff(dispatchAttempts: number): number {
    const exponent = Math.max(0, Math.min(dispatchAttempts, 20));
    return Math.min(this.backoffBaseMs * 2 ** exponent, this.maxBackoffMs);
  }

  private defer(task: TaskRow, delayMs: number): Promise<void> {
    const notBefore = this.ctx.now() + delayMs;
    return this.ctx.journal.transaction((tx) =>
      tx.deferDispatch(task.task_id, task.attempt, notBefore),
    );
  }

  private transportFor(task: TaskRow): TaskTransport | null {
    const key = `${task.queue}\u0000${task.activity}`;
    const cached = this.transports.get(key);
    if (cached !== undefined) return cached;

    const transport = this.buildTransport(task);
    this.transports.set(key, transport);
    return transport;
  }

  private buildTransport(task: TaskRow): TaskTransport | null {
    if (this.ctx.roles.has(`worker:${task.queue}`)) {
      const worker = findWorker(this.ctx.workers, task.queue, task.activity);
      if (worker !== undefined) {
        return new InProcessTransport(worker, localReporter(this.ctx), {
          tracker: this.ctx.inProcess,
          onError: (error) => this.warn(`could not report task on queue "${task.queue}"`, error),
        });
      }
    }

    const queue = this.ctx.queues[task.queue];
    if (queue?.url === undefined) return null;
    return new HttpPushTransport({
      url: queue.url,
      secret: queue.secret ?? "",
      now: this.ctx.now,
      ...(this.options.fetch !== undefined ? { fetch: this.options.fetch } : {}),
    });
  }

  // --------------------------------------------------------- stage 5: notify parents

  private async notifyParents(): Promise<number> {
    const nowMs = this.ctx.now();
    const children = await this.ctx.journal.transaction((tx) =>
      tx.claimClosedUnnotified(nowMs, this.batch, this.claimHoldMs),
    );
    let notified = 0;
    for (const child of children) {
      try {
        await this.notifyParent(child);
        notified += 1;
      } catch (error) {
        this.warn(`could not notify the parent of ${child.run_id}`, error);
      }
    }
    return notified;
  }

  private async notifyParent(child: RunRow): Promise<void> {
    const parentRunId = child.parent_run_id;
    const parentStepId = child.parent_step_id;
    const status = childStatusOf(child.status);
    // `continued` maps to null on purpose: the run handed its parent link to its successor
    // (see `successorRun` in transition.ts), so the parent hears from whichever run in the
    // chain finally closes — once, with that run's output. This one is just marked notified.
    if (parentRunId === undefined || parentStepId === undefined || status === null) {
      await this.markNotified(child.run_id);
      return;
    }

    const output = await inlineOrBlob(this.ctx, child.output, child.output_ref);
    await applyEvent(
      this.ctx,
      parentRunId,
      childEvent({ runId: parentRunId, nowMs: this.ctx.now() }, parentStepId, status, output),
      async (tx) => {
        await tx.markParentNotified(child.run_id, this.ctx.now());
      },
    );
  }

  private markNotified(runId: string): Promise<void> {
    return this.ctx.journal.transaction((tx) => tx.markParentNotified(runId, this.ctx.now()));
  }

  /**
   * Never throws and never writes to stdout: hosts listen on `events` if they care.
   * A closed journal is shutdown, not a fault — the host stopped while this was in flight —
   * so it is dropped rather than reported.
   */
  private warn(message: string, error?: unknown): void {
    if (error instanceof JournalClosed) return;
    this.ctx.events.emit("warning", { message, ...(error !== undefined ? { error } : {}) });
  }
}
