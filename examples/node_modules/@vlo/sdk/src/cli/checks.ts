/**
 * The checks behind `vlo doctor`.
 *
 * Every check is a real round trip, not a config read: the point is to fail here rather
 * than three minutes into a deploy. They use only the public journal, blob and kernel
 * surfaces, and they are cheap enough to run on every boot of a new environment — the blob
 * probe is content-addressed, so a re-run writes nothing.
 */

import { statSync } from "node:fs";
import { openBlobStore } from "../blob/open.ts";
import type { LoadedConfig } from "../config/load.ts";
import { sha256Hex } from "../core/hash.ts";
import { loadKernel } from "../kernel/load.ts";
import { PROTOCOL_VERSION } from "../kernel/protocol.ts";
import { openJournal } from "../journal/open.ts";
import type { Journal } from "../journal/types.ts";

export type CheckStatus = "ok" | "warn" | "fail";

export interface Check {
  check: string;
  status: CheckStatus;
  detail: string;
  hint?: string;
}

export interface CheckOptions {
  /** `false` ⇒ never write to the journal; a missing schema shows up as a failed commit. */
  migrate: boolean;
  fetch?: typeof fetch;
}

const PROBE_BYTES = 1024;
const MAX_WASM_BYTES = 1024 * 1024;
const QUEUE_TIMEOUT_MS = 3_000;
/** Same relative shape as `kernel/load.ts`: `wasm/` sits beside `src/` and beside `dist/`. */
const WASM_CANDIDATES = ["../../wasm/vlo_kernel_bg.wasm", "../wasm/vlo_kernel_bg.wasm"];

export async function runChecks(loaded: LoadedConfig, options: CheckOptions): Promise<Check[]> {
  const checks: Check[] = [];
  const journal = await checkJournal(checks, loaded, options);
  await checkBlob(checks, loaded);
  await checkKernel(checks);
  if (journal !== null) await checkSchemas(checks, loaded, journal);
  await checkQueues(checks, loaded, options.fetch ?? fetch);
  checkRoles(checks, loaded);

  if (journal !== null) await journal.close().catch(() => undefined);
  return checks;
}

/** Returns the open journal when it is usable, so later checks can reuse the connection. */
async function checkJournal(
  checks: Check[],
  loaded: LoadedConfig,
  options: CheckOptions,
): Promise<Journal | null> {
  const url = loaded.profile.journal;
  const dialect = url.startsWith("sqlite://") ? "sqlite" : "postgres";

  let journal: Journal;
  try {
    journal = openJournal(url);
  } catch (error) {
    checks.push({
      check: "journal",
      status: "fail",
      detail: message(error),
      hint: "journal must be a sqlite:// or postgres:// url",
    });
    return null;
  }

  // Migrate first but report second: "journal" reads as the connection, "migrate" as what
  // was done to it.
  let migrated: Check;
  if (options.migrate) {
    try {
      await journal.migrate();
      migrated = { check: "migrate", status: "ok", detail: "schema up to date" };
    } catch (error) {
      checks.push({
        check: "migrate",
        status: "fail",
        detail: message(error),
        hint: migrateHint(error),
      });
      await journal.close().catch(() => undefined);
      return null;
    }
  } else {
    migrated = {
      check: "migrate",
      status: "warn",
      detail: "skipped (--no-migrate)",
      hint: "re-run without --no-migrate to apply pending migrations",
    };
  }

  // One empty write transaction: proves the connection, the lock and the commit path.
  const startedAt = Date.now();
  try {
    await journal.transaction((tx) => tx.lockRun("vlo-doctor"));
  } catch (error) {
    checks.push({
      check: "journal",
      status: "fail",
      detail: `${dialect} · ${message(error)}`,
      hint: options.migrate
        ? "check the journal url and that the database is reachable"
        : "the schema may be missing; re-run without --no-migrate",
    });
    checks.push(migrated);
    await journal.close().catch(() => undefined);
    return null;
  }

  checks.push(
    {
      check: "journal",
      status: "ok",
      detail: `${dialect} · commit round trip ${Date.now() - startedAt} ms`,
    },
    migrated,
  );
  return journal;
}

async function checkBlob(checks: Check[], loaded: LoadedConfig): Promise<void> {
  const url = loaded.profile.blob;
  try {
    const store = openBlobStore(url);
    const probe = new Uint8Array(PROBE_BYTES).fill(0x76);
    const digest = await store.put(probe);
    if (digest !== sha256Hex(probe)) {
      checks.push({
        check: "blob",
        status: "fail",
        detail: `${url} · put returned ${digest}, which is not the sha256 of the bytes`,
        hint: "the store is not content-addressed; payload refs would not resolve",
      });
      return;
    }
    const read = await store.get(digest);
    if (read.length !== probe.length) {
      checks.push({
        check: "blob",
        status: "fail",
        detail: `${url} · read back ${read.length} bytes, wrote ${probe.length}`,
        hint: "the store is truncating writes",
      });
      return;
    }
    checks.push({ check: "blob", status: "ok", detail: `${url} · 1 KiB round trip` });
  } catch (error) {
    checks.push({
      check: "blob",
      status: "fail",
      detail: `${url} · ${message(error)}`,
      hint: "check the blob url and that the process may write there",
    });
  }
}

async function checkKernel(checks: Check[]): Promise<void> {
  const bytes = wasmSize();
  if (bytes === null) {
    checks.push({
      check: "kernel",
      status: "fail",
      detail: "wasm not found",
      hint: "run scripts/build-kernel.sh from the vlo repo root, or set VLO_KERNEL_WASM",
    });
    return;
  }

  try {
    // `loadKernel` refuses a protocol it does not speak, so reaching here is the match.
    const kernel = await loadKernel();
    const kib = Math.round(bytes / 1024);
    const oversized = bytes > MAX_WASM_BYTES;
    checks.push({
      check: "kernel",
      status: oversized ? "warn" : "ok",
      detail: `protocol ${kernel.version().protocol} · ${kib} KiB`,
      ...(oversized ? { hint: `over the ${MAX_WASM_BYTES / 1024} KiB budget; build with --release` } : {}),
    });
  } catch (error) {
    checks.push({
      check: "kernel",
      status: "fail",
      detail: message(error),
      hint: `this SDK speaks protocol ${PROTOCOL_VERSION}; rebuild the kernel`,
    });
  }
}

function wasmSize(): number | null {
  const override = process.env["VLO_KERNEL_WASM"];
  const candidates: (string | URL)[] =
    override !== undefined && override !== ""
      ? [override]
      : WASM_CANDIDATES.map((c) => new URL(c, import.meta.url));
  for (const candidate of candidates) {
    try {
      return statSync(candidate).size;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Registered activities and signals against the `schemas` table. A miss is not an error:
 * the host upserts every schema on boot. It is worth saying out loud, because a miss also
 * means no other process has booted this build yet.
 */
async function checkSchemas(
  checks: Check[],
  loaded: LoadedConfig,
  journal: Journal,
): Promise<void> {
  const wanted = [
    ...loaded.activities.map((a) => ({ name: a.name, version: a.hash })),
    ...loaded.signals.map((s) => ({ name: s.name, version: s.hash })),
  ].filter((s): s is { name: string; version: string } => s.version !== undefined);

  if (wanted.length === 0) {
    checks.push({ check: "schemas", status: "ok", detail: "none declared" });
    return;
  }

  try {
    const missing = await journal.transaction(async (tx) => {
      const absent: string[] = [];
      for (const { name, version } of wanted) {
        if ((await tx.getSchema(name, version)) === null) absent.push(name);
      }
      return absent;
    });
    checks.push({
      check: "schemas",
      status: missing.length === 0 ? "ok" : "warn",
      detail:
        missing.length === 0
          ? `${wanted.length} registered`
          : `${wanted.length - missing.length}/${wanted.length} registered · missing ${missing.join(" · ")}`,
      ...(missing.length === 0 ? {} : { hint: "these register on the next host boot" }),
    });
  } catch (error) {
    checks.push({ check: "schemas", status: "fail", detail: message(error) });
  }
}

async function checkQueues(
  checks: Check[],
  loaded: LoadedConfig,
  doFetch: typeof fetch,
): Promise<void> {
  const queues = Object.entries(loaded.profile.queues);
  if (queues.length === 0) {
    checks.push({ check: "queues", status: "ok", detail: "none configured · in-process only" });
    return;
  }

  for (const [name, config] of queues) {
    const label = `queue:${name}`;
    if (config.mode === "pull") {
      checks.push({ check: label, status: "ok", detail: "pull · served by pollers" });
      continue;
    }
    if (config.url === undefined) {
      const worker = loaded.workers.find((w) => w.queues.includes(name));
      checks.push(
        worker !== undefined
          ? { check: label, status: "ok", detail: "in-process" }
          : {
              check: label,
              status: "fail",
              detail: "no url and no in-process worker",
              hint: `give the queue a url, or export defineWorker({ … }, { queues: ["${name}"] })`,
            },
      );
      continue;
    }
    checks.push(await probeQueue(label, config.url, config.secret, doFetch));
  }
}

async function probeQueue(
  label: string,
  url: string,
  secret: string | undefined,
  doFetch: typeof fetch,
): Promise<Check> {
  const unsigned = secret === undefined || secret.length === 0;
  let health: URL;
  try {
    health = new URL("/healthz", url);
  } catch {
    return { check: label, status: "fail", detail: `${url} is not a url`, hint: "queue url must be absolute" };
  }

  try {
    const response = await doFetch(health, { signal: AbortSignal.timeout(QUEUE_TIMEOUT_MS) });
    if (!response.ok) {
      return {
        check: label,
        status: "fail",
        detail: `push · ${health.href} → ${response.status}`,
        hint: "the worker host is up but not healthy",
      };
    }
  } catch (error) {
    return {
      check: label,
      status: "fail",
      detail: `push · ${health.href} unreachable: ${message(error)}`,
      hint: "start the worker host, or fix the queue url",
    };
  }

  return {
    check: label,
    status: unsigned ? "warn" : "ok",
    detail: `push · ${health.href} reachable${unsigned ? " · no secret" : ""}`,
    ...(unsigned ? { hint: "set `secret` on the queue; unsigned pushes are rejected by the worker" } : {}),
  };
}

function checkRoles(checks: Check[], loaded: LoadedConfig): void {
  const { roles, dispatcher, deploy } = loaded.profile;
  const listed = roles ?? ["orchestrator", "api", "worker:*"];
  const mode = dispatcher?.mode ?? "loop";
  const detail = `${listed.join(" · ")} · dispatcher ${mode}`;

  const stalled =
    listed.includes("orchestrator") && mode === "manual" && deploy?.cron === undefined;
  checks.push({
    check: "roles",
    status: stalled ? "warn" : "ok",
    detail,
    ...(stalled
      ? { hint: "a manual dispatcher only advances on POST /v1/timers/tick; set `deploy.cron`" }
      : {}),
  });
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A hint that matches the failure: reachability and auth are far more common than DDL rights. */
function migrateHint(error: unknown): string {
  const text = message(error);
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|timeout/i.test(text)) {
    return "the journal is unreachable: check the url, host and port, and that the database is running";
  }
  if (/password|authentication|no pg_hba/i.test(text)) {
    return "the journal rejected the credentials in the url";
  }
  if (/does not exist/i.test(text)) return "the database named in the url does not exist";
  if (/permission denied for database/i.test(text)) {
    return "the journal user cannot create the schema: GRANT CREATE ON DATABASE to it, or have a DBA run CREATE SCHEMA <name> AUTHORIZATION <user>";
  }
  return "the journal user needs CREATE on its schema";
}
