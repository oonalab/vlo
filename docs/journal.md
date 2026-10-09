# Journal

The journal is the only durable state Vlo has. It is the source of truth for every run and,
because the `tasks` table doubles as an outbox with leases, it is also the queue. There is no
broker: a transition commits its events, its checkpoint and its new task rows together, and
the dispatcher picks the rows up on its next pass. Source: `src/journal/**`, `src/blob/**`.

## Tables

All tables live in their own Postgres schema (`vlo` by default) or, on SQLite, unprefixed in
their own file. Every instant is a `bigint` / `INTEGER` millisecond epoch named `*_ms`.

| Table | Key columns | Role |
| --- | --- | --- |
| `runs` | `run_id` PK, `namespace`, `workflow`, `component_digest`, `status`, `last_seq`, `parent_run_id`, `parent_step_id`, `continued_from`, `continued_to`, `input` / `input_ref`, `output` / `output_ref`, `search`, `assignee`, `created_at_ms`, `updated_at_ms`, `started_at_ms`, `closed_at_ms`, `parent_notified_at_ms`, `start_claimed_until_ms`, `notify_claimed_until_ms` | One row per run. `status = 'created'` rows and closed-but-unnotified children are outbox stages. |
| `events` | `(run_id, seq)` PK, `step_id`, `attempt`, `kind`, `status`, `cause`, `schema_ref`, `payload` / `payload_ref`, `error`, `usage`, `random`, `state_hash`, `parent_run_id`, `parent_step_id`, `ts_ms` | Append-only history. The primary key is the backstop against a double append. |
| `run_state` | `run_id` PK, `seq`, `bundle_digest`, `kernel_state`, `state` / `state_ref`, `state_hash` | The checkpoint. Rewritten on every transition in the same transaction as the events. Exactly one of `state` / `state_ref` (CHECK constraint). |
| `tasks` | `task_id` PK, `run_id`, `step_id`, `attempt`, `activity`, `schema_ref`, `queue`, `input` / `input_ref`, `retry_policy`, `status`, `idempotency_key` UNIQUE, `not_before_ms`, `dispatched_at_ms`, `dispatch_attempts`, `dispatch_claimed_until_ms`, `lease_ttl_ms`, `lease_until_ms`, `worker_id`, `heartbeat_at_ms`, `timeout_ms` | The outbox and the lease. `UNIQUE (run_id, step_id)`; one row per step, rewritten per attempt. |
| `timers` | `(run_id, step_id)` PK, `fire_at_ms`, `fired_at_ms`, `claimed_until_ms` | Due timers, claimed and fired by the dispatcher. Deduped by `step_id`. |
| `signal_waits` | `(run_id, step_id)` PK, `name`, `schema_ref`, `expires_at_ms` | Open `await_signal` steps. `expires_at_ms` is informational; a wait with a deadline also owns a `timers` row named `<step_id>:timeout`. |
| `signals` | `signal_id` PK, `run_id`, `name`, `payload` / `payload_ref`, `sender`, `created_at_ms`, `delivered_at_ms`, `delivered_step_id` | The inbox. A signal with no matching wait stays undelivered until one opens. |
| `schemas` | `(name, version)` PK, `json_schema`, `retry_policy`, `created_at_ms` | Activity and signal schemas, keyed by content hash. Upserted on host boot. |
| `bundles` | `digest` PK, `workflow`, `kind`, `blob_ref`, `source_map_ref`, `created_at_ms` | Reserved for workflow bundles; the table exists and is not written yet. |
| `migrations` | `version` PK, `applied_at_ms` | Which migration files have run. |

### Outbox and lease columns on `tasks`

| Predicate | Meaning |
| --- | --- |
| `status = 'scheduled' AND dispatched_at_ms IS NULL AND not_before_ms <= now` | Waiting to be pushed or polled. A crash between commit and push loses nothing: the row is still here. |
| `dispatch_claimed_until_ms > now` | Claimed by one dispatcher pass; other passes skip it until the hold lapses (30 s by default). |
| `dispatch_attempts` | Incremented per claim; drives the exponential backoff after a refused push. |
| `status = 'running' AND lease_until_ms < now` | Lease lapsed without a heartbeat; the reaper fails the attempt with `cause: heartbeat_lost`. |
| `status = 'running' AND dispatched_at_ms + timeout_ms < now` | Attempt outlived its wall-clock budget; the reaper fails it with `cause: timeout`. |

### Text, not jsonb

Anything that is hashed or replayed — `run_state.state`, `run_state.kernel_state`,
`events.payload`, `runs.input`, `runs.output`, `tasks.input`, `schemas.retry_policy` — is stored
as `text`, byte-exact. `jsonb` rewrites key order and numeric lexemes, which would change the
bytes the kernel hashes and break the re-fold check. Only `runs.search`, `events.usage` and
`tasks.retry_policy` are `jsonb` on Postgres (plain `TEXT` on SQLite).

## Postgres adapter

`src/journal/postgres.ts`, driver `pg`, options `{ schema?: string, max?: number }`.

- **Own schema.** Every table is created unqualified inside `CREATE SCHEMA IF NOT EXISTS vlo`.
  Nothing in the journal can reach `public`, so it coexists with whatever else uses the
  database.
- **Migrations on boot.** `host.start()` (and therefore `serve()`, `handler()` and the first
  `host.fetch`) calls `journal.migrate()`. `vlo doctor` does the same unless `--no-migrate`
  is given. The migration lock is a transaction-scoped advisory lock on `vlo:migrate`, so
  several processes may boot at once.
- **Session-free.** The adapter keeps no session state at all: no startup `options`, no
  session-level `SET`, no session advisory locks. Every read and every transaction is
  `BEGIN` · `SET LOCAL search_path TO <schema>` · statements · `COMMIT` on a pooled
  connection. Per-run serialisation is `pg_advisory_xact_lock(hashtextextended($1, 0))` on
  the key `vlo:run:<run_id>`, released at commit. Claims use `FOR UPDATE SKIP LOCKED`, so
  concurrent dispatcher passes get disjoint rows.
- **Why it works behind transaction-mode poolers.** PgBouncer in transaction mode, PlanetScale
  and Neon's poolers multiplex sessions and reject startup parameters. Because the journal
  never assumes the next statement lands on the same backend, and everything it sets is
  `LOCAL` to one transaction, it is correct behind any of them.
- Placeholders are written once as `?` and rewritten to `$n` for Postgres.

## SQLite adapter

`src/journal/sqlite.ts`, built on `node:sqlite` (Node ≥ 22.5), no native dependency.

- One file, one connection, one writer. A promise mutex owns the connection: a transaction
  holds it from `BEGIN IMMEDIATE` to `COMMIT`; reads queue behind it. `BEGIN IMMEDIATE`
  takes the write lock up front, which is what makes claims disjoint without `SKIP LOCKED`.
- Pragmas on open: `journal_mode = WAL`, `busy_timeout = 5000`, `foreign_keys = ON`.
- The directory of the file is created on demand, so `vlo doctor` and `vlo serve` work on a
  fresh checkout. `sqlite://:memory:` gives a throwaway journal for tests.
- Share one `SqliteJournal` instance per process. Separate processes on the same file are
  serialised by SQLite's lock and `busy_timeout`.

## URL forms

| URL | Opens |
| --- | --- |
| `sqlite://:memory:` | In-memory SQLite, gone when the process exits. |
| `sqlite://.vlo/dev.db` | SQLite file at a relative path: relative to the config file's directory when it comes from a profile, to the working directory when passed to `openJournal` or `serve` directly. |
| `sqlite:///abs/path.db` | SQLite file at an absolute path. |
| `postgres://…` or `postgresql://…` | Postgres via `pg`; the rest of the URL is passed to the driver. |

`openJournal(url, { schema?, max? })` in `@vlo/sdk/host` picks the adapter by prefix and throws
`unsupported journal url: …` otherwise.

### Privileges the Postgres role needs

The first boot does two things in order: create the schema (`vlo` by default), then create
the tables inside it. Each needs one privilege, and the two are on different objects:

| Step | Needs | Granted by |
| --- | --- | --- |
| `CREATE SCHEMA vlo` | `CREATE` on the **database** | `GRANT CREATE ON DATABASE <db> TO <role>;` |
| tables and indexes in `vlo` | `CREATE` on the **schema** | automatic for the schema's owner; otherwise `GRANT USAGE, CREATE ON SCHEMA vlo TO <role>;` |

Pick one of two setups:

- **Let the app own the schema (simplest).** Grant `CREATE` on the database once. The app
  creates `vlo` on first boot, owns it, and needs nothing else afterwards. Steady-state runtime
  only needs `USAGE` on the schema and DML on its tables, which the owner has.
- **DBA-provisioned schema.** If the role may not have database-level `CREATE`, have an admin run
  `CREATE SCHEMA vlo AUTHORIZATION <role>;` once. The host sees the schema and skips creation.

Do not mix them by creating the schema as a *different* role: the app is then not the owner and
fails on the first table with `permission denied for schema vlo` until it also receives
`USAGE, CREATE` on the schema.

Diagnostics, run as an admin on the same database the app connects to:

```sql
SELECT usename, count(*) FROM pg_stat_activity WHERE usename LIKE '%' GROUP BY 1;  -- who is actually connected
SELECT has_database_privilege('<role>', current_database(), 'CREATE');             -- step 1
SELECT has_schema_privilege('<role>', 'vlo', 'CREATE');                            -- step 2
SELECT version FROM vlo.migrations ORDER BY 1;                                     -- what the boot achieved
```

Behind a pooler the login name can carry routing information (PlanetScale uses
`<role>.<branch>`); the Postgres role is the part the pooler maps it to, which
`pg_stat_activity` shows. Grant to that name. `vlo doctor` prints these remedies when a boot
fails on either privilege.

## Migrations

Migrations are SQL strings inlined as TypeScript modules, one per dialect and version, listed
in `MIGRATION_VERSIONS` (`src/journal/migrations.ts`):

| Version | Adds |
| --- | --- |
| `0001_init` | Every table above and its indexes. |
| `0002_task_timeout` | `tasks.timeout_ms` and the `tasks_timeout_idx` partial index behind the timeout reaper. |
| `0003_continued_to` | `runs.continued_to`, the forward link written when `continue_as_new` starts a successor. |

The runner reads `migrations`, applies whatever is missing inside the caller's transaction
and inserts the bookkeeping row. Postgres statements are `IF NOT EXISTS` and rerunnable;
SQLite's `ALTER TABLE … ADD COLUMN` in `0002` and `0003` is guarded only by the `migrations`
row, so do not delete that table on SQLite.

## Blob stores

Anything over the inline limit — `INLINE_LIMIT_BYTES`, 256 KiB — leaves the journal and is
stored content-addressed. The journal keeps a reference of the form `blob://sha256/<64 hex>`
in the matching `*_ref` column (`payload_ref`, `input_ref`, `output_ref`, `state_ref`).

```ts
interface BlobStore {
  /** Stores the bytes and returns their sha256, lowercase hex. Idempotent. */
  put(bytes: Uint8Array): Promise<string>;
  get(sha256Hex: string): Promise<Uint8Array>;
}
```

`offloadIfOversized(store, text)` returns the ref when the UTF-8 byte length exceeds the limit
and `null` otherwise; `readBlobText(store, ref)` reads it back byte-exact. The kernel decides
`state_inline` for the checkpoint; the host offloads the completion output the same way.

| URL | Store | Notes |
| --- | --- | --- |
| `file://<dir>` | `FileBlobStore` | `<dir>/<first two hex>/<sha256>`; written to a temp file and renamed, so readers never see a partial blob. Default is `file://.vlo/blobs`; a relative directory resolves like a SQLite path (config directory from a profile, working directory when opened directly). |
| `gcs://<bucket>[/<prefix>]` | `GcsBlobStore` | Object key `<prefix>/<first two hex>/<sha256>`. `put` checks existence first, so a retried offload uploads nothing. Needs the optional peer dependency `@google-cloud/storage` (^7). Credentials: Application Default Credentials, or `GCP_SERVICE_ACCOUNT_KEY_BASE64` (base64 of a service-account JSON) where no metadata server exists. |

`openBlobStore(url)` throws `unsupported blob store url: …` for any other scheme. `vlo doctor`
writes a 1 KiB probe and checks that `put` returned its real sha256 and that `get` returned
every byte.

## `JournalClosed`

Every journal call made after `close()` rejects with `JournalClosed` (`code: "journal_closed"`,
exported from `@vlo/sdk/host`). Shutdown is racy by nature — a worker reporting a result while
the host stops — and this is the one recognisable error those late calls get instead of
whatever the driver does to a closed handle. The dispatcher drops it silently as "shutting
down" rather than emitting a `warning`.

## The interface

`Journal` (`src/journal/types.ts`) is what the host talks to. Reads outside a transaction:
`readEvents`, `getRun`, `getState`, `getTask`, `listTasks`, `query`, `dueTimers`,
`expiredLeases`, `expiredTimeouts`. Everything that writes goes through
`transaction(fn)` and a `JournalTx`: `lockRun`, `createRun`, `applyTransition` (the whole
kernel write-set plus the child and successor run rows the host derives, atomically), the claim methods (`claimUndispatchedTasks`,
`claimCreatedRuns`, `claimClosedUnnotified`, `claimDueTimers`), lease methods
(`markDispatched`, `deferDispatch`, `heartbeat`), timer and signal methods, and the schema
registry (`upsertSchema`, `getSchema`).

If you write another adapter, `journalConformance` from `@vlo/sdk/testing` runs the same
suite the two built-in journals pass: ordering, disjoint claims, hold expiry, terminal marks,
idempotent appends. Point it at your `Journal` factory inside a Vitest `describe`.
