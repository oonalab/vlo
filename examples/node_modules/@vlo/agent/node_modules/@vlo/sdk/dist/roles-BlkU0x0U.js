import { i as findWorker, n as mergeDomains, s as isTerminalRunStatus } from "./domain-C6_UPgcw.js";
import { createRequire } from "node:module";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import pg from "pg";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
//#region src/blob/file.ts
/**
* The file blob store: `<dir>/<first two hex chars>/<sha256>`.
*
* Writes land on a temporary file in the same directory and are renamed into
* place, so a reader never sees a partial blob and two concurrent writers of the
* same content cannot corrupt it.
*/
/** The on-disk {@link BlobStore}. Opened by `openBlobStore("file://…")`. */
var FileBlobStore = class {
	dir;
	/** `dir` is created on the first `put`. */
	constructor(dir) {
		this.dir = dir;
	}
	/** Writes atomically (temp file + rename) and returns the sha256 hex digest. */
	async put(bytes) {
		const digest = createHash("sha256").update(bytes).digest("hex");
		const target = this.pathFor(digest);
		await mkdir(dirname(target), { recursive: true });
		const temp = `${target}.${randomBytes(8).toString("hex")}.tmp`;
		await writeFile(temp, bytes);
		await rename(temp, target);
		return digest;
	}
	/** Reads the blob; rejects with the `node:fs` error when it is missing. */
	async get(sha256Hex) {
		const buffer = await readFile(this.pathFor(sha256Hex));
		return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	}
	pathFor(sha256Hex) {
		return join(this.dir, sha256Hex.slice(0, 2), sha256Hex);
	}
};
//#endregion
//#region src/blob/gcs.ts
/**
* The Google Cloud Storage blob store: `gs://<bucket>/<prefix>/<first two hex chars>/<sha256>`.
*
* Content addressing does the deduplication a bucket cannot: the object name *is* the digest,
* so `put` checks existence and skips the upload instead of rewriting the same bytes. That
* also makes a retried offload free, which matters because every oversized payload passes
* through here on the write path.
*
* `@google-cloud/storage` is an optional peer dependency, loaded on first use: a host that
* stores blobs on disk should not have to install a cloud SDK.
*/
/**
* The Google Cloud Storage {@link BlobStore}. Opened by `openBlobStore("gcs://…")`. Needs
* the optional peer dependency `@google-cloud/storage` unless a `client` is injected.
*/
var GcsBlobStore = class {
	bucketName;
	prefix;
	projectId;
	bucket;
	/** Throws a plain `Error` when `bucket` is empty. No network call is made here. */
	constructor(options) {
		if (!options.bucket) throw new Error("GcsBlobStore: a bucket name is required");
		this.bucketName = options.bucket;
		this.prefix = trim(options.prefix ?? "");
		this.projectId = options.projectId;
		if (options.client !== void 0) this.bucket = Promise.resolve(options.client.bucket(this.bucketName));
	}
	/** Uploads unless an object with that digest already exists; returns the sha256 hex digest. */
	async put(bytes) {
		const digest = createHash("sha256").update(bytes).digest("hex");
		const file = (await this.open()).file(this.keyFor(digest));
		const [exists] = await file.exists();
		if (!exists) await file.save(bytes, {
			resumable: false,
			contentType: "application/octet-stream"
		});
		return digest;
	}
	/** Downloads the blob; rejects with the client's error when it is missing. */
	async get(sha256Hex) {
		const [contents] = await (await this.open()).file(this.keyFor(sha256Hex)).download();
		return contents instanceof Uint8Array ? contents : new Uint8Array(contents);
	}
	keyFor(sha256Hex) {
		const path = `${sha256Hex.slice(0, 2)}/${sha256Hex}`;
		return this.prefix.length > 0 ? `${this.prefix}/${path}` : path;
	}
	open() {
		this.bucket ??= loadStorage(this.projectId).then((client) => client.bucket(this.bucketName));
		return this.bucket;
	}
};
/**
* Application Default Credentials by default; `GCP_SERVICE_ACCOUNT_KEY_BASE64` when the
* runtime has no metadata server to ask (Vercel, a laptop, CI).
*/
async function loadStorage(projectId) {
	let storage;
	try {
		storage = await import("@google-cloud/storage");
	} catch (error) {
		throw new Error(`gcs blob store: install the optional peer dependency @google-cloud/storage (^7) to use gcs:// urls (${error instanceof Error ? error.message : String(error)})`);
	}
	const encoded = process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64;
	const credentials = encoded === void 0 ? void 0 : JSON.parse(Buffer.from(encoded, "base64").toString());
	return new storage.Storage({
		...projectId !== void 0 ? { projectId } : {},
		...credentials !== void 0 ? { credentials } : {}
	});
}
function trim(value) {
	return value.replace(/^\/+|\/+$/g, "");
}
//#endregion
//#region src/blob/open.ts
/** Blob store selection by URL scheme: `file://` on disk, `gcs://` in a bucket. */
const FILE_PREFIX = "file://";
const GCS_PREFIX = "gcs://";
/**
* Opens a blob store by URL: `file://<dir>` (relative to the working directory when the
* path is) or `gcs://<bucket>/<prefix>`. The GCS client is only loaded on first use.
* Throws a plain `Error` on any other scheme or an empty directory or bucket.
*/
function openBlobStore(url) {
	if (url.startsWith(FILE_PREFIX)) {
		const dir = url.slice(7);
		if (dir.length === 0) throw new Error(`blob store url has no directory: ${url}`);
		return new FileBlobStore(dir);
	}
	if (url.startsWith(GCS_PREFIX)) {
		const [bucket, ...rest] = url.slice(6).split("/");
		if (bucket === void 0 || bucket.length === 0) throw new Error(`blob store url has no bucket: ${url}`);
		const prefix = rest.join("/");
		return new GcsBlobStore({
			bucket,
			...prefix.length > 0 ? { prefix } : {}
		});
	}
	throw new Error(`unsupported blob store url: ${url}`);
}
//#endregion
//#region src/journal/dialect.ts
const PG = {
	kind: "pg",
	skipLocked: " FOR UPDATE SKIP LOCKED"
};
/** SQLite serialises writers with `BEGIN IMMEDIATE`, so claims never collide. */
const SQLITE = {
	kind: "sqlite",
	skipLocked: ""
};
async function one(x, sql, params) {
	return (await x.all(sql, params))[0] ?? null;
}
/** JSON as a bound parameter: one text encoding that both dialects accept. */
function jsonParam(value) {
	return JSON.stringify(value ?? null);
}
function orNull(value) {
	return value ?? null;
}
//#endregion
//#region src/journal/migrations/pg/0001_init.ts
const sql$5 = "-- Vlo journal, Postgres.\n--\n-- Every object is unqualified on purpose: the journal connects with\n-- `search_path = <schema>` (default `vlo`) and creates that schema before this\n-- file runs, so nothing here can reach `public`.\n--\n-- Hashed or replayed JSON (`state`, `kernel_state`, `payload`, `input`,\n-- `output`, `schemas.retry_policy`) is `text`, never `jsonb`: jsonb rewrites key\n-- order and numeric lexemes, which would break re-fold equality.\n-- Every instant is a `bigint` millisecond epoch named `*_ms`, so Postgres,\n-- SQLite and the TypeScript rows agree on one representation.\n\nCREATE TABLE IF NOT EXISTS migrations (\n  version       text PRIMARY KEY,\n  applied_at_ms bigint NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS runs (\n  run_id                  text PRIMARY KEY,\n  namespace               text NOT NULL DEFAULT 'default',\n  workflow                text NOT NULL,\n  component_digest        text NOT NULL,\n  status                  text NOT NULL,\n  last_seq                bigint NOT NULL DEFAULT 0,\n  parent_run_id           text,\n  parent_step_id          text,\n  continued_from          text,\n  input                   text,\n  input_ref               text,\n  output                  text,\n  output_ref              text,\n  search                  jsonb NOT NULL DEFAULT '{}',\n  assignee                text,\n  created_at_ms           bigint NOT NULL,\n  updated_at_ms           bigint NOT NULL,\n  started_at_ms           bigint,\n  closed_at_ms            bigint,\n  parent_notified_at_ms   bigint,\n  start_claimed_until_ms  bigint,\n  notify_claimed_until_ms bigint\n);\n\n-- Outbox stage \"start runs\".\nCREATE INDEX IF NOT EXISTS runs_created_idx\n  ON runs (created_at_ms) WHERE status = 'created';\n\n-- Outbox stage \"notify parents\".\nCREATE INDEX IF NOT EXISTS runs_notify_idx\n  ON runs (closed_at_ms)\n  WHERE parent_run_id IS NOT NULL AND parent_notified_at_ms IS NULL;\n\nCREATE INDEX IF NOT EXISTS runs_query_idx ON runs (namespace, status, created_at_ms);\nCREATE INDEX IF NOT EXISTS runs_search_idx ON runs USING gin (search);\n\nCREATE TABLE IF NOT EXISTS events (\n  run_id         text NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  seq            bigint NOT NULL,\n  step_id        text NOT NULL,\n  attempt        integer NOT NULL,\n  kind           text NOT NULL,\n  status         text NOT NULL,\n  cause          text,\n  schema_ref     text,\n  payload        text,\n  payload_ref    text,\n  error          text,\n  usage          jsonb,\n  random         text NOT NULL,\n  state_hash     text NOT NULL,\n  parent_run_id  text,\n  parent_step_id text,\n  ts_ms          bigint NOT NULL,\n  PRIMARY KEY (run_id, seq)\n);\n\nCREATE TABLE IF NOT EXISTS run_state (\n  run_id        text PRIMARY KEY REFERENCES runs (run_id) ON DELETE CASCADE,\n  seq           bigint NOT NULL,\n  bundle_digest text NOT NULL,\n  kernel_state  text NOT NULL,\n  state         text,\n  state_ref     text,\n  state_hash    text NOT NULL,\n  CONSTRAINT run_state_one_body CHECK ((state IS NULL) <> (state_ref IS NULL))\n);\n\nCREATE TABLE IF NOT EXISTS tasks (\n  task_id                   text PRIMARY KEY,\n  run_id                    text NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  step_id                   text NOT NULL,\n  attempt                   integer NOT NULL,\n  activity                  text NOT NULL,\n  schema_ref                text,\n  queue                     text NOT NULL,\n  input                     text,\n  input_ref                 text,\n  retry_policy              jsonb NOT NULL,\n  status                    text NOT NULL,\n  idempotency_key           text NOT NULL,\n  not_before_ms             bigint NOT NULL,\n  dispatched_at_ms          bigint,\n  dispatch_attempts         integer NOT NULL DEFAULT 0,\n  dispatch_claimed_until_ms bigint,\n  lease_ttl_ms              bigint NOT NULL,\n  lease_until_ms            bigint,\n  worker_id                 text,\n  heartbeat_at_ms           bigint,\n  created_at_ms             bigint NOT NULL,\n  updated_at_ms             bigint NOT NULL,\n  UNIQUE (run_id, step_id),\n  UNIQUE (idempotency_key)\n);\n\n-- Outbox stage \"push tasks\".\nCREATE INDEX IF NOT EXISTS tasks_dispatch_idx\n  ON tasks (queue, not_before_ms)\n  WHERE status = 'scheduled' AND dispatched_at_ms IS NULL;\n\n-- Lease reaper.\nCREATE INDEX IF NOT EXISTS tasks_lease_idx\n  ON tasks (lease_until_ms) WHERE status = 'running';\n\nCREATE INDEX IF NOT EXISTS tasks_run_idx ON tasks (run_id);\n\nCREATE TABLE IF NOT EXISTS timers (\n  run_id           text NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  step_id          text NOT NULL,\n  fire_at_ms       bigint NOT NULL,\n  fired_at_ms      bigint,\n  claimed_until_ms bigint,\n  PRIMARY KEY (run_id, step_id)\n);\n\nCREATE INDEX IF NOT EXISTS timers_due_idx\n  ON timers (fire_at_ms) WHERE fired_at_ms IS NULL;\n\nCREATE TABLE IF NOT EXISTS signal_waits (\n  run_id        text NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  step_id       text NOT NULL,\n  name          text NOT NULL,\n  schema_ref    text,\n  expires_at_ms bigint,\n  PRIMARY KEY (run_id, step_id)\n);\n\nCREATE INDEX IF NOT EXISTS signal_waits_name_idx ON signal_waits (run_id, name);\n\nCREATE TABLE IF NOT EXISTS signals (\n  signal_id         text PRIMARY KEY,\n  run_id            text NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  name              text NOT NULL,\n  payload           text,\n  payload_ref       text,\n  sender            text,\n  created_at_ms     bigint NOT NULL,\n  delivered_at_ms   bigint,\n  delivered_step_id text\n);\n\nCREATE INDEX IF NOT EXISTS signals_pending_idx\n  ON signals (run_id, name, created_at_ms) WHERE delivered_at_ms IS NULL;\n\nCREATE TABLE IF NOT EXISTS schemas (\n  name          text NOT NULL,\n  version       text NOT NULL,\n  json_schema   text NOT NULL,\n  retry_policy  text,\n  created_at_ms bigint NOT NULL,\n  PRIMARY KEY (name, version)\n);\n\nCREATE TABLE IF NOT EXISTS bundles (\n  digest         text PRIMARY KEY,\n  workflow       text NOT NULL,\n  kind           text NOT NULL,\n  blob_ref       text NOT NULL,\n  source_map_ref text,\n  created_at_ms  bigint NOT NULL\n);\n";
//#endregion
//#region src/journal/migrations/pg/0002_task_timeout.ts
const sql$4 = `-- Vlo journal, Postgres. Activity timeouts.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timeout_ms bigint;

-- Timeout backstop: running attempts whose dispatch is older than their budget.
CREATE INDEX IF NOT EXISTS tasks_timeout_idx
  ON tasks (dispatched_at_ms)
  WHERE status = 'running' AND timeout_ms IS NOT NULL;
`;
//#endregion
//#region src/journal/migrations/pg/0003_continued_to.ts
const sql$3 = `-- Vlo journal, Postgres. continue_as_new successor link.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS continued_to text;
`;
//#endregion
//#region src/journal/migrations/sqlite/0001_init.ts
const sql$2 = "-- Vlo journal, SQLite. Mirror of migrations/pg/0001_init.sql.\n--\n-- SQLite has one file per journal, so tables are unprefixed. Millisecond epochs\n-- are INTEGER, JSON is TEXT (SQLite has no jsonb), and hashed or replayed JSON\n-- stays byte-exact for the same reason as in Postgres.\n\nCREATE TABLE IF NOT EXISTS migrations (\n  version       TEXT PRIMARY KEY,\n  applied_at_ms INTEGER NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS runs (\n  run_id                  TEXT PRIMARY KEY,\n  namespace               TEXT NOT NULL DEFAULT 'default',\n  workflow                TEXT NOT NULL,\n  component_digest        TEXT NOT NULL,\n  status                  TEXT NOT NULL,\n  last_seq                INTEGER NOT NULL DEFAULT 0,\n  parent_run_id           TEXT,\n  parent_step_id          TEXT,\n  continued_from          TEXT,\n  input                   TEXT,\n  input_ref               TEXT,\n  output                  TEXT,\n  output_ref              TEXT,\n  search                  TEXT NOT NULL DEFAULT '{}',\n  assignee                TEXT,\n  created_at_ms           INTEGER NOT NULL,\n  updated_at_ms           INTEGER NOT NULL,\n  started_at_ms           INTEGER,\n  closed_at_ms            INTEGER,\n  parent_notified_at_ms   INTEGER,\n  start_claimed_until_ms  INTEGER,\n  notify_claimed_until_ms INTEGER\n);\n\n-- Outbox stage \"start runs\".\nCREATE INDEX IF NOT EXISTS runs_created_idx\n  ON runs (created_at_ms) WHERE status = 'created';\n\n-- Outbox stage \"notify parents\".\nCREATE INDEX IF NOT EXISTS runs_notify_idx\n  ON runs (closed_at_ms)\n  WHERE parent_run_id IS NOT NULL AND parent_notified_at_ms IS NULL;\n\nCREATE INDEX IF NOT EXISTS runs_query_idx ON runs (namespace, status, created_at_ms);\n\nCREATE TABLE IF NOT EXISTS events (\n  run_id         TEXT NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  seq            INTEGER NOT NULL,\n  step_id        TEXT NOT NULL,\n  attempt        INTEGER NOT NULL,\n  kind           TEXT NOT NULL,\n  status         TEXT NOT NULL,\n  cause          TEXT,\n  schema_ref     TEXT,\n  payload        TEXT,\n  payload_ref    TEXT,\n  error          TEXT,\n  usage          TEXT,\n  random         TEXT NOT NULL,\n  state_hash     TEXT NOT NULL,\n  parent_run_id  TEXT,\n  parent_step_id TEXT,\n  ts_ms          INTEGER NOT NULL,\n  PRIMARY KEY (run_id, seq)\n);\n\nCREATE TABLE IF NOT EXISTS run_state (\n  run_id        TEXT PRIMARY KEY REFERENCES runs (run_id) ON DELETE CASCADE,\n  seq           INTEGER NOT NULL,\n  bundle_digest TEXT NOT NULL,\n  kernel_state  TEXT NOT NULL,\n  state         TEXT,\n  state_ref     TEXT,\n  state_hash    TEXT NOT NULL,\n  CONSTRAINT run_state_one_body CHECK ((state IS NULL) <> (state_ref IS NULL))\n);\n\nCREATE TABLE IF NOT EXISTS tasks (\n  task_id                   TEXT PRIMARY KEY,\n  run_id                    TEXT NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  step_id                   TEXT NOT NULL,\n  attempt                   INTEGER NOT NULL,\n  activity                  TEXT NOT NULL,\n  schema_ref                TEXT,\n  queue                     TEXT NOT NULL,\n  input                     TEXT,\n  input_ref                 TEXT,\n  retry_policy              TEXT NOT NULL,\n  status                    TEXT NOT NULL,\n  idempotency_key           TEXT NOT NULL,\n  not_before_ms             INTEGER NOT NULL,\n  dispatched_at_ms          INTEGER,\n  dispatch_attempts         INTEGER NOT NULL DEFAULT 0,\n  dispatch_claimed_until_ms INTEGER,\n  lease_ttl_ms              INTEGER NOT NULL,\n  lease_until_ms            INTEGER,\n  worker_id                 TEXT,\n  heartbeat_at_ms           INTEGER,\n  created_at_ms             INTEGER NOT NULL,\n  updated_at_ms             INTEGER NOT NULL,\n  UNIQUE (run_id, step_id),\n  UNIQUE (idempotency_key)\n);\n\n-- Outbox stage \"push tasks\".\nCREATE INDEX IF NOT EXISTS tasks_dispatch_idx\n  ON tasks (queue, not_before_ms)\n  WHERE status = 'scheduled' AND dispatched_at_ms IS NULL;\n\n-- Lease reaper.\nCREATE INDEX IF NOT EXISTS tasks_lease_idx\n  ON tasks (lease_until_ms) WHERE status = 'running';\n\nCREATE INDEX IF NOT EXISTS tasks_run_idx ON tasks (run_id);\n\nCREATE TABLE IF NOT EXISTS timers (\n  run_id           TEXT NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  step_id          TEXT NOT NULL,\n  fire_at_ms       INTEGER NOT NULL,\n  fired_at_ms      INTEGER,\n  claimed_until_ms INTEGER,\n  PRIMARY KEY (run_id, step_id)\n);\n\nCREATE INDEX IF NOT EXISTS timers_due_idx\n  ON timers (fire_at_ms) WHERE fired_at_ms IS NULL;\n\nCREATE TABLE IF NOT EXISTS signal_waits (\n  run_id        TEXT NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  step_id       TEXT NOT NULL,\n  name          TEXT NOT NULL,\n  schema_ref    TEXT,\n  expires_at_ms INTEGER,\n  PRIMARY KEY (run_id, step_id)\n);\n\nCREATE INDEX IF NOT EXISTS signal_waits_name_idx ON signal_waits (run_id, name);\n\nCREATE TABLE IF NOT EXISTS signals (\n  signal_id         TEXT PRIMARY KEY,\n  run_id            TEXT NOT NULL REFERENCES runs (run_id) ON DELETE CASCADE,\n  name              TEXT NOT NULL,\n  payload           TEXT,\n  payload_ref       TEXT,\n  sender            TEXT,\n  created_at_ms     INTEGER NOT NULL,\n  delivered_at_ms   INTEGER,\n  delivered_step_id TEXT\n);\n\nCREATE INDEX IF NOT EXISTS signals_pending_idx\n  ON signals (run_id, name, created_at_ms) WHERE delivered_at_ms IS NULL;\n\nCREATE TABLE IF NOT EXISTS schemas (\n  name          TEXT NOT NULL,\n  version       TEXT NOT NULL,\n  json_schema   TEXT NOT NULL,\n  retry_policy  TEXT,\n  created_at_ms INTEGER NOT NULL,\n  PRIMARY KEY (name, version)\n);\n\nCREATE TABLE IF NOT EXISTS bundles (\n  digest         TEXT PRIMARY KEY,\n  workflow       TEXT NOT NULL,\n  kind           TEXT NOT NULL,\n  blob_ref       TEXT NOT NULL,\n  source_map_ref TEXT,\n  created_at_ms  INTEGER NOT NULL\n);\n";
//#endregion
//#region src/journal/migrations/sqlite/0002_task_timeout.ts
const sql$1 = `-- Vlo journal, SQLite. Mirror of migrations/pg/0002_task_timeout.

ALTER TABLE tasks ADD COLUMN timeout_ms INTEGER;

-- Timeout backstop: running attempts whose dispatch is older than their budget.
CREATE INDEX IF NOT EXISTS tasks_timeout_idx
  ON tasks (dispatched_at_ms)
  WHERE status = 'running' AND timeout_ms IS NOT NULL;
`;
//#endregion
//#region src/journal/migrations/sqlite/0003_continued_to.ts
const sql = `-- Vlo journal, SQLite. Mirror of migrations/pg/0003_continued_to.

ALTER TABLE runs ADD COLUMN continued_to TEXT;
`;
//#endregion
//#region src/journal/migrations.ts
const MIGRATION_VERSIONS = [
	"0001_init",
	"0002_task_timeout",
	"0003_continued_to"
];
const MIGRATIONS = {
	pg: {
		"0001_init": sql$5,
		"0002_task_timeout": sql$4,
		"0003_continued_to": sql$3
	},
	sqlite: {
		"0001_init": sql$2,
		"0002_task_timeout": sql$1,
		"0003_continued_to": sql
	}
};
function migrationSql(kind, version) {
	return MIGRATIONS[kind][version];
}
/**
* @param hasMigrationsTable dialect-specific probe, so the runner needs no
*   bootstrap copy of the `migrations` DDL.
*/
async function applyMigrations(x, kind, hasMigrationsTable, nowMs) {
	const applied = await hasMigrationsTable() ? await appliedVersions(x) : /* @__PURE__ */ new Set();
	for (const version of MIGRATION_VERSIONS) {
		if (applied.has(version)) continue;
		await x.exec(migrationSql(kind, version));
		await x.run("INSERT INTO migrations (version, applied_at_ms) VALUES (?, ?) ON CONFLICT (version) DO NOTHING", [version, nowMs]);
	}
}
async function appliedVersions(x) {
	const rows = await x.all("SELECT version FROM migrations");
	return new Set(rows.map((r) => r.version));
}
//#endregion
//#region src/journal/rows.ts
function num(value) {
	return typeof value === "number" ? value : Number(value);
}
function optNum(value) {
	return value == null ? null : num(value);
}
function parseJson(value) {
	if (value == null) return null;
	return typeof value === "string" ? JSON.parse(value) : value;
}
/** Copies the entries that are actually present, leaving absent columns off the row. */
function withPresent(row, optional) {
	const sink = row;
	for (const [key, value] of Object.entries(optional)) if (value !== null && value !== void 0) sink[key] = value;
	return row;
}
function mapRun(r) {
	return withPresent({
		run_id: String(r.run_id),
		namespace: String(r.namespace),
		workflow: String(r.workflow),
		component_digest: String(r.component_digest),
		status: r.status,
		last_seq: num(r.last_seq),
		search: parseJson(r.search) ?? {},
		created_at_ms: num(r.created_at_ms),
		updated_at_ms: num(r.updated_at_ms)
	}, {
		parent_run_id: r.parent_run_id,
		parent_step_id: r.parent_step_id,
		continued_from: r.continued_from,
		continued_to: r.continued_to,
		input: r.input,
		input_ref: r.input_ref,
		output: r.output,
		output_ref: r.output_ref,
		assignee: r.assignee,
		started_at_ms: optNum(r.started_at_ms),
		closed_at_ms: optNum(r.closed_at_ms),
		parent_notified_at_ms: optNum(r.parent_notified_at_ms),
		start_claimed_until_ms: optNum(r.start_claimed_until_ms),
		notify_claimed_until_ms: optNum(r.notify_claimed_until_ms)
	});
}
function mapEvent(r) {
	return withPresent({
		run_id: String(r.run_id),
		seq: num(r.seq),
		step_id: String(r.step_id),
		attempt: num(r.attempt),
		kind: r.kind,
		status: r.status,
		ts_ms: num(r.ts_ms),
		random: String(r.random),
		state_hash: String(r.state_hash)
	}, {
		cause: r.cause,
		schema_ref: r.schema_ref,
		payload: r.payload,
		payload_ref: r.payload_ref,
		error: r.error,
		usage: parseJson(r.usage),
		parent_run_id: r.parent_run_id,
		parent_step_id: r.parent_step_id
	});
}
function mapState(r) {
	return withPresent({
		run_id: String(r.run_id),
		seq: num(r.seq),
		bundle_digest: String(r.bundle_digest),
		kernel_state: String(r.kernel_state),
		state_hash: String(r.state_hash)
	}, {
		state: r.state,
		state_ref: r.state_ref
	});
}
function mapTask(r) {
	return withPresent({
		task_id: String(r.task_id),
		run_id: String(r.run_id),
		step_id: String(r.step_id),
		attempt: num(r.attempt),
		activity: String(r.activity),
		queue: String(r.queue),
		retry_policy: parseJson(r.retry_policy),
		status: r.status,
		idempotency_key: String(r.idempotency_key),
		not_before_ms: num(r.not_before_ms),
		dispatch_attempts: num(r.dispatch_attempts),
		lease_ttl_ms: num(r.lease_ttl_ms),
		created_at_ms: num(r.created_at_ms),
		updated_at_ms: num(r.updated_at_ms)
	}, {
		schema_ref: r.schema_ref,
		input: r.input,
		input_ref: r.input_ref,
		dispatched_at_ms: optNum(r.dispatched_at_ms),
		dispatch_claimed_until_ms: optNum(r.dispatch_claimed_until_ms),
		timeout_ms: optNum(r.timeout_ms),
		lease_until_ms: optNum(r.lease_until_ms),
		worker_id: r.worker_id,
		heartbeat_at_ms: optNum(r.heartbeat_at_ms)
	});
}
function mapTimer(r) {
	return withPresent({
		run_id: String(r.run_id),
		step_id: String(r.step_id),
		fire_at_ms: num(r.fire_at_ms)
	}, {
		fired_at_ms: optNum(r.fired_at_ms),
		claimed_until_ms: optNum(r.claimed_until_ms)
	});
}
function mapSignalWait(r) {
	return withPresent({
		run_id: String(r.run_id),
		step_id: String(r.step_id),
		name: String(r.name)
	}, {
		schema_ref: r.schema_ref,
		expires_at_ms: optNum(r.expires_at_ms)
	});
}
function mapSignal(r) {
	return withPresent({
		signal_id: String(r.signal_id),
		run_id: String(r.run_id),
		name: String(r.name),
		created_at_ms: num(r.created_at_ms)
	}, {
		payload: r.payload,
		payload_ref: r.payload_ref,
		sender: r.sender,
		delivered_at_ms: optNum(r.delivered_at_ms),
		delivered_step_id: r.delivered_step_id
	});
}
function mapSchema(r) {
	return withPresent({
		name: String(r.name),
		version: String(r.version),
		json_schema: String(r.json_schema)
	}, { retry_policy: r.retry_policy });
}
//#endregion
//#region src/journal/reads.ts
const RUN_COLUMNS = "*";
const DEFAULT_QUERY_LIMIT = 100;
async function readEvents(x, runId, sinceSeq = 0) {
	return (await x.all("SELECT * FROM events WHERE run_id = ? AND seq > ? ORDER BY seq", [runId, sinceSeq])).map(mapEvent);
}
async function getRun(x, runId) {
	const row = await one(x, `SELECT ${RUN_COLUMNS} FROM runs WHERE run_id = ?`, [runId]);
	return row ? mapRun(row) : null;
}
async function getState(x, runId) {
	const row = await one(x, "SELECT * FROM run_state WHERE run_id = ?", [runId]);
	return row ? mapState(row) : null;
}
async function getTask(x, taskId) {
	const row = await one(x, "SELECT * FROM tasks WHERE task_id = ?", [taskId]);
	return row ? mapTask(row) : null;
}
async function listTasks(x, runId) {
	return (await x.all("SELECT * FROM tasks WHERE run_id = ? ORDER BY created_at_ms, task_id", [runId])).map(mapTask);
}
async function queryRuns(x, q) {
	const where = [];
	const params = [];
	if (q.namespace !== void 0) {
		where.push("namespace = ?");
		params.push(q.namespace);
	}
	if (q.status !== void 0) {
		where.push("status = ?");
		params.push(q.status);
	}
	if (q.workflow !== void 0) {
		where.push("workflow = ?");
		params.push(q.workflow);
	}
	params.push(q.limit ?? DEFAULT_QUERY_LIMIT);
	const filter = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
	return (await x.all(`SELECT ${RUN_COLUMNS} FROM runs ${filter} ORDER BY created_at_ms DESC, run_id DESC LIMIT ?`, params)).map(mapRun);
}
async function dueTimers(x, nowMs, limit) {
	return (await x.all(`SELECT * FROM timers
       WHERE fired_at_ms IS NULL AND fire_at_ms <= ?
       ORDER BY fire_at_ms, run_id, step_id
       LIMIT ?`, [nowMs, limit])).map(mapTimer);
}
async function expiredLeases(x, nowMs, limit) {
	return (await x.all(`SELECT * FROM tasks
       WHERE status = 'running' AND lease_until_ms IS NOT NULL AND lease_until_ms < ?
       ORDER BY lease_until_ms, task_id
       LIMIT ?`, [nowMs, limit])).map(mapTask);
}
/**
* Running attempts whose wall-clock budget has run out. A task dispatched but not yet
* stamped has a NULL `dispatched_at_ms`, and NULL + timeout is NULL, so it is never due.
*/
async function expiredTimeouts(x, nowMs, limit) {
	return (await x.all(`SELECT * FROM tasks
       WHERE status = 'running'
         AND timeout_ms IS NOT NULL
         AND dispatched_at_ms + timeout_ms < ?
       ORDER BY dispatched_at_ms, task_id
       LIMIT ?`, [nowMs, limit])).map(mapTask);
}
//#endregion
//#region src/journal/apply.ts
const TERMINAL_RUN_STATUS = /* @__PURE__ */ new Set([
	"completed",
	"failed",
	"cancelled",
	"continued"
]);
const TERMINAL_TASK_STATUS = /* @__PURE__ */ new Set([
	"succeeded",
	"failed",
	"cancelled"
]);
const INSERT_RUN = `
  INSERT INTO runs (
    run_id, namespace, workflow, component_digest, status, last_seq,
    parent_run_id, parent_step_id, continued_from, input, input_ref, search,
    created_at_ms, updated_at_ms
  ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (run_id) DO NOTHING`;
const INSERT_EVENT = `
  INSERT INTO events (
    run_id, seq, step_id, attempt, kind, status, cause, schema_ref, payload,
    payload_ref, error, usage, random, state_hash, parent_run_id, parent_step_id, ts_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const UPSERT_STATE = `
  INSERT INTO run_state (run_id, seq, bundle_digest, kernel_state, state, state_ref, state_hash)
  VALUES (?, ?, COALESCE(?, (SELECT component_digest FROM runs WHERE run_id = ?)), ?, ?, ?, ?)
  ON CONFLICT (run_id) DO UPDATE SET
    seq = excluded.seq,
    bundle_digest = excluded.bundle_digest,
    kernel_state = excluded.kernel_state,
    state = excluded.state,
    state_ref = excluded.state_ref,
    state_hash = excluded.state_hash`;
/**
* A replay of the same attempt is a no-op; a retry at a higher attempt resets
* the outbox and lease columns so the dispatcher picks the task up again.
*/
const UPSERT_TASK = `
  INSERT INTO tasks (
    task_id, run_id, step_id, attempt, activity, schema_ref, queue, input,
    retry_policy, status, idempotency_key, not_before_ms, dispatch_attempts,
    lease_ttl_ms, timeout_ms, created_at_ms, updated_at_ms
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, 0, ?, ?, ?, ?)
  ON CONFLICT (task_id) DO UPDATE SET
    attempt = excluded.attempt,
    activity = excluded.activity,
    schema_ref = excluded.schema_ref,
    queue = excluded.queue,
    input = excluded.input,
    retry_policy = excluded.retry_policy,
    status = 'scheduled',
    idempotency_key = excluded.idempotency_key,
    not_before_ms = excluded.not_before_ms,
    dispatched_at_ms = NULL,
    dispatch_attempts = 0,
    dispatch_claimed_until_ms = NULL,
    lease_until_ms = NULL,
    worker_id = NULL,
    heartbeat_at_ms = NULL,
    lease_ttl_ms = excluded.lease_ttl_ms,
    timeout_ms = excluded.timeout_ms,
    updated_at_ms = excluded.updated_at_ms
  WHERE tasks.attempt < excluded.attempt`;
const RESCHEDULE_TASK = `
  UPDATE tasks SET
    status = ?, attempt = ?, not_before_ms = ?, updated_at_ms = ?,
    dispatched_at_ms = NULL, dispatch_claimed_until_ms = NULL,
    lease_until_ms = NULL, worker_id = NULL
  WHERE task_id = ?`;
const CLOSE_TASK = `
  UPDATE tasks SET
    status = ?, attempt = ?, updated_at_ms = ?,
    lease_until_ms = NULL, dispatch_claimed_until_ms = NULL
  WHERE task_id = ?`;
const SET_TASK_STATUS = `
  UPDATE tasks SET status = ?, attempt = ?, updated_at_ms = ? WHERE task_id = ?`;
const INSERT_TIMER = `
  INSERT INTO timers (run_id, step_id, fire_at_ms) VALUES (?, ?, ?)
  ON CONFLICT (run_id, step_id) DO NOTHING`;
const INSERT_SIGNAL_WAIT = `
  INSERT INTO signal_waits (run_id, step_id, name, schema_ref, expires_at_ms)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT (run_id, step_id) DO NOTHING`;
const UPDATE_RUN = `
  UPDATE runs SET
    status = ?,
    last_seq = ?,
    updated_at_ms = ?,
    started_at_ms = COALESCE(started_at_ms, ?),
    output = COALESCE(?, output),
    output_ref = COALESCE(?, output_ref),
    closed_at_ms = COALESCE(closed_at_ms, ?),
    continued_to = COALESCE(?, continued_to)
  WHERE run_id = ?`;
async function insertRun(x, row, nowMs) {
	await x.run(INSERT_RUN, [
		row.run_id,
		row.namespace ?? "default",
		row.workflow,
		row.component_digest,
		row.status,
		orNull(row.parent_run_id),
		orNull(row.parent_step_id),
		orNull(row.continued_from),
		orNull(row.input),
		orNull(row.input_ref),
		jsonParam(row.search ?? {}),
		nowMs,
		nowMs
	]);
}
async function applyTransition(x, runId, t, opts) {
	const now = opts.nowMs;
	for (const event of t.events) await insertEvent(x, runId, event);
	await upsertState(x, runId, t, opts);
	for (const task of t.tasks) await upsertTask(x, runId, task, now);
	for (const update of t.task_updates) await applyTaskUpdate(x, update, now);
	for (const timer of t.timers) await insertTimer(x, runId, timer);
	for (const wait of t.signal_waits) await insertSignalWait(x, runId, wait);
	for (const child of opts.childRuns ?? []) await insertRun(x, child, now);
	if (opts.successorRun !== void 0) await insertRun(x, opts.successorRun, now);
	await updateRun(x, runId, t, opts);
}
async function insertEvent(x, runId, e) {
	await x.run(INSERT_EVENT, [
		runId,
		e.seq,
		e.step_id,
		e.attempt,
		e.kind,
		e.status,
		orNull(e.cause),
		orNull(e.schema_ref),
		orNull(e.payload),
		orNull(e.payload_ref),
		orNull(e.error),
		e.usage ? jsonParam(e.usage) : null,
		e.random,
		e.state_hash,
		orNull(e.parent_run_id),
		orNull(e.parent_step_id),
		e.ts_ms
	]);
}
async function upsertState(x, runId, t, opts) {
	const offloaded = opts.stateRef !== void 0;
	await x.run(UPSERT_STATE, [
		runId,
		t.run.last_seq,
		orNull(opts.bundleDigest),
		runId,
		jsonParam(t.kernel_state),
		offloaded ? null : t.state,
		orNull(opts.stateRef),
		t.state_hash
	]);
}
async function upsertTask(x, runId, task, nowMs) {
	await x.run(UPSERT_TASK, [
		task.task_id,
		runId,
		task.step_id,
		task.attempt,
		task.activity,
		orNull(task.schema_ref),
		task.queue,
		jsonParam(task.input),
		jsonParam(task.retry),
		task.idempotency_key,
		nowMs,
		task.lease_ttl_ms,
		orNull(task.timeout_ms),
		nowMs,
		nowMs
	]);
}
async function applyTaskUpdate(x, u, nowMs) {
	if (u.status === "scheduled" || u.status === "retrying") {
		const notBefore = u.not_before_ms ?? nowMs;
		await x.run(RESCHEDULE_TASK, [
			u.status,
			u.attempt,
			notBefore,
			nowMs,
			u.task_id
		]);
		return;
	}
	const sql = TERMINAL_TASK_STATUS.has(u.status) ? CLOSE_TASK : SET_TASK_STATUS;
	await x.run(sql, [
		u.status,
		u.attempt,
		nowMs,
		u.task_id
	]);
}
async function insertTimer(x, runId, timer) {
	await x.run(INSERT_TIMER, [
		runId,
		timer.step_id,
		timer.fire_at_ms
	]);
}
async function insertSignalWait(x, runId, wait) {
	await x.run(INSERT_SIGNAL_WAIT, [
		runId,
		wait.step_id,
		wait.name,
		orNull(wait.schema_ref),
		orNull(wait.expires_at_ms)
	]);
}
async function updateRun(x, runId, t, opts) {
	const status = t.run.status;
	const closed = TERMINAL_RUN_STATUS.has(status);
	const outputRef = opts.outputRef;
	const inlineOutput = outputRef === void 0 && t.completion?.output !== void 0 ? jsonParam(t.completion.output) : null;
	const params = [
		status,
		t.run.last_seq,
		opts.nowMs,
		status === "created" ? null : opts.nowMs,
		inlineOutput,
		orNull(outputRef),
		closed ? opts.nowMs : null,
		orNull(opts.successorRun?.run_id),
		runId
	];
	await x.run(UPDATE_RUN, params);
}
//#endregion
//#region src/journal/tx.ts
const RUN_LOCK_PREFIX = "vlo:run:";
var JournalTransaction = class {
	x;
	d;
	constructor(x, d) {
		this.x = x;
		this.d = d;
	}
	async lockRun(runId) {
		await this.x.advisoryLock(RUN_LOCK_PREFIX + runId);
		return getRun(this.x, runId);
	}
	async createRun(row, nowMs) {
		await insertRun(this.x, row, nowMs);
	}
	getState(runId) {
		return getState(this.x, runId);
	}
	readEvents(runId, sinceSeq) {
		return readEvents(this.x, runId, sinceSeq);
	}
	applyTransition(runId, t, opts) {
		return applyTransition(this.x, runId, t, opts);
	}
	async claimUndispatchedTasks(nowMs, limit, holdMs, filter) {
		const clauses = [];
		const params = [
			nowMs + holdMs,
			nowMs,
			nowMs,
			nowMs
		];
		if (filter?.queue !== void 0) {
			clauses.push("AND queue = ?");
			params.push(filter.queue);
		}
		const excluded = filter?.excludeQueues ?? [];
		if (excluded.length > 0) {
			clauses.push(`AND queue NOT IN (${excluded.map(() => "?").join(", ")})`);
			params.push(...excluded);
		}
		params.push(limit);
		return (await this.x.all(`UPDATE tasks SET
         dispatch_claimed_until_ms = ?,
         dispatch_attempts = dispatch_attempts + 1,
         updated_at_ms = ?
       WHERE task_id IN (
         SELECT task_id FROM tasks
          WHERE status = 'scheduled'
            AND dispatched_at_ms IS NULL
            AND not_before_ms <= ?
            AND (dispatch_claimed_until_ms IS NULL OR dispatch_claimed_until_ms < ?)
            ${clauses.join("\n            ")}
          ORDER BY not_before_ms, created_at_ms, task_id
          LIMIT ?${this.d.skipLocked}
       )
       RETURNING *`, params)).map(mapTask);
	}
	async markDispatched(taskId, attempt, nowMs, leaseUntilMs, workerId) {
		return await this.x.run(`UPDATE tasks SET
         status = 'running',
         dispatched_at_ms = ?,
         lease_until_ms = ?,
         heartbeat_at_ms = ?,
         worker_id = ?,
         dispatch_claimed_until_ms = NULL,
         updated_at_ms = ?
       WHERE task_id = ? AND attempt = ?
         AND (status = 'scheduled' OR (status = 'running' AND dispatched_at_ms IS NULL))`, [
			nowMs,
			leaseUntilMs,
			nowMs,
			orNull(workerId),
			nowMs,
			taskId,
			attempt
		]) > 0;
	}
	async deferDispatch(taskId, attempt, notBeforeMs) {
		await this.x.run(`UPDATE tasks SET not_before_ms = ?, dispatch_claimed_until_ms = NULL
       WHERE task_id = ? AND attempt = ?`, [
			notBeforeMs,
			taskId,
			attempt
		]);
	}
	async heartbeat(taskId, attempt, leaseUntilMs, nowMs) {
		return await this.x.run(`UPDATE tasks SET lease_until_ms = ?, heartbeat_at_ms = ?, updated_at_ms = ?
       WHERE task_id = ? AND attempt = ? AND status = 'running'`, [
			leaseUntilMs,
			nowMs,
			nowMs,
			taskId,
			attempt
		]) > 0;
	}
	async claimCreatedRuns(nowMs, limit, holdMs) {
		return (await this.x.all(`UPDATE runs SET start_claimed_until_ms = ?, updated_at_ms = ?
       WHERE run_id IN (
         SELECT run_id FROM runs
          WHERE status = 'created'
            AND (start_claimed_until_ms IS NULL OR start_claimed_until_ms < ?)
          ORDER BY created_at_ms, run_id
          LIMIT ?${this.d.skipLocked}
       )
       RETURNING *`, [
			nowMs + holdMs,
			nowMs,
			nowMs,
			limit
		])).map(mapRun);
	}
	async claimClosedUnnotified(nowMs, limit, holdMs) {
		return (await this.x.all(`UPDATE runs SET notify_claimed_until_ms = ?, updated_at_ms = ?
       WHERE run_id IN (
         SELECT run_id FROM runs
          WHERE parent_run_id IS NOT NULL
            AND parent_notified_at_ms IS NULL
            AND closed_at_ms IS NOT NULL
            AND (notify_claimed_until_ms IS NULL OR notify_claimed_until_ms < ?)
          ORDER BY closed_at_ms, run_id
          LIMIT ?${this.d.skipLocked}
       )
       RETURNING *`, [
			nowMs + holdMs,
			nowMs,
			nowMs,
			limit
		])).map(mapRun);
	}
	async markParentNotified(runId, nowMs) {
		await this.x.run(`UPDATE runs SET parent_notified_at_ms = ?, updated_at_ms = ?
       WHERE run_id = ? AND parent_notified_at_ms IS NULL`, [
			nowMs,
			nowMs,
			runId
		]);
	}
	async claimDueTimers(nowMs, limit, holdMs) {
		return (await this.x.all(`UPDATE timers SET claimed_until_ms = ?
       WHERE (run_id, step_id) IN (
         SELECT run_id, step_id FROM timers
          WHERE fired_at_ms IS NULL
            AND fire_at_ms <= ?
            AND (claimed_until_ms IS NULL OR claimed_until_ms < ?)
          ORDER BY fire_at_ms, run_id, step_id
          LIMIT ?${this.d.skipLocked}
       )
       RETURNING *`, [
			nowMs + holdMs,
			nowMs,
			nowMs,
			limit
		])).map(mapTimer);
	}
	async markTimerFired(runId, stepId, nowMs) {
		return await this.x.run("UPDATE timers SET fired_at_ms = ? WHERE run_id = ? AND step_id = ? AND fired_at_ms IS NULL", [
			nowMs,
			runId,
			stepId
		]) > 0;
	}
	async putSignal(row, nowMs) {
		await this.x.run(`INSERT INTO signals (signal_id, run_id, name, payload, payload_ref, sender, created_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (signal_id) DO NOTHING`, [
			row.signal_id,
			row.run_id,
			row.name,
			orNull(row.payload),
			orNull(row.payload_ref),
			orNull(row.sender),
			nowMs
		]);
	}
	async takeSignal(runId, name) {
		const row = await one(this.x, `SELECT * FROM signals
        WHERE run_id = ? AND name = ? AND delivered_at_ms IS NULL
        ORDER BY created_at_ms, signal_id
        LIMIT 1${this.d.skipLocked}`, [runId, name]);
		return row ? mapSignal(row) : null;
	}
	async markSignalDelivered(signalId, stepId, nowMs) {
		await this.x.run(`UPDATE signals SET delivered_at_ms = ?, delivered_step_id = ?
       WHERE signal_id = ? AND delivered_at_ms IS NULL`, [
			nowMs,
			stepId,
			signalId
		]);
	}
	async getSignalWaits(runId) {
		return (await this.x.all("SELECT * FROM signal_waits WHERE run_id = ? ORDER BY step_id", [runId])).map(mapSignalWait);
	}
	async removeSignalWait(runId, stepId) {
		await this.x.run("DELETE FROM signal_waits WHERE run_id = ? AND step_id = ?", [runId, stepId]);
	}
	async upsertSchema(row, nowMs) {
		await this.x.run(`INSERT INTO schemas (name, version, json_schema, retry_policy, created_at_ms)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (name, version) DO UPDATE SET
         json_schema = excluded.json_schema,
         retry_policy = excluded.retry_policy`, [
			row.name,
			row.version,
			row.json_schema,
			orNull(row.retry_policy),
			nowMs
		]);
	}
	async getSchema(name, version) {
		const row = await one(this.x, "SELECT * FROM schemas WHERE name = ? AND version = ?", [name, version]);
		return row ? mapSchema(row) : null;
	}
};
//#endregion
//#region src/journal/types.ts
/**
* Thrown by every journal call made after `close()`.
*
* Shutdown is inherently racy: a worker reporting a result, a stage finishing its pass. The
* contract is that those calls fail with this, one recognisable error, instead of whatever
* the driver does to a closed handle — `node:sqlite` raises `ERR_INVALID_STATE` from a
* finalized statement, which surfaces as a crash rather than as "the host is stopping".
*/
var JournalClosed = class extends Error {
	/** Always `journal_closed`. */
	code = "journal_closed";
	/** `dialect` names the implementation, e.g. `sqlite` or `postgres`. */
	constructor(dialect) {
		super(`vlo journal: the ${dialect} journal is closed`);
		this.name = "JournalClosed";
	}
};
//#endregion
//#region src/journal/postgres.ts
/**
* The Postgres journal.
*
* Every statement runs inside a transaction whose `search_path` is pinned with
* `SET LOCAL` to the journal's own schema (`vlo` by default, or a throwaway schema in
* tests), so the shared SQL can name tables unqualified and nothing can reach `public`.
* Nothing is session state: no startup `options`, no session-level `SET`, no
* session-level advisory locks — so the journal works behind transaction-mode poolers
* (PgBouncer, PlanetScale, Neon), which reject startup parameters and multiplex
* sessions. Per-run serialisation is a transaction-scoped advisory lock; claims use
* `FOR UPDATE SKIP LOCKED`.
*/
const { Pool } = pg;
const MIGRATE_LOCK = "vlo:migrate";
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const rewritten = /* @__PURE__ */ new Map();
/** Shared SQL is written with `?`; Postgres wants `$n`. */
function toPgSql(sql) {
	const hit = rewritten.get(sql);
	if (hit !== void 0) return hit;
	let index = 0;
	const out = sql.replace(/\?/g, () => `$${++index}`);
	rewritten.set(sql, out);
	return out;
}
var PgExecutor = class {
	q;
	constructor(q) {
		this.q = q;
	}
	async all(sql, params = []) {
		return (await this.q.query(toPgSql(sql), params)).rows;
	}
	async run(sql, params = []) {
		return (await this.q.query(toPgSql(sql), params)).rowCount ?? 0;
	}
	async exec(sql) {
		await this.q.query(sql);
	}
	async advisoryLock(key) {
		await this.q.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
	}
};
/** The Postgres {@link Journal}. Opened by `openJournal("postgres://…")`. */
var PostgresJournal = class {
	pool;
	schema;
	executor;
	closed = false;
	/** Creates the pool; no connection is made until the first call. Throws on a schema name that is not a plain identifier. */
	constructor(url, opts = {}) {
		this.schema = assertIdentifier(opts.schema ?? "vlo");
		this.pool = new Pool({
			connectionString: url,
			...opts.max !== void 0 ? { max: opts.max } : {}
		});
		this.executor = new PgExecutor({ query: (text, values) => this.inPinnedTransaction((client) => client.query(text, values)) });
	}
	/** Runs `fn` on one connection inside `BEGIN … COMMIT` with `search_path` set locally. */
	async inPinnedTransaction(fn) {
		this.assertOpen();
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(`SET LOCAL search_path TO ${this.schema}`);
			const result = await fn(client);
			await client.query("COMMIT");
			return result;
		} catch (error) {
			await client.query("ROLLBACK").catch(() => void 0);
			throw error;
		} finally {
			client.release();
		}
	}
	async migrate() {
		this.assertOpen();
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [MIGRATE_LOCK]);
			if ((await client.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [this.schema])).rowCount === 0) await client.query(`CREATE SCHEMA ${this.schema}`);
			await client.query("COMMIT");
			await client.query("BEGIN");
			await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [MIGRATE_LOCK]);
			await client.query(`SET LOCAL search_path TO ${this.schema}`);
			const executor = new PgExecutor(client);
			await applyMigrations(executor, "pg", () => this.hasMigrationsTable(executor), Date.now());
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK").catch(() => void 0);
			throw error;
		} finally {
			client.release();
		}
	}
	transaction(fn) {
		return this.inPinnedTransaction((client) => fn(new JournalTransaction(new PgExecutor(client), PG)));
	}
	readEvents(runId, sinceSeq) {
		return readEvents(this.executor, runId, sinceSeq);
	}
	getRun(runId) {
		return getRun(this.executor, runId);
	}
	getState(runId) {
		return getState(this.executor, runId);
	}
	getTask(taskId) {
		return getTask(this.executor, taskId);
	}
	listTasks(runId) {
		return listTasks(this.executor, runId);
	}
	query(q) {
		return queryRuns(this.executor, q);
	}
	dueTimers(nowMs, limit) {
		return dueTimers(this.executor, nowMs, limit);
	}
	expiredLeases(nowMs, limit) {
		return expiredLeases(this.executor, nowMs, limit);
	}
	expiredTimeouts(nowMs, limit) {
		return expiredTimeouts(this.executor, nowMs, limit);
	}
	/** Idempotent. */
	async close() {
		if (this.closed) return;
		this.closed = true;
		await this.pool.end();
	}
	assertOpen() {
		if (this.closed) throw new JournalClosed("postgres");
	}
	async hasMigrationsTable(x) {
		return (await x.all("SELECT to_regclass(CAST(? AS text)) IS NOT NULL AS present", [`${this.schema}.migrations`]))[0]?.present === true;
	}
};
function assertIdentifier(name) {
	if (!IDENTIFIER.test(name)) throw new Error(`invalid journal schema name: ${name}`);
	return name;
}
//#endregion
//#region src/journal/sqlite.ts
/**
* The SQLite journal: one file, one connection, `node:sqlite`.
*
* `node:sqlite` is synchronous while the `Journal` API is not, so a promise
* mutex owns the connection: a transaction holds it from `BEGIN IMMEDIATE`
* until `COMMIT`, and reads queue behind it. `BEGIN IMMEDIATE` takes SQLite's
* write lock up front, which is what makes claims disjoint without
* `SKIP LOCKED`.
*/
/**
* `node:sqlite` prints an ExperimentalWarning the moment it is imported, so it is loaded
* only when a SQLite journal is actually opened; a Postgres host never touches it.
*/
function loadSqlite() {
	return createRequire(import.meta.url)("node:sqlite");
}
/** Serialises access to the one synchronous connection. */
var Mutex = class {
	tail = Promise.resolve();
	run(fn) {
		const result = this.tail.then(fn);
		this.tail = result.catch(() => void 0);
		return result;
	}
};
var SqliteExecutor = class {
	db;
	statements = /* @__PURE__ */ new Map();
	constructor(db) {
		this.db = db;
	}
	async all(sql, params = []) {
		return this.prepare(sql).all(...params);
	}
	async run(sql, params = []) {
		return Number(this.prepare(sql).run(...params).changes);
	}
	async exec(sql) {
		this.db.exec(sql);
	}
	/** No-op: `BEGIN IMMEDIATE` already holds the database's single write lock. */
	async advisoryLock() {}
	prepare(sql) {
		const hit = this.statements.get(sql);
		if (hit !== void 0) return hit;
		const statement = this.db.prepare(sql);
		this.statements.set(sql, statement);
		return statement;
	}
};
/** The SQLite {@link Journal}. Opened by `openJournal("sqlite://…")`. */
var SqliteJournal = class {
	db;
	executor;
	mutex = new Mutex();
	/** Every statement in the executor's cache is finalized once the connection closes. */
	closed = false;
	/** Opens `location` (a path, or `:memory:`) in WAL mode, creating the parent directory. */
	constructor(location) {
		if (location !== ":memory:") mkdirSync(dirname(location), { recursive: true });
		this.db = new (loadSqlite()).DatabaseSync(location);
		this.db.exec("PRAGMA journal_mode = WAL");
		this.db.exec("PRAGMA busy_timeout = 5000");
		this.db.exec("PRAGMA foreign_keys = ON");
		this.executor = new SqliteExecutor(this.db);
	}
	async migrate() {
		await this.inTransaction(async () => {
			await applyMigrations(this.executor, "sqlite", () => this.hasMigrationsTable(), Date.now());
		});
	}
	transaction(fn) {
		return this.inTransaction(() => fn(new JournalTransaction(this.executor, SQLITE)));
	}
	readEvents(runId, sinceSeq) {
		return this.read(() => readEvents(this.executor, runId, sinceSeq));
	}
	getRun(runId) {
		return this.read(() => getRun(this.executor, runId));
	}
	getState(runId) {
		return this.read(() => getState(this.executor, runId));
	}
	getTask(taskId) {
		return this.read(() => getTask(this.executor, taskId));
	}
	listTasks(runId) {
		return this.read(() => listTasks(this.executor, runId));
	}
	query(q) {
		return this.read(() => queryRuns(this.executor, q));
	}
	dueTimers(nowMs, limit) {
		return this.read(() => dueTimers(this.executor, nowMs, limit));
	}
	expiredLeases(nowMs, limit) {
		return this.read(() => expiredLeases(this.executor, nowMs, limit));
	}
	expiredTimeouts(nowMs, limit) {
		return this.read(() => expiredTimeouts(this.executor, nowMs, limit));
	}
	/** Idempotent. Work queued before it still runs; anything after gets `JournalClosed`. */
	async close() {
		await this.mutex.run(async () => {
			if (this.closed) return;
			this.closed = true;
			this.db.close();
		});
	}
	read(fn) {
		return this.mutex.run(async () => {
			this.assertOpen();
			return fn();
		});
	}
	inTransaction(fn) {
		return this.mutex.run(async () => {
			this.assertOpen();
			this.db.exec("BEGIN IMMEDIATE");
			try {
				const result = await fn();
				this.db.exec("COMMIT");
				return result;
			} catch (error) {
				try {
					this.db.exec("ROLLBACK");
				} catch {}
				throw error;
			}
		});
	}
	assertOpen() {
		if (this.closed) throw new JournalClosed("sqlite");
	}
	async hasMigrationsTable() {
		return (await this.executor.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'")).length > 0;
	}
};
//#endregion
//#region src/journal/open.ts
/** Journal selection by URL scheme. */
const SQLITE_PREFIX = "sqlite://";
/**
* Opens a journal by URL: `sqlite://:memory:`, `sqlite://./.vlo/dev.db`,
* `sqlite:///abs/path.db`, `postgres://…` or `postgresql://…`. Nothing is created or
* migrated until `migrate()`. Throws a plain `Error` on any other scheme.
*
* @example
* ```ts
* import { openJournal } from "@vlo/sdk/host";
*
* const journal = openJournal("postgres://user:pass@localhost/app", { schema: "vlo", max: 5 });
* await journal.migrate();
* const run = await journal.getRun("run_1");
* await journal.close();
* ```
*/
function openJournal(url, opts = {}) {
	if (url.startsWith(SQLITE_PREFIX)) return new SqliteJournal(sqliteLocation(url));
	if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return new PostgresJournal(url, opts);
	throw new Error(`unsupported journal url: ${url}`);
}
function sqliteLocation(url) {
	const location = url.slice(9);
	if (location.length === 0) throw new Error(`sqlite journal url has no path: ${url}`);
	return location;
}
//#endregion
//#region src/kernel/protocol.ts
const INLINE_LIMIT_BYTES = 262144;
const START_STEP_ID = "start";
/** Marker step ids the host writes to end a run without calling the reducer. */
const CANCEL_STEP_ID = "cancel";
const FAIL_STEP_ID = "fail";
const NONDETERMINISM_STEP_ID = "nondeterminism";
const CONTINUE_STEP_ID = "continue";
//#endregion
//#region src/kernel/load.ts
/**
* Loads the Rust kernel compiled to wasm and adapts it to the `Kernel` interface.
*
* The wasm exports are JSON string in, JSON string out, so every method here is a
* stringify / call / parse. Instantiation is synchronous (`initSync` over bytes read
* from disk) and memoised: the kernel is stateless, so one instance serves the process.
*/
/**
* `wasm/` sits next to `src/` in the repo and next to `dist/` in the published package,
* so the bytes are one of two places relative to this module. `VLO_KERNEL_WASM` overrides
* both; CI uses it to run the golden fixtures against a freshly built kernel.
*/
const WASM_CANDIDATES = ["../../wasm/vlo_kernel_bg.wasm", "../wasm/vlo_kernel_bg.wasm"];
let loading;
/**
* Loads the wasm kernel once per process and returns the same instance afterwards. Looks for
* `vlo_kernel_bg.wasm` in the package's `wasm/` directory, or at `VLO_KERNEL_WASM`. Rejects
* when the bytes are missing or the kernel speaks a different protocol version.
*/
async function loadKernel() {
	loading ??= instantiate();
	return loading;
}
function readWasmBytes() {
	const override = process.env["VLO_KERNEL_WASM"];
	if (override !== void 0 && override !== "") return readFileSync(override);
	const failures = [];
	for (const candidate of WASM_CANDIDATES) try {
		return readFileSync(new URL(candidate, import.meta.url));
	} catch (error) {
		failures.push(`${candidate}: ${error.message}`);
	}
	throw new Error(`vlo kernel wasm not found; run packages/vlo/scripts/build-kernel.sh\n${failures.join("\n")}`);
}
async function instantiate() {
	const wasm = await import("./vlo_kernel-C5TJTOmG.js");
	wasm.initSync({ module: readWasmBytes() });
	const call = (exported, input) => JSON.parse(exported(JSON.stringify(input)));
	const version = unwrap$1(JSON.parse(wasm.kernel_version()));
	if (version.protocol !== 1) throw new Error(`vlo kernel speaks protocol ${version.protocol}, this SDK speaks 1`);
	return {
		version: () => version,
		validateEvent: (event) => call(wasm.validate_event, event),
		prepareEvent: (input) => call(wasm.prepare_event, input),
		reduceStep: (input) => call(wasm.reduce_step, input),
		stateHash: (input) => call(wasm.compute_state_hash, input),
		planRetry: (input) => call(wasm.plan_retry, input),
		refoldCheck: (input) => call(wasm.refold_check, input),
		deriveIds: (input) => call(wasm.derive_ids, input)
	};
}
function unwrap$1(result) {
	if (!result.ok) throw new Error(`vlo kernel: ${result.error.code}: ${result.error.message}`);
	return result.value;
}
//#endregion
//#region src/host/errors.ts
/**
* Base of every error the host maps to an HTTP response. The router turns one into
* `{ error: { code, message } }` with `status`; anything else is a 500 `internal`.
*/
var VloError = class extends Error {
	/** HTTP status the router answers with. */
	status;
	/** Stable machine-readable code, e.g. `run_not_found`. */
	code;
	/** `name` is set to the concrete subclass name. */
	constructor(code, message, status) {
		super(message);
		this.name = new.target.name;
		this.code = code;
		this.status = status;
	}
};
/** No run with that id. `run_not_found`, 404. */
var RunNotFound = class extends VloError {
	runId;
	/** @param runId The id that was looked up; kept on the error. */
	constructor(runId) {
		super("run_not_found", `no run "${runId}"`, 404);
		this.runId = runId;
	}
};
/** No task with that id. `task_not_found`, 404. */
var TaskNotFound = class extends VloError {
	taskId;
	/** @param taskId The id that was looked up; kept on the error. */
	constructor(taskId) {
		super("task_not_found", `no task "${taskId}"`, 404);
		this.taskId = taskId;
	}
};
/**
* The run already ended, so a non-task event (a signal, say) cannot be applied.
* `run_terminal`, 409. A late task result on an ended run is a duplicate, not this.
*/
var RunTerminal = class extends VloError {
	/** `status` is the terminal status the run is in. */
	constructor(runId, status) {
		super("run_terminal", `run "${runId}" is ${status}; no further events are accepted`, 409);
	}
};
/** The kernel refused the event: a duplicate, a stale attempt or an illegal transition. */
var IllegalEvent = class extends VloError {
	/** The kernel's refusal, verbatim. Its `code` becomes this error's `code`. */
	kernelError;
	/** Code is the kernel's (`unknown_step`, `bad_seq`, `illegal_transition`, …), status 409. */
	constructor(error) {
		super(error.code, error.message, 409);
		this.kernelError = error;
	}
};
/**
* The checkpoint or the re-fold disagreed with the journal. The run is failed first: the
* `nondeterminism` marker it records carries `cause: "nondeterminism_detected"`, which is the
* kernel's `Cause` value and stays as it is. This error's own code is `refold_mismatch`.
*/
var Nondeterminism = class extends VloError {
	runId;
	seq;
	/** `refold_mismatch`, 409. */
	constructor(runId, seq, detail) {
		super("refold_mismatch", `run "${runId}" diverged at seq ${seq}: ${detail}`, 409);
		this.runId = runId;
		this.seq = seq;
	}
};
/**
* The reducer threw, or the host could not honour what it asked for. `applyEvent` swallows
* this and records a `fail` marker with `cause: "app_error"` (the kernel's `Cause` value; this
* error's own code is `reducer_failed`). Also raised when a `spawn` or `continue_as_new`
* names a workflow this host has not registered.
*/
var ReducerFailed = class extends VloError {
	runId;
	trigger;
	/** The reducer's own message, without the folding context; journaled as the `fail` marker's `error`. */
	reason;
	/** `reducer_failed`, 409. Callers of `applyEvent` never see it; the run is failed instead. */
	constructor(runId, message, trigger, reason) {
		super("reducer_failed", message, 409);
		this.runId = runId;
		this.trigger = trigger;
		this.reason = reason ?? message;
	}
};
/** Kernel refusals that mean the step an event named is no longer open. */
const STEP_GONE = /* @__PURE__ */ new Set([
	"unknown_step",
	"illegal_transition",
	"already_terminal"
]);
/**
* True when `error` says the step an event was aimed at is closed for good: the run ended, or
* the kernel refused the event because the step is unknown or past that transition. A timer
* or a signal wait in that state has nothing left to wake, so its row is retired, not retried.
*/
function isStepGone(error) {
	if (error instanceof RunTerminal) return true;
	return error instanceof IllegalEvent && STEP_GONE.has(error.kernelError.code);
}
/** The host was asked to run a workflow it does not have registered. */
var WorkflowRejected = class extends VloError {
	/** `unknown_workflow`, 400. */
	constructor(name) {
		super("unknown_workflow", `no workflow "${name}" is registered on this host`, 400);
	}
};
/** Bearer token or push signature missing or wrong. `unauthorized`, 401. */
var Unauthorized = class extends VloError {
	/** Message defaults to `missing or invalid credentials`. */
	constructor(message = "missing or invalid credentials") {
		super("unauthorized", message, 401);
	}
};
/** Malformed body, query or signal payload. `bad_request`, 400. */
var BadRequest = class extends VloError {
	/** `bad_request`, 400. */
	constructor(message) {
		super("bad_request", message, 400);
	}
};
/** The worker's lease is gone: stop working, someone else owns the attempt. */
var LeaseLost = class extends VloError {
	/** `lease_lost`, 410. */
	constructor(taskId, attempt) {
		super("lease_lost", `task "${taskId}" attempt ${attempt} no longer holds its lease`, 410);
	}
};
//#endregion
//#region src/host/links.ts
/**
* Signed action links: a URL that delivers one named signal to one run, and nothing else.
*
* Same HMAC shape as the push signature (`worker/signature.ts`), with a different binding.
* A push signs "this body, this attempt, now"; a link signs "this run, this signal, until
* then" — because the holder is a person clicking an email hours later, not a peer host.
* The token authorises exactly one `(run, signal)` pair, so leaking it cannot start a run,
* read a journal or signal anything else.
*/
const PREFIX$2 = "v1";
/** How long a minted link stays valid when the request gives no `expires_in_ms`: 7 days. */
const DEFAULT_LINK_TTL_MS = 6048e5;
/**
* The secret signed links are minted with. Falls back to the control-plane token and then
* the push secret so a single-secret deployment gets links for free; `undefined` disables
* them rather than signing with an empty key.
*/
function linkSecret(auth) {
	return auth.linkSecret ?? auth.token ?? auth.pushSecret;
}
/**
* Mints the token for a link: `v1.<expiresAtMs>.<hmac-sha256 hex>`. The host's
* `POST /v1/runs/{id}/links/{name}` route does this for you; call it directly to mint
* links out of band with the same secret ({@link linkSecret}).
*
* @example
* ```ts
* const token = signSignalLink(secret, {
*   runId: "run_1",
*   name: "approve",
*   expiresAtMs: Date.now() + DEFAULT_LINK_TTL_MS,
* });
* verifySignalLink(secret, token, "run_1", "approve", Date.now()); // true
* ```
*/
function signSignalLink(secret, link) {
	const expiresAtMs = Math.floor(link.expiresAtMs);
	return `${PREFIX$2}.${expiresAtMs}.${digest$1(secret, link.runId, link.name, expiresAtMs)}`;
}
/**
* True when `token` was signed with `secret` for exactly this `(runId, name)` and has not
* expired at `nowMs`. Malformed tokens are false, never thrown; the comparison is timing-safe.
*/
function verifySignalLink(secret, token, runId, name, nowMs) {
	const [version, expiry, signature] = token.split(".");
	if (version !== PREFIX$2 || expiry === void 0 || signature === void 0) return false;
	const expiresAtMs = Number(expiry);
	if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs) return false;
	const expected = Buffer.from(digest$1(secret, runId, name, expiresAtMs), "utf8");
	const actual = Buffer.from(signature, "utf8");
	if (expected.length !== actual.length) return false;
	return timingSafeEqual(expected, actual);
}
function digest$1(secret, runId, name, expiresAtMs) {
	return createHmac("sha256", secret).update(`${runId}.${name}.${expiresAtMs}`, "utf8").digest("hex");
}
//#endregion
//#region src/host/api/http.ts
/** Small helpers shared by the routes: JSON in, JSON out, bearer auth, errors. */
function json(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" }
	});
}
function errorResponse(error) {
	if (error instanceof VloError) return json({ error: {
		code: error.code,
		message: error.message
	} }, error.status);
	return json({ error: {
		code: "internal",
		message: error instanceof Error ? error.message : String(error)
	} }, 500);
}
async function readJson(request) {
	const text = await request.text();
	if (text.length === 0) return null;
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new BadRequest(`body is not JSON: ${error instanceof Error ? error.message : error}`);
	}
}
function requireBearer(request, token) {
	if (token === void 0) return;
	if (!constantTimeEquals(request.headers.get("authorization") ?? "", `Bearer ${token}`)) throw new Unauthorized();
}
/** Compares without leaking the match length through timing. Length itself is not secret. */
function constantTimeEquals(actual, expected) {
	const a = Buffer.from(actual, "utf8");
	const b = Buffer.from(expected, "utf8");
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}
function asObject(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new BadRequest("body must be a JSON object");
	return value;
}
function requireString(body, key) {
	const value = body[key];
	if (typeof value !== "string" || value.length === 0) throw new BadRequest(`"${key}" must be a non-empty string`);
	return value;
}
function requireInt(body, key) {
	const value = body[key];
	if (typeof value !== "number" || !Number.isInteger(value)) throw new BadRequest(`"${key}" must be an integer`);
	return value;
}
function optionalInt(body, key) {
	const value = body[key];
	if (value === void 0 || value === null) return void 0;
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new BadRequest(`"${key}" must be a non-negative integer`);
	return value;
}
const CAUSES = /* @__PURE__ */ new Set([
	"timeout",
	"heartbeat_lost",
	"app_error",
	"user_cancel",
	"schema_violation",
	"nondeterminism_detected"
]);
function optionalCause(body) {
	const value = body.cause;
	if (value === void 0 || value === null) return void 0;
	if (typeof value !== "string" || !CAUSES.has(value)) throw new BadRequest(`unknown cause`);
	return value;
}
/** Wire `usage` is snake_case and integral, because the kernel hashes it into run state. */
function optionalUsage(body) {
	const value = body.usage;
	if (value === void 0 || value === null) return void 0;
	const fields = asObject(value);
	return {
		cpu_ms: optionalInt(fields, "cpu_ms") ?? 0,
		tokens: optionalInt(fields, "tokens") ?? 0,
		cost_micro_usd: optionalInt(fields, "cost_micro_usd") ?? 0
	};
}
//#endregion
//#region src/host/api/links.ts
var LinksDisabled = class extends VloError {
	constructor() {
		super("links_disabled", "signed links need auth.linkSecret (or auth.token / auth.pushSecret) on this host", 503);
	}
};
async function postSignalLink(ctx, request, url, runId, name) {
	const secret = linkSecret(ctx.auth);
	if (secret === void 0) throw new LinksDisabled();
	const body = asObject(await readJson(request));
	const expiresAtMs = ctx.now() + (optionalInt(body, "expires_in_ms") ?? 6048e5);
	const token = signSignalLink(secret, {
		runId,
		name,
		expiresAtMs
	});
	return json({
		url: `${`${(ctx.publicUrl ?? url.origin).replace(/\/$/, "")}${ctx.basePath ?? ""}`}${signalPath(runId, name)}?token=${encodeURIComponent(token)}`,
		expires_at_ms: expiresAtMs
	});
}
/** The confirmation page. Deliberately dependency-free: it renders inside a webmail iframe. */
function renderConfirmation(runId, name, token, basePath = "") {
	const action = `${basePath}${signalPath(runId, name)}?token=${encodeURIComponent(token)}`;
	const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Confirm ${escapeHtml(name)}</title>
<body style="font-family:system-ui,sans-serif;margin:0;padding:2rem;max-width:32rem">
<h1 style="font-size:1.25rem">Confirm “${escapeHtml(name)}”</h1>
<p>This sends the <code>${escapeHtml(name)}</code> signal to run <code>${escapeHtml(runId)}</code>.</p>
<form method="post" action="${escapeHtml(action)}">
<button type="submit" style="font:inherit;padding:.6rem 1.2rem">Confirm</button>
</form>
</body>
</html>
`;
	return new Response(html, {
		status: 200,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store"
		}
	});
}
function signalPath(runId, name) {
	return `/v1/runs/${encodeURIComponent(runId)}/signals/${encodeURIComponent(name)}`;
}
function escapeHtml(value) {
	return value.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}
const ENTITIES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
};
//#endregion
//#region src/blob/ref.ts
/** Blob references as they appear in `*_ref` columns. */
const PREFIX$1 = "blob://sha256/";
const SHA256_HEX = /^[0-9a-f]{64}$/;
/** `blob://sha256/<hex>` for a lowercase sha256 digest. Throws a plain `Error` on anything else. */
function toBlobRef(sha256Hex) {
	if (!SHA256_HEX.test(sha256Hex)) throw new Error(`not a sha256 hex digest: ${sha256Hex}`);
	return PREFIX$1 + sha256Hex;
}
/** The digest, or null when `ref` is not a blob reference. */
function parseBlobRef(ref) {
	if (!ref.startsWith(PREFIX$1)) return null;
	const digest = ref.slice(14);
	return SHA256_HEX.test(digest) ? digest : null;
}
//#endregion
//#region src/blob/offload.ts
/**
* The 256 KB rule: JSON text rides inline in the journal while it fits, and
* moves to the blob store otherwise. The journal stores the resulting
* `blob://sha256/<hex>` in the matching `*_ref` column.
*/
const encoder = new TextEncoder();
const decoder = new TextDecoder();
/** A blob reference when `text` is too big to inline, otherwise null. */
async function offloadIfOversized(store, text, limit = INLINE_LIMIT_BYTES) {
	const bytes = encoder.encode(text);
	if (bytes.byteLength <= limit) return null;
	return toBlobRef(await store.put(bytes));
}
/** Reads back what `offloadIfOversized` wrote, byte-exact. */
async function readBlobText(store, ref) {
	const digest = parseBlobRef(ref);
	if (digest === null) throw new Error(`not a blob ref: ${ref}`);
	return decoder.decode(await store.get(digest));
}
//#endregion
//#region src/host/events.ts
/**
* Building the events the host submits, and telling them apart from the ones the kernel
* emits.
*
* The journal holds both. Only *inputs* are re-fed on a re-fold; kernel outputs (a task
* the reducer asked for, a signal wait, the `complete` marker) are recomputed by replaying
* the inputs, so feeding them back would double-count. The partition below mirrors
* `crates/kernel/src/classify.rs`: an event is an input exactly when `classify` routes it.
*/
const INPUT_MARKERS = /* @__PURE__ */ new Set([
	START_STEP_ID,
	CANCEL_STEP_ID,
	FAIL_STEP_ID,
	NONDETERMINISM_STEP_ID
]);
/** 32 lowercase hex characters, journaled so every replay sees the same randomness. */
function randomHex() {
	return randomBytes(16).toString("hex");
}
function isInputEvent(event) {
	switch (event.kind) {
		case "marker": return INPUT_MARKERS.has(event.step_id);
		case "task": return event.status !== "scheduled";
		case "timer":
		case "signal": return event.status === "succeeded";
		case "child": return event.status === "succeeded" || event.status === "failed" || event.status === "cancelled";
	}
}
const ASSIGNED_BY_KERNEL = [
	"seq",
	"state_hash",
	"parent_run_id",
	"parent_step_id"
];
/** Drops the fields the kernel assigns, so a journaled envelope can be re-submitted. */
function toEventInput(envelope) {
	const input = { ...envelope };
	for (const field of ASSIGNED_BY_KERNEL) delete input[field];
	return input;
}
function base(b, rest) {
	return {
		run_id: b.runId,
		ts_ms: b.nowMs,
		random: randomHex(),
		...rest
	};
}
function startedEvent(b, inputJson) {
	return base(b, {
		step_id: START_STEP_ID,
		attempt: 0,
		kind: "marker",
		status: "succeeded",
		payload: inputJson
	});
}
function taskRunningEvent(b, stepId, attempt) {
	return base(b, {
		step_id: stepId,
		attempt,
		kind: "task",
		status: "running"
	});
}
/** What an attempt spent, when the worker reported any. The kernel banks it as it folds. */
function spent(usage) {
	return usage !== void 0 ? { usage } : {};
}
function taskSucceededEvent(b, stepId, attempt, outputJson, schemaRef, usage) {
	return base(b, {
		step_id: stepId,
		attempt,
		kind: "task",
		status: "succeeded",
		payload: outputJson,
		...schemaRef !== void 0 ? { schema_ref: schemaRef } : {},
		...spent(usage)
	});
}
function taskFailedEvent(b, stepId, attempt, cause, error, usage) {
	return base(b, {
		step_id: stepId,
		attempt,
		kind: "task",
		status: "failed",
		cause,
		error,
		...spent(usage)
	});
}
/** `attempt` names the *next* attempt; the payload carries the delay the kernel planned. */
function taskRetryingEvent(b, stepId, nextAttempt, cause, delayMs, error, usage) {
	return base(b, {
		step_id: stepId,
		attempt: nextAttempt,
		kind: "task",
		status: "retrying",
		cause,
		payload: JSON.stringify({ delay_ms: delayMs }),
		...error !== void 0 ? { error } : {},
		...spent(usage)
	});
}
/** A due timer. The kernel reads the deadline from the step, so there is no payload. */
function timerFiredEvent(b, stepId) {
	return base(b, {
		step_id: stepId,
		attempt: 0,
		kind: "timer",
		status: "succeeded"
	});
}
function signalEvent(b, stepId, payloadJson) {
	return base(b, {
		step_id: stepId,
		attempt: 0,
		kind: "signal",
		status: "succeeded",
		payload: payloadJson
	});
}
function childEvent(b, stepId, status, outputJson) {
	return base(b, {
		step_id: stepId,
		attempt: 0,
		kind: "child",
		status,
		...outputJson !== void 0 ? { payload: outputJson } : {}
	});
}
function cancelEvent(b) {
	return base(b, {
		step_id: CANCEL_STEP_ID,
		attempt: 0,
		kind: "marker",
		status: "cancelled",
		cause: "user_cancel"
	});
}
/**
* The reducer threw: `WorkflowFailure` and any other throw both land here. The event being
* folded is rolled back with its transaction, so it rides along in the payload as evidence.
*/
function failEvent(b, message, trigger) {
	return base(b, {
		step_id: FAIL_STEP_ID,
		attempt: 0,
		kind: "marker",
		status: "failed",
		cause: "app_error",
		error: message,
		...trigger !== void 0 ? { payload: JSON.stringify(trigger) } : {}
	});
}
function nondeterminismEvent(b, detail) {
	return base(b, {
		step_id: NONDETERMINISM_STEP_ID,
		attempt: 0,
		kind: "marker",
		status: "failed",
		cause: "nondeterminism_detected",
		error: detail
	});
}
/** A run that accepts no further events. */
function isTerminalRun(status) {
	return isTerminalRunStatus(status);
}
/** A child run's terminal status as the parent's `child` event sees it. */
function childStatusOf(runStatus) {
	switch (runStatus) {
		case "completed": return "succeeded";
		case "failed": return "failed";
		case "cancelled": return "cancelled";
		default: return null;
	}
}
/** Kernel calls are infallible-by-contract; a refusal is an `IllegalEvent` here. */
function unwrap(result) {
	if (result.ok) return result.value;
	throw new IllegalEvent(result.error);
}
/** Codes that mean "this event was already folded", i.e. an at-least-once redelivery. */
const DUPLICATE_CODES = /* @__PURE__ */ new Set([
	"unknown_step",
	"already_terminal",
	"bad_seq"
]);
function isDuplicate(error) {
	return DUPLICATE_CODES.has(error.code);
}
//#endregion
//#region src/host/refold.ts
/**
* One event → one write-set. The reducer runs here and nowhere else. Pure: nothing is
* journaled, the caller applies the returned transition.
*
* @throws {@link ReducerFailed} when the workflow's reducer throws; carries the trigger event.
* @throws {@link IllegalEvent} when the kernel refuses to prepare or reduce the event.
*/
function foldEvent(ctx, workflow, run, at, event) {
	const prepared = unwrap(ctx.kernel.prepareEvent({
		run,
		...at.kernelState !== void 0 ? { kernel_state: at.kernelState } : {},
		...at.state !== void 0 ? { state: at.state } : {},
		event
	}));
	if (prepared.mode === "lifecycle") return prepared.transition;
	let reduction;
	try {
		reduction = workflow.reduce(at.state ?? null, prepared.reducer_event, prepared.init_input);
	} catch (error) {
		const reason = messageOf$1(error);
		throw new ReducerFailed(run.run_id, `${reason} [while folding ${describe(event)}]`, event, reason);
	}
	return unwrap(ctx.kernel.reduceStep({
		run,
		kernel_state: prepared.kernel_state,
		event,
		reduction
	}));
}
function messageOf$1(error) {
	return error instanceof Error ? error.message : String(error);
}
function describe(event) {
	const cause = event.cause !== void 0 ? ` cause=${event.cause}` : "";
	const error = event.error !== void 0 ? ` error=${event.error}` : "";
	return `${event.kind} ${event.step_id}#${event.attempt} ${event.status}${cause}${error}`;
}
/**
* Replays every input event in the journal. Kernel outputs (scheduled tasks, signal waits,
* the `complete` marker) are recomputed, never re-fed.
*
* @throws {@link Nondeterminism} at the first event whose replayed `seq` or `state_hash`
* differs from the journaled one, or when `events` holds nothing foldable.
*/
function rebuildCheckpoint(ctx, workflow, run, events) {
	let at = {};
	let stateHash = "";
	let lastSeq = 0;
	let status = "created";
	for (const envelope of events) {
		if (!isInputEvent(envelope)) continue;
		const transition = foldEvent(ctx, workflow, {
			run_id: run.run_id,
			workflow: run.workflow,
			bundle_digest: run.component_digest,
			status,
			last_seq: lastSeq,
			...run.parent_run_id !== void 0 ? { parent_run_id: run.parent_run_id } : {},
			...run.parent_step_id !== void 0 ? { parent_step_id: run.parent_step_id } : {}
		}, at, toEventInput(envelope));
		const trigger = transition.events[0];
		if (trigger === void 0 || trigger.seq !== envelope.seq) throw new Nondeterminism(run.run_id, envelope.seq, `replay produced seq ${trigger?.seq ?? "none"} for a journaled seq ${envelope.seq}`);
		if (trigger.state_hash !== envelope.state_hash) throw new Nondeterminism(run.run_id, envelope.seq, `state hash ${trigger.state_hash} does not match the journaled ${envelope.state_hash}`);
		at = {
			kernelState: transition.kernel_state,
			state: transition.state
		};
		stateHash = transition.state_hash;
		lastSeq = transition.run.last_seq;
		status = transition.run.status;
	}
	if (at.kernelState === void 0 || at.state === void 0) throw new Nondeterminism(run.run_id, 0, "the journal holds no foldable events for this run");
	return {
		kernelState: at.kernelState,
		state: at.state,
		stateHash,
		seq: lastSeq,
		status
	};
}
//#endregion
//#region src/host/transition.ts
/**
* The single writer path. Every durable change to a run goes through `applyEvent`.
*
* One transaction: take the run's write lock, load the checkpoint, fold the event, apply
* the kernel's write-set. Cross-run effects (starting a child, telling a parent) and HTTP
* pushes stay outside — SQLite serialises transactions through one connection, so holding
* one across a network call would stall the whole host.
*/
/** Markers that end a run. They echo whatever checkpoint exists and never call the reducer. */
const CLOSING_MARKERS = /* @__PURE__ */ new Set([
	CANCEL_STEP_ID,
	FAIL_STEP_ID,
	NONDETERMINISM_STEP_ID
]);
/**
* Submits one event. Owns its transaction, recovers a reducer throw or a divergence into
* the matching marker, then runs the post-commit work (buffered signals, emits, kick).
*
* A `ReducerFailed` is swallowed: the run is failed with an `app_error` marker and that
* outcome is returned. A `Nondeterminism` is recorded as a marker and then rethrown.
*
* @throws {@link RunNotFound} when no run has that id.
* @throws {@link RunTerminal} when the run ended and the event is not a task result or a closing marker.
* @throws {@link WorkflowRejected} when the run's workflow is not registered on this host.
* @throws {@link IllegalEvent} when the kernel refuses the event for a reason other than a duplicate.
* @throws {@link Nondeterminism} after journaling the divergence.
*/
async function applyEvent(ctx, runId, source, after) {
	let outcome;
	try {
		outcome = await ctx.journal.transaction((tx) => runTransition(ctx, tx, runId, source, after));
	} catch (error) {
		if (error instanceof ReducerFailed) return applyEvent(ctx, runId, failEvent({
			runId,
			nowMs: ctx.now()
		}, error.reason, error.trigger));
		if (error instanceof Nondeterminism) {
			await applyEvent(ctx, runId, nondeterminismEvent({
				runId,
				nowMs: ctx.now()
			}, error.message));
			throw error;
		}
		throw error;
	}
	await afterCommit(ctx, runId, outcome);
	return outcome;
}
async function afterCommit(ctx, runId, outcome) {
	for (const emit of outcome.transition?.emits ?? []) ctx.events.emit("emit", {
		run_id: runId,
		channel: emit.channel,
		data: emit.data
	});
	for (const task of outcome.transition?.tasks ?? []) {
		const scheduled = {
			run_id: runId,
			task_id: task.task_id,
			queue: task.queue
		};
		ctx.events.emit("task_scheduled", scheduled);
	}
	for (const followUp of outcome.followUps) await applyEvent(ctx, runId, followUp);
	if (outcome.applied) ctx.kick();
}
async function runTransition(ctx, tx, runId, source, after) {
	const run = await tx.lockRun(runId);
	if (run === null) throw new RunNotFound(runId);
	const event = typeof source === "function" ? await source(tx, run) : source;
	if (event === null) return finish(tx, {
		applied: false,
		duplicate: false,
		run,
		followUps: []
	}, after);
	const closing = event.kind === "marker" && CLOSING_MARKERS.has(event.step_id);
	if (isTerminalRun(run.status)) {
		if (event.kind === "task" || closing) return finish(tx, {
			applied: false,
			duplicate: true,
			run,
			followUps: []
		}, after);
		throw new RunTerminal(runId, run.status);
	}
	const workflow = ctx.workflows.get(run.workflow);
	if (workflow === void 0) throw new WorkflowRejected(run.workflow);
	const at = await loadCheckpoint(ctx, tx, run, workflow, closing);
	let transition;
	try {
		transition = foldEvent(ctx, workflow, runRef(run), at, event);
	} catch (error) {
		if (error instanceof IllegalEvent && isDuplicate(error.kernelError)) return finish(tx, {
			applied: false,
			duplicate: true,
			run,
			followUps: []
		}, after);
		throw error;
	}
	const nowMs = ctx.now();
	const opts = {
		nowMs,
		...await offloadedRefs(ctx, transition),
		childRuns: childRuns(ctx, run, transition),
		...successorRun(ctx, run, transition)
	};
	await tx.applyTransition(runId, transition, opts);
	const followUps = await pickUpBufferedSignals(ctx, tx, runId, transition, nowMs);
	return finish(tx, {
		applied: true,
		duplicate: false,
		run,
		transition,
		followUps
	}, after);
}
async function finish(tx, outcome, after) {
	if (after !== void 0) await after(tx, outcome);
	return outcome;
}
/**
* The checkpoint to fold onto.
*
* Only one checkpoint is kept per run, so the plan's "re-fold the last N events" becomes a
* hash check: re-hashing the stored pair must reproduce the stored `state_hash`. A missing
* checkpoint, or one written by a different bundle, is rebuilt from seq 0 instead.
*/
async function loadCheckpoint(ctx, tx, run, workflow, closing) {
	if (run.last_seq === 0) return {};
	const checkpoint = await tx.getState(run.run_id);
	if (closing) return checkpoint === null ? {} : await readCheckpoint(ctx, checkpoint);
	if (checkpoint === null || checkpoint.bundle_digest !== run.component_digest) {
		const rebuilt = rebuildCheckpoint(ctx, workflow, run, await tx.readEvents(run.run_id, 0));
		return {
			kernelState: rebuilt.kernelState,
			state: rebuilt.state
		};
	}
	const at = await readCheckpoint(ctx, checkpoint);
	if (at.kernelState === void 0 || at.state === void 0) throw new Nondeterminism(run.run_id, checkpoint.seq, "the checkpoint has no body");
	const hash = ctx.kernel.stateHash({
		kernel_state: at.kernelState,
		state: at.state
	});
	if (!hash.ok || hash.value.hash !== checkpoint.state_hash) throw new Nondeterminism(run.run_id, checkpoint.seq, `the checkpoint hashes to ${hash.ok ? hash.value.hash : hash.error.code}, not the stored ${checkpoint.state_hash}`);
	return at;
}
async function readCheckpoint(ctx, row) {
	const state = row.state ?? (row.state_ref ? await readBlobText(ctx.blob, row.state_ref) : void 0);
	return {
		kernelState: JSON.parse(row.kernel_state),
		...state !== void 0 ? { state } : {}
	};
}
async function offloadedRefs(ctx, t) {
	const refs = {};
	if (!t.state_inline) {
		const ref = await offloadIfOversized(ctx.blob, t.state);
		if (ref !== null) refs.stateRef = ref;
	}
	if (t.completion?.output !== void 0) {
		const ref = await offloadIfOversized(ctx.blob, JSON.stringify(t.completion.output));
		if (ref !== null) refs.outputRef = ref;
	}
	return refs;
}
/** Child runs land as `created` rows; the outbox starts them in their own transaction. */
function childRuns(ctx, run, t) {
	return t.spawns.map((spawn) => {
		const child = ctx.workflows.get(spawn.workflow);
		if (child === void 0) throw new ReducerFailed(run.run_id, `cannot spawn "${spawn.workflow}": no such workflow is registered on this host`);
		return {
			run_id: spawn.child_run_id,
			namespace: run.namespace,
			workflow: spawn.workflow,
			component_digest: child.digest,
			status: "created",
			parent_run_id: run.run_id,
			parent_step_id: spawn.step_id,
			input: JSON.stringify(spawn.input)
		};
	});
}
/**
* The successor of a `continue_as_new`, as a `created` row the outbox will start. Its id is
* derived from the `continue` step, so re-deriving it lands on the same row (`ON CONFLICT DO
* NOTHING`). It inherits the parent link: whichever run in the chain finally closes is the
* one that tells the parent, and a `continued` run never does.
*/
function successorRun(ctx, run, t) {
	if (t.continue_as_new === void 0) return {};
	const workflow = ctx.workflows.get(run.workflow);
	if (workflow === void 0) throw new ReducerFailed(run.run_id, `cannot continue "${run.workflow}": no such workflow is registered on this host`);
	return { successorRun: {
		run_id: unwrap(ctx.kernel.deriveIds({
			run_id: run.run_id,
			step_id: CONTINUE_STEP_ID,
			attempt: 0
		})).child_run_id,
		namespace: run.namespace,
		workflow: run.workflow,
		component_digest: workflow.digest,
		status: "created",
		continued_from: run.run_id,
		input: JSON.stringify(t.continue_as_new.input),
		search: run.search,
		...run.parent_run_id !== void 0 ? { parent_run_id: run.parent_run_id } : {},
		...run.parent_step_id !== void 0 ? { parent_step_id: run.parent_step_id } : {}
	} };
}
/** A signal that arrived before anyone waited for it is delivered as soon as a wait opens. */
async function pickUpBufferedSignals(ctx, tx, runId, t, nowMs) {
	const followUps = [];
	for (const wait of t.signal_waits) {
		const buffered = await tx.takeSignal(runId, wait.name);
		if (buffered === null) continue;
		await tx.markSignalDelivered(buffered.signal_id, wait.step_id, nowMs);
		await tx.removeSignalWait(runId, wait.step_id);
		followUps.push(signalEvent({
			runId,
			nowMs
		}, wait.step_id, await signalPayload(ctx, buffered)));
	}
	return followUps;
}
async function signalPayload(ctx, row) {
	if (row.payload !== void 0) return row.payload;
	if (row.payload_ref !== void 0) return readBlobText(ctx.blob, row.payload_ref);
	return "null";
}
/** The run identity the kernel folds against, taken from its row. */
function runRef(run) {
	return {
		run_id: run.run_id,
		workflow: run.workflow,
		bundle_digest: run.component_digest,
		status: run.status,
		last_seq: run.last_seq,
		...run.parent_run_id !== void 0 ? { parent_run_id: run.parent_run_id } : {},
		...run.parent_step_id !== void 0 ? { parent_step_id: run.parent_step_id } : {}
	};
}
//#endregion
//#region src/host/task-dispatch.ts
/**
* The accept path a task takes on its way to a worker, shared by the two ways it can
* leave the journal: the dispatcher pushing it, and a poller claiming it.
*
* Both do the same two things in the same order — build the push body, then commit
* `task/running` together with the lease — so a pulled task is indistinguishable from a
* pushed one to the kernel, the reaper and crash recovery.
*/
async function toPushedTask(ctx, task) {
	const inputJson = await inlineOrBlob(ctx, task.input, task.input_ref) ?? "null";
	const completeUrl = ctx.publicUrl === void 0 ? void 0 : `${ctx.publicUrl}${ctx.basePath ?? ""}/v1/tasks/${encodeURIComponent(task.task_id)}`;
	return {
		task_id: task.task_id,
		run_id: task.run_id,
		step_id: task.step_id,
		attempt: task.attempt,
		activity: {
			name: task.activity,
			...task.schema_ref !== void 0 ? { schema_ref: task.schema_ref } : {}
		},
		idempotency_key: task.idempotency_key,
		input: JSON.parse(inputJson),
		lease_ms: task.lease_ttl_ms,
		heartbeat_ms: Math.max(1e3, Math.floor(task.lease_ttl_ms / 3)),
		...task.timeout_ms !== void 0 ? { timeout_ms: task.timeout_ms } : {},
		...completeUrl !== void 0 ? { complete_url: completeUrl } : {}
	};
}
/** Records the dispatch: the `running` event and the lease commit together or not at all. */
async function markTaskRunning(ctx, task, workerId) {
	const nowMs = ctx.now();
	await applyEvent(ctx, task.run_id, taskRunningEvent({
		runId: task.run_id,
		nowMs
	}, task.step_id, task.attempt), async (tx) => {
		await tx.markDispatched(task.task_id, task.attempt, nowMs, nowMs + task.lease_ttl_ms, workerId);
	});
}
/** A payload column: inline text, or the blob it was offloaded to. */
async function inlineOrBlob(ctx, inline, ref) {
	if (inline !== void 0) return inline;
	if (ref !== void 0) return readBlobText(ctx.blob, ref);
}
//#endregion
//#region src/host/api/poll.ts
const MAX_WAIT_MS = 25e3;
const MAX_TASKS = 10;
const RECHECK_MS = 500;
/** A claim only has to outlive the accept below; the lease takes over from there. */
const CLAIM_HOLD_MS = 3e4;
async function postPoll(ctx, request) {
	const body = asObject(await readJson(request));
	return json({ tasks: await pollQueue(ctx, {
		queue: requireString(body, "queue"),
		workerId: requireString(body, "worker_id"),
		waitMs: bounded(body.wait_ms, 0, MAX_WAIT_MS),
		max: bounded(body.max, 1, MAX_TASKS)
	}) });
}
async function pollQueue(ctx, o) {
	const deadline = Date.now() + o.waitMs;
	for (;;) {
		const accepted = await accept(ctx, await ctx.journal.transaction((tx) => tx.claimUndispatchedTasks(ctx.now(), o.max, CLAIM_HOLD_MS, { queue: o.queue })), o.workerId);
		if (accepted.length > 0) return accepted;
		const remaining = deadline - Date.now();
		if (remaining <= 0) return [];
		await waitForWork(ctx, o.queue, Math.min(remaining, RECHECK_MS));
	}
}
/**
* Records each claimed task as running before handing it over, exactly as a push does.
* A task whose accept fails is left claimed; the hold lapses and it comes back.
*/
async function accept(ctx, tasks, workerId) {
	const accepted = [];
	for (const task of tasks) try {
		const pushed = await toPushedTask(ctx, task);
		await markTaskRunning(ctx, task, workerId);
		accepted.push(pushed);
	} catch (error) {
		ctx.events.emit("warning", {
			message: `could not hand out task ${task.task_id}`,
			error
		});
	}
	return accepted;
}
/** Resolves on the timeout, or as soon as this process commits a task for the queue. */
function waitForWork(ctx, queue, timeoutMs) {
	return new Promise((resolve) => {
		const done = () => {
			clearTimeout(timer);
			ctx.events.off("task_scheduled", onScheduled);
			resolve();
		};
		const onScheduled = (message) => {
			if (message.queue === queue) done();
		};
		const timer = setTimeout(done, timeoutMs);
		timer.unref();
		ctx.events.on("task_scheduled", onScheduled);
	});
}
function bounded(value, min, max) {
	if (typeof value !== "number" || !Number.isFinite(value)) return min;
	return Math.min(Math.max(Math.floor(value), min), max);
}
//#endregion
//#region src/host/runs.ts
/**
* Run-level operations behind the API: start, signal, cancel, read.
*
* `startRun` only writes a `created` row. The `started` event is folded by the dispatcher's
* start-runs stage, so there is exactly one code path into a run's first transition and a
* crash between "row written" and "run started" is recovered by the outbox rather than lost.
*/
/**
* Writes a `created` run row and kicks the dispatcher; the `started` event is folded by the
* outbox. Idempotent on `runId`. Runs on a host with the `api` role.
*
* @throws {@link WorkflowRejected} when the workflow is not registered.
*/
async function startRun(ctx, opts) {
	const workflow = ctx.workflows.get(opts.workflow);
	if (workflow === void 0) throw new WorkflowRejected(opts.workflow);
	const runId = opts.runId ?? `run_${randomHex()}`;
	await ctx.journal.transaction((tx) => tx.createRun({
		run_id: runId,
		namespace: opts.namespace ?? ctx.namespace,
		workflow: workflow.name,
		component_digest: workflow.digest,
		status: "created",
		input: JSON.stringify(opts.input ?? null),
		...opts.search !== void 0 ? { search: opts.search } : {}
	}, ctx.now()));
	ctx.kick();
	return { run_id: runId };
}
/**
* Stores a signal and, when the run is waiting on that name, delivers it in the same
* transaction. Validated against the registered signal schema when there is one. Never
* answers 409 for an ended run: the signal is stored and reported as not delivered.
*
* @throws {@link BadRequest} when the payload fails the schema.
* @throws {@link RunNotFound} when no run has that id.
*/
async function signalRun(ctx, runId, name, payload) {
	const definition = ctx.signals.get(name);
	let value = payload;
	if (definition !== void 0) {
		const parsed = definition.schema.safeParse(payload);
		if (!parsed.success) throw new BadRequest(`signal "${name}" payload is invalid: ${parsed.error.message}`);
		value = parsed.data;
	}
	const row = {
		signal_id: `sig_${randomHex()}`,
		run_id: runId,
		name,
		payload: JSON.stringify(value ?? null)
	};
	let matched;
	try {
		const outcome = await applyEvent(ctx, runId, async (tx) => {
			const nowMs = ctx.now();
			await tx.putSignal(row, nowMs);
			const wait = (await tx.getSignalWaits(runId)).find((w) => w.name === name);
			if (wait === void 0) return null;
			matched = wait.step_id;
			await tx.markSignalDelivered(row.signal_id, wait.step_id, nowMs);
			await tx.removeSignalWait(runId, wait.step_id);
			return signalEvent({
				runId,
				nowMs
			}, wait.step_id, row.payload ?? "null");
		});
		return {
			signal_id: row.signal_id,
			delivered: outcome.applied
		};
	} catch (error) {
		if (matched === void 0 || !isStepGone(error)) throw error;
		await recordLateSignal(ctx, row, matched);
		return {
			signal_id: row.signal_id,
			delivered: false
		};
	}
}
function recordLateSignal(ctx, row, stepId) {
	return ctx.journal.transaction(async (tx) => {
		const nowMs = ctx.now();
		await tx.putSignal(row, nowMs);
		await tx.markSignalDelivered(row.signal_id, stepId, nowMs);
		await tx.removeSignalWait(row.run_id, stepId);
	});
}
/**
* Folds a `cancel` marker and returns the run. Cancelling an ended run is a no-op that
* still returns the view.
*
* @throws {@link RunNotFound} when no run has that id.
*/
async function cancelRun(ctx, runId) {
	await applyEvent(ctx, runId, cancelEvent({
		runId,
		nowMs: ctx.now()
	}));
	return getRunView(ctx, runId);
}
/**
* Reads one run, inlining an offloaded output.
*
* @throws {@link RunNotFound} when no run has that id.
*/
async function getRunView(ctx, runId) {
	const row = await ctx.journal.getRun(runId);
	if (row === null) throw new RunNotFound(runId);
	return toView(ctx, row);
}
/** Lists runs in the host's namespace unless `query.namespace` says otherwise. */
async function listRuns(ctx, query) {
	const rows = await ctx.journal.query({
		namespace: ctx.namespace,
		...query
	});
	return Promise.all(rows.map((row) => toView(ctx, row)));
}
/** Journaled events with `seq > sinceSeq`, ascending. Empty for an unknown run. */
function readRunEvents(ctx, runId, sinceSeq) {
	return ctx.journal.readEvents(runId, sinceSeq);
}
async function toView(ctx, row) {
	const outputJson = row.output ?? (row.output_ref !== void 0 ? await readBlobText(ctx.blob, row.output_ref) : void 0);
	const failure = row.status === "failed" ? await failureOf(ctx, row) : {};
	return {
		run_id: row.run_id,
		workflow: row.workflow,
		status: row.status,
		last_seq: row.last_seq,
		search: row.search,
		created_at_ms: row.created_at_ms,
		updated_at_ms: row.updated_at_ms,
		...row.started_at_ms !== void 0 ? { started_at_ms: row.started_at_ms } : {},
		...row.closed_at_ms !== void 0 ? { closed_at_ms: row.closed_at_ms } : {},
		...row.parent_run_id !== void 0 ? { parent_run_id: row.parent_run_id } : {},
		...row.continued_from !== void 0 ? { continued_from: row.continued_from } : {},
		...row.continued_to !== void 0 ? { continued_to: row.continued_to } : {},
		...outputJson !== void 0 ? { output: JSON.parse(outputJson) } : {},
		...failure
	};
}
/**
* A failed run's last event is its closing marker (`fail` or `nondeterminism`), so one
* read of `seq > last_seq - 1` gives the reason. Live runs never pay for it.
*/
async function failureOf(ctx, row) {
	const [last] = await ctx.journal.readEvents(row.run_id, Math.max(0, row.last_seq - 1));
	if (last === void 0 || last.kind !== "marker" || last.error === void 0) return {};
	return {
		error: last.error,
		...last.cause !== void 0 ? { cause: last.cause } : {}
	};
}
//#endregion
//#region src/host/api/runs.ts
async function createRun(ctx, request) {
	const body = asObject(await readJson(request));
	return json(await startRun(ctx, {
		workflow: requireString(body, "workflow"),
		input: body.input ?? null,
		...typeof body.run_id === "string" ? { runId: body.run_id } : {},
		...isRecord(body.search) ? { search: body.search } : {}
	}), 201);
}
async function showRun(ctx, runId) {
	return json(await getRunView(ctx, runId));
}
async function showEvents(ctx, runId, url) {
	const since = Number(url.searchParams.get("since") ?? 0);
	return json(await readRunEvents(ctx, runId, Number.isFinite(since) ? since : 0));
}
async function postSignal(ctx, runId, name, request) {
	return json(await signalRun(ctx, runId, name, await readJson(request)));
}
async function postCancel(ctx, runId) {
	return json(await cancelRun(ctx, runId));
}
async function indexRuns(ctx, url) {
	const status = url.searchParams.get("status");
	const workflow = url.searchParams.get("workflow");
	const limit = Number(url.searchParams.get("limit") ?? 50);
	return json(await listRuns(ctx, {
		...status !== null ? { status } : {},
		...workflow !== null ? { workflow } : {},
		...Number.isInteger(limit) && limit > 0 ? { limit } : {}
	}));
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region src/host/api/stream.ts
const KEEPALIVE_MS = 15e3;
async function streamRunEvents(ctx, runId, url, request) {
	if (await ctx.journal.getRun(runId) === null) throw new RunNotFound(runId);
	const since = sinceOf(url, request.headers);
	const encoder = new TextEncoder();
	const stream = new ReadableStream({ start(controller) {
		let open = true;
		const send = (frame) => {
			if (!open) return;
			try {
				controller.enqueue(encoder.encode(frame));
			} catch {
				open = false;
			}
		};
		const onEmit = (message) => {
			if (message.run_id !== runId) return;
			send(frame("emit", JSON.stringify({
				channel: message.channel,
				data: message.data
			})));
		};
		ctx.events.on("emit", onEmit);
		const keepalive = setInterval(() => send(": keepalive\n\n"), KEEPALIVE_MS);
		keepalive.unref();
		const finish = () => {
			if (!open) return;
			open = false;
			clearInterval(keepalive);
			ctx.events.off("emit", onEmit);
			try {
				controller.close();
			} catch {}
		};
		request.signal.addEventListener("abort", finish, { once: true });
		tail(ctx, runId, since, send, () => open).finally(finish);
	} });
	return new Response(stream, { headers: {
		"content-type": "text/event-stream; charset=utf-8",
		"cache-control": "no-cache, no-transform",
		connection: "keep-alive",
		"x-accel-buffering": "no"
	} });
}
/** Replays from `since`, then follows the journal until the run is terminal. */
async function tail(ctx, runId, since, send, open) {
	let lastSeq = since;
	for (;;) {
		const events = await ctx.journal.readEvents(runId, lastSeq);
		for (const envelope of events) {
			send(frame("journal", JSON.stringify(envelope), envelope.seq));
			lastSeq = envelope.seq;
		}
		if (!open()) return;
		const run = await ctx.journal.getRun(runId);
		if (run !== null && isTerminalRun(run.status) && run.last_seq <= lastSeq) {
			send(frame("end", JSON.stringify(await getRunView(ctx, runId))));
			return;
		}
		await sleep(ctx.streamPollMs);
		if (!open()) return;
	}
}
function frame(event, data, id) {
	return `${id === void 0 ? "" : `id: ${id}\n`}event: ${event}\ndata: ${data}\n\n`;
}
/** `?since` wins over `Last-Event-ID`, so an explicit replay beats a reconnect. */
function sinceOf(url, headers) {
	const explicit = Number(url.searchParams.get("since"));
	if (Number.isFinite(explicit) && explicit > 0) return explicit;
	const resumed = Number(headers.get("last-event-id"));
	return Number.isFinite(resumed) && resumed > 0 ? resumed : 0;
}
function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms).unref();
	});
}
/** True when the caller asked for a stream rather than the JSON array. */
function wantsStream(request, url) {
	if (url.searchParams.get("stream") === "1") return true;
	return (request.headers.get("accept") ?? "").includes("text/event-stream");
}
//#endregion
//#region src/host/worker/complete.ts
const DUPLICATE = { duplicate: true };
const APPLIED = { duplicate: false };
const TERMINAL_TASK = /* @__PURE__ */ new Set([
	"succeeded",
	"failed",
	"cancelled"
]);
/**
* Records an attempt's output. Validated against the registered activity's output schema
* when there is one; a violation fails the attempt with `schema_violation` and no retry.
* The first terminal result for an attempt wins; later ones return `duplicate: true`.
*
* @throws {@link TaskNotFound} when no task has that id.
*/
async function completeTask(ctx, taskId, attempt, output, usage) {
	const task = await liveTask(ctx, taskId, attempt);
	if (task === null) return DUPLICATE;
	const activity = ctx.activities.get(task.activity);
	if (activity === void 0) return submit(ctx, task, JSON.stringify(output ?? null), usage);
	const parsed = activity.output.safeParse(output);
	if (!parsed.success) return failValidation(ctx, task, issuesOf(parsed.error.issues), usage);
	return submit(ctx, task, JSON.stringify(parsed.data ?? null), usage);
}
/**
* Records an attempt's failure: a `retrying` event when `retryable` and the kernel's retry
* plan allows another attempt, otherwise a `failed` event. The first terminal result for an
* attempt wins; later ones return `duplicate: true`.
*
* `cause` names who lost the attempt: the handler by default, the reaper on a dead lease.
* `usage` is banked whichever way the attempt ends — tokens burned before a throw are spent.
*
* @throws {@link TaskNotFound} when no task has that id.
*/
async function failTask(ctx, taskId, attempt, error, retryable = true, cause = "app_error", usage) {
	const task = await liveTask(ctx, taskId, attempt);
	if (task === null) return DUPLICATE;
	const nowMs = ctx.now();
	const base = {
		runId: task.run_id,
		nowMs
	};
	if (retryable) {
		const plan = ctx.kernel.planRetry({
			policy: task.retry_policy,
			attempt,
			cause,
			random: randomHex()
		});
		if (plan.ok && plan.value.retry) {
			await applyEvent(ctx, task.run_id, taskRetryingEvent(base, task.step_id, plan.value.next_attempt, cause, plan.value.delay_ms, error, usage));
			return APPLIED;
		}
	}
	await applyEvent(ctx, task.run_id, taskFailedEvent(base, task.step_id, attempt, cause, error, usage));
	return APPLIED;
}
/**
* Extends the attempt's lease by the task's `lease_ttl_ms` from now.
*
* @throws {@link TaskNotFound} when no task has that id.
* @throws {@link LeaseLost} when the task is not running at that attempt any more.
*/
async function heartbeatTask(ctx, taskId, attempt) {
	const task = await ctx.journal.getTask(taskId);
	if (task === null) throw new TaskNotFound(taskId);
	const nowMs = ctx.now();
	if (!await ctx.journal.transaction((tx) => tx.heartbeat(taskId, attempt, nowMs + task.lease_ttl_ms, nowMs))) throw new LeaseLost(taskId, attempt);
}
/** The task row when this attempt may still produce a result, else null (a redelivery). */
async function liveTask(ctx, taskId, attempt) {
	const task = await ctx.journal.getTask(taskId);
	if (task === null) throw new TaskNotFound(taskId);
	if (task.attempt !== attempt || TERMINAL_TASK.has(task.status)) return null;
	return task;
}
function submit(ctx, task, outputJson, usage) {
	const event = taskSucceededEvent({
		runId: task.run_id,
		nowMs: ctx.now()
	}, task.step_id, task.attempt, outputJson, task.schema_ref, usage);
	return applyEvent(ctx, task.run_id, event).then(() => APPLIED);
}
/** A schema violation is the worker's fault, not a flake: the kernel never retries it. */
async function failValidation(ctx, task, detail, usage) {
	await applyEvent(ctx, task.run_id, taskFailedEvent({
		runId: task.run_id,
		nowMs: ctx.now()
	}, task.step_id, task.attempt, "schema_violation", `activity "${task.activity}" returned an invalid output: ${detail}`, usage));
	return APPLIED;
}
function issuesOf(issues) {
	return issues.map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`).join("; ");
}
//#endregion
//#region src/host/worker/handle-task.ts
/**
* Runs one pushed task on a worker and reports exactly one terminal result. Heartbeats every
* `heartbeat_ms`; a refused heartbeat, `timeout_ms` elapsing or `options.signal` aborting
* all abort the handler's `ctx.signal`. A handler throw is reported as a retryable failure;
* a missing handler as a non-retryable one. Resolves once the result was reported, and
* rejects only when the reporter itself fails.
*/
async function handleTask(worker, task, reporter, options = {}) {
	const handler = worker.handlers.get(task.activity.name);
	if (handler === void 0) {
		await reporter.fail(task.task_id, task.attempt, `no handler for activity "${task.activity.name}"`, false);
		return;
	}
	const spend = usageTally();
	const controller = new AbortController();
	const stop = () => controller.abort();
	options.signal?.addEventListener("abort", stop, { once: true });
	let reported = false;
	/** The first terminal result wins; anything later is a loser of the race. */
	const report = (send) => {
		if (reported) return Promise.resolve();
		reported = true;
		return send();
	};
	const heartbeat = () => reporter.heartbeat(task.task_id, task.attempt);
	const beat = task.heartbeat_ms > 0 ? setInterval(() => {
		heartbeat().catch(stop);
	}, task.heartbeat_ms) : void 0;
	beat?.unref();
	const finished = (async () => {
		try {
			const output = await handler(task.input, {
				taskId: task.task_id,
				runId: task.run_id,
				attempt: task.attempt,
				heartbeat,
				reportUsage: spend.add,
				signal: controller.signal
			});
			await report(() => reporter.complete(task.task_id, task.attempt, output, spend.total()));
		} catch (error) {
			await report(() => reporter.fail(task.task_id, task.attempt, messageOf(error), true, spend.total()));
		}
	})();
	try {
		await raceTimeout(finished, task.timeout_ms, async () => {
			stop();
			await report(() => reporter.fail(task.task_id, task.attempt, `activity "${task.activity.name}" timed out after ${String(task.timeout_ms)} ms`, true, spend.total(), "timeout"));
		});
	} finally {
		if (beat !== void 0) clearInterval(beat);
		options.signal?.removeEventListener("abort", stop);
	}
}
/**
* Resolves on whichever comes first: the handler settling, or the timeout reporting. A
* handler that ignores `ctx.signal` keeps running, but it no longer owns the attempt.
*/
function raceTimeout(finished, timeoutMs, onTimeout) {
	if (timeoutMs === void 0 || timeoutMs <= 0) return finished;
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			onTimeout().then(resolve, reject);
		}, timeoutMs);
		timer.unref();
		finished.then(() => {
			clearTimeout(timer);
			resolve();
		}, (error) => {
			clearTimeout(timer);
			reject(error instanceof Error ? error : new Error(String(error)));
		});
	});
}
function usageTally() {
	const total = {
		cpu_ms: 0,
		tokens: 0,
		cost_micro_usd: 0
	};
	let touched = false;
	return {
		add(usage) {
			touched = true;
			total.cpu_ms += whole(usage.cpuMs);
			total.tokens += whole(usage.tokens);
			total.cost_micro_usd += whole(usage.costMicroUsd);
		},
		total: () => touched ? { ...total } : void 0
	};
}
/** `Usage` is hashed into the kernel state, so it is integers only and never negative. */
function whole(value) {
	if (value === void 0 || !Number.isFinite(value)) return 0;
	return Math.max(0, Math.trunc(value));
}
function messageOf(error) {
	if (error instanceof Error) return error.message;
	return String(error);
}
//#endregion
//#region src/host/worker/reporters.ts
/** Reports straight into this host's journal via {@link completeTask}, {@link failTask} and {@link heartbeatTask}. */
function localReporter(ctx) {
	return {
		async complete(taskId, attempt, output, usage) {
			await completeTask(ctx, taskId, attempt, output, usage);
		},
		async fail(taskId, attempt, error, retryable, usage, cause) {
			await failTask(ctx, taskId, attempt, error, retryable, cause ?? "app_error", usage);
		},
		heartbeat: (taskId, attempt) => heartbeatTask(ctx, taskId, attempt)
	};
}
/**
* Reports over HTTP to the host that owns the task. `completeUrl` is the task's base URL
* (`…/v1/tasks/{id}`); the three verbs hang off it. Each call has a 10 s timeout and throws
* a plain `Error` on a non-2xx answer, which for `heartbeat` is how a lost lease surfaces.
*/
function remoteReporter(completeUrl, token, fetchImpl = globalThis.fetch) {
	const post = async (verb, body) => {
		const response = await fetchImpl(`${completeUrl}/${verb}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...token !== void 0 ? { authorization: `Bearer ${token}` } : {}
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(1e4)
		});
		if (!response.ok) throw new Error(`task ${verb} failed: ${response.status} ${await response.text()}`);
	};
	return {
		complete: (_taskId, attempt, output, usage) => post("complete", {
			attempt,
			output,
			...usage !== void 0 ? { usage } : {}
		}),
		fail: (_taskId, attempt, error, retryable, usage, cause) => post("fail", {
			attempt,
			error,
			retryable,
			...usage !== void 0 ? { usage } : {},
			...cause !== void 0 ? { cause } : {}
		}),
		heartbeat: (_taskId, attempt) => post("heartbeat", { attempt })
	};
}
//#endregion
//#region src/host/worker/signature.ts
/**
* Push signatures. Same shape as the repo's Zernio webhook verifier: HMAC-SHA256, hex,
* compared timing-safe — but the signed string binds the task and a timestamp as well as
* the body, so a captured push cannot be replayed onto a different attempt or an hour later.
*/
/** Header carrying the pushed task's id. */
const TASK_ID_HEADER = "vlo-task-id";
/** Header carrying the attempt number. */
const ATTEMPT_HEADER = "vlo-attempt";
/** Header carrying the signing time, epoch milliseconds. */
const TIMESTAMP_HEADER = "vlo-timestamp";
/** Header carrying the signature, `v1=<hex>`. */
const SIGNATURE_HEADER = "vlo-signature";
const PREFIX = "v1=";
const WINDOW_MS = 3e5;
function digest(secret, taskId, attempt, tsMs, body) {
	const bodyHash = createHash("sha256").update(body, "utf8").digest("hex");
	return createHmac("sha256", secret).update(`${taskId}.${attempt}.${tsMs}.${bodyHash}`, "utf8").digest("hex");
}
/**
* Signs a push: `v1=` + HMAC-SHA256 over `taskId.attempt.tsMs.sha256(body)`, hex. The
* dispatcher's HTTP transport calls this; a custom transport signs the same way.
*/
function signPush(secret, taskId, attempt, tsMs, body) {
	return PREFIX + digest(secret, taskId, attempt, tsMs, body);
}
/**
* True when the `vlo-*` headers sign `rawBody` with `secret` and the timestamp is within
* 5 minutes of `nowMs` (default `Date.now()`). Missing or malformed headers are false, never
* thrown; the comparison is timing-safe.
*/
function verifySignature(secret, headers, rawBody, nowMs = Date.now()) {
	const taskId = headers.get(TASK_ID_HEADER);
	const attempt = Number(headers.get(ATTEMPT_HEADER));
	const tsMs = Number(headers.get(TIMESTAMP_HEADER));
	const signature = headers.get(SIGNATURE_HEADER);
	if (taskId === null || signature === null) return false;
	if (!Number.isInteger(attempt) || !Number.isFinite(tsMs)) return false;
	if (Math.abs(nowMs - tsMs) > WINDOW_MS) return false;
	const expected = Buffer.from(signPush(secret, taskId, attempt, tsMs, rawBody), "utf8");
	const actual = Buffer.from(signature, "utf8");
	if (expected.length !== actual.length) return false;
	return timingSafeEqual(expected, actual);
}
//#endregion
//#region src/host/api/tasks.ts
async function postComplete(ctx, taskId, request) {
	const body = asObject(await readJson(request));
	return json(await completeTask(ctx, taskId, requireInt(body, "attempt"), body.output ?? null, optionalUsage(body)));
}
async function postFail(ctx, taskId, request) {
	const body = asObject(await readJson(request));
	return json(await failTask(ctx, taskId, requireInt(body, "attempt"), requireString(body, "error"), body.retryable !== false, optionalCause(body) ?? "app_error", optionalUsage(body)));
}
async function postHeartbeat(ctx, taskId, request) {
	await heartbeatTask(ctx, taskId, requireInt(asObject(await readJson(request)), "attempt"));
	return json({ ok: true });
}
/**
* Inbound push. Answers 202 and runs the handler afterwards: the pusher is recording the
* dispatch while this returns, and holding the connection open for the whole task would
* put the lease and the socket timeout in competition.
*/
async function postPush(ctx, request, inFlight) {
	const secret = ctx.auth.pushSecret;
	if (secret === void 0) return json({ error: {
		code: "no_push_secret",
		message: "this host accepts no pushes"
	} }, 503);
	const raw = await request.text();
	if (!verifySignature(secret, request.headers, raw, ctx.now())) throw new Unauthorized();
	const task = JSON.parse(raw);
	const worker = workerFor(ctx, task.activity.name);
	if (worker === void 0) return json({ error: {
		code: "no_handler",
		message: `no worker serves "${task.activity.name}"`
	} }, 404);
	if (inFlight.has(task.idempotency_key)) return json({ duplicate: true }, 409);
	const reporter = task.complete_url !== void 0 ? remoteReporter(task.complete_url, ctx.auth.callbackToken ?? ctx.auth.token) : localReporter(ctx);
	inFlight.add(task.idempotency_key);
	setImmediate(() => {
		handleTask(worker, task, reporter).finally(() => inFlight.delete(task.idempotency_key));
	});
	return new Response(null, { status: 202 });
}
function workerFor(ctx, activity) {
	return ctx.workers.find((w) => w.handlers.has(activity) && w.queues.some((q) => ctx.roles.has(`worker:${q}`)));
}
//#endregion
//#region src/host/api/router.ts
var NotServed = class extends VloError {
	constructor(role) {
		super("role_not_served", `this host does not hold the "${role}" role`, 404);
	}
};
var NoRoute = class extends VloError {
	constructor(method, path) {
		super("no_route", `${method} ${path} is not a route`, 404);
	}
};
/** `"api/vlo"`, `"/api/vlo/"` and `"/api/vlo"` all normalise to `"/api/vlo"`; `""` to none. */
function normalizeBasePath(value) {
	if (value === void 0) return void 0;
	const trimmed = value.replace(/^\/+/, "").replace(/\/+$/, "");
	return trimmed.length === 0 ? void 0 : `/${trimmed}`;
}
/**
* Builds the `/v1` router for a context. Every {@link VloError} becomes a JSON error response
* with its status; anything else is a 500. Routes a role is not held for answer 404
* `role_not_served`. `createHost` calls this; only custom hosts need it directly.
*/
function createRouter(ctx) {
	/** Idempotency keys this process is running right now, for the push endpoint. */
	const inFlight = /* @__PURE__ */ new Set();
	return async (request) => {
		try {
			return await route(ctx, request, inFlight);
		} catch (error) {
			return errorResponse(error);
		}
	};
}
async function route(ctx, request, inFlight) {
	const url = new URL(request.url);
	const path = stripBase(url.pathname.split("/").filter(Boolean).map(decodeURIComponent), ctx.basePath);
	const method = request.method.toUpperCase();
	if (path[0] === "healthz") return json({
		ok: true,
		roles: [...ctx.roles],
		workflows: [...ctx.workflows.keys()]
	});
	if (path[0] !== "v1") throw new NoRoute(method, url.pathname);
	if (path[1] === "tasks" && path[2] === "push" && path.length === 3) {
		if (method !== "POST") throw new NoRoute(method, url.pathname);
		if (![...ctx.roles].some((role) => role.startsWith("worker:"))) throw new NotServed("worker");
		return postPush(ctx, request, inFlight);
	}
	const signed = signedSignalRoute(ctx, request, url, method, path);
	if (signed !== null) return signed;
	requireBearer(request, ctx.auth.token);
	if (path[1] === "timers" && path[2] === "tick" && path.length === 3) {
		if (method !== "POST") throw new NoRoute(method, url.pathname);
		if (!ctx.roles.has("orchestrator") || ctx.tick === void 0 || ctx.drain === void 0) throw new NotServed("orchestrator");
		if (!truthy(url.searchParams.get("drain"))) return json(await ctx.tick());
		return json(await ctx.drain(drainOptions(url)));
	}
	if (!ctx.roles.has("api")) throw new NotServed("api");
	if (path[1] === "tasks" && path[2] === "poll" && path.length === 3) {
		if (method !== "POST") throw new NoRoute(method, url.pathname);
		return postPoll(ctx, request);
	}
	if (path[1] === "runs") return runRoute(ctx, request, url, method, path);
	if (path[1] === "tasks") return taskRoute(ctx, request, method, path);
	throw new NoRoute(method, url.pathname);
}
/**
* `?token=` on the signal route, or null when this is not that route or the token is absent.
* An invalid or expired token falls through to the bearer check, so a stale link gets the
* same 401 as no credential at all rather than leaking that the run exists.
*/
function signedSignalRoute(ctx, request, url, method, path) {
	const [, section, runId, action, name] = path;
	if (section !== "runs" || action !== "signals" || runId === void 0 || name === void 0) return null;
	const token = url.searchParams.get("token");
	const secret = linkSecret(ctx.auth);
	if (token === null || secret === void 0) return null;
	if (!verifySignalLink(secret, token, runId, name, ctx.now())) return null;
	if (!ctx.roles.has("api")) throw new NotServed("api");
	if (method === "GET") return Promise.resolve(renderConfirmation(runId, name, token, ctx.basePath ?? ""));
	if (method === "POST") return postSignal(ctx, runId, name, request);
	throw new NoRoute(method, url.pathname);
}
function runRoute(ctx, request, url, method, path) {
	const [, , runId, action, name] = path;
	if (runId === void 0) {
		if (method === "POST") return createRun(ctx, request);
		if (method === "GET") return indexRuns(ctx, url);
		throw new NoRoute(method, url.pathname);
	}
	if (action === void 0 && method === "GET") return showRun(ctx, runId);
	if (action === "events" && method === "GET") return wantsStream(request, url) ? streamRunEvents(ctx, runId, url, request) : showEvents(ctx, runId, url);
	if (action === "cancel" && method === "POST") return postCancel(ctx, runId);
	if (action === "signals" && name !== void 0 && method === "POST") return postSignal(ctx, runId, name, request);
	if (action === "links" && name !== void 0 && method === "POST") return postSignalLink(ctx, request, url, runId, name);
	throw new NoRoute(method, url.pathname);
}
/**
* Drops the mount prefix so the routes below are written as `/v1/…` whatever the host is
* mounted under. A path that does not carry the prefix is matched as it stands, which is
* what lets an in-process client call `/v1/runs` on a host mounted at `/api/vlo`.
*/
function stripBase(path, basePath) {
	if (basePath === void 0) return path;
	const base = basePath.slice(1).split("/");
	if (base.some((segment, at) => path[at] !== segment)) return path;
	return path.slice(base.length);
}
function truthy(value) {
	return value !== null && value !== "0" && value !== "false";
}
function drainOptions(url) {
	const raw = url.searchParams.get("max_ms");
	if (raw === null) return {};
	const maxMs = Number(raw);
	if (!Number.isInteger(maxMs) || maxMs <= 0) throw new BadRequest(`"max_ms" must be a positive integer`);
	return { maxMs };
}
function taskRoute(ctx, request, method, path) {
	const [, , taskId, action] = path;
	if (taskId === void 0 || method !== "POST") throw new NoRoute(method, path.join("/"));
	switch (action) {
		case "complete": return postComplete(ctx, taskId, request);
		case "fail": return postFail(ctx, taskId, request);
		case "heartbeat": return postHeartbeat(ctx, taskId, request);
		default: throw new NoRoute(method, path.join("/"));
	}
}
//#endregion
//#region src/host/deadlines.ts
/** The number of timers that actually fired. */
async function fireTimers(ctx, o) {
	const nowMs = ctx.now();
	const timers = await ctx.journal.transaction((tx) => tx.claimDueTimers(nowMs, o.batch, o.claimHoldMs));
	let fired = 0;
	for (const timer of timers) try {
		await fireOne(ctx, timer);
		fired += 1;
	} catch (error) {
		if (!isStepGone(error)) {
			o.warn(`could not fire timer ${timer.run_id}/${timer.step_id}`, error);
			continue;
		}
		await retire(ctx, timer, o);
	}
	return fired;
}
/** The fired flag and the timer event share one transaction: `false` means someone else won. */
function fireOne(ctx, timer) {
	return applyEvent(ctx, timer.run_id, async (tx) => {
		const nowMs = ctx.now();
		return await tx.markTimerFired(timer.run_id, timer.step_id, nowMs) ? timerFiredEvent({
			runId: timer.run_id,
			nowMs
		}, timer.step_id) : null;
	});
}
async function retire(ctx, timer, o) {
	try {
		await ctx.journal.transaction((tx) => tx.markTimerFired(timer.run_id, timer.step_id, ctx.now()));
	} catch (error) {
		o.warn(`could not retire timer ${timer.run_id}/${timer.step_id}`, error);
	}
}
/**
* Fails every attempt whose lease has lapsed, which retries it on a fresh attempt or ends the
* run once the policy is spent. No claim column is needed: `failTask` reads the task first and
* `liveTask` returns null once the attempt has moved on, so a second reaper writes nothing.
*
* Returns the number of lapsed attempts this reaper was the one to fail.
*/
async function reapLeases(ctx, o) {
	return reap(ctx, o, await ctx.journal.expiredLeases(ctx.now(), o.batch), "lease expired without heartbeat", "heartbeat_lost", "lease");
}
/**
* The host's half of `activity({ timeoutMs })`. The worker arms its own timer, which is what
* normally ends an over-running attempt; this catches the case where the worker is gone, or
* never got far enough to arm anything. Same no-claim argument as the lease reaper.
*/
async function reapTimeouts(ctx, o) {
	const nowMs = ctx.now();
	const tasks = await ctx.journal.expiredTimeouts(nowMs, o.batch);
	let reaped = 0;
	for (const task of tasks) {
		const elapsed = nowMs - (task.dispatched_at_ms ?? nowMs);
		reaped += await reap(ctx, o, [task], `activity "${task.activity}" timed out after ${elapsed} ms without a result`, "timeout", "timeout");
	}
	return reaped;
}
/** Fails each attempt and counts the ones this process was the first to settle. */
async function reap(ctx, o, tasks, error, cause, label) {
	let reaped = 0;
	for (const task of tasks) try {
		if (!(await failTask(ctx, task.task_id, task.attempt, error, true, cause)).duplicate) reaped += 1;
	} catch (failure) {
		o.warn(`could not reap the ${label} on task ${task.task_id}`, failure);
	}
	return reaped;
}
//#endregion
//#region src/host/transport/http-push.ts
const TIMEOUT_MS = 5e3;
/** 4xx codes that mean "not now" rather than "never": auth, timeout, rate limit. */
const RETRYABLE_4XX = /* @__PURE__ */ new Set([
	401,
	403,
	408,
	429
]);
/** Pushes tasks to a remote worker over signed HTTP. Built by the dispatcher per configured queue. */
var HttpPushTransport = class {
	/** Always `http-push`. */
	kind = "http-push";
	url;
	secret;
	now;
	fetchImpl;
	timeoutMs;
	/** Throws a plain `Error` when `secret` is empty: tasks are never pushed unsigned. */
	constructor(options) {
		if (!options.secret) throw new Error(`queue "${options.url}" has no push secret; refusing to push unsigned tasks`);
		this.url = options.url;
		this.secret = options.secret;
		this.now = options.now ?? Date.now;
		this.fetchImpl = options.fetch ?? globalThis.fetch;
		this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
	}
	/**
	* POSTs the task with the four `vlo-*` headers. Never throws: a network error, a timeout
	* or a 5xx is `accepted: false` without `fatal`; a non-retryable 4xx sets `fatal`.
	*/
	async push(task) {
		const body = JSON.stringify(task);
		const tsMs = this.now();
		let response;
		try {
			response = await this.fetchImpl(this.url, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					[TASK_ID_HEADER]: task.task_id,
					[ATTEMPT_HEADER]: String(task.attempt),
					[TIMESTAMP_HEADER]: String(tsMs),
					[SIGNATURE_HEADER]: signPush(this.secret, task.task_id, task.attempt, tsMs, body)
				},
				body,
				signal: AbortSignal.timeout(this.timeoutMs)
			});
		} catch (error) {
			return {
				accepted: false,
				reason: error instanceof Error ? error.message : String(error)
			};
		}
		if (response.status === 202 || response.status === 409) {
			await response.body?.cancel();
			return { accepted: true };
		}
		if (response.status === 200) {
			const payload = await response.json().catch(() => null);
			return payload !== null && payload.output !== void 0 ? {
				accepted: true,
				inlineOutput: payload.output
			} : { accepted: true };
		}
		return {
			accepted: false,
			reason: `${response.status} ${(await response.text().catch(() => "")).slice(0, 500)}`,
			fatal: response.status >= 400 && response.status < 500 && !RETRYABLE_4XX.has(response.status)
		};
	}
};
//#endregion
//#region src/host/transport/in-process.ts
/**
* Counts handlers this process still owes a result for. One tracker is shared by every
* in-process transport a host builds, because `Host.drain` has to tell "the dispatcher
* moved nothing" apart from "the dispatcher moved nothing *yet*: a handler is running and
* its result will schedule the next task".
*/
var InProcessTracker = class {
	running = 0;
	done = 0;
	waiting = /* @__PURE__ */ new Set();
	/** Handlers started and not yet reported. */
	get inFlight() {
		return this.running;
	}
	/** Monotonic count of handlers that reported. A change across a tick means work landed. */
	get finished() {
		return this.done;
	}
	/** Counts a handler as started. */
	enter() {
		this.running += 1;
	}
	/** Counts a handler as reported; wakes `settled()` waiters when none are left. */
	leave() {
		this.running -= 1;
		this.done += 1;
		if (this.running > 0) return;
		for (const resolve of this.waiting) resolve();
		this.waiting.clear();
	}
	/** Resolves once no in-process handler is outstanding. */
	settled() {
		if (this.running === 0) return Promise.resolve();
		return new Promise((resolve) => this.waiting.add(resolve));
	}
};
/** Runs tasks on a worker in this process. Built by the dispatcher for each `worker:<queue>` role. */
var InProcessTransport = class {
	worker;
	reporter;
	options;
	/** Always `in-process`. */
	kind = "in-process";
	/** `reporter` is where the handler's result goes; usually `localReporter(ctx)`. */
	constructor(worker, reporter, options = {}) {
		this.worker = worker;
		this.reporter = reporter;
		this.options = options;
	}
	/** Always accepts. The handler starts on the next macrotask, after the dispatcher has committed `running`. */
	async push(task) {
		const tracker = this.options.tracker;
		tracker?.enter();
		setImmediate(() => {
			handleTask(this.worker, task, this.reporter).catch((error) => this.options.onError?.(error)).finally(() => tracker?.leave());
		});
		return { accepted: true };
	}
};
//#endregion
//#region src/host/dispatcher.ts
/**
* The outbox dispatcher: the only thing that turns durable rows into effects.
*
* Nothing here is on the write path. A transition commits rows — a `created` run, a
* `scheduled` task, a closed child — and the dispatcher picks them up on its next tick.
* That is what makes a crash between "persisted" and "pushed" recoverable: the row is
* still there, unclaimed, and any process holding the `orchestrator` role will find it.
*
* Every stage is idempotent and claim results are unordered sets, so several orchestrators
* can run at once.
*
* Five stages, in tick order:
* 1. **start runs** — a `created` run row becomes a `started` event.
* 2. **push tasks** — a `scheduled` task is handed to the transport that serves its queue.
*    Queues configured `mode: "pull"` are skipped entirely: pollers own those rows, and a
*    claim here would burn dispatch attempts on work this process is never going to deliver.
* 3. **fire timers** — a due timer becomes a `timer/succeeded` event. The fired flag and the
*    event commit together, so a timer fires exactly once however many orchestrators claim it.
* 4. **reap leases** — a `running` task whose lease lapsed is failed with `heartbeat_lost`,
*    which retries it on a fresh attempt or ends the run once the policy is spent.
* 5. **reap timeouts** — a `running` task past its `timeout_ms` is failed with `timeout`. The
*    worker arms the same deadline locally; this is the backstop for a worker that is gone.
* 6. **notify parents** — a closed child run becomes a `child` event on its parent.
*
* Stages 1, 2, 3 and 6 take a claim for `claimHoldMs` so two orchestrators do not do the same
* work at the same time. The reapers need no claim column: `failTask` reads the task first and
* `liveTask` returns null once the attempt has moved on or the task is terminal, so a second
* orchestrator reaping the same expired attempt writes nothing.
*
* Stages 3, 4 and 5 are driven by the clock rather than by a freshly written row; they live in
* `deadlines.ts`.
*/
/**
* The outbox dispatcher. `createHost` builds one per host holding the `orchestrator` role;
* only tests and custom hosts construct it directly.
*/
var Dispatcher = class {
	ctx;
	options;
	mode;
	tickMs;
	batch;
	claimHoldMs;
	backoffBaseMs;
	maxBackoffMs;
	unroutableBackoffMs;
	workerId;
	deadlines;
	transports = /* @__PURE__ */ new Map();
	/** Queues served by pollers: the push stage must leave their tasks unclaimed. */
	pullQueues;
	timer;
	current = null;
	again = false;
	stopped = true;
	/** Passes still running, whoever started them — the loop, a tick route, a drain. */
	passes = /* @__PURE__ */ new Set();
	/** Reads the options once; nothing runs until {@link Dispatcher.start}. */
	constructor(ctx, options = {}) {
		this.ctx = ctx;
		this.options = options;
		this.mode = options.mode ?? "loop";
		this.tickMs = options.tickMs ?? 500;
		this.batch = options.batch ?? 50;
		this.claimHoldMs = options.claimHoldMs ?? 3e4;
		this.backoffBaseMs = options.backoffBaseMs ?? 1e3;
		this.maxBackoffMs = options.maxBackoffMs ?? 6e4;
		this.unroutableBackoffMs = options.unroutableBackoffMs ?? 6e4;
		this.workerId = options.workerId ?? `vlo-${randomHex().slice(0, 8)}`;
		this.pullQueues = Object.entries(ctx.queues).filter(([, queue]) => queue.mode === "pull").map(([name]) => name);
		this.deadlines = {
			batch: this.batch,
			claimHoldMs: this.claimHoldMs,
			warn: (message, error) => this.warn(message, error)
		};
	}
	/** Begins ticking (`loop` mode) or merely arms `tick()` (`manual` mode). Idempotent. */
	start() {
		if (!this.stopped) return;
		this.stopped = false;
		if (this.mode === "manual") return;
		this.timer = setInterval(() => this.schedule(), this.tickMs);
		this.timer.unref();
		this.schedule();
	}
	/**
	* Stops ticking and waits for every pass still in flight. The wait is what makes shutdown
	* safe: the host closes the journal next, and a stage halfway through a claim must not be
	* left reading a connection that is gone.
	*/
	async stop() {
		this.stopped = true;
		if (this.timer !== void 0) clearInterval(this.timer);
		this.timer = void 0;
		await this.current;
		while (this.passes.size > 0) await Promise.allSettled([...this.passes]);
	}
	/** Runs a tick soon. Safe to call from inside a tick: it queues one more pass. */
	kick() {
		if (this.stopped || this.mode === "manual") return;
		this.schedule();
	}
	/** One pass over every stage. The tick route and the tests drive the outbox with it. */
	async tick() {
		const pass = this.pass();
		this.passes.add(pass);
		try {
			return await pass;
		} finally {
			this.passes.delete(pass);
		}
	}
	async pass() {
		return {
			started: await this.startRuns(),
			pushed: await this.pushTasks(),
			timers: await fireTimers(this.ctx, this.deadlines),
			reaped: await reapLeases(this.ctx, this.deadlines),
			timeouts: await reapTimeouts(this.ctx, this.deadlines),
			notified: await this.notifyParents()
		};
	}
	schedule() {
		if (this.stopped) return;
		if (this.current !== null) {
			this.again = true;
			return;
		}
		this.current = this.drain().finally(() => {
			this.current = null;
		});
	}
	async drain() {
		do {
			this.again = false;
			try {
				await this.tick();
			} catch (error) {
				this.warn("tick failed", error);
			}
		} while (this.again && !this.stopped);
	}
	async startRuns() {
		const nowMs = this.ctx.now();
		const runs = await this.ctx.journal.transaction((tx) => tx.claimCreatedRuns(nowMs, this.batch, this.claimHoldMs));
		let started = 0;
		for (const run of runs) try {
			const input = await inlineOrBlob(this.ctx, run.input, run.input_ref);
			await applyEvent(this.ctx, run.run_id, startedEvent({
				runId: run.run_id,
				nowMs: this.ctx.now()
			}, input ?? "null"));
			started += 1;
		} catch (error) {
			this.warn(`could not start run ${run.run_id}`, error);
		}
		return started;
	}
	async pushTasks() {
		const nowMs = this.ctx.now();
		const tasks = await this.ctx.journal.transaction((tx) => tx.claimUndispatchedTasks(nowMs, this.batch, this.claimHoldMs, { excludeQueues: this.pullQueues }));
		return (await Promise.all(tasks.map((task) => this.pushOne(task).catch((error) => {
			this.warn(`could not push task ${task.task_id}`, error);
			return false;
		})))).filter(Boolean).length;
	}
	/** True when the task was accepted by a worker and recorded as running. */
	async pushOne(task) {
		const transport = this.transportFor(task);
		if (transport === null) {
			this.warn(`no transport for queue "${task.queue}"; deferring task ${task.task_id}`);
			await this.defer(task, this.unroutableBackoffMs);
			return false;
		}
		const result = await transport.push(await toPushedTask(this.ctx, task));
		if (!result.accepted) {
			if (result.fatal === true) {
				await applyEvent(this.ctx, task.run_id, taskFailedEvent({
					runId: task.run_id,
					nowMs: this.ctx.now()
				}, task.step_id, task.attempt, "schema_violation", `worker rejected the push: ${result.reason}`));
				return false;
			}
			await this.defer(task, this.backoff(task.dispatch_attempts));
			return false;
		}
		await markTaskRunning(this.ctx, task, this.workerId);
		if (result.inlineOutput !== void 0) await completeTask(this.ctx, task.task_id, task.attempt, result.inlineOutput);
		return true;
	}
	backoff(dispatchAttempts) {
		const exponent = Math.max(0, Math.min(dispatchAttempts, 20));
		return Math.min(this.backoffBaseMs * 2 ** exponent, this.maxBackoffMs);
	}
	defer(task, delayMs) {
		const notBefore = this.ctx.now() + delayMs;
		return this.ctx.journal.transaction((tx) => tx.deferDispatch(task.task_id, task.attempt, notBefore));
	}
	transportFor(task) {
		const key = `${task.queue}\u0000${task.activity}`;
		const cached = this.transports.get(key);
		if (cached !== void 0) return cached;
		const transport = this.buildTransport(task);
		this.transports.set(key, transport);
		return transport;
	}
	buildTransport(task) {
		if (this.ctx.roles.has(`worker:${task.queue}`)) {
			const worker = findWorker(this.ctx.workers, task.queue, task.activity);
			if (worker !== void 0) return new InProcessTransport(worker, localReporter(this.ctx), {
				tracker: this.ctx.inProcess,
				onError: (error) => this.warn(`could not report task on queue "${task.queue}"`, error)
			});
		}
		const queue = this.ctx.queues[task.queue];
		if (queue?.url === void 0) return null;
		return new HttpPushTransport({
			url: queue.url,
			secret: queue.secret ?? "",
			now: this.ctx.now,
			...this.options.fetch !== void 0 ? { fetch: this.options.fetch } : {}
		});
	}
	async notifyParents() {
		const nowMs = this.ctx.now();
		const children = await this.ctx.journal.transaction((tx) => tx.claimClosedUnnotified(nowMs, this.batch, this.claimHoldMs));
		let notified = 0;
		for (const child of children) try {
			await this.notifyParent(child);
			notified += 1;
		} catch (error) {
			this.warn(`could not notify the parent of ${child.run_id}`, error);
		}
		return notified;
	}
	async notifyParent(child) {
		const parentRunId = child.parent_run_id;
		const parentStepId = child.parent_step_id;
		const status = childStatusOf(child.status);
		if (parentRunId === void 0 || parentStepId === void 0 || status === null) {
			await this.markNotified(child.run_id);
			return;
		}
		const output = await inlineOrBlob(this.ctx, child.output, child.output_ref);
		await applyEvent(this.ctx, parentRunId, childEvent({
			runId: parentRunId,
			nowMs: this.ctx.now()
		}, parentStepId, status, output), async (tx) => {
			await tx.markParentNotified(child.run_id, this.ctx.now());
		});
	}
	markNotified(runId) {
		return this.ctx.journal.transaction((tx) => tx.markParentNotified(runId, this.ctx.now()));
	}
	/**
	* Never throws and never writes to stdout: hosts listen on `events` if they care.
	* A closed journal is shutdown, not a fault — the host stopped while this was in flight —
	* so it is dropped rather than reported.
	*/
	warn(message, error) {
		if (error instanceof JournalClosed) return;
		this.ctx.events.emit("warning", {
			message,
			...error !== void 0 ? { error } : {}
		});
	}
};
//#endregion
//#region src/host/drain.ts
/** Wall-clock budget of a drain when `maxMs` is absent: 25 s, under a typical serverless `maxDuration`. */
const DEFAULT_DRAIN_MAX_MS = 25e3;
/**
* Ticks until a pass is quiet or the budget runs out. `Host.drain` wraps this and additionally
* shares one drain between concurrent callers; call that unless you hold a `HostContext`.
* Throws a plain `Error` on a context without the `orchestrator` role.
*
* @example
* ```ts
* // Inside a request on a `manual`-mode host: carry the run as far as it goes right now.
* const result = await host.drain({ maxMs: 20_000 });
* if (!result.idle) console.warn(`still busy after ${result.passes} passes`);
* ```
*/
async function drainHost(ctx, options = {}) {
	const tick = ctx.tick;
	if (tick === void 0) throw new Error("vlo host: drain() needs the \"orchestrator\" role");
	const tracker = ctx.inProcess;
	const deadline = Date.now() + (options.maxMs ?? 25e3);
	let passes = 0;
	for (;;) {
		const finishedBefore = tracker.finished;
		const counts = await tick();
		passes += 1;
		await settle(tracker, deadline - Date.now());
		if (moved(counts) === 0 && tracker.inFlight === 0 && tracker.finished === finishedBefore) return {
			passes,
			idle: true,
			counts
		};
		if (Date.now() >= deadline) return {
			passes,
			idle: false,
			counts
		};
	}
}
/** Waits for the in-process handlers, but never past the drain's own deadline. */
function settle(tracker, remainingMs) {
	if (tracker.inFlight === 0 || remainingMs <= 0) return Promise.resolve();
	return Promise.race([tracker.settled(), after(remainingMs)]);
}
function after(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms).unref();
	});
}
function moved(counts) {
	return counts.started + counts.pushed + counts.timers + counts.reaped + counts.timeouts + counts.notified;
}
//#endregion
//#region src/host/node-server.ts
/**
* node:http ↔ fetch adapter. The router speaks `Request`/`Response`; this is the ~80 lines
* that let it listen on a port without pulling in a framework.
*
* The body is piped, never buffered: an SSE response never ends, so waiting for it would
* hang the request instead of streaming it. A socket that goes away aborts the request
* signal, which is how an open stream learns its reader left.
*/
/**
* Serves a fetch-style handler on `port` (`0` picks a free one) and `host` (default
* `127.0.0.1`). Rejects when the port cannot be bound. Response bodies are streamed, so an
* SSE response works without a framework.
*/
async function listen(handler, port, host = "127.0.0.1") {
	const server = createServer((req, res) => {
		respond(handler, req, res);
	});
	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, host, () => {
			server.removeListener("error", reject);
			resolve();
		});
	});
	const address = server.address();
	const actual = typeof address === "object" && address !== null ? address.port : port;
	return {
		url: `http://${host}:${actual}`,
		port: actual,
		close: () => closeServer(server)
	};
}
async function respond(handler, req, res) {
	const gone = new AbortController();
	res.on("close", () => gone.abort());
	try {
		const response = await handler(toRequest(req, gone.signal));
		res.writeHead(response.status, Object.fromEntries(response.headers));
		if (response.body === null) {
			res.end();
			return;
		}
		res.flushHeaders();
		await pipeline(Readable.fromWeb(response.body), res);
	} catch (error) {
		if (res.writableEnded || res.headersSent) {
			res.end();
			return;
		}
		res.writeHead(500, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: {
			code: "internal",
			message: String(error)
		} }));
	}
}
function toRequest(req, signal) {
	const url = `http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`;
	const method = req.method ?? "GET";
	const hasBody = method !== "GET" && method !== "HEAD";
	return new Request(url, {
		method,
		headers: headersOf(req),
		signal,
		...hasBody ? {
			body: Readable.toWeb(req),
			duplex: "half"
		} : {}
	});
}
function headersOf(req) {
	const headers = new Headers();
	for (const [name, value] of Object.entries(req.headers)) {
		if (value === void 0) continue;
		for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
	}
	return headers;
}
function closeServer(server) {
	return new Promise((resolve, reject) => {
		server.closeAllConnections();
		server.close((error) => error ? reject(error) : resolve());
	});
}
//#endregion
//#region src/host/schemas.ts
async function registerSchemas(ctx) {
	const nowMs = ctx.now();
	const rows = [...[...ctx.activities.values()].flatMap((a) => a.hash === void 0 || a.jsonSchema === void 0 ? [] : [{
		name: a.name,
		version: a.hash,
		json_schema: JSON.stringify(a.jsonSchema),
		...a.retry !== void 0 ? { retry_policy: JSON.stringify(a.retry) } : {}
	}]), ...[...ctx.signals.values()].flatMap((s) => s.hash === void 0 || s.jsonSchema === void 0 ? [] : [{
		name: s.name,
		version: s.hash,
		json_schema: JSON.stringify(s.jsonSchema)
	}])];
	if (rows.length === 0) return;
	await ctx.journal.transaction(async (tx) => {
		for (const row of rows) await tx.upsertSchema(row, nowMs);
	});
}
//#endregion
//#region src/host/roles.ts
/**
* `createHost` — one process, some subset of the engine's roles.
*
* - `orchestrator` runs the outbox dispatcher.
* - `api` serves the control plane.
* - `worker:<queue>` runs activities for that queue, in-process and over inbound push.
*
* Splitting them is how the same code becomes a laptop all-in-one, a Cloud Run service and
* a fleet of workers. Nothing else in the host reads roles: the dispatcher asks whether a
* queue is served locally, the router asks whether it may answer.
*/
/** Blob store used when {@link CreateHostOptions.blob} is absent: a `file://` directory relative to the working directory. */
const DEFAULT_BLOB_URL = "file://.vlo/blobs";
/** Port {@link serve} binds when `port` is absent. */
const DEFAULT_PORT = 4100;
/** How often an open SSE stream re-reads the journal when `streamPollMs` is absent, in milliseconds. */
const DEFAULT_STREAM_POLL_MS = 500;
/** How long `stop()` gives in-process handlers to report before the journal closes. */
const SHUTDOWN_GRACE_MS = 5e3;
/** `tick` and `drain` move the outbox, which only an orchestrator owns. */
var NoOrchestrator = class extends Error {
	constructor(what, roles) {
		super(`vlo host: ${what}() needs the "orchestrator" role; this host holds [${[...roles].join(", ")}]`);
		this.name = "NoOrchestrator";
	}
};
const NOT_STARTED = new Proxy({}, { get() {
	throw new Error("vlo host: call start() (or serve()) before submitting events");
} });
/**
* Builds a host without binding a port or starting it. Nothing is loaded or migrated until
* `start()` (or the first `fetch`). A `journal` given as a URL is opened here and closed by
* `stop()`; a `Journal` instance is left to its owner.
*
* @example
* ```ts
* import { createClient, createHost, defineWorker } from "@vlo/sdk/host";
*
* const host = createHost({
*   journal: "sqlite://./.vlo/dev.db",
*   workflows: [pipeline],
*   activities: [render],
*   workers: [defineWorker({ "pull.render": (input: { clip: string }) => ({ rendered: input.clip }) })],
* });
* await host.start();
*
* const client = createClient({ fetch: host.fetch });
* const run = await client.start(pipeline, { clip: "reel" });
* await client.waitFor(run.run_id, "completed");
* await host.stop();
* ```
*/
function createHost(options) {
	const ownsJournal = typeof options.journal === "string";
	const journal = ownsJournal ? openJournal(options.journal) : options.journal;
	const blob = typeof options.blob === "string" || options.blob === void 0 ? openBlobStore(options.blob ?? "file://.vlo/blobs") : options.blob;
	const registries = mergeDomains(options);
	const workers = [...registries.workers];
	const roles = new Set(options.roles ?? defaultRoles(workers));
	const events = new EventEmitter();
	events.setMaxListeners(0);
	let dispatcher;
	const ctx = {
		journal,
		blob,
		kernel: options.kernel ?? NOT_STARTED,
		now: options.now ?? Date.now,
		namespace: options.namespace ?? "default",
		workflows: byName(registries.workflows),
		activities: byName(registries.activities),
		signals: byName(registries.signals),
		workers,
		queues: options.queues ?? {},
		auth: options.auth ?? {},
		roles,
		...options.publicUrl !== void 0 ? { publicUrl: options.publicUrl } : {},
		...withBasePath(options.basePath),
		streamPollMs: options.streamPollMs ?? 500,
		events,
		kick: () => dispatcher?.kick(),
		inProcess: new InProcessTracker()
	};
	/** One drain at a time per host: a second caller joins the one already running. */
	let draining = null;
	if (roles.has("orchestrator")) {
		dispatcher = new Dispatcher(ctx, options.dispatcher ?? {});
		const orchestrator = dispatcher;
		ctx.tick = async () => {
			await start();
			return orchestrator.tick();
		};
		ctx.drain = (drainOptions = {}) => {
			if (draining !== null) return draining;
			const pending = drainHost(ctx, drainOptions);
			draining = pending;
			pending.catch(() => void 0).then(() => {
				if (draining === pending) draining = null;
			});
			return pending;
		};
	}
	const router = createRouter(ctx);
	let ready = null;
	let closing = null;
	const start = () => ready ??= boot(ctx, options, dispatcher);
	return {
		fetch: async (request) => {
			await start();
			return router(request);
		},
		start,
		tick() {
			if (ctx.tick === void 0) return Promise.reject(new NoOrchestrator("tick", roles));
			return ctx.tick();
		},
		drain(drainOptions = {}) {
			if (ctx.drain === void 0) return Promise.reject(new NoOrchestrator("drain", roles));
			return ctx.drain(drainOptions);
		},
		/** Idempotent: a host may be stopped by its owner and again by a shutdown hook. */
		stop() {
			closing ??= (async () => {
				await dispatcher?.stop();
				await Promise.race([ctx.inProcess.settled(), timeout(SHUTDOWN_GRACE_MS)]);
				if (ownsJournal) await journal.close();
				ready = null;
			})();
			return closing;
		},
		events,
		journal,
		roles,
		get publicUrl() {
			return ctx.publicUrl;
		},
		set publicUrl(url) {
			if (url === void 0) delete ctx.publicUrl;
			else ctx.publicUrl = url;
		}
	};
}
async function boot(ctx, options, dispatcher) {
	ctx.kernel = options.kernel ?? await loadKernel();
	await ctx.journal.migrate();
	await registerSchemas(ctx);
	dispatcher?.start();
}
/**
* Binds a port, tells the host its own URL, then starts it. `publicUrl` is set to the
* listener's URL unless the options give one, so pushed tasks carry a working `complete_url`.
*
* @example
* ```ts
* import { serve } from "@vlo/sdk/host";
*
* const server = await serve({
*   journal: "postgres://user:pass@localhost/app",
*   workflows: [pipeline],
*   activities: [render],
*   auth: { token: "control-plane-token" },
*   port: 4100,
* });
* console.log(server.url); // http://127.0.0.1:4100
* await server.close();
* ```
*/
async function serve(options) {
	const host = createHost(options);
	const listener = await listen(host.fetch, options.port ?? 4100, options.hostname);
	host.publicUrl = options.publicUrl ?? listener.url;
	await host.start();
	return {
		...listener,
		host,
		async close() {
			await listener.close();
			await host.stop();
		}
	};
}
/**
* Next route file: `export const { GET, POST } = handler({ … })`. The host is created on the
* first request and shared by every request after, so a serverless function pays for the
* kernel load once per instance. Pair it with `dispatcher: { mode: "manual" }` and a cron on
* `POST /v1/timers/tick`.
*
* @example
* ```ts
* // app/api/vlo/[[...path]]/route.ts
* import { handler } from "@vlo/sdk/host";
*
* export const { GET, POST } = handler({
*   journal: process.env.DATABASE_URL ?? "sqlite://./.vlo/dev.db",
*   workflows: [pipeline],
*   activities: [render],
*   basePath: "/api/vlo",
*   dispatcher: { mode: "manual" },
* });
* ```
*/
function handler(options) {
	let host;
	const serveOne = (request) => {
		host ??= createHost(options);
		return host.fetch(request);
	};
	return {
		GET: serveOne,
		POST: serveOne
	};
}
function timeout(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms).unref();
	});
}
/** `exactOptionalPropertyTypes`: an absent base path must be an absent key, not `undefined`. */
function withBasePath(value) {
	const basePath = normalizeBasePath(value);
	return basePath === void 0 ? {} : { basePath };
}
function defaultRoles(workers) {
	const roles = ["orchestrator", "api"];
	for (const worker of workers) for (const queue of worker.queues) roles.push(`worker:${queue}`);
	return roles;
}
function byName(items) {
	return new Map(items.map((item) => [item.name, item]));
}
//#endregion
export { loadKernel as $, getRunView as A, signSignalLink as B, localReporter as C, failTask as D, completeTask as E, applyEvent as F, Nondeterminism as G, BadRequest as H, foldEvent as I, RunTerminal as J, ReducerFailed as K, rebuildCheckpoint as L, readRunEvents as M, signalRun as N, heartbeatTask as O, startRun as P, WorkflowRejected as Q, DEFAULT_LINK_TTL_MS as R, verifySignature as S, handleTask as T, IllegalEvent as U, verifySignalLink as V, LeaseLost as W, Unauthorized as X, TaskNotFound as Y, VloError as Z, ATTEMPT_HEADER as _, createHost as a, TIMESTAMP_HEADER as b, listen as c, Dispatcher as d, openJournal as et, InProcessTracker as f, normalizeBasePath as g, createRouter as h, SHUTDOWN_GRACE_MS as i, listRuns as j, cancelRun as k, DEFAULT_DRAIN_MAX_MS as l, HttpPushTransport as m, DEFAULT_PORT as n, openBlobStore as nt, handler as o, InProcessTransport as p, RunNotFound as q, DEFAULT_STREAM_POLL_MS as r, GcsBlobStore as rt, serve as s, DEFAULT_BLOB_URL as t, JournalClosed as tt, drainHost as u, SIGNATURE_HEADER as v, remoteReporter as w, signPush as x, TASK_ID_HEADER as y, linkSecret as z };
