/** How a scheduled task reaches the code that runs it. */

import type { Json } from "../../kernel/protocol.ts";

/** The task as a worker receives it — the HTTP push body, byte for byte. */
export interface PushedTask {
  /** The task's id; the callback URL is built from it. */
  task_id: string;
  /** The run the task belongs to. */
  run_id: string;
  /** The workflow step that scheduled it. */
  step_id: string;
  /** Attempt number, starting at 1. Every report must carry it back. */
  attempt: number;
  /** Activity name and, when registered, the schema version the output is checked against. */
  activity: { name: string; schema_ref?: string };
  /** Stable per attempt: a worker that sees it twice is being re-pushed, not asked to run again. */
  idempotency_key: string;
  /** The activity input. */
  input: Json;
  /** Lease length in milliseconds; each heartbeat extends it by this much. */
  lease_ms: number;
  /** How often to heartbeat, in milliseconds: a third of the lease, at least 1 s. */
  heartbeat_ms: number;
  /** Wall-clock budget for this attempt. The worker aborts the handler at it. */
  timeout_ms?: number;
  /** Base URL for `${complete_url}/complete|fail|heartbeat`. Absent for in-process work. */
  complete_url?: string;
}

/**
 * What a transport's `push` answers. `accepted` means the task is now the worker's: the
 * dispatcher records it as running. `inlineOutput` is a result the worker returned at once.
 */
export type PushResult =
  | { accepted: true; inlineOutput?: Json }
  /** `fatal` means the worker rejected the task itself; retrying would not help. */
  | { accepted: false; reason: string; fatal?: boolean };

/** Delivers a scheduled task to whatever runs it. The dispatcher picks one per queue. */
export interface TaskTransport {
  /** A label for warnings, e.g. `http-push` or `in-process`. */
  readonly kind: string;
  /** Hands the task over. Must not throw for a refused push; report it in the result. */
  push(task: PushedTask): Promise<PushResult>;
}
