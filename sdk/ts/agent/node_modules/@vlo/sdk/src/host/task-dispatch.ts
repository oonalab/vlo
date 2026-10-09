/**
 * The accept path a task takes on its way to a worker, shared by the two ways it can
 * leave the journal: the dispatcher pushing it, and a poller claiming it.
 *
 * Both do the same two things in the same order — build the push body, then commit
 * `task/running` together with the lease — so a pulled task is indistinguishable from a
 * pushed one to the kernel, the reaper and crash recovery.
 */

import { readBlobText } from "../blob/offload.ts";
import type { TaskRow } from "../journal/types.ts";
import type { Json } from "../kernel/protocol.ts";
import type { HostContext } from "./context.ts";
import { taskRunningEvent } from "./events.ts";
import { applyEvent } from "./transition.ts";
import type { PushedTask } from "./transport/types.ts";

export async function toPushedTask(ctx: HostContext, task: TaskRow): Promise<PushedTask> {
  const inputJson = (await inlineOrBlob(ctx, task.input, task.input_ref)) ?? "null";
  const completeUrl =
    ctx.publicUrl === undefined
      ? undefined
      : `${ctx.publicUrl}${ctx.basePath ?? ""}/v1/tasks/${encodeURIComponent(task.task_id)}`;

  return {
    task_id: task.task_id,
    run_id: task.run_id,
    step_id: task.step_id,
    attempt: task.attempt,
    activity: {
      name: task.activity,
      ...(task.schema_ref !== undefined ? { schema_ref: task.schema_ref } : {}),
    },
    idempotency_key: task.idempotency_key,
    input: JSON.parse(inputJson) as Json,
    lease_ms: task.lease_ttl_ms,
    heartbeat_ms: Math.max(1_000, Math.floor(task.lease_ttl_ms / 3)),
    ...(task.timeout_ms !== undefined ? { timeout_ms: task.timeout_ms } : {}),
    ...(completeUrl !== undefined ? { complete_url: completeUrl } : {}),
  };
}

/** Records the dispatch: the `running` event and the lease commit together or not at all. */
export async function markTaskRunning(
  ctx: HostContext,
  task: TaskRow,
  workerId: string,
): Promise<void> {
  const nowMs = ctx.now();
  await applyEvent(
    ctx,
    task.run_id,
    taskRunningEvent({ runId: task.run_id, nowMs }, task.step_id, task.attempt),
    async (tx) => {
      await tx.markDispatched(
        task.task_id,
        task.attempt,
        nowMs,
        nowMs + task.lease_ttl_ms,
        workerId,
      );
    },
  );
}

/** A payload column: inline text, or the blob it was offloaded to. */
export async function inlineOrBlob(
  ctx: HostContext,
  inline: string | undefined,
  ref: string | undefined,
): Promise<string | undefined> {
  if (inline !== undefined) return inline;
  if (ref !== undefined) return readBlobText(ctx.blob, ref);
  return undefined;
}
