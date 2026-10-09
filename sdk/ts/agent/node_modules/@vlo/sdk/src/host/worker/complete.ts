/**
 * Where a task result becomes an event. HTTP routes and the in-process transport both land
 * here, so validation, retry planning and idempotency are written once.
 *
 * Idempotency rule: the first terminal result for an attempt wins. A later one — a retried
 * push, a worker that answered twice — reports `duplicate` instead of failing.
 */

import type { TaskRow } from "../../journal/types.ts";
import type { Cause, Usage } from "../../kernel/protocol.ts";
import type { HostContext } from "../context.ts";
import { LeaseLost, TaskNotFound } from "../errors.ts";
import { randomHex, taskFailedEvent, taskRetryingEvent, taskSucceededEvent } from "../events.ts";
import { applyEvent } from "../transition.ts";

/** What a task report resolved to. */
export interface TaskResult {
  /** True when the attempt had already been settled, so nothing was written. */
  duplicate: boolean;
}

const DUPLICATE: TaskResult = { duplicate: true };
const APPLIED: TaskResult = { duplicate: false };

const TERMINAL_TASK = new Set(["succeeded", "failed", "cancelled"]);

/**
 * Records an attempt's output. Validated against the registered activity's output schema
 * when there is one; a violation fails the attempt with `schema_violation` and no retry.
 * The first terminal result for an attempt wins; later ones return `duplicate: true`.
 *
 * @throws {@link TaskNotFound} when no task has that id.
 */
export async function completeTask(
  ctx: HostContext,
  taskId: string,
  attempt: number,
  output: unknown,
  usage?: Usage,
): Promise<TaskResult> {
  const task = await liveTask(ctx, taskId, attempt);
  if (task === null) return DUPLICATE;

  const activity = ctx.activities.get(task.activity);
  if (activity === undefined) {
    // Nothing to validate against: fold the output as opaque JSON.
    return submit(ctx, task, JSON.stringify(output ?? null), usage);
  }

  const parsed = activity.output.safeParse(output);
  if (!parsed.success) return failValidation(ctx, task, issuesOf(parsed.error.issues), usage);
  return submit(ctx, task, JSON.stringify(parsed.data ?? null), usage);
}

/**
 * Records an attempt's failure: a `retrying` event when `retryable` and the kernel's retry
 * plan allows another attempt, otherwise a `failed` event. The first terminal result for an
 * attempt wins; later ones return `duplicate: true`.
 *
 * `cause` names who lost the attempt: the handler by default, the reaper on a dead lease.
 * `usage` is banked whichever way the attempt ends — tokens burned before a throw are spent.
 *
 * @throws {@link TaskNotFound} when no task has that id.
 */
export async function failTask(
  ctx: HostContext,
  taskId: string,
  attempt: number,
  error: string,
  retryable = true,
  cause: Cause = "app_error",
  usage?: Usage,
): Promise<TaskResult> {
  const task = await liveTask(ctx, taskId, attempt);
  if (task === null) return DUPLICATE;

  const nowMs = ctx.now();
  const base = { runId: task.run_id, nowMs };

  if (retryable) {
    const plan = ctx.kernel.planRetry({
      policy: task.retry_policy,
      attempt,
      cause,
      random: randomHex(),
    });
    if (plan.ok && plan.value.retry) {
      await applyEvent(
        ctx,
        task.run_id,
        taskRetryingEvent(
          base,
          task.step_id,
          plan.value.next_attempt,
          cause,
          plan.value.delay_ms,
          error,
          usage,
        ),
      );
      return APPLIED;
    }
  }

  await applyEvent(
    ctx,
    task.run_id,
    taskFailedEvent(base, task.step_id, attempt, cause, error, usage),
  );
  return APPLIED;
}

/**
 * Extends the attempt's lease by the task's `lease_ttl_ms` from now.
 *
 * @throws {@link TaskNotFound} when no task has that id.
 * @throws {@link LeaseLost} when the task is not running at that attempt any more.
 */
export async function heartbeatTask(
  ctx: HostContext,
  taskId: string,
  attempt: number,
): Promise<void> {
  const task = await ctx.journal.getTask(taskId);
  if (task === null) throw new TaskNotFound(taskId);

  const nowMs = ctx.now();
  const held = await ctx.journal.transaction((tx) =>
    tx.heartbeat(taskId, attempt, nowMs + task.lease_ttl_ms, nowMs),
  );
  if (!held) throw new LeaseLost(taskId, attempt);
}

/** The task row when this attempt may still produce a result, else null (a redelivery). */
async function liveTask(ctx: HostContext, taskId: string, attempt: number): Promise<TaskRow | null> {
  const task = await ctx.journal.getTask(taskId);
  if (task === null) throw new TaskNotFound(taskId);
  if (task.attempt !== attempt || TERMINAL_TASK.has(task.status)) return null;
  return task;
}

function submit(
  ctx: HostContext,
  task: TaskRow,
  outputJson: string,
  usage: Usage | undefined,
): Promise<TaskResult> {
  const event = taskSucceededEvent(
    { runId: task.run_id, nowMs: ctx.now() },
    task.step_id,
    task.attempt,
    outputJson,
    task.schema_ref,
    usage,
  );
  return applyEvent(ctx, task.run_id, event).then(() => APPLIED);
}

/** A schema violation is the worker's fault, not a flake: the kernel never retries it. */
async function failValidation(
  ctx: HostContext,
  task: TaskRow,
  detail: string,
  usage: Usage | undefined,
): Promise<TaskResult> {
  await applyEvent(
    ctx,
    task.run_id,
    taskFailedEvent(
      { runId: task.run_id, nowMs: ctx.now() },
      task.step_id,
      task.attempt,
      "schema_violation",
      `activity "${task.activity}" returned an invalid output: ${detail}`,
      usage,
    ),
  );
  return APPLIED;
}

function issuesOf(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}
