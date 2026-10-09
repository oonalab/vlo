/**
 * `vlo.config.ts` — where the code lives and how each environment is wired.
 *
 * Secrets never sit in the file. `env("DATABASE_URL")` records the *name* of a variable;
 * `loadConfig` resolves it at start-up and says which one is missing when it is.
 */

import type { Role } from "../host/context.ts";

/** A reference to an environment variable, as {@link env} builds it. Resolved at load time. */
export interface EnvRef {
  /** Name of the environment variable. */
  readonly __env: string;
  /** When `true`, an unset or empty variable resolves to "absent" instead of failing the load. */
  readonly optional?: boolean;
}

/** A literal value, or the name of the environment variable holding it. */
export type Ref = string | EnvRef;

/**
 * Refers to an environment variable by name so a secret never sits in `vlo.config.ts`.
 *
 * The value is read when the profile is loaded, not when `env` is called. An unset or empty
 * variable fails the load with a message naming the variable, unless `optional` is `true`,
 * in which case the field is simply absent.
 *
 * @example
 * ```ts
 * import { defineConfig, env } from "@vlo/sdk";
 *
 * export default defineConfig({
 *   workflows: ["*.workflow.ts"],
 *   profiles: {
 *     prod: {
 *       journal: env("DATABASE_URL"),
 *       auth: { token: env("VLO_TOKEN"), pushSecret: env("VLO_PUSH_SECRET", { optional: true }) },
 *     },
 *   },
 * });
 * ```
 */
export function env(name: string, options: { optional?: boolean } = {}): EnvRef {
  return { __env: name, ...(options.optional !== undefined ? { optional: options.optional } : {}) };
}

/** Whether `value` is an {@link EnvRef} rather than a literal. */
export function isEnvRef(value: unknown): value is EnvRef {
  return typeof value === "object" && value !== null && "__env" in value;
}

/**
 * How tasks on one queue reach their workers. A queue with neither `url` nor `mode` is
 * served only by a worker in the same process.
 */
export interface QueueProfile {
  /** Endpoint the dispatcher pushes tasks to, payload included. */
  url?: Ref;
  /** HMAC secret shared with the worker behind `url`; required for an HTTP push. */
  secret?: Ref;
  /** `"push"` delivers to `url`; `"pull"` never pushes and lets workers long-poll the host instead. */
  mode?: "push" | "pull";
}

/** Outbox dispatcher settings for a profile holding the `orchestrator` role. */
export interface DispatcherProfile {
  /** `manual` never arms the interval: something outside must call the tick route. */
  mode?: "loop" | "manual";
  /** Interval between dispatcher passes in `loop` mode, in milliseconds. Default `500`. */
  tickMs?: number;
}

/** Platform `vlo deploy` renders templates for. */
export type DeployTarget = "cloud-run" | "vercel";

/** What `vlo deploy` needs to write templates. Never a secret — only names and regions. */
export interface DeployProfile {
  /** Which set of templates to render. */
  target: DeployTarget;
  /** Cloud project id, where the target needs one. */
  project?: Ref;
  /** Region the service runs in. Default `europe-west4`. */
  region?: Ref;
  /**
   * First segment of every generated resource name: `<namePrefix>-<env>-<service>`. Must
   * equal the `prefix` of each entry in the Terraform `local.envs` the templates join.
   * Default `vlo`.
   */
  namePrefix?: Ref;
  /** Component name inside the per-env prefix, e.g. `<namePrefix>-<env>-<service>`. Default `vlo`. */
  service?: Ref;
  /** Bucket for offloaded payloads. Defaults to the bucket named by a `gcs://` `blob` URL. */
  bucket?: Ref;
  /** Terraform envs this profile is deployed to. Default `["staging", "prod"]`. */
  envs?: readonly string[];
  /** Middle segment of the generated Secret Manager secret ids. Default `vlo`. */
  secretName?: Ref;
  /** Cron expression driving the tick route on serverless targets. Default every minute. */
  cron?: Ref;
}

/** One environment's wiring: where state lives, how queues deliver, which roles run. */
export interface Profile {
  /** @deprecated Use `publicUrl`. Kept so existing configs keep loading. */
  host?: Ref;
  /** Base URL peers reach this host on. Fills `complete_url` on an outbound push. */
  publicUrl?: Ref;
  /** Journal URL: `sqlite://<path>` or a Postgres connection string. Required. */
  journal: Ref;
  /** Blob store URL for payloads over the inline limit: `file://<dir>` or `gcs://<bucket>/<prefix>`. Default `file://.vlo/blobs`. */
  blob?: Ref;
  /** Delivery settings per queue name; see {@link QueueProfile}. */
  queues?: Record<string, QueueProfile>;
  /** `token`: bearer for the control-plane routes. `pushSecret`: HMAC secret inbound pushes are verified with. */
  auth?: { token?: Ref; pushSecret?: Ref };
  /** Port `vlo serve` listens on. `--port` and `PORT` take precedence. */
  port?: number;
  /** Roles this process runs. Absent ⇒ orchestrator + api + every in-process worker. */
  roles?: readonly Role[];
  /** Outbox dispatcher settings; see {@link DispatcherProfile}. */
  dispatcher?: DispatcherProfile;
  /** Template inputs for `vlo deploy`; see {@link DeployProfile}. */
  deploy?: DeployProfile;
}

/** The shape of `vlo.config.ts`'s default export; build it with {@link defineConfig}. */
export interface VloConfig {
  /** Globs, relative to the config file. Every matching module is imported. */
  workflows: string | readonly string[];
  /** Globs of modules exporting {@link defineWorker} results. */
  workers?: string | readonly string[];
  /** Optional: modules exporting `activity()` / `signal()` definitions to register. */
  activities?: string | readonly string[];
  /**
   * Named environments; at least one is required. `vlo dev` picks `local` when present, else
   * the only profile, unless `--profile` / `VLO_PROFILE` names one; `serve`, `doctor` and
   * `deploy` always need a name.
   */
  profiles: Record<string, Profile>;
}

/**
 * Types and checks a `vlo.config.ts` and returns it unchanged for `export default`.
 *
 * Throws a `TypeError` when `profiles` is empty. Values wrapped with {@link env} are
 * resolved later, when the CLI loads the profile.
 *
 * @example
 * ```ts
 * import { defineConfig, env } from "@vlo/sdk";
 *
 * export default defineConfig({
 *   workflows: ["./workflows/*.workflow.ts"],
 *   workers: ["./workers/*.worker.ts"],
 *   profiles: {
 *     local: { journal: "sqlite://.vlo/dev.db", blob: "file://.vlo/blobs" },
 *     prod: {
 *       journal: env("DATABASE_URL"),
 *       auth: { token: env("VLO_TOKEN") },
 *       roles: ["orchestrator", "api"],
 *       queues: { media: { mode: "pull" } },
 *       dispatcher: { mode: "manual" },
 *       deploy: { target: "vercel", cron: "* * * * *" },
 *     },
 *   },
 * });
 * ```
 */
export function defineConfig(config: VloConfig): VloConfig {
  if (Object.keys(config.profiles).length === 0) {
    throw new TypeError("defineConfig: at least one profile is required");
  }
  return config;
}

/** Used when there is no `vlo.config.ts`: SQLite and a file blob store under `.vlo/`. */
export const DEFAULT_CONFIG: VloConfig = {
  workflows: ["**/*.workflow.{ts,js,mjs}"],
  workers: ["**/*.worker.{ts,js,mjs}"],
  profiles: {
    local: { journal: "sqlite://.vlo/dev.db", blob: "file://.vlo/blobs" },
  },
};
