---
name: mark-dispatched-never-applies
description: Open @vlo/sdk defect found 2026-09-17 — tx.markDispatched is a silent no-op on the normal dispatch path, so dispatched_at_ms / worker_id / lease_until_ms are never recorded
metadata:
  type: project
---

`tx.markDispatched` (guarded `WHERE status = 'scheduled'`) runs in `applyEvent`'s `after`
callback, which fires *after* `tx.applyTransition` has already applied the kernel's own
`task_update → running` inside the same transaction. The row is no longer `scheduled`, so
the update matches zero rows and is discarded — for the push dispatcher and for the pull
poller alike, since both share `markTaskRunning` in `src/host/task-dispatch.ts`.

Observable consequences on a dispatched task row: `dispatched_at_ms`, `worker_id` and
`lease_until_ms` stay NULL and `dispatch_claimed_until_ms` is never cleared. The lease
reaper still works only because `heartbeatTask` is what first writes `lease_until_ms` — so
a worker that dies *before* its first heartbeat (default: lease/3, i.e. 20 s) leaves a task
that `expiredLeases` cannot see. Separately, the kernel emits no terminal `task_update`, so
task rows stay `status = 'running'` after the run completes.

**Why:** found while writing the pull-mode tests for M1 Track A; reported to the user rather
than fixed, because the fix changes write-path ordering (run `after` before
`applyTransition`, or drop the `status = 'scheduled'` guard) and that is an engine semantics
decision, not a Track A one.

**How to apply:** do not assert `worker_id` / `lease_until_ms` / `status === "succeeded"` on
task rows in host tests — they will fail for reasons unrelated to the code under test. Before
acting on this, re-verify: it may have been fixed since 2026-09-17.
