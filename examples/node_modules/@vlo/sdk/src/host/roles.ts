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

import { EventEmitter } from "node:events";
import { openBlobStore } from "../blob/open.ts";
import type { BlobStore } from "../blob/types.ts";
import type { Workflow } from "../core/workflow.ts";
import { openJournal } from "../journal/open.ts";
import type { Journal } from "../journal/types.ts";
import type { Kernel } from "../kernel/protocol.ts";
import { loadKernel } from "../kernel/load.ts";
import { createRouter, normalizeBasePath, type FetchHandler } from "./api/router.ts";
import type {
  ActivityRegistration,
  AuthConfig,
  HostContext,
  QueueConfig,
  Role,
  SignalRegistration,
} from "./context.ts";
import { Dispatcher, type DispatcherOptions, type TickCounts } from "./dispatcher.ts";
import { mergeDomains, type Domain } from "./domain.ts";
import { drainHost, type DrainOptions, type DrainResult } from "./drain.ts";
import { listen, type Listening } from "./node-server.ts";
import { registerSchemas } from "./schemas.ts";
import { InProcessTracker } from "./transport/in-process.ts";
import type { Worker } from "./worker/registry.ts";

/** Blob store used when {@link CreateHostOptions.blob} is absent: a `file://` directory relative to the working directory. */
export const DEFAULT_BLOB_URL = "file://.vlo/blobs";
/** Port {@link serve} binds when `port` is absent. */
export const DEFAULT_PORT = 4100;
/** How often an open SSE stream re-reads the journal when `streamPollMs` is absent, in milliseconds. */
export const DEFAULT_STREAM_POLL_MS = 500;
/** How long `stop()` gives in-process handlers to report before the journal closes. */
export const SHUTDOWN_GRACE_MS = 5_000;

/** What {@link createHost} needs: durable stores, the registries, and which roles this process plays. */
export interface CreateHostOptions {
  /** A `Journal`, or a URL the host opens (and closes on `stop`). */
  journal: Journal | string;
  /** A `BlobStore`, or a `file://` / `gcs://` URL to open. Default {@link DEFAULT_BLOB_URL}. */
  blob?: BlobStore | string;
  /** Workflows this host can run, by name. Starting an unregistered one is refused. Optional when `domains` supplies them. */
  workflows?: readonly Workflow[];
  /** Domains from `defineDomain`; their registries are flattened onto the four arrays below. */
  domains?: readonly Domain[];
  /**
   * Activities whose output schema the host enforces before folding a result. Unregistered
   * activities still run; their output is folded as opaque JSON.
   */
  activities?: readonly ActivityRegistration[];
  /** Workers run in this process. Each adds a `worker:<queue>` role when `roles` is absent. */
  workers?: readonly Worker[];
  /** Signals whose payload the host validates before delivery. Unregistered signals pass through as-is. */
  signals?: readonly SignalRegistration[];
  /** Roles this process holds. Default: `orchestrator`, `api`, plus one `worker:<queue>` per queue of every worker. */
  roles?: readonly Role[];
  /** Per-queue delivery: a push URL and secret, or `mode: "pull"`. Queues not listed are in-process only. */
  queues?: Record<string, QueueConfig>;
  /** Credentials for the control plane, inbound pushes, callbacks and signed links. Absent ⇒ open host. */
  auth?: AuthConfig;
  /** Namespace new runs are created in and `listRuns` filters by. Default `"default"`. */
  namespace?: string;
  /** Base URL peers reach this host on; fills `complete_url` on an outbound push. */
  publicUrl?: string;
  /**
   * Path prefix this host is mounted under, e.g. `"/api/vlo"` for a Next route file at
   * `app/api/vlo/[[...path]]/route.ts`. The router strips it before matching and every URL
   * built from `publicUrl` carries it.
   */
  basePath?: string;
  /** How often an open SSE stream looks for new journal events. Default 500 ms. */
  streamPollMs?: number;
  /** Clock for every journaled timestamp, in epoch milliseconds. Default `Date.now`. */
  now?: () => number;
  /** Injected for tests; otherwise the wasm kernel is loaded on `start`. */
  kernel?: Kernel;
  /** Outbox dispatcher tuning. Only read when this host holds the `orchestrator` role. */
  dispatcher?: DispatcherOptions;
}

/** A running (or startable) host: the fetch handler plus the controls a process owner needs. */
export interface Host {
  /** The HTTP surface as a `(Request) => Response`. Starts the host on first call. */
  readonly fetch: FetchHandler;
  /** Loads the kernel, migrates the journal and starts the dispatcher. Idempotent. */
  start(): Promise<void>;
  /**
   * Stops the dispatcher, waits up to {@link SHUTDOWN_GRACE_MS} for in-process handlers, then
   * closes the journal if the host opened it from a URL. Idempotent.
   */
  stop(): Promise<void>;
  /** One dispatcher pass. Rejects on a host without the `orchestrator` role. */
  tick(): Promise<TickCounts>;
  /**
   * Ticks until the outbox is idle or `maxMs` (default 25 s) runs out. Concurrent callers
   * share one drain. Rejects on a host without the `orchestrator` role.
   */
  drain(options?: DrainOptions): Promise<DrainResult>;
  /** In-memory side channel: `emit` (from `cmd.emit`), `warning` (dispatcher) and `task_scheduled`. */
  readonly events: EventEmitter;
  /** The journal this host reads and writes. */
  readonly journal: Journal;
  /** Roles this process holds. */
  readonly roles: ReadonlySet<Role>;
  /** Base URL peers reach this host on. Settable, so {@link serve} can fill it after binding a port. */
  publicUrl: string | undefined;
}

/** `tick` and `drain` move the outbox, which only an orchestrator owns. */
class NoOrchestrator extends Error {
  constructor(what: string, roles: ReadonlySet<Role>) {
    super(
      `vlo host: ${what}() needs the "orchestrator" role; this host holds [${[...roles].join(", ")}]`,
    );
    this.name = "NoOrchestrator";
  }
}

const NOT_STARTED: Kernel = new Proxy({} as Kernel, {
  get() {
    throw new Error("vlo host: call start() (or serve()) before submitting events");
  },
});

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
export function createHost(options: CreateHostOptions): Host {
  const ownsJournal = typeof options.journal === "string";
  const journal = ownsJournal ? openJournal(options.journal as string) : (options.journal as Journal);
  const blob =
    typeof options.blob === "string" || options.blob === undefined
      ? openBlobStore(options.blob ?? DEFAULT_BLOB_URL)
      : options.blob;

  const registries = mergeDomains(options);
  const workers = [...registries.workers];
  const roles = new Set<Role>(options.roles ?? defaultRoles(workers));
  const events = new EventEmitter();
  events.setMaxListeners(0);

  let dispatcher: Dispatcher | undefined;
  const ctx: HostContext = {
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
    ...(options.publicUrl !== undefined ? { publicUrl: options.publicUrl } : {}),
    ...withBasePath(options.basePath),
    streamPollMs: options.streamPollMs ?? DEFAULT_STREAM_POLL_MS,
    events,
    kick: () => dispatcher?.kick(),
    inProcess: new InProcessTracker(),
  };

  /** One drain at a time per host: a second caller joins the one already running. */
  let draining: Promise<DrainResult> | null = null;

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
      void pending.catch(() => undefined).then(() => {
        if (draining === pending) draining = null;
      });
      return pending;
    };
  }

  const router = createRouter(ctx);
  let ready: Promise<void> | null = null;
  let closing: Promise<void> | null = null;
  const start = (): Promise<void> => (ready ??= boot(ctx, options, dispatcher));

  return {
    fetch: async (request) => {
      await start();
      return router(request);
    },
    start,
    tick() {
      if (ctx.tick === undefined) return Promise.reject(new NoOrchestrator("tick", roles));
      return ctx.tick();
    },
    drain(drainOptions = {}) {
      if (ctx.drain === undefined) return Promise.reject(new NoOrchestrator("drain", roles));
      return ctx.drain(drainOptions);
    },
    /** Idempotent: a host may be stopped by its owner and again by a shutdown hook. */
    stop() {
      closing ??= (async () => {
        // Order matters: no more passes, then no more in-process handlers, then the journal
        // goes. A handler that outlives the grace window meets `JournalClosed`, which the
        // dispatcher drops as shutdown rather than reporting as a fault.
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
    set publicUrl(url: string | undefined) {
      if (url === undefined) delete ctx.publicUrl;
      else ctx.publicUrl = url;
    },
  };
}

async function boot(
  ctx: HostContext,
  options: CreateHostOptions,
  dispatcher: Dispatcher | undefined,
): Promise<void> {
  ctx.kernel = options.kernel ?? (await loadKernel());
  await ctx.journal.migrate();
  await registerSchemas(ctx);
  dispatcher?.start();
}

/** {@link CreateHostOptions} plus where to listen. */
export interface ServeOptions extends CreateHostOptions {
  /** TCP port to bind. Default {@link DEFAULT_PORT}; `0` picks a free one. */
  port?: number;
  /** Interface to bind. Default `127.0.0.1`. */
  hostname?: string;
}

/** A bound server: the listener's `url`, `port` and `close()`, plus the host behind it. */
export interface ServeResult extends Listening {
  /** The host serving requests. `close()` on the result stops it too. */
  host: Host;
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
export async function serve(options: ServeOptions): Promise<ServeResult> {
  const host = createHost(options);
  const listener = await listen(host.fetch, options.port ?? DEFAULT_PORT, options.hostname);
  host.publicUrl = options.publicUrl ?? listener.url;
  await host.start();

  return {
    ...listener,
    host,
    async close() {
      await listener.close();
      await host.stop();
    },
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
export function handler(options: CreateHostOptions): { GET: FetchHandler; POST: FetchHandler } {
  let host: Host | undefined;
  const serveOne: FetchHandler = (request) => {
    host ??= createHost(options);
    return host.fetch(request);
  };
  return { GET: serveOne, POST: serveOne };
}

function timeout(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

/** `exactOptionalPropertyTypes`: an absent base path must be an absent key, not `undefined`. */
function withBasePath(value: string | undefined): { basePath?: string } {
  const basePath = normalizeBasePath(value);
  return basePath === undefined ? {} : { basePath };
}

function defaultRoles(workers: readonly Worker[]): Role[] {
  const roles: Role[] = ["orchestrator", "api"];
  for (const worker of workers) {
    for (const queue of worker.queues) roles.push(`worker:${queue}`);
  }
  return roles;
}

function byName<T extends { name: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.name, item]));
}
