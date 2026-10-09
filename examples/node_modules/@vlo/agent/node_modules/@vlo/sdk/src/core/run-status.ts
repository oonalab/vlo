/** Run statuses a run can no longer leave, and the predicate over them. */

import type { RunStatus } from "../kernel/protocol.ts";

/** The statuses a run never leaves: `completed`, `failed`, `cancelled`, `continued`. */
export const TERMINAL_RUN_STATUSES: ReadonlySet<RunStatus> = new Set<RunStatus>([
  "completed",
  "failed",
  "cancelled",
  "continued",
]);

/** True when the run accepts no further events. */
export function isTerminalRunStatus(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.has(status);
}
