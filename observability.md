---
url: /vlo/observability.md
---
# Observability

Vlo has no separate tracing store. The journal is the trace: every durable fact about a run is
one row in `events`, and the two things that are not durable — `cmd.emit` payloads and
dispatcher warnings — go over an in-memory side channel. Source: `src/host/**`.

## The journal is the trace

Each event carries enough to reconstruct what happened and why:

| Field | What it tells you |
| --- | --- |
| `seq` | Position in the run. Strictly increasing, assigned by the kernel under the run lock. |
| `kind` / `status` | Which step type moved (`task`, `timer`, `signal`, `child`, `marker`) and to which of the seven statuses. |
| `step_id` / `attempt` | Which step, which attempt. Task ids are `<run_id>:<step_id>`, idempotency keys `<run_id>:<step_id>:<attempt>`. |
| `cause` | Why an attempt or run stopped: `timeout`, `heartbeat_lost`, `app_error`, `user_cancel`, `schema_violation`, `nondeterminism_detected`. |
| `error` | Free text from the worker or reducer. Never interpreted by the kernel. |
| `usage` | What this attempt spent (`cpu_ms`, `tokens`, `cost_micro_usd`). Present only when the worker reported any. |
| `ts_ms` / `random` | The clock and entropy the transition saw. A replay sees the same values. |
| `state_hash` | Hash of the state after this transition. Every event in one transition carries the same hash. |
| `schema_ref` | `name@<content hash>` of the activity or signal schema in force. |
| `parent_run_id` / `parent_step_id` | Set on every event of a child run from birth, so a run tree is a join. |

Read it with `GET /v1/runs/{id}/events`, `client.events(runId, since)`, or straight from the
table. Lifecycle events (`scheduled`, `running`, `retrying`, `cancelled`) sit next to the
reducer-facing ones, so the timeline includes dispatch, lease and retry decisions, not just
results.

Markers are the run-level punctuation: `start` (the input), `complete` (the output),
`continue` (the next input), `cancel`, `fail` (a reducer throw; its payload is the event that
was being folded, since that event's own transaction rolled back) and `nondeterminism`.

## Usage accounting

Usage travels one way and is banked once:

1. A handler calls `ctx.reportUsage({ tokens?, costMicroUsd?, cpuMs? })` as often as it
   likes; the worker tallies per attempt (integers, never negative).
2. The tally rides on the attempt's result — the `complete` or `fail` body over HTTP, the
   reporter call in-process — and lands as `usage` on the `task/succeeded`, `task/failed` or
   `task/retrying` event.
3. The kernel adds it to `kernel_state.usage_total` while folding, on lifecycle events too,
   so a retried attempt's spend is not lost.
4. Every reducer event carries `usage_total` (the banked total including this event);
   `task_done` also carries the step's own `usage`, zeroed when nothing was reported.

A reducer can therefore decide on a budget without keeping its own tally; that is how the
agent layer parks a run on a top-up signal. The current total is also readable off the
checkpoint: `run_state.kernel_state` is JSON with a `usage_total` field. `cost_micro_usd` is
whatever the worker reports; the engine has no price table, and child runs are not rolled up
into their parent.

## The side channel

`host.events` is a Node `EventEmitter`. Nothing on it is journaled or replayed.

| Channel | Payload | Emitted when |
| --- | --- | --- |
| `emit` | `{ run_id, channel, data }` | A transition committed with `cmd.emit(channel, data)` commands. Also relayed on the SSE stream as `event: emit`. |
| `warning` | `{ message, error? }` | The dispatcher could not start, push, fire, reap or notify something, or a poll accept failed. Never thrown, never printed; subscribe if you want a log. |
| `task_scheduled` | `{ run_id, task_id, queue }` | A task row was committed. Wakes an open `POST /v1/tasks/poll` for that queue. |

```ts
host.events.on("warning", ({ message, error }) => console.warn("vlo", message, error));
```

A closed journal during shutdown is not reported as a warning; the dispatcher drops it.

## Following a run live

`client.stream(runId, { since?, signal? })` yields `journal`, `emit` and finally `end`
messages over the SSE form of the events route (see [HTTP API](http-api.md)). Journal frames
are a replay plus a tail, so reconnecting with the last `seq` loses nothing durable; emits
between connections are gone. `client.waitFor(runId, status)` is the polling alternative
for scripts and tests.

## Health and the outbox

* `GET /healthz` answers `{ ok, roles, workflows }` with no auth; it says the process is up
  and what it serves, nothing about the journal.
* `POST /v1/timers/tick` answers `TickCounts` — `started`, `pushed`, `timers`, `reaped`,
  `timeouts`, `notified` — for one dispatcher pass, and `?drain=1` answers
  `{ passes, idle, counts }`. A cron that logs these has a per-minute picture of how much the
  outbox moved and whether it ran dry (`idle: true`) or hit its time box.
* `vlo doctor --profile <name> [--json]` runs real round trips: journal connect, migrate and
  commit; blob put/get; kernel wasm size and protocol; schema registration; each push queue's
  `/healthz`; roles against dispatcher mode. It exits 1 on any failing check. The hint
  strings are listed in [errors](errors.md).

## Nondeterminism as a correctness signal

On every fold the host re-hashes the stored checkpoint and compares it with the stored
`state_hash`; when the checkpoint is missing or was written by another bundle it folds the
journal from `seq 0` and compares each transition's hash with the hash journaled on the
trigger event. The first disagreement ends the run: a `nondeterminism` marker with
`cause: nondeterminism_detected` and the divergent `seq` in `error`, and every open task is
cancelled. Treat it as a bug report, not a flake — the reducer no longer reproduces the
history it wrote (a `Date`, `Math.random`, or a state shape change without
`continue_as_new`). It is never retried.

## Not built yet

Everything below would be an additive reader over the journal; none of it needs a kernel or
schema change.

* **OpenTelemetry export.** A run maps to a trace and a step to a span: `started_at_ms` /
  `closed_at_ms` bound the trace, `scheduled` → terminal events bound each span, `cause` and
  `error` become span status, `usage` becomes attributes, `parent_run_id` links traces.
* **A console.** Run tree, inbox of `awaiting_signal` runs, event timeline, rewind and fork.
  Today the inbox is `GET /v1/runs?status=awaiting_signal`.
* **`assignee` search attribute.** The `runs.assignee` column exists and is not written or
  queried yet.
* **Child usage roll-up.** `usage_total` is per run; a parent does not see what its children
  spent.
* **Pending-migration and schema-drift detection in `vlo doctor`.** It reports schemas that
  are absent, not ones that differ.
