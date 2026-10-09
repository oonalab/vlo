/**
 * Loading `vlo.config.ts` and the modules it points at.
 *
 * The config is imported, not parsed: Node 24 strips TypeScript types natively, so a `.ts`
 * config runs with no build step. The limitation that buys us — and it is the reason this
 * is a load step and not a bundler — is that the config file itself may only use relative
 * imports with explicit extensions. Path aliases and extensionless specifiers are not supported yet.
 */

import { glob, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Workflow } from "../core/workflow.ts";
import type {
  ActivityRegistration,
  QueueConfig,
  Role,
  SignalRegistration,
} from "../host/context.ts";
import type { Worker } from "../host/worker/registry.ts";
import {
  DEFAULT_CONFIG,
  isEnvRef,
  type DeployTarget,
  type DispatcherProfile,
  type Profile,
  type Ref,
  type VloConfig,
} from "./define.ts";

const CONFIG_NAMES = ["vlo.config.ts", "vlo.config.js", "vlo.config.mjs"];

/** A resolved `deploy` block. Every value here is safe to write into a template. */
export interface LoadedDeploy {
  target: DeployTarget;
  project?: string;
  region?: string;
  namePrefix?: string;
  service?: string;
  bucket?: string;
  envs?: string[];
  secretName?: string;
  cron?: string;
}

export interface LoadedProfile {
  name: string;
  journal: string;
  blob: string;
  queues: Record<string, QueueConfig>;
  auth: { token?: string; pushSecret?: string };
  publicUrl?: string;
  port?: number;
  roles?: Role[];
  dispatcher?: DispatcherProfile;
  deploy?: LoadedDeploy;
}

export interface LoadedConfig {
  /** Absent when no config file was found and the built-in default was used. */
  configPath?: string;
  /**
   * Directory every relative path in the profile resolves against: the config file's
   * directory, or `cwd` when the built-in default was used. Workflow globs and the
   * `sqlite://` / `file://` URLs in {@link LoadedProfile} are already resolved against it.
   */
  root: string;
  profile: LoadedProfile;
  workflows: Workflow[];
  workers: Worker[];
  activities: ActivityRegistration[];
  signals: SignalRegistration[];
}

/** How {@link loadConfig} picks a profile when none is named. */
export interface LoadConfigOptions {
  /**
   * With `profileName` undefined: use `local` when the config has one, else its only
   * profile. Off by default, in which case an unnamed profile is an error.
   */
  implicitProfile?: boolean;
}

/**
 * Finds and imports the config, picks a profile, resolves `env()` references and imports
 * every module the globs match. Relative `sqlite://` and `file://` URLs in the profile are
 * made absolute against the config directory, so they mean the same thing from any `cwd`.
 */
export async function loadConfig(
  cwd: string,
  profileName: string | undefined,
  configPath?: string,
  opts: LoadConfigOptions = {},
): Promise<LoadedConfig> {
  const found = configPath !== undefined ? resolve(cwd, configPath) : await findConfig(cwd);
  const config = found === null ? DEFAULT_CONFIG : await importConfig(found);
  const root = found === null ? cwd : dirOf(found);

  const [name, profile] = selectProfile(config.profiles, profileName, opts.implicitProfile === true);

  const modules = await importAll(root, [
    ...patterns(config.workflows),
    ...patterns(config.workers),
    ...patterns(config.activities),
  ]);

  return {
    ...(found !== null ? { configPath: found } : {}),
    root,
    profile: resolveProfile(name, profile, root),
    workflows: collect<Workflow>(modules, "workflow"),
    workers: collect<Worker>(modules, "worker"),
    activities: collect<ActivityRegistration>(modules, "activity"),
    signals: collect<SignalRegistration>(modules, "signal"),
  };
}

function selectProfile(
  profiles: Record<string, Profile>,
  name: string | undefined,
  implicit: boolean,
): [string, Profile] {
  const available = Object.keys(profiles);
  if (name !== undefined) {
    const profile = profiles[name];
    if (profile === undefined) {
      throw new Error(`no profile "${name}" in the config; available: ${available.join(", ")}`);
    }
    return [name, profile];
  }

  const local = profiles["local"];
  if (implicit && local !== undefined) return ["local", local];
  const [sole] = available;
  if (implicit && sole !== undefined && available.length === 1) {
    return [sole, profiles[sole] as Profile];
  }
  throw new Error(`no profile selected; pass --profile; available: ${available.join(", ")}`);
}

/**
 * `sqlite://<relative>` and `file://<relative>` become `sqlite://<root>/<relative>` and
 * `file://<root>/<relative>`; `:memory:`, absolute paths (`sqlite:///abs`, `file:///abs`)
 * and every other scheme (`postgres://`, `gcs://`) pass through untouched.
 */
function absolutize(url: string, root: string): string {
  const match = /^(sqlite|file):\/\/(.*)$/.exec(url);
  if (match === null) return url;
  const scheme = match[1] ?? "";
  const path = match[2] ?? "";
  if (path.length === 0 || path === ":memory:" || isAbsolute(path)) return url;
  return `${scheme}://${resolve(root, path)}`;
}

function resolveProfile(name: string, profile: Profile, root: string): LoadedProfile {
  const queues: Record<string, QueueConfig> = {};
  for (const [queue, spec] of Object.entries(profile.queues ?? {})) {
    queues[queue] = {
      ...optional("url", resolveRef(spec.url)),
      ...optional("secret", resolveRef(spec.secret)),
      ...(spec.mode !== undefined ? { mode: spec.mode } : {}),
    };
  }

  return {
    name,
    journal: absolutize(required(resolveRef(profile.journal), "journal"), root),
    blob: absolutize(resolveRef(profile.blob) ?? "file://.vlo/blobs", root),
    queues,
    auth: {
      ...optional("token", resolveRef(profile.auth?.token)),
      ...optional("pushSecret", resolveRef(profile.auth?.pushSecret)),
    },
    ...optional("publicUrl", resolveRef(profile.publicUrl ?? profile.host)),
    ...(profile.port !== undefined ? { port: profile.port } : {}),
    ...(profile.roles !== undefined ? { roles: [...profile.roles] } : {}),
    ...(profile.dispatcher !== undefined ? { dispatcher: { ...profile.dispatcher } } : {}),
    ...(profile.deploy !== undefined ? { deploy: resolveDeploy(profile.deploy) } : {}),
  };
}

function resolveDeploy(deploy: NonNullable<Profile["deploy"]>): LoadedDeploy {
  return {
    target: deploy.target,
    ...optional("project", resolveRef(deploy.project)),
    ...optional("region", resolveRef(deploy.region)),
    ...optional("namePrefix", resolveRef(deploy.namePrefix)),
    ...optional("service", resolveRef(deploy.service)),
    ...optional("bucket", resolveRef(deploy.bucket)),
    ...(deploy.envs !== undefined ? { envs: [...deploy.envs] } : {}),
    ...optional("secretName", resolveRef(deploy.secretName)),
    ...optional("cron", resolveRef(deploy.cron)),
  };
}

function resolveRef(ref: Ref | undefined): string | undefined {
  if (ref === undefined) return undefined;
  if (!isEnvRef(ref)) return ref;

  const value = process.env[ref.__env];
  if (value === undefined || value.length === 0) {
    if (ref.optional === true) return undefined;
    throw new Error(`the environment variable ${ref.__env} is required by this profile but unset`);
  }
  return value;
}

function required(value: string | undefined, field: string): string {
  if (value === undefined) throw new Error(`the profile has no "${field}"`);
  return value;
}

function optional<K extends string>(key: K, value: string | undefined): Record<K, string> | object {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

async function findConfig(cwd: string): Promise<string | null> {
  for (const name of CONFIG_NAMES) {
    const candidate = join(cwd, name);
    if (await exists(candidate)) return candidate;
  }
  return null;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function importConfig(path: string): Promise<VloConfig> {
  const loaded = (await import(pathToFileURL(path).href)) as { default?: VloConfig };
  if (loaded.default === undefined) {
    throw new Error(`${path} has no default export; use \`export default defineConfig({ … })\``);
  }
  return loaded.default;
}

function patterns(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : [...value];
}

async function importAll(root: string, globs: string[]): Promise<Record<string, unknown>[]> {
  const paths = new Set<string>();
  for (const pattern of globs) {
    for await (const match of glob(pattern, { cwd: root, exclude: ["**/node_modules/**"] })) {
      paths.add(isAbsolute(match) ? match : join(root, match));
    }
  }
  return Promise.all(
    [...paths].sort().map((path) => import(pathToFileURL(path).href) as Promise<Record<string, unknown>>),
  );
}

/**
 * Anything a module exports that carries the right `kind` marker — default export or named,
 * so re-exporting an activity from a workflow file registers it too. Deduped by `name` where
 * there is one (workers have none) and by identity otherwise.
 */
function collect<T>(modules: Record<string, unknown>[], kind: string): T[] {
  const byName = new Map<string, unknown>();
  const anonymous = new Set<unknown>();

  for (const exports of modules) {
    for (const value of Object.values(exports)) {
      if (!isKind(value, kind)) continue;
      const name = (value as { name?: unknown }).name;
      if (typeof name === "string") {
        if (!byName.has(name)) byName.set(name, value);
      } else {
        anonymous.add(value);
      }
    }
  }
  return [...byName.values(), ...anonymous] as T[];
}

function isKind(value: unknown, kind: string): boolean {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === kind;
}

function dirOf(path: string): string {
  return resolve(path, "..");
}
