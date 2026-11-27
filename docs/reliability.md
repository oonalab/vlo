# Reliability

Vlo is built so that a crash at any point loses nothing and wrong state cannot pass
unnoticed. This page states what Vlo guarantees, how each guarantee works, and what it
leaves to you.

## The guarantees at a glance

| Guarantee | In one line |
| --- | --- |
| [Commit before acknowledge](#commit-before-acknowledge) | Nothing is confirmed to a caller or a worker until it is in the journal. |
| [One transaction per step](#one-transaction-per-step) | The event, the new state and the next tasks are saved together or not at all. |
| [Nothing lost between "saved" and "sent"](#the-outbox) | Tasks, timers and child runs are rows; any orchestrator picks them up. |
| [Exactly-once recording](#exactly-once-recording-at-least-once-execution) | The first result recorded for an attempt wins. Execution is at-least-once. |
| [Dead workers are noticed](#leases-heartbeats-and-retries) | A lease that stops being renewed is reaped, and the retry policy takes over. |
| [State that checks itself](#state-that-checks-itself) | Every checkpoint is hash-checked on load. A rebuilt run is compared step by step. |
| [Typed, signed boundaries](#typed-and-signed-boundaries) | Inputs, outputs and signals are schema-checked. Pushed tasks are signed. |

## Commit before acknowledge

This is the one durability rule, and it is the same on every platform. A request to start a
run, deliver a signal or complete a task is answered only after its transaction has
committed. If the process dies before the answer, the caller retries and the journal
decides: the work is either recorded or it is not.

## One transaction per step

Every durable change goes through one path: lock the run, load the checkpoint, fold the
event, commit. The transaction holds the event, the new checkpoint and every row the
commands produced (tasks, timers, signal waits, child runs). There is no second system to
keep in step, because the journal is also the queue. See
[architecture.md](./architecture.md#the-write-path).

## The outbox

Commands are not executed inside the transaction. They are rows, and the dispatcher turns
rows into effects on its next pass: it starts runs, pushes tasks, fires timers, reaps
lapsed leases and tells parents about closed children.

- A crash between "committed" and "pushed" loses nothing. The row is still there, and the
  next pass on any process holding the `orchestrator` role picks it up.
- Every stage claims its rows, so several orchestrators can share one Postgres journal
  without doing the same work twice.
- Timers fire exactly once: the fired flag and the timer event commit together.

## Exactly-once recording, at-least-once execution

This is the honest guarantee a distributed system can make.

- Each attempt has an idempotency key, `run_id:step_id:attempt`.
- The first terminal result for an attempt wins. A later one is answered as a duplicate and
  changes nothing.
- A handler may still run twice for one key, for example after a crash. **Make a handler
  idempotent on `ctx.taskId` and `ctx.attempt` when its side effect matters.** See
  [activities-and-workers.md](./activities-and-workers.md#idempotency).

Vlo does not claim exactly-once execution.

## Leases, heartbeats and retries

- A task is held by a lease, not by a broker deadline. The SDK worker heartbeats
  automatically, so a task can run for hours.
- A worker that dies stops heartbeating. The lease lapses, the reaper fails the attempt
  with `heartbeat_lost`, and the retry policy decides what happens next.
- Retries use backoff with jitter. The default policy is 3 attempts, exponential, starting
  at 1 second.
- `schema_violation`, `user_cancel` and `nondeterminism_detected` are never retried.

Only a task's final outcome reaches your reducer. Retries happen below it.

## State that checks itself

Every checkpoint carries a hash, and the host verifies it every time it loads one.

If a checkpoint is missing, or was written by a different workflow build, the host rebuilds
the run from its first event and compares each step's hash with the one recorded in the
journal. A mismatch fails the run with `nondeterminism_detected` at the exact event,
instead of continuing with wrong state.

What this means for your code:

- **Normal recovery never re-runs your workflow.** It loads stored state and continues.
- **Reducers must be pure**: no clock, no randomness, no I/O. Time and entropy arrive on the
  event as `ts_ms` and `random`. See [workflows.md](./workflows.md#determinism).
- **Nothing enforces purity yet.** No lint or sandbox stops a reducer from reading the
  clock. An impure reducer is caught only when a run is rebuilt, and it is caught as a
  failed run, not as silently different state.

## Typed and signed boundaries

- Activity inputs are validated when a reducer asks for a task; outputs are validated
  before a result is folded. Registered signals are validated on arrival.
- Every pushed task carries an HMAC signature bound to the task, the attempt and the time,
  and is refused outside a five-minute window. A queue URL alone cannot be fed forged or
  replayed work.
- A signed link authorises one signal on one run until it expires. Opening the link
  changes nothing; it must be confirmed. See
  [signals-and-humans.md](./signals-and-humans.md#signed-links).

## How the kernel is tested

The kernel is a pure library, which makes it the easiest part to test hard:

- property tests over the whole event pipeline;
- an exhaustive table of step transitions;
- golden fixtures in `fixtures/kernel/`, which any host in any language can replay;
- a CI gate that requires both the committed wasm and a freshly built one to pass every
  fixture.

Journal adapters share one conformance suite, `journalConformance` from
`@oona/vlo/testing`. See [kernel-protocol.md](./kernel-protocol.md).

## What you are responsible for

| Your part | Why |
| --- | --- |
| Keep reducers pure | Nothing enforces it yet. |
| Make side-effecting handlers idempotent | Execution is at-least-once. |
| Run the journal on durable storage | Vlo is as durable as the database under it. Back it up as you would any system of record. |
| Set `auth.token` on any reachable host | The control plane is plain HTTP behind a bearer token. |
| On serverless, run the cron tick | A manual dispatcher only advances when something calls it. See [deployment.md](./deployment.md#serverless-manual-dispatch). |

## See it

Kill the host while a run is waiting, restart it, and the run carries on. The walkthrough
is in [getting-started.md](./getting-started.md#kill-it-and-watch-it-continue).
