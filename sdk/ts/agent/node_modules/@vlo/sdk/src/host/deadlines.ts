/**
 * The clock-driven outbox stages: a timer whose `fire_at_ms` has passed, a task whose lease
 * lapsed without a heartbeat, and a task that outlived its `timeout_ms`.
 *
 * Unlike the other stages these are not triggered by a row someone just wrote, which is what
 * makes them the engine's recovery path: a run parked on a timer and a run whose worker died
 * both wait on nothing but time, and any orchestrator that ticks will pick them up.
 */

import type { TaskRow, TimerRow } from "../journal/types.ts";
import type { Cause } from "../kernel/protocol.ts";
import type { HostContext } from "./context.ts";
import { isStepGone } from "./errors.ts";
import { timerFiredEvent } from "./events.ts";
import { applyEvent } from "./transition.ts";
import { failTask } from "./worker/complete.ts";

export interface DeadlineOptions {
  batch: number;
  claimHoldMs: number;
  /** Never throws: the dispatcher decides what a warning is worth. */
  warn(message: string, error?: unknown): void;
}

/** The number of timers that actually fired. */
export async function fireTimers(ctx: HostContext, o: DeadlineOptions): Promise<number> {
  const nowMs = ctx.now();
  const timers = await ctx.journal.transaction((tx) =>
    tx.claimDueTimers(nowMs, o.batch, o.claimHoldMs),
  );
  let fired = 0;
  for (const timer of timers) {
    try {
      await fireOne(ctx, timer);
      fired += 1;
    } catch (error) {
      if (!isStepGone(error)) {
        o.warn(`could not fire timer ${timer.run_id}/${timer.step_id}`, error);
        continue;
      }
      // The step this timer belonged to is gone for good (the run ended, or a signal beat the
      // deadline and the kernel pruned the timer step). The claim rolled back with the refused
      // transition, so retire the row instead, or the next tick claims it again.
      await retire(ctx, timer, o);
    }
  }
  return fired;
}

/** The fired flag and the timer event share one transaction: `false` means someone else won. */
function fireOne(ctx: HostContext, timer: TimerRow): Promise<unknown> {
  return applyEvent(ctx, timer.run_id, async (tx) => {
    const nowMs = ctx.now();
    const fired = await tx.markTimerFired(timer.run_id, timer.step_id, nowMs);
    return fired ? timerFiredEvent({ runId: timer.run_id, nowMs }, timer.step_id) : null;
  });
}

async function retire(ctx: HostContext, timer: TimerRow, o: DeadlineOptions): Promise<void> {
  try {
    await ctx.journal.transaction((tx) =>
      tx.markTimerFired(timer.run_id, timer.step_id, ctx.now()),
    );
  } catch (error) {
    o.warn(`could not retire timer ${timer.run_id}/${timer.step_id}`, error);
  }
}

/**
 * Fails every attempt whose lease has lapsed, which retries it on a fresh attempt or ends the
 * run once the policy is spent. No claim column is needed: `failTask` reads the task first and
 * `liveTask` returns null once the attempt has moved on, so a second reaper writes nothing.
 *
 * Returns the number of lapsed attempts this reaper was the one to fail.
 */
export async function reapLeases(ctx: HostContext, o: DeadlineOptions): Promise<number> {
  const tasks = await ctx.journal.expiredLeases(ctx.now(), o.batch);
  return reap(ctx, o, tasks, "lease expired without heartbeat", "heartbeat_lost", "lease");
}

/**
 * The host's half of `activity({ timeoutMs })`. The worker arms its own timer, which is what
 * normally ends an over-running attempt; this catches the case where the worker is gone, or
 * never got far enough to arm anything. Same no-claim argument as the lease reaper.
 */
export async function reapTimeouts(ctx: HostContext, o: DeadlineOptions): Promise<number> {
  const nowMs = ctx.now();
  const tasks = await ctx.journal.expiredTimeouts(nowMs, o.batch);
  let reaped = 0;
  for (const task of tasks) {
    const elapsed = nowMs - (task.dispatched_at_ms ?? nowMs);
    reaped += await reap(
      ctx,
      o,
      [task],
      `activity "${task.activity}" timed out after ${elapsed} ms without a result`,
      "timeout",
      "timeout",
    );
  }
  return reaped;
}

/** Fails each attempt and counts the ones this process was the first to settle. */
async function reap(
  ctx: HostContext,
  o: DeadlineOptions,
  tasks: readonly TaskRow[],
  error: string,
  cause: Cause,
  label: string,
): Promise<number> {
  let reaped = 0;
  for (const task of tasks) {
    try {
      const result = await failTask(ctx, task.task_id, task.attempt, error, true, cause);
      if (!result.duplicate) reaped += 1;
    } catch (failure) {
      o.warn(`could not reap the ${label} on task ${task.task_id}`, failure);
    }
  }
  return reaped;
}
