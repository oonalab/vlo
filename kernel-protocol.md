---
url: /vlo/kernel-protocol.md
---
# Kernel protocol

The kernel is a Rust library (`crates/kernel`) with no I/O, no clock and no randomness of its
own, compiled to wasm (`crates/kernel-wasm`) and loaded in Node by `src/kernel/load.ts`.
Every export is a JSON string in and a JSON string out. This page is the contract between the
host and that boundary. Types: `crates/types`, mirrored by hand in `src/kernel/protocol.ts`.

## Exports and versioning

`PROTOCOL_VERSION` is `1` on both sides; `loadKernel()` refuses a wasm whose
`kernel_version().protocol` differs. `kernel_version` also reports the crate version and a
`features` list (`canonical_json_v1`, `state_hash_v1`, `refold_v1`), which is additive only.

| wasm export | `Kernel` method | Input → output |
| --- | --- | --- |
| `kernel_version` | `version()` | `{ version, protocol, features }` |
| `validate_event` | `validateEvent(event)` | `EventInput` → `{ normalized: EventInput }` |
| `prepare_event` | `prepareEvent({ run, kernel_state?, state?, event })` | `Prepared` (see below) |
| `reduce_step` | `reduceStep({ run, kernel_state, event, reduction })` | `Transition` |
| `compute_state_hash` | `stateHash({ kernel_state, state })` | `{ hash }` |
| `plan_retry` | `planRetry({ policy, attempt, cause, random })` | `RetryPlan` |
| `refold_check` | `refoldCheck({ expected, actual })` | `RefoldCheckOutput` |
| `derive_ids` | `deriveIds({ run_id, step_id, attempt })` | `{ task_id, idempotency_key, child_run_id }` |

Every export returns `KernelResult<T>`: `{"ok":true,"value":…}` or
`{"ok":false,"error":{"code","message","seq"?,"step_id"?}}`. The kernel never panics
(`panic = "abort"` in the wasm profile makes that a hard requirement); the twelve codes are
listed in [errors](errors.md).

## Envelope

An `EventInput` is what the host submits; an `Envelope` is the journaled form, which adds
`seq`, `state_hash`, and the run's `parent_run_id` / `parent_step_id`.

| Field | Values |
| --- | --- |
| `kind` | `task`, `timer`, `signal`, `child`, `marker` |
| `status` | `scheduled`, `running`, `succeeded`, `failed`, `retrying`, `cancelled`, `awaiting_signal` |
| `cause` | `timeout`, `heartbeat_lost`, `app_error`, `user_cancel`, `schema_violation`, `nondeterminism_detected` |
| `usage` | `{ cpu_ms, tokens, cost_micro_usd }`, integers |
| `ts_ms`, `random` | The host's clock and 32 hex chars of entropy, journaled so a replay sees the same values |
| `payload` / `payload_ref` | Byte-exact JSON text, or a `blob://sha256/…` ref; at most one of the two |
| `schema_ref`, `error` | Optional; never interpreted by the kernel |

The kernel routes on the header alone (`classify.rs`). Markers are keyed by `step_id`:
`start` (status `succeeded`), `cancel`, `fail` (status `failed`), `nondeterminism`
(cause `nondeterminism_detected`); the kernel itself writes `complete` and `continue`.

The step state machine allows these edges (`step_machine.rs`); anything else is
`illegal_transition`:

```
scheduled → running | succeeded | failed | retrying | cancelled
running   → succeeded | failed | retrying | cancelled | awaiting_signal
retrying  → scheduled | succeeded | failed | cancelled
awaiting_signal → running | succeeded | cancelled
```

Terminal steps are pruned from `kernel_state.steps` (`closed_steps` counts them), so a late
event for one is `unknown_step`.

## Two-phase fold

`prepare_event` classifies the event and answers one of two modes:

* `{ "mode": "reduce", "reducer_event", "init_input"?, "kernel_state" }` — call the reducer
  with `reducer_event` (and `init(init_input)` first for `started`), then pass the result to
  `reduce_step`.
* `{ "mode": "lifecycle", "transition" }` — pure bookkeeping (task `running`, `retrying`,
  `cancelled`; run `cancel`, `fail`, `nondeterminism`). Apply the transition as-is; the user
  state is echoed from the checkpoint and re-hashed with the new kernel state.

The five reducer events, each carrying `ts_ms`, `random` and `usage_total`:

| `type` | Extra fields |
| --- | --- |
| `started` | `input` |
| `task_done` | `step_id`, `attempt`, `activity`, `status` (`succeeded` or `failed`), `output?`, `cause?`, `error?`, `usage` |
| `signal` | `step_id`, `name`, `payload` |
| `timer` | `step_id` |
| `child_done` | `step_id`, `child_run_id`, `status`, `output?` |

The seven commands a reducer may return (`Reduction = { state: string, commands }`):

| `type` | Fields | Opens |
| --- | --- | --- |
| `task` | `activity`, `input`, `schema_ref?`, `queue?` (default `default`), `retry?`, `lease_ttl_ms?` (default 60 000), `timeout_ms?`, `id?` | a task step, attempt 1 |
| `timer` | `fire_in_ms?` or `fire_at_ms?`, `id?` | a timer step |
| `spawn` | `workflow`, `input`, `id?` | a child step with a derived `child_run_id` |
| `await_signal` | `name`, `schema_ref?`, `timeout_ms?`, `id?` | a signal step in `awaiting_signal`; with `timeout_ms`, also a timer step `<id>:timeout` and its `NewTimer`. Whichever fires first, the kernel prunes the other, so the reducer sees one event and a late event on the loser is `unknown_step`. |
| `emit` | `channel`, `data` | nothing durable |
| `complete` | `output` | the `complete` marker; run → `completed` |
| `continue_as_new` | `input` | the `continue` marker; run → `continued` |

Default step ids are `<kind>#<n>` from the monotonic `step_no` (`task#1`, `timer#2`,
`child#3`, `signal#4`); an explicit `id` must be unique among open steps. At most one
completion per reduction and nothing after it.

## The write-set

`reduce_step` validates every command and returns a declarative `Transition`. The journal
applies it atomically under the run lock and never interprets commands.

| Field | Type | Contents |
| --- | --- | --- |
| `run` | `RunPatch` | `{ status, last_seq }` for the `runs` row. Status is derived from the step map: `awaiting_signal` when only signal steps and their `<id>:timeout` deadline timers are open, else `running`, or the completion's status. |
| `kernel_state` | `KernelState` | `{ v, status, step_no, steps, closed_steps, usage_total }` |
| `state`, `state_hash`, `state_inline` | | The reducer's state (byte-exact), its hash, and whether it fits inline |
| `events` | `Envelope[]` | The trigger first, then one lifecycle `scheduled` / `awaiting_signal` event per opened step and one marker for a completion. All carry the same `state_hash`. |
| `tasks` | `NewTask[]` | `task_id`, `step_id`, `attempt`, `activity`, `queue`, `schema_ref?`, `input`, `idempotency_key`, `retry`, `lease_ttl_ms`, `timeout_ms?` |
| `task_updates` | `TaskUpdate[]` | `{ task_id, attempt, status, not_before_ms? }` — the trigger's own row is settled here, cancels on run close, `scheduled` after a retry |
| `timers` | `NewTimer[]` | `{ step_id, fire_at_ms }` |
| `spawns` | `NewSpawn[]` | `{ step_id, child_run_id, workflow, input }`; the host turns these into `created` run rows |
| `signal_waits` | `SignalWait[]` | `{ step_id, name, schema_ref?, expires_at_ms? }`; `expires_at_ms` is informational, the deadline itself is the paired timer |
| `emits` | `Emit[]` | `{ channel, data }`; the host publishes them after commit |
| `completion?` | `Completion` | `{ status, output? }` |
| `continue_as_new?` | `ContinueAsNew` | `{ input }`; the host turns it into a `created` successor row whose id is `derive_ids(run_id, "continue").child_run_id` |

## Retry planning

`plan_retry({ policy, attempt, cause, random })` is pure: the only entropy is the journaled
`random`. `RetryPolicy` is `{ max_attempts, backoff: "fixed" | "exponential", initial_ms,
max_ms, factor, jitter: "none" | "full" }`. The plan is `{ retry: false }` when the cause is
`schema_violation`, `user_cancel` or `nondeterminism_detected`, or when `attempt >=
max_attempts` (`max_attempts: 1` never retries). Otherwise
`{ retry: true, next_attempt: attempt + 1, delay_ms }` where the base delay is
`initial_ms` (fixed) or `min(initial_ms × factor^(attempt−1), max_ms)` (exponential), and full
jitter scales it by the first 16 hex chars of `random` over `2^64 − 1`. A fixture:
attempt 2, exponential from 1000 ms with the fixture's `random` plans `delay_ms: 1246`.

## Hashing rules

* **Canonical JSON**: parse, then re-serialise compact with object keys sorted. Whitespace
  and key order never matter; `{"a":1,"b":2}` and `{ "b": 2, "a": 1 }` hash alike.
* **No floats in hashed inputs**: `Usage`, `RetryPolicy` and `KernelState` are integers only.
* **Byte-exact JSON as strings**: the user state, payloads and inputs cross the boundary as
  strings and are stored as `text`, so the bytes the kernel saw are the bytes it hashes again.
* `state_hash = sha256("vlo1" ‖ 0x00 ‖ canon(kernel_state) ‖ 0x00 ‖ canon(state))`, hex. The
  `vlo1` prefix is a domain separator.
* `refold_check` compares two `{ seq, hash }[]` lists and reports the first divergent seq
  with both hashes, or `{ matches: true }`. The host's rebuild path
  (`rebuildCheckpoint`) does the same comparison per event as it folds, so it stops at the
  first divergence rather than folding past it.

## Schema hash

Activity and signal versions are content hashes computed by the SDK, not the kernel; the
kernel only carries `schema_ref` through. They are still a protocol, because any SDK must
mint the same `schema_ref` for the same definition.

* **Projection.** Before hashing, every schema object at every depth drops the annotation
  keywords `$schema`, `$id`, `$comment`, `title`, `description`, `examples`, `default`,
  `deprecated`, `readOnly`, `writeOnly`. The entries of `properties`, `patternProperties`,
  `dependentSchemas`, `$defs` and `definitions` are name-keyed: names are kept verbatim
  (a property may be called `default`) and only their values are projected. Arrays keep
  their order. Nothing else is rewritten: two emitters that disagree on validation
  semantics (say `anyOf` with `null` versus `type: [..., "null"]`) produce different hashes
  by design.
* **Envelope.** Activities hash
  `{ "v": 1, "name", "input": <projected>, "output": <projected>, "retry": <RetryPolicy> }`;
  signals hash `{ "v": 1, "name", "schema": <projected> }`. `retry` is the resolved wire
  policy (`max_attempts`, `backoff`, `initial_ms`, `max_ms`, `factor`, `jitter`).
* **Encoding.** Canonical JSON as above (sorted keys, compact, no floats), SHA-256, first
  16 lowercase hex characters. `schema_ref = "<name>@<hash>"`.
* **Versioning.** `v` is `SCHEMA_HASH_VERSION`. A change to the projection or the envelope
  bumps it, so the move is explicit; the rule is never changed under the same `v`.
* **Fixtures.** `fixtures/schema-hash/*.json` are golden cases: each lists `cases` (schemas
  as an emitter would produce them) that must all project to `projected` and hash to
  `hash`. `test/schema-hash.test.ts` replays them; a second-language SDK runs the same
  files.

## ID derivation

`task_id = "<run_id>:<step_id>"`, `idempotency_key = "<run_id>:<step_id>:<attempt>"`,
`child_run_id = "run_" + sha256(task_id)[0..26]`. All are pure functions of
`(run_id, step_id, attempt)`, so a re-push or a rebuilt checkpoint names the same task.

## Schema, fixtures, build

* `schema/kernel-protocol.schema.json` is generated from `crates/types` with `schemars`.
  `cargo test -p vlo-types` fails on drift; `UPDATE_SCHEMA=1 cargo test -p vlo-types`
  rewrites it.
* `fixtures/kernel/*.json` are golden `{ export, input, output }` cases (43 today) produced by
  the native tests through the same `api` module the wasm wraps.
  `UPDATE_FIXTURES=1 cargo test -p vlo-kernel` regenerates them. `src/kernel/kernel.test.ts`
  replays every fixture through the compiled wasm, so a mismatch means the committed wasm
  drifted from the Rust source.
  One field is masked in both replays: `kernel_version.json` holds `"<crate version>"` in
  place of the version, because a release bumps the crate while the committed wasm keeps
  the version it was built at. Both harnesses still check that the real value is a semver.
* `scripts/build-kernel.sh` runs `wasm-pack build --release --target web` on
  `crates/kernel-wasm`, remaps source paths so the artifact is reproducible on one platform,
  writes `sdk/ts/sdk/wasm/`, and fails over 1 MiB. The output is committed; a JS consumer
  never needs a Rust toolchain.
* `VLO_KERNEL_WASM=/path/to/vlo_kernel_bg.wasm` makes the loader (and `vlo doctor`) use
  another artifact. CI builds fresh, then runs the fixture replay against both the committed
  and the fresh wasm; byte drift between platforms is reported, not fatal.

Minimal use of the interface, lifted from the tests:

```ts
const kernel = await loadKernel();
const prepared = kernel.prepareEvent({ run, event });
if (prepared.ok && prepared.value.mode === "reduce") {
  const reduced = kernel.reduceStep({
    run, kernel_state: prepared.value.kernel_state, event,
    reduction: { state: JSON.stringify({ phase: "work" }),
                 commands: [{ type: "task", activity: "plan", input: { a: 1 } }] },
  });
  // reduced.value.tasks[0].idempotency_key === "run_ts:task#1:1"
}
```
