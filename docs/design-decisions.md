# Design decisions

The choices that shape the engine, each as decision, reason and what it costs. Nothing here is
a roadmap; it is why the code looks the way it does.

## A reducer kernel instead of replayed linear code

**Decision.** A workflow is `(state, event) → (state, commands)`. State is the snapshot; the
kernel folds one event per transition and never runs workflow code otherwise.

**Why.** Linear `await` code has to be re-executed from the top to resume, which needs a
frozen realm or sandbox for determinism, a poll or asyncify contract to suspend, and replay
cost proportional to history. A reducer never suspends: there is no stack to save, no realm
to freeze, and recovery is "load the checkpoint, verify its hash, continue".

**Consequence.** Pipelines are written as phases (`sequence`, `fanOut`, `waitFor`, `sleep`)
or as hand-written handlers, not as `await a(); await b();`. A linear layer could be built
later on top of the same journal; it would not change the kernel.

## The journal is the queue; brokers only as a transport

**Decision.** The `tasks` table is the outbox and the lease. There is no message broker in
the write path. `TaskTransport` (HTTP push today, in-process for a local worker) is delivery
only; the row is the only source of truth.

**Why.** A broker gives you a second source of truth, an ack deadline that caps task
duration, and one more service on the hot path. A row committed in the same transaction as
the event gives exactly-once recording, lease-and-heartbeat with no duration ceiling,
completion from anywhere at any time, and a crash between "persisted" and "pushed" that
loses nothing.

**Consequence.** Fan-out throughput is bounded by the database (low thousands of tasks per
second on Postgres). Teams with an existing broker can add a transport adapter that carries
the pushed task; the journal still records it.

## Rust kernel on wasm, with a size budget and a semantic gate

**Decision.** The kernel is Rust with zero I/O, compiled to `wasm32-unknown-unknown` via
`wasm-bindgen`, committed under `sdk/ts/sdk/wasm/`, capped at 1 MiB. CI rebuilds it and
requires both the committed and the fresh artifact to pass every golden fixture.

**Why.** One implementation of the envelope rules, hashing and retry maths serves Node now
and any other host later, and a pure library is the easiest thing to test exhaustively
(proptests, an exhaustive step-edge table, fixtures). Byte-identical wasm across macOS and
Linux toolchains is not achievable in practice, so the gate is on behaviour instead.

**Consequence.** JS consumers never need a Rust toolchain. Kernel changes require rebuilding
and committing the wasm and regenerating fixtures; `VLO_KERNEL_WASM` lets you test another
build in place.

## A write-set kernel: the kernel returns rows, the host writes them

**Decision.** `reduce_step` returns a declarative `Transition` — events, checkpoint, new
tasks, task updates, timers, spawns, signal waits, emits, completion — and the journal applies
it atomically without interpreting commands.

**Why.** A kernel that owns the database cannot compile to wasm and would force a native host.
Splitting "decide" from "persist" keeps the kernel pure and testable, and makes every journal
adapter a dumb applier of the same shape.

**Consequence.** Journal adapters are small (one SQL text for both dialects) and can be
conformance-tested with `journalConformance`. Cross-run effects (starting a child, notifying a
parent) happen in later transactions through the outbox, never inside the fold.

## Hashed JSON is kept as text

**Decision.** `state`, `kernel_state`, `payload`, `input` and `output` are `text` columns.
Only `search`, `usage` and `retry_policy` are `jsonb` on Postgres.

**Why.** `jsonb` normalises key order and numeric lexemes. The re-fold check compares the
hash of what the kernel wrote with the hash of what it reads back; any rewrite in between is a
false nondeterminism.

**Consequence.** You cannot index into state with `jsonb` operators. Put queryable attributes
in `search` when starting a run.

## File and GCS blobs, with a 256 KiB offload

**Decision.** Anything larger than 256 KiB leaves the journal for a content-addressed blob
store; `file://` and `gcs://` are built in. References are `blob://sha256/<hex>`.

**Why.** History rows should stay small enough that folding thousands of events is cheap, and
a content address makes retries and duplicates free. GCS with Application Default
Credentials matches the first production target; a directory matches a laptop and CI.

**Consequence.** Every oversized payload costs a blob round trip on the write path. Other
stores (S3, Vercel Blob) are adapters to add; the interface is two methods.

## Push by default, signed with an HMAC

**Decision.** The dispatcher POSTs the full task to the queue's URL and expects `202`; the
worker completes later through `complete_url`. Every push carries
`vlo-signature: v1=hmac-sha256(secret, task_id.attempt.ts.sha256(body))` and is refused
outside a five-minute window. Pull (`mode: "pull"`) and in-process are the alternatives.

**Why.** Push lets workers scale to zero and live in serverless functions, and a signature
bound to task, attempt and time means a queue URL alone cannot be fed forged or replayed
tasks. Pull exists for workers behind a NAT or on hardware the orchestrator cannot reach.

**Consequence.** Every push queue needs a shared `secret`; the dispatcher refuses to push
unsigned. Workers must be idempotent on `idempotency_key`: delivery is at-least-once.

## A manual dispatcher plus a cron for serverless

**Decision.** `dispatcher: { mode: "manual" }` never arms an interval and ignores `kick()`.
Progress comes from `host.drain({ maxMs })`, called by the request that started or signalled
a run, and from a cron hitting `POST /v1/timers/tick?drain=1`.

**Why.** A serverless platform may freeze the process the moment a response is sent. An
unattended background tick would leave tasks marked `running` with nobody behind them; an
awaited, time-boxed drain finishes what it started, and the cron catches whatever a crashed
invocation left in the outbox.

**Consequence.** A run's chain of in-process steps advances within one invocation; anything
that parks (a timer, a remote worker, a signal) waits at most one cron interval. `vlo doctor`
warns when a manual orchestrator has no `deploy.cron`.

## Budget is a reducer decision

**Decision.** The kernel banks every attempt's `usage` into `usage_total` and hands it to the
reducer on every event. Budget enforcement lives in `@oona/vlo/agent`, which parks an exhausted
run on a top-up signal instead of failing it.

**Why.** An engine-level interceptor would need policy the kernel cannot know (what a token
costs, what a ceiling means, whether to park or fail). Trustworthy accounting is the only part
that must be engine-level, because a reducer cannot see a failed attempt's spend any other
way.

**Consequence.** Any workflow, not just an agent, can read `usage_total` and decide. There is
no price table: `cost_micro_usd` is whatever the worker reports.

## One checkpoint, verified by hash, rebuilt from zero

**Decision.** `run_state` holds exactly one checkpoint per run, rewritten in the same
transaction as every event. On load the host re-hashes it; a mismatch, a missing row or a
different bundle digest triggers a full fold from `seq 0`, comparing each transition's hash
with the journaled one.

**Why.** Folding is calling a pure function once per input event, which is milliseconds for
thousands of events, so a "last N events" window buys nothing. A per-event hash pinpoints
the exact seq where a reducer stopped agreeing with its own history.

**Consequence.** A run failed with `nondeterminism_detected` is a bug in the reducer, never
retried. Long-lived runs compact history with `continue_as_new`.
