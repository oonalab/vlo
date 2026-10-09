/**
 * `POST /v1/tasks/poll` — the pull half of task delivery.
 *
 * A pull worker asks for work instead of being pushed to, which is what lets a queue live
 * behind a NAT, on a GPU box, or on a machine the orchestrator cannot reach. The claim and
 * the accept are the same ones the push dispatcher uses, so the two modes differ only in who
 * starts the conversation.
 *
 * The wait is a long poll: hold the request open, re-check on a slow interval, and wake early
 * when a transition in this process commits a task for the queue.
 */

import type { HostContext, TaskScheduled } from "../context.ts";
import type { TaskRow } from "../../journal/types.ts";
import { markTaskRunning, toPushedTask } from "../task-dispatch.ts";
import type { PushedTask } from "../transport/types.ts";
import { asObject, json, readJson, requireString } from "./http.ts";

const MAX_WAIT_MS = 25_000;
const MAX_TASKS = 10;
const RECHECK_MS = 500;
/** A claim only has to outlive the accept below; the lease takes over from there. */
const CLAIM_HOLD_MS = 30_000;

export async function postPoll(ctx: HostContext, request: Request): Promise<Response> {
  const body = asObject(await readJson(request));
  const queue = requireString(body, "queue");
  const workerId = requireString(body, "worker_id");
  const waitMs = bounded(body.wait_ms, 0, MAX_WAIT_MS);
  const max = bounded(body.max, 1, MAX_TASKS);

  const tasks = await pollQueue(ctx, { queue, workerId, waitMs, max });
  return json({ tasks });
}

interface PollRequest {
  queue: string;
  workerId: string;
  waitMs: number;
  max: number;
}

async function pollQueue(ctx: HostContext, o: PollRequest): Promise<PushedTask[]> {
  // Wall-clock, not `ctx.now`: this is how long the socket stays open, not journal time.
  const deadline = Date.now() + o.waitMs;
  for (;;) {
    const claimed = await ctx.journal.transaction((tx) =>
      tx.claimUndispatchedTasks(ctx.now(), o.max, CLAIM_HOLD_MS, { queue: o.queue }),
    );
    const accepted = await accept(ctx, claimed, o.workerId);
    if (accepted.length > 0) return accepted;

    const remaining = deadline - Date.now();
    if (remaining <= 0) return [];
    await waitForWork(ctx, o.queue, Math.min(remaining, RECHECK_MS));
  }
}

/**
 * Records each claimed task as running before handing it over, exactly as a push does.
 * A task whose accept fails is left claimed; the hold lapses and it comes back.
 */
async function accept(
  ctx: HostContext,
  tasks: TaskRow[],
  workerId: string,
): Promise<PushedTask[]> {
  const accepted: PushedTask[] = [];
  for (const task of tasks) {
    try {
      const pushed = await toPushedTask(ctx, task);
      await markTaskRunning(ctx, task, workerId);
      accepted.push(pushed);
    } catch (error) {
      ctx.events.emit("warning", { message: `could not hand out task ${task.task_id}`, error });
    }
  }
  return accepted;
}

/** Resolves on the timeout, or as soon as this process commits a task for the queue. */
function waitForWork(ctx: HostContext, queue: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      ctx.events.off("task_scheduled", onScheduled);
      resolve();
    };
    const onScheduled = (message: TaskScheduled): void => {
      if (message.queue === queue) done();
    };
    const timer = setTimeout(done, timeoutMs);
    timer.unref();
    ctx.events.on("task_scheduled", onScheduled);
  });
}

function bounded(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.floor(value), min), max);
}
