# Errors

Three families: host errors that become HTTP responses, kernel error codes that the host
maps or passes through, and the checks `vlo doctor` prints. Source: `src/host/errors.ts`,
`crates/kernel/src/error.rs`, `src/cli/checks.ts`.

## Host errors

Every class extends `VloError` (`code`, `status`, `message`) and is exported from
`@oona/vlo/host`. A route catches it and answers `{ "error": { code, message } }` with `status`.
Anything that is not a `VloError` becomes `500 internal`.

| Class | `code` | HTTP | When |
| --- | --- | --- | --- |
| `RunNotFound` | `run_not_found` | 404 | No run with that id. |
| `TaskNotFound` | `task_not_found` | 404 | No task with that id on a callback. |
| `RunTerminal` | `run_terminal` | 409 | An event other than a task result or closing marker reached a completed, failed, cancelled or continued run. |
| `IllegalEvent` | kernel code, see below | 409 | The kernel refused the event. `kernelError` holds the original `{ code, message, seq?, step_id? }`. |
| `Nondeterminism` | `refold_mismatch` | 409 | The checkpoint hash or a re-fold disagreed with the journal. The run is failed first with cause `nondeterminism_detected` and a `nondeterminism` marker, then this is thrown. |
| `ReducerFailed` | `reducer_failed` | 409 | The reducer threw (`WorkflowFailure` or anything else), or a `spawn` / `continue_as_new` named a workflow this host does not know. `applyEvent` swallows it and records the `fail` marker (cause `app_error`) with the trigger event as payload; the pre-event checkpoint stays. |
| `WorkflowRejected` | `unknown_workflow` | 400 | Start, fold or spawn named a workflow this host has not registered. |
| `Unauthorized` | `unauthorized` | 401 | Missing or wrong bearer, bad push signature, bad or expired link token. |
| `BadRequest` | `bad_request` | 400 | Malformed body, missing field, invalid signal payload, bad `max_ms`. |
| `LeaseLost` | `lease_lost` | 410 | A heartbeat for an attempt that no longer holds its lease. The worker should stop. |

Routes also raise three local ones with the same shape: `role_not_served` (404, the host
lacks the role), `no_route` (404), and `links_disabled` (503, no secret to sign links with).
The push endpoint answers `503 no_push_secret`, `404 no_handler` and `409 { "duplicate": true }`
as plain JSON.

## Kernel error codes

The kernel never throws; every export returns `{ ok: false, error: { code, message, seq?,
step_id? } }`. The host wraps a refusal in `IllegalEvent`, passing the code through unchanged.
Three codes — `unknown_step`, `already_terminal`, `bad_seq` — are treated as "already folded"
(an at-least-once redelivery) and answer `duplicate: true` instead of failing.

| Code | Raised when |
| --- | --- |
| `malformed_json` | The input string, a payload, the reducer's state or a command's JSON does not parse. |
| `invalid_event` | Empty `run_id` or `step_id`; `random` is not 32 lowercase hex; both `payload` and `payload_ref` set; `payload_ref` without the `blob://sha256/` prefix; an unroutable kind/status/marker combination; a `payload_ref` reaching a fold unresolved; a lifecycle-only event sent to `reduce_step`; `kernel_state` missing on anything but `started`; event `run_id` differs from the run. |
| `payload_too_large` | Inline `payload` exceeds 262 144 bytes. Offload it and send `payload_ref`. |
| `run_closed` | The `RunRef` is already completed, failed, cancelled or continued. Distinct from the host's `run_terminal`, which refuses the event before the kernel is called. |
| `bad_seq` | `started` arrived while `last_seq` is not 0. |
| `unknown_step` | No open step with that id (terminal steps are pruned, so a late duplicate lands here, as does the loser of a signal-versus-deadline race). |
| `illegal_transition` | Step kind does not match the event kind; the status edge is not in the step machine; an event for a higher attempt than the step's; a retry that skips attempts; `started` on a run that is not `created`; a signal for a step not `awaiting_signal`. |
| `already_terminal` | An event for a lower attempt than the step's, or a retry naming an attempt the step already reached. |
| `invalid_command` | Empty activity, workflow, signal name, emit channel or explicit step id; a timer with neither `fire_at_ms` nor `fire_in_ms`. |
| `duplicate_step_id` | A command's explicit `id` names a step that is still open. |
| `multiple_completions` | A reduction contains more than one `complete` / `continue_as_new`. |
| `commands_after_completion` | Any command follows a `complete` / `continue_as_new` in the same reduction. |

## Authoring and runtime errors

| Class | Package | When |
| --- | --- | --- |
| `ActivityInputError` | `@oona/vlo` | `cmd.task(activity, input)` was given input that fails the activity's Zod input schema. Thrown synchronously inside the reducer, which fails the run. |
| `WorkflowFailure` | `@oona/vlo` | The deliberate way to fail a run from a reducer: `throw new WorkflowFailure(message, details?)`. `sequence` throws it for a task that did not succeed and for a `waitFor` deadline with `onTimeout: "fail"`. |
| `JournalClosed` | `@oona/vlo/host` | Any journal call after `close()`. `code: "journal_closed"`. Expected during shutdown. |
| `LeaseLost` | `@oona/vlo/host` | See above; also surfaces to a worker as a rejected `ctx.heartbeat()`, after which `ctx.signal` is aborted. |

## `vlo doctor`

Each check is a real round trip and prints `✓`, `⚠` or `✗` with a hint under anything that is
not `✓`. Any `✗` sets exit code 1. `--json` prints the same `Check[]`.

| Check | Status | Hint | What to do |
| --- | --- | --- | --- |
| `journal` | ✗ | `journal must be a sqlite:// or postgres:// url` | Fix `profile.journal`. |
| `journal` | ✗ | `check the journal url and that the database is reachable` | The empty write transaction failed after a successful migrate; check network and credentials. |
| `journal` | ✗ | `the schema may be missing; re-run without --no-migrate` | You skipped migrations and the tables do not exist yet. |
| `migrate` | ⚠ | `re-run without --no-migrate to apply pending migrations` | Informational when `--no-migrate` was passed. |
| `migrate` | ✗ | `the journal is unreachable: check the url, host and port, and that the database is running` | Connection refused or timed out. |
| `migrate` | ✗ | `the journal rejected the credentials in the url` | Wrong user or password. |
| `migrate` | ✗ | `the database named in the url does not exist` | Create it, or fix the URL. |
| `migrate` | ✗ | `the journal user needs CREATE on its schema` | Grant `CREATE` on the database so `CREATE SCHEMA vlo` can run. |
| `blob` | ✗ | `the store is not content-addressed; payload refs would not resolve` | `put` returned something other than the sha256 of the bytes; your store breaks the contract. |
| `blob` | ✗ | `the store is truncating writes` | `get` returned fewer bytes than were written. |
| `blob` | ✗ | `check the blob url and that the process may write there` | Bad URL, missing peer dependency for `gcs://`, or no write permission. |
| `kernel` | ✗ | `run scripts/build-kernel.sh, or set VLO_KERNEL_WASM` | The wasm is missing beside `src/` or `dist/`; build it with `scripts/build-kernel.sh` or point `VLO_KERNEL_WASM` at one. |
| `kernel` | ⚠ | `over the 1024 KiB budget; build with --release` | A debug build was committed. |
| `kernel` | ✗ | `this SDK speaks protocol 1; rebuild the kernel` | Protocol mismatch between the wasm and the SDK. |
| `schemas` | ⚠ | `these register on the next host boot` | No host has booted this build yet; not an error. |
| `queue:<name>` | ✗ | `give the queue a url, or export defineWorker({ … }, { queues: ["<name>"] })` | A push queue with no URL and no in-process worker can never be served. |
| `queue:<name>` | ✗ | `queue url must be absolute` | The URL did not parse. |
| `queue:<name>` | ✗ | `the worker host is up but not healthy` | `/healthz` on the queue's origin answered non-2xx. |
| `queue:<name>` | ✗ | `start the worker host, or fix the queue url` | `/healthz` was unreachable within 3 s. |
| `queue:<name>` | ⚠ | `set \`secret\` on the queue; unsigned pushes are rejected by the worker` | The dispatcher refuses to push unsigned; add the shared secret. |
| `roles` | ⚠ | `a manual dispatcher only advances on POST /v1/timers/tick; set \`deploy.cron\`` | An orchestrator in `manual` mode with no cron declared will never move the outbox. |

Details worth knowing: `journal` reports `<dialect> · commit round trip <n> ms`; `kernel`
reports `protocol <n> · <size> KiB`; `schemas` reports `<registered>/<wanted> registered ·
missing <names>`; a pull queue reports `pull · served by pollers`; with no queues configured
the single check `queues` reports `none configured · in-process only`.
