/**
 * The deploy plan: everything a template is allowed to know.
 *
 * `LoadedConfig` holds resolved secrets — the journal url, the bearer token, the push
 * secret. A template must never see them, so this module projects the loaded profile onto
 * a plan of names, regions and modes, and the renderers take only the plan. That is the
 * whole reason for the indirection: it makes "no secret in a generated file" a type
 * boundary rather than a review habit.
 */

import type { DeployTarget, LoadedConfig } from "../config/index.ts";
import type { Role } from "../host/context.ts";
import { cloudRunCommands, renderCloudRun } from "./cloud-run.ts";
import { renderVercel, vercelCommands } from "./vercel.ts";

export interface RenderedFile {
  /** Relative to the `--out` directory. */
  path: string;
  contents: string;
}

export interface QueuePlan {
  name: string;
  mode: "push" | "pull" | "in-process";
}

export interface DeployPlan {
  profile: string;
  target: DeployTarget;
  project?: string;
  region: string;
  /** First segment of every generated resource name: `<namePrefix>-<env>-<service>`. */
  namePrefix: string;
  /** Component segment of the per-env resource names: `<namePrefix>-<env>-<service>`. */
  service: string;
  bucket?: string;
  envs: string[];
  secretName: string;
  cron: string;
  roles: Role[];
  dispatcherMode: "loop" | "manual";
  queues: QueuePlan[];
  blobScheme: string;
  workflows: string[];
}

const DEFAULTS = {
  region: "europe-west4",
  namePrefix: "vlo",
  service: "vlo",
  secretName: "vlo",
  cron: "* * * * *",
  envs: ["staging", "prod"],
} as const;

export function planDeploy(loaded: LoadedConfig): DeployPlan {
  const deploy = loaded.profile.deploy;
  if (deploy === undefined) {
    throw new Error(
      `profile "${loaded.profile.name}" has no \`deploy\` block; add ` +
        `deploy: { target: "cloud-run" | "vercel" } to vlo.config.ts`,
    );
  }

  const queues: QueuePlan[] = Object.entries(loaded.profile.queues).map(([name, config]) => ({
    name,
    mode: config.mode === "pull" ? "pull" : config.url !== undefined ? "push" : "in-process",
  }));

  return {
    profile: loaded.profile.name,
    target: deploy.target,
    ...(deploy.project !== undefined ? { project: deploy.project } : {}),
    region: deploy.region ?? DEFAULTS.region,
    namePrefix: deploy.namePrefix ?? DEFAULTS.namePrefix,
    service: deploy.service ?? DEFAULTS.service,
    ...bucketOf(deploy.bucket, loaded.profile.blob),
    envs: deploy.envs ?? [...DEFAULTS.envs],
    secretName: deploy.secretName ?? DEFAULTS.secretName,
    cron: deploy.cron ?? DEFAULTS.cron,
    roles: loaded.profile.roles ?? ["orchestrator", "api"],
    dispatcherMode: loaded.profile.dispatcher?.mode ?? "loop",
    queues,
    blobScheme: schemeOf(loaded.profile.blob),
    workflows: loaded.workflows.map((w) => w.name).sort(),
  };
}

export function render(plan: DeployPlan): RenderedFile[] {
  return plan.target === "cloud-run" ? renderCloudRun(plan) : renderVercel(plan);
}

/** What `--apply` prints. Vlo never runs these: applying is the operator's call. */
export function commands(plan: DeployPlan): string[] {
  return plan.target === "cloud-run" ? cloudRunCommands(plan) : vercelCommands(plan);
}

function bucketOf(explicit: string | undefined, blobUrl: string): { bucket?: string } {
  if (explicit !== undefined) return { bucket: explicit };
  if (!blobUrl.startsWith("gcs://")) return {};
  const [bucket] = blobUrl.slice("gcs://".length).split("/");
  return bucket !== undefined && bucket.length > 0 ? { bucket } : {};
}

function schemeOf(url: string): string {
  const end = url.indexOf("://");
  return end === -1 ? url : url.slice(0, end);
}
