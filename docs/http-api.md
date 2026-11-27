# HTTP API

The host exposes one `(Request) => Response` handler (`host.fetch`), so the same routes serve
from a Node port (`serve()`), a framework route file (`handler()`), or a test with no socket
at all (`createClient({ fetch: host.fetch })`). Source: `src/host/api/**`, `src/client/**`.

## Conventions

- **JSON in, JSON out.** Bodies are `application/json`; an empty body is `null`. A failed
  request answers `{ "error": { "code": string, "message": string } }` with the status the
  error carries (see [errors](errors.md)); anything unexpected is `500` with code `internal`.
- **Auth.** When `auth.token` is configured, every control-plane route needs
  `Authorization: Bearer <token>` (compared timing-safe) and answers `401 unauthorized`
  otherwise. Two exceptions: `POST /v1/tasks/push` is authenticated by an HMAC over the body,
  and the signal route accepts a signed link token in `?token=`. Without `auth.token` the
  host is open.
- **Roles.** A route belongs to a role. A host that does not hold it answers
  `404 role_not_served`; an unknown path is `404 no_route`.
- **`basePath`.** A host mounted under a prefix (for example `/api/vlo`) strips it before
  matching, so routes are always written as `/v1/…`. A path without the prefix is matched as
  it stands, which is what lets an in-process client keep calling `/v1/runs`. Every URL the
  host hands out (`complete_url`, signed links, the confirmation form's action) carries the
  prefix.
- **`/healthz`** needs no token and no role.

## Routes

| Method | Path | Role | Auth |
| --- | --- | --- | --- |
| `GET` | `/healthz` | any | none |
| `POST` | `/v1/runs` | `api` | bearer |
| `GET` | `/v1/runs` | `api` | bearer |
| `GET` | `/v1/runs/{id}` | `api` | bearer |
| `GET` | `/v1/runs/{id}/events` | `api` | bearer |
| `POST` | `/v1/runs/{id}/signals/{name}` | `api` | bearer, or `?token=` |
| `GET` | `/v1/runs/{id}/signals/{name}?token=` | `api` | link token |
| `POST` | `/v1/runs/{id}/links/{name}` | `api` | bearer |
| `POST` | `/v1/runs/{id}/cancel` | `api` | bearer |
| `POST` | `/v1/tasks/poll` | `api` | bearer |
| `POST` | `/v1/tasks/{id}/complete` | `api` | bearer |
| `POST` | `/v1/tasks/{id}/fail` | `api` | bearer |
| `POST` | `/v1/tasks/{id}/heartbeat` | `api` | bearer |
| `POST` | `/v1/tasks/push` | `worker:*` | HMAC |
| `POST` | `/v1/timers/tick` | `orchestrator` | bearer |

### `GET /healthz`

`200 { "ok": true, "roles": string[], "workflows": string[] }`. `vlo doctor` probes each push
queue's `/healthz` to decide whether a worker host is reachable.

### `POST /v1/runs`

Request `{ "workflow": string, "input"?: Json, "run_id"?: string, "search"?: object }`.
Response `201 { "run_id": string }`. Unknown workflow → `400 unknown_workflow`. The row is
written with `status: "created"`; the dispatcher's next pass folds `started`, so on a
`manual` dispatcher the run stays `created` until something ticks. `run_id` defaults to
`run_<32 hex>`; passing your own makes a duplicate submission idempotent (the insert is
`ON CONFLICT DO NOTHING`).

### `GET /v1/runs?status=&workflow=&limit=`

`200 RunView[]`, newest first, default limit 50, scoped to the host's namespace. `RunView`:

```json
{ "run_id": "run_…", "workflow": "example", "status": "awaiting_signal", "last_seq": 7,
  "search": {}, "created_at_ms": 0, "updated_at_ms": 0, "started_at_ms": 0,
  "closed_at_ms": 0, "parent_run_id": "run_…", "continued_from": "run_…",
  "continued_to": "run_…", "output": null, "error": "…", "cause": "app_error" }
```

`started_at_ms`, `closed_at_ms`, `parent_run_id`, `continued_from`, `continued_to` and
`output` are present only when set. `error` and `cause` are present only on a `failed` run:
the `error` of its closing marker (the reducer's `WorkflowFailure` message, or the refold
mismatch) and that marker's cause (`app_error` or `nondeterminism_detected`). A `continued` run's result lives on the run named by
`continued_to`; follow the chain to its end.
`status` is one of `created`, `running`, `awaiting_signal`, `completed`, `failed`,
`cancelled`, `continued`.

### `GET /v1/runs/{id}`

`200 RunView`; `404 run_not_found`.

### `GET /v1/runs/{id}/events?since=N`

`200 Envelope[]` with `seq > N`, ascending (default `N = 0`). Each envelope is one journal
row: `run_id`, `seq`, `step_id`, `attempt`, `kind`, `status`, `cause?`, `usage?`, `ts_ms`,
`random`, `schema_ref?`, `payload?`, `payload_ref?`, `error?`, `parent_run_id?`,
`parent_step_id?`, `state_hash`.

With `Accept: text/event-stream` or `?stream=1` the same route answers as Server-Sent Events
(`Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`,
`X-Accel-Buffering: no`):

```
id: 3
event: journal
data: {"run_id":"run_…","seq":3,…}

event: emit
data: {"channel":"human","data":{…}}

: keepalive

event: end
data: {"run_id":"run_…","status":"completed",…}
```

- `journal` frames replay everything after `since`, then follow the journal every
  `streamPollMs` (default 500 ms). `id` is the `seq`.
- `emit` frames carry `cmd.emit` payloads for this run. They are in-memory only: a reconnect
  resumes the journal, not the emits it missed.
- `: keepalive` is sent every 15 s.
- `end` carries the final `RunView` once the run is terminal and every event has been sent.
- Resume with `?since=` or the `Last-Event-ID` header; `?since` wins when both are present.

### `POST /v1/runs/{id}/signals/{name}`

Request: the signal payload as the body (any JSON; empty body = `null`). If the host has a
`signal()` definition of that name registered, the payload is validated first
(`400 bad_request` on a mismatch). Response `200 { "signal_id": "sig_…", "delivered": bool }`.
`delivered: false` means either no wait was open (the signal is buffered and delivered when
one opens) or the matching wait had already closed because its deadline fired or the run
ended (the signal is recorded and never folded).

With `?token=<signed link>` no bearer is needed. The same path with `GET` and a valid token
renders an HTML confirmation form (`Cache-Control: no-store`) whose submit POSTs the token
back; a `GET` never delivers. An invalid or expired token falls through to the bearer check
and gets the same `401` as no credential at all.

### `POST /v1/runs/{id}/links/{name}`

Request `{ "expires_in_ms"?: integer }` (default 7 days). Response
`200 { "url": string, "expires_at_ms": number }`. The URL is
`<publicUrl or request origin><basePath>/v1/runs/{id}/signals/{name}?token=v1.<expiry>.<hmac>`.
`503 links_disabled` when the host has none of `auth.linkSecret`, `auth.token`,
`auth.pushSecret`.

### `POST /v1/runs/{id}/cancel`

Appends the `cancel` marker (`cause: user_cancel`), closes every open step and cancels open
tasks. Response `200 RunView`. Cancelling a terminal run is a no-op that still answers `200`.

### `POST /v1/tasks/poll`

The pull half of delivery. Request `{ "queue": string, "worker_id": string, "wait_ms"?: 0–25000,
"max"?: 1–10 }`; out-of-range values are clamped. The host claims up to `max` scheduled tasks
on that queue, records each as `running` with a lease, and answers `200 { "tasks": PushedTask[] }`.
With nothing to hand out it holds the request open up to `wait_ms`, re-checking every 500 ms
and waking early when a transition in this process commits a task for the queue.
`runPullWorker` in `@oona/vlo/host` is the client loop.

### Task callbacks

All three take `{ "attempt": integer, … }`; `attempt` must match the attempt the worker was
given. `404 task_not_found` for an unknown id.

| Route | Body | Response |
| --- | --- | --- |
| `…/complete` | `{ attempt, output?: Json, usage?: Usage }` | `200 { "duplicate": bool }` |
| `…/fail` | `{ attempt, error: string, retryable?: bool = true, cause?: Cause, usage?: Usage }` | `200 { "duplicate": bool }` |
| `…/heartbeat` | `{ attempt }` | `200 { "ok": true }`; `410 lease_lost` if the attempt no longer holds its lease |

`Usage` is `{ "cpu_ms": int, "tokens": int, "cost_micro_usd": int }` (missing fields are 0).
`duplicate: true` means this attempt already produced a terminal result, or the task moved on
to a later attempt, and nothing was written. On `complete`, the output is validated against
the registered activity's output schema; a mismatch is recorded as `failed` with
`cause: schema_violation`, which the kernel never retries. On `fail` with `retryable: true`,
the kernel plans the next attempt from the task's retry policy and the attempt is either
`retrying` (back in the outbox after the delay) or `failed` for good.

### `POST /v1/tasks/push`

Inbound delivery for a worker role. The body is a `PushedTask`:

```json
{ "task_id": "run_x:task#1", "run_id": "run_x", "step_id": "task#1", "attempt": 1,
  "activity": { "name": "example.plan", "schema_ref": "example.plan@<hash>" },
  "idempotency_key": "run_x:task#1:1", "input": {…}, "lease_ms": 60000,
  "heartbeat_ms": 20000, "timeout_ms": 240000, "complete_url": "https://…/v1/tasks/run_x%3Atask%231" }
```

Headers: `vlo-task-id`, `vlo-attempt`, `vlo-timestamp` (ms), and
`vlo-signature: v1=hmac-sha256(secret, "<task_id>.<attempt>.<ts>.<sha256(body)>")` in hex.
The receiver rejects a signature older or newer than 5 minutes. Responses:

| Status | Meaning to the pusher |
| --- | --- |
| `202` | Accepted; the result arrives later on `complete_url`. |
| `200 { "output": … }` | Accepted with an inline result (contract only; the SDK worker always answers 202). |
| `409 { "duplicate": true }` | Already running this idempotency key in this process; treated as accepted. |
| `401` | Bad signature. Retried later (`401`, `403`, `408`, `429` mean "not now"). |
| `404 no_handler` | No worker here serves the activity. Fatal: the task is failed with `schema_violation`. |
| `503 no_push_secret` | This host has no `auth.pushSecret`. Retried later. |

The handler runs after the `202` is sent; results go to `complete_url` with the host's
`auth.callbackToken` (falling back to `auth.token`) as the bearer.

### `POST /v1/timers/tick`

One dispatcher pass: start created runs, push scheduled tasks, fire due timers, reap lapsed
leases, reap timed-out attempts, notify parents of closed children. Response
`200 { "started", "pushed", "timers", "reaped", "timeouts", "notified" }` (counts). With
`?drain=1[&max_ms=N]` the host keeps ticking until a pass moves nothing and no in-process
handler is outstanding, or `max_ms` (default 25 000) runs out, and answers
`200 { "passes": n, "idle": bool, "counts": TickCounts }`. This is the cron's entry point on a
`manual` dispatcher; a host without the `orchestrator` role answers `404 role_not_served`.

## The client

`createClient({ baseUrl?, token?, fetch? })` from `@oona/vlo/host` wraps every route above.
Lifted from the test suite:

```ts
import { createClient, serve } from "@oona/vlo/host";

const server = await serve({ journal: "sqlite://.vlo/dev.db", workflows: [exampleWorkflow],
  activities: [plan, work, finish], signals: [approve], workers: [worker],
  auth: { token: TOKEN }, port: 0 });

const client = createClient({ baseUrl: server.url, token: TOKEN });
const started = await client.start(exampleWorkflow, { n: 2 });

for await (const message of client.stream(started.run_id)) {
  if (message.type === "journal") console.log(message.seq, message.data.kind);
  if (message.type === "end") console.log(message.data.status);
}

await client.waitFor(started.run_id, "awaiting_signal");
await client.signal(started.run_id, approve, { by: "sse" });
```

`client.start` returns the `RunView` (it calls `GET` after the `POST`); `events`, `get`,
`list`, `cancel`, `signalLink` map one-to-one onto the routes; `waitFor(runId, status,
timeoutMs = 10_000)` polls every 50 ms. A non-2xx answer rejects with
`"<METHOD> <path> → <status> <body>"`, except `find(runId)`, which answers `null` on a 404.

`startFresh(workflow, input, { runId, search?, maxChain = 50 })` is `start` for a unit of
work that may run more than once: it walks `runId`, `${runId}_2`, `${runId}_3`, … and starts
the first id with no run, or joins (returns) a live one. The result is
`{ run, joined }`. The walk is deterministic, so two concurrent callers land on the same id
and the insert's `ON CONFLICT DO NOTHING` makes one of them the joiner. For "once ever" or
"once per period" ids, plain `start` with a fixed `runId` is already idempotent.
