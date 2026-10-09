/** The two ways a worker reports a result: straight into this process, or over HTTP. */

import type { HostContext } from "../context.ts";
import { completeTask, failTask, heartbeatTask } from "./complete.ts";
import type { TaskReporter } from "./handle-task.ts";

/** Reports straight into this host's journal via {@link completeTask}, {@link failTask} and {@link heartbeatTask}. */
export function localReporter(ctx: HostContext): TaskReporter {
  return {
    async complete(taskId, attempt, output, usage) {
      await completeTask(ctx, taskId, attempt, output, usage);
    },
    async fail(taskId, attempt, error, retryable, usage, cause) {
      await failTask(ctx, taskId, attempt, error, retryable, cause ?? "app_error", usage);
    },
    heartbeat: (taskId, attempt) => heartbeatTask(ctx, taskId, attempt),
  };
}

/** The subset of `fetch` the reporter needs; injected by tests. */
import type { FetchLike } from "../transport/http-push.ts";

export type { FetchLike };

/**
 * Reports over HTTP to the host that owns the task. `completeUrl` is the task's base URL
 * (`…/v1/tasks/{id}`); the three verbs hang off it. Each call has a 10 s timeout and throws
 * a plain `Error` on a non-2xx answer, which for `heartbeat` is how a lost lease surfaces.
 */
export function remoteReporter(
  completeUrl: string,
  token: string | undefined,
  fetchImpl: FetchLike = globalThis.fetch,
): TaskReporter {
  const post = async (verb: string, body: unknown): Promise<void> => {
    const response = await fetchImpl(`${completeUrl}/${verb}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token !== undefined ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`task ${verb} failed: ${response.status} ${await response.text()}`);
    }
  };

  // The task id is already bound into `completeUrl`, so the verbs only carry the attempt.
  return {
    complete: (_taskId, attempt, output, usage) =>
      post("complete", { attempt, output, ...(usage !== undefined ? { usage } : {}) }),
    fail: (_taskId, attempt, error, retryable, usage, cause) =>
      post("fail", {
        attempt,
        error,
        retryable,
        ...(usage !== undefined ? { usage } : {}),
        ...(cause !== undefined ? { cause } : {}),
      }),
    heartbeat: (_taskId, attempt) => post("heartbeat", { attempt }),
  };
}
