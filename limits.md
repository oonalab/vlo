---
url: /vlo/limits.md
---
# Limits

Hard caps, defaults you can raise, and what the current runtime cannot do. Every number
below is a constant in the source; the file is named so you can check it.

## Payload and state caps

| Limit | Value | Where | Behaviour at the limit |
| --- | --- | --- | --- |
| Inline payload | 256 KiB (262 144 bytes) | `INLINE_LIMIT_BYTES` in `crates/types/src/lib.rs` and `src/kernel/protocol.ts` | `validate_event` rejects a larger inline `payload` with `payload_too_large`. The host offloads oversized text to the blob store and sends `payload_ref` instead. |
| Inline user state | 256 KiB | same constant | The kernel sets `state_inline: false`; the host writes `run_state.state_ref` and the bytes go to the blob store. Folding then reads the blob on every event, so keep state small or `continue_as_new`. |
| Inline run output | 256 KiB | same constant | Offloaded to `runs.output_ref`; `GET /v1/runs/{id}` reads it back. |
| Blob reference | `blob://sha256/<64 lowercase hex>` | `src/blob/ref.ts` | Anything else is rejected. |
| `random` | exactly 32 lowercase hex chars | `crates/kernel/src/validate.rs` | `invalid_event` otherwise. |
| Child run id | `run_` + 26 hex | `crates/kernel/src/ids.rs` | Derived from `sha256("<run_id>:<step_id>")`. |

Numbers in hashed structures (`Usage`, `RetryPolicy`, `KernelState`) are integers. Money is
`cost_micro_usd`; there are no floats on the wire where a hash is taken.

## Size budgets (CI gate)

`sdk/ts/sdk/scripts/size-gate.mjs` fails the build when any budget is exceeded, or when code
that belongs to the CLI (argument parsing, doctor checks, deploy templates) appears in a chunk
the runtime imports:

| Artifact | Budget | Today |
| --- | --- | --- |
| `wasm/vlo_kernel_bg.wasm` | 1 MiB (1 048 576 bytes); also enforced by `scripts/build-kernel.sh` and warned on by `vlo doctor` | 297 573 bytes (298 KB), built with `opt-level = "z"`, fat LTO, `panic = "abort"`, `strip`, `wasm-opt` off |
| Runtime JS: every `dist/*.js` chunk reachable from `index.js` and `host.js` (what `@oona/vlo` and `@oona/vlo/host` load) | 256 KB (262 144 bytes) | ~207 KB |
| CLI JS: `cli.js` and the chunks only it reaches | 96 KB (98 304 bytes) | ~54 KB |

The CI gate on the kernel is semantic, not byte-identical: the committed wasm and a
freshly built one must both pass every golden fixture (see [kernel protocol](kernel-protocol.md)).

## Known weak spots

These are measured, not theoretical. The setup behind the numbers is in
[performance.md](./performance.md#setup).

| Weak spot | What was measured | What to do |
| --- | --- | --- |
| **Database round trips per step** | One step makes about 15 round trips to the database, so step time is roughly 15 times the round trip. With a 23 ms round trip, a step took 336 ms. | Run the host in the same region as its journal. |
| **Very wide fan-out in one run** | 1,000 tasks inside a single run finished at 45 per second, against 975 per second across separate runs. Per-task cost grows with the width of the run. | Fan out wide work as child runs with `fanOutRuns`, each with its own journal. |
| **Throughput is bounded by the database** | By design: low thousands of tasks per second on Postgres. Not load-tested on server hardware. | Add a broker as a delivery transport if you need more; the journal still records everything. |
| **Reducer purity is not enforced** | A TypeScript reducer could read the clock or call the network, and no lint catches it. | Keep reducers pure. A mistake surfaces as `nondeterminism_detected` when a run is rebuilt. |

## Dispatcher, lease and retry defaults

| Knob | Default | Where |
| --- | --- | --- |
| Dispatcher tick | 500 ms (`loop` mode only) | `DispatcherOptions.tickMs` |
| Claim batch | 50 rows per stage per pass | `DispatcherOptions.batch` |
| Claim hold | 30 s | `DispatcherOptions.claimHoldMs` |
| Refused-push backoff | 1 s × 2^attempts, capped at 60 s | `backoffBaseMs`, `maxBackoffMs` |
| Unroutable queue backoff | 60 s | `unroutableBackoffMs` |
| Drain time box | 25 s | `DEFAULT_DRAIN_MAX_MS`; `?max_ms=` on the tick route |
| Task lease | 60 s | `DEFAULT_LEASE_MS` (SDK), `DEFAULT_LEASE_TTL_MS` (kernel); `activity({ leaseMs })` |
| Heartbeat interval | `max(1000, lease / 3)` ms | `toPushedTask` |
| Attempt timeout | none | `activity({ timeoutMs })` |
| Retry policy | 3 attempts, exponential, 1 s initial, 600 s max, factor 2, full jitter | `DEFAULT_RETRY` |
| Push request timeout | 5 s | `HttpPushTransport` |
| Callback request timeout | 10 s | `remoteReporter` |
| Push signature window | ±5 min | `src/host/worker/signature.ts` |
| Signed link TTL | 7 days | `DEFAULT_LINK_TTL_MS` |
| Poll long-wait | ≤ 25 s, ≤ 10 tasks, recheck 500 ms | `src/host/api/poll.ts` |
| Pull worker | 20 s wait, concurrency 4, ≤ 10 per poll, 1 s backoff after a failed poll | `runPullWorker` |
| SSE poll | 500 ms; keepalive every 15 s | `streamPollMs`, `KEEPALIVE_MS` |
| Run list | 50 via the route, 100 via `journal.query` | `indexRuns`, `DEFAULT_QUERY_LIMIT` |
| Shutdown grace | 5 s for in-process handlers | `SHUTDOWN_GRACE_MS` |
| Default port | 4100, bound to `127.0.0.1` | `DEFAULT_PORT`, `listen()` |
| Agent loop | 50 iterations, 20 observations kept | `DEFAULT_MAX_ITERATIONS`, `DEFAULT_MEMORY_LIMIT` in `@oona/vlo/agent` |

A missed heartbeat window moves the attempt to `retrying` with `cause: heartbeat_lost`, or to
`failed` once the policy is spent. `schema_violation`, `user_cancel` and
`nondeterminism_detected` never retry, whatever the policy.

## SQLite is single-writer

The SQLite journal is one `node:sqlite` connection behind a promise mutex; every transaction
takes the file's write lock with `BEGIN IMMEDIATE`. Consequences:

* Run **one host process per SQLite file**. A second process waits on the lock for
  `busy_timeout` (5 s) and then errors; two `SqliteJournal` instances in one process must
  never both be opened on the same file.
* Throughput is one transaction at a time. It is the right journal for a laptop, CI and a
  small self-host, not for fan-out in the thousands.
* Postgres has no such constraint: claims use `FOR UPDATE SKIP LOCKED` and per-run advisory
  locks, so several orchestrators may tick the same journal at once.

## Runtime

* **Node ≥ 22.5** (`engines` in both packages), because the SQLite journal uses `node:sqlite`
  and the kernel is instantiated with `WebAssembly` from bytes read off disk.
* `zod` ^4 is a peer dependency of both packages; `@google-cloud/storage` ^7 is optional and
  only needed for `gcs://`.
* The workflow bundle digest is currently `contentHash({ name, v: 1 })`: a run pins the
  workflow name, not its code. Changing a reducer's behaviour under a live run is caught by
  the re-fold check, not prevented.

## Not available on edge runtimes yet

Vlo is built to run at the edge, and it does not run there yet. The host runs on Node
today. The kernel already compiles to `wasm32-unknown-unknown` with no
imports, which is what an edge host needs, but the surrounding pieces are Node-only:

* **Cloudflare Workers / Durable Objects** as a host and journal are deferred. There is no
  Durable Object journal adapter, no `wrangler.toml` emitter, and the journal is opened with
  `pg` or `node:sqlite`.
* **No cross-run index** outside the `runs` table: listing and searching runs is a SQL query
  against Postgres or SQLite.
* **No console.** The inbox is `GET /v1/runs?status=awaiting_signal`; the timeline is the
  events route.
* **No S3 or Vercel Blob adapter**: blob stores are `file://` and `gcs://`.
* **No `vlo.toml`, no native (non-Node) host**: `crates/traits` sketches the adapter traits a
  Rust host would implement, and nothing implements them.
* `vlo deploy` renders templates for two targets, `cloud-run` and `vercel`, and prints the
  commands with `--apply`; it never runs them.
