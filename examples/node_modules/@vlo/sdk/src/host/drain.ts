/**
 * `drain` — ticking until the outbox has nothing left to move.
 *
 * A `loop` dispatcher gets this for free: it ticks again on its own timer and on every
 * `kick()`. A `manual` one has no process to tick in, so a request that starts a run would
 * otherwise hand the rest of the chain to the next cron tick — one step per minute. `drain`
 * is the bounded, explicit alternative: keep ticking inside this invocation until the run
 * parks on something (a timer, a signal, a remote worker) or ends.
 *
 * A pass is only "quiet" when three things hold at once: the tick moved nothing, no
 * in-process handler is outstanding, and none finished while the tick was running. The last
 * check is what stops a drain from declaring idle on the tick a handler happened to complete
 * under — its result schedules the next task, which only the following tick can see.
 *
 * The budget is wall-clock (`Date.now`, not `ctx.now`): it exists to fit inside a function's
 * `maxDuration`, so a test clock must not make it infinite.
 */

import type { HostContext } from "./context.ts";
import type { TickCounts } from "./dispatcher.ts";
import type { InProcessTracker } from "./transport/in-process.ts";

/** Wall-clock budget of a drain when `maxMs` is absent: 25 s, under a typical serverless `maxDuration`. */
export const DEFAULT_DRAIN_MAX_MS = 25_000;

export interface DrainOptions {
  /** Wall-clock budget for the whole drain. Default 25 s. */
  maxMs?: number;
}

export interface DrainResult {
  /** How many dispatcher passes ran. */
  passes: number;
  /** True when the drain stopped because there was nothing left, false when it ran out of time. */
  idle: boolean;
  /** The counts of the last pass. */
  counts: TickCounts;
}

/**
 * Ticks until a pass is quiet or the budget runs out. `Host.drain` wraps this and additionally
 * shares one drain between concurrent callers; call that unless you hold a `HostContext`.
 * Throws a plain `Error` on a context without the `orchestrator` role.
 *
 * @example
 * ```ts
 * // Inside a request on a `manual`-mode host: carry the run as far as it goes right now.
 * const result = await host.drain({ maxMs: 20_000 });
 * if (!result.idle) console.warn(`still busy after ${result.passes} passes`);
 * ```
 */
export async function drainHost(ctx: HostContext, options: DrainOptions = {}): Promise<DrainResult> {
  const tick = ctx.tick;
  if (tick === undefined) {
    throw new Error('vlo host: drain() needs the "orchestrator" role');
  }

  const tracker = ctx.inProcess;
  const deadline = Date.now() + (options.maxMs ?? DEFAULT_DRAIN_MAX_MS);
  let passes = 0;

  for (;;) {
    const finishedBefore = tracker.finished;
    const counts = await tick();
    passes += 1;

    await settle(tracker, deadline - Date.now());

    const quiet =
      moved(counts) === 0 && tracker.inFlight === 0 && tracker.finished === finishedBefore;
    if (quiet) return { passes, idle: true, counts };
    if (Date.now() >= deadline) return { passes, idle: false, counts };
  }
}

/** Waits for the in-process handlers, but never past the drain's own deadline. */
function settle(tracker: InProcessTracker, remainingMs: number): Promise<void> {
  if (tracker.inFlight === 0 || remainingMs <= 0) return Promise.resolve();
  return Promise.race([tracker.settled(), after(remainingMs)]);
}

function after(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

function moved(counts: TickCounts): number {
  return (
    counts.started + counts.pushed + counts.timers + counts.reaped + counts.timeouts + counts.notified
  );
}
