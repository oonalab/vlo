#!/usr/bin/env node
import { y as sha256Hex } from "./domain-C6_UPgcw.js";
import { i as isEnvRef, t as DEFAULT_CONFIG } from "./define-B5qX4EZX.js";
import { $ as loadKernel, et as openJournal, nt as openBlobStore, s as serve } from "./roles-BlkU0x0U.js";
import { glob, mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { readFileSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
//#region src/config/load.ts
/**
* Loading `vlo.config.ts` and the modules it points at.
*
* The config is imported, not parsed: Node 24 strips TypeScript types natively, so a `.ts`
* config runs with no build step. The limitation that buys us — and it is the reason this
* is a load step and not a bundler — is that the config file itself may only use relative
* imports with explicit extensions. Path aliases and extensionless specifiers are not supported yet.
*/
const CONFIG_NAMES = [
	"vlo.config.ts",
	"vlo.config.js",
	"vlo.config.mjs"
];
/**
* Finds and imports the config, picks a profile, resolves `env()` references and imports
* every module the globs match. Relative `sqlite://` and `file://` URLs in the profile are
* made absolute against the config directory, so they mean the same thing from any `cwd`.
*/
async function loadConfig(cwd, profileName, configPath, opts = {}) {
	const found = configPath !== void 0 ? resolve(cwd, configPath) : await findConfig(cwd);
	const config = found === null ? DEFAULT_CONFIG : await importConfig(found);
	const root = found === null ? cwd : dirOf(found);
	const [name, profile] = selectProfile(config.profiles, profileName, opts.implicitProfile === true);
	const modules = await importAll(root, [
		...patterns(config.workflows),
		...patterns(config.workers),
		...patterns(config.activities)
	]);
	return {
		...found !== null ? { configPath: found } : {},
		root,
		profile: resolveProfile(name, profile, root),
		workflows: collect(modules, "workflow"),
		workers: collect(modules, "worker"),
		activities: collect(modules, "activity"),
		signals: collect(modules, "signal")
	};
}
function selectProfile(profiles, name, implicit) {
	const available = Object.keys(profiles);
	if (name !== void 0) {
		const profile = profiles[name];
		if (profile === void 0) throw new Error(`no profile "${name}" in the config; available: ${available.join(", ")}`);
		return [name, profile];
	}
	const local = profiles["local"];
	if (implicit && local !== void 0) return ["local", local];
	const [sole] = available;
	if (implicit && sole !== void 0 && available.length === 1) return [sole, profiles[sole]];
	throw new Error(`no profile selected; pass --profile; available: ${available.join(", ")}`);
}
/**
* `sqlite://<relative>` and `file://<relative>` become `sqlite://<root>/<relative>` and
* `file://<root>/<relative>`; `:memory:`, absolute paths (`sqlite:///abs`, `file:///abs`)
* and every other scheme (`postgres://`, `gcs://`) pass through untouched.
*/
function absolutize(url, root) {
	const match = /^(sqlite|file):\/\/(.*)$/.exec(url);
	if (match === null) return url;
	const scheme = match[1] ?? "";
	const path = match[2] ?? "";
	if (path.length === 0 || path === ":memory:" || isAbsolute(path)) return url;
	return `${scheme}://${resolve(root, path)}`;
}
function resolveProfile(name, profile, root) {
	const queues = {};
	for (const [queue, spec] of Object.entries(profile.queues ?? {})) queues[queue] = {
		...optional("url", resolveRef(spec.url)),
		...optional("secret", resolveRef(spec.secret)),
		...spec.mode !== void 0 ? { mode: spec.mode } : {}
	};
	return {
		name,
		journal: absolutize(required(resolveRef(profile.journal), "journal"), root),
		blob: absolutize(resolveRef(profile.blob) ?? "file://.vlo/blobs", root),
		queues,
		auth: {
			...optional("token", resolveRef(profile.auth?.token)),
			...optional("pushSecret", resolveRef(profile.auth?.pushSecret))
		},
		...optional("publicUrl", resolveRef(profile.publicUrl ?? profile.host)),
		...profile.port !== void 0 ? { port: profile.port } : {},
		...profile.roles !== void 0 ? { roles: [...profile.roles] } : {},
		...profile.dispatcher !== void 0 ? { dispatcher: { ...profile.dispatcher } } : {},
		...profile.deploy !== void 0 ? { deploy: resolveDeploy(profile.deploy) } : {}
	};
}
function resolveDeploy(deploy) {
	return {
		target: deploy.target,
		...optional("project", resolveRef(deploy.project)),
		...optional("region", resolveRef(deploy.region)),
		...optional("namePrefix", resolveRef(deploy.namePrefix)),
		...optional("service", resolveRef(deploy.service)),
		...optional("bucket", resolveRef(deploy.bucket)),
		...deploy.envs !== void 0 ? { envs: [...deploy.envs] } : {},
		...optional("secretName", resolveRef(deploy.secretName)),
		...optional("cron", resolveRef(deploy.cron))
	};
}
function resolveRef(ref) {
	if (ref === void 0) return void 0;
	if (!isEnvRef(ref)) return ref;
	const value = process.env[ref.__env];
	if (value === void 0 || value.length === 0) {
		if (ref.optional === true) return void 0;
		throw new Error(`the environment variable ${ref.__env} is required by this profile but unset`);
	}
	return value;
}
function required(value, field) {
	if (value === void 0) throw new Error(`the profile has no "${field}"`);
	return value;
}
function optional(key, value) {
	return value === void 0 ? {} : { [key]: value };
}
async function findConfig(cwd) {
	for (const name of CONFIG_NAMES) {
		const candidate = join(cwd, name);
		if (await exists(candidate)) return candidate;
	}
	return null;
}
async function exists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}
async function importConfig(path) {
	const loaded = await import(pathToFileURL(path).href);
	if (loaded.default === void 0) throw new Error(`${path} has no default export; use \`export default defineConfig({ … })\``);
	return loaded.default;
}
function patterns(value) {
	if (value === void 0) return [];
	return typeof value === "string" ? [value] : [...value];
}
async function importAll(root, globs) {
	const paths = /* @__PURE__ */ new Set();
	for (const pattern of globs) for await (const match of glob(pattern, {
		cwd: root,
		exclude: ["**/node_modules/**"]
	})) paths.add(isAbsolute(match) ? match : join(root, match));
	return Promise.all([...paths].sort().map((path) => import(pathToFileURL(path).href)));
}
/**
* Anything a module exports that carries the right `kind` marker — default export or named,
* so re-exporting an activity from a workflow file registers it too. Deduped by `name` where
* there is one (workers have none) and by identity otherwise.
*/
function collect(modules, kind) {
	const byName = /* @__PURE__ */ new Map();
	const anonymous = /* @__PURE__ */ new Set();
	for (const exports of modules) for (const value of Object.values(exports)) {
		if (!isKind(value, kind)) continue;
		const name = value.name;
		if (typeof name === "string") {
			if (!byName.has(name)) byName.set(name, value);
		} else anonymous.add(value);
	}
	return [...byName.values(), ...anonymous];
}
function isKind(value, kind) {
	return typeof value === "object" && value !== null && value.kind === kind;
}
function dirOf(path) {
	return resolve(path, "..");
}
//#endregion
//#region src/cli/bootstrap.ts
/**
* What `vlo dev` and `vlo serve` share: load the config, open and migrate the journal,
* bind the port, and print the same four ✓ lines. The two verbs differ only in their
* defaults — that is the point, so a laptop and Cloud Run run identical code.
*/
async function start(options) {
	const loaded = await loadConfig(options.cwd, options.profile, options.configPath, { implicitProfile: options.implicitProfile === true });
	const journal = openJournal(loaded.profile.journal);
	await journal.migrate();
	line("journal", loaded.profile.journal);
	const names = loaded.workflows.map((w) => w.name).sort();
	line(`found ${names.length} workflow${names.length === 1 ? "" : "s"}`, names.join(" · "));
	describeWorkers(loaded.workers.length, Object.keys(loaded.profile.queues));
	const { roles, dispatcher, publicUrl } = loaded.profile;
	const running = await serve({
		journal,
		blob: loaded.profile.blob,
		workflows: loaded.workflows,
		workers: loaded.workers,
		activities: loaded.activities,
		signals: loaded.signals,
		queues: loaded.profile.queues,
		auth: loaded.profile.auth,
		...roles !== void 0 ? { roles } : {},
		...dispatcher !== void 0 ? { dispatcher } : {},
		...publicUrl !== void 0 ? { publicUrl } : {},
		port: options.port ?? loaded.profile.port ?? 4100
	});
	line("api", `http://localhost:${running.port}`);
	running.host.events.on("warning", (w) => {
		const detail = w.error instanceof Error ? `: ${w.error.message}` : "";
		process.stderr.write(`  ⚠ ${w.message}${detail}\n`);
	});
	const close = async () => {
		await running.close();
		await journal.close();
	};
	const shutdown = () => void close();
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);
	return {
		running,
		loaded,
		close
	};
}
function describeWorkers(count, remoteQueues) {
	if (count > 0) {
		line(`found ${count} worker${count === 1 ? "" : "s"}`, "in-process");
		return;
	}
	if (remoteQueues.length > 0) {
		line("workers", `remote via queues ${remoteQueues.join(" · ")}`);
		return;
	}
	process.stderr.write("  ⚠ no workers found: tasks will stay scheduled until a module exporting defineWorker() matches `workers` in vlo.config.ts, or a queue url is configured\n");
}
function line(label, value) {
	const gap = label.length >= 9 ? "   " : "";
	process.stdout.write(`  ✓ ${label.padEnd(9)}${gap}${value}\n`);
}
//#endregion
//#region src/cli/help.ts
/** `--help` detection, the `--profile` fallback and the package version, shared by every verb. */
/** From `src/cli/` (tsx) and from `dist/` (built), respectively. */
const PACKAGE_JSON_CANDIDATES = ["../../package.json", "../package.json"];
function wantsHelp(argv) {
	return argv.includes("--help") || argv.includes("-h");
}
/** `--profile`, then `VLO_PROFILE`; an empty value counts as unset. */
function profileArg(values) {
	const profile = values.profile ?? process.env["VLO_PROFILE"];
	return profile === void 0 || profile.length === 0 ? void 0 : profile;
}
/** {@link profileArg}, but a missing profile is an error quoting the verb's usage. */
function requireProfile(values, usage) {
	const profile = profileArg(values);
	if (profile === void 0) throw new Error(`${usage}\n  --profile is required (or set VLO_PROFILE)`);
	return profile;
}
function version() {
	for (const candidate of PACKAGE_JSON_CANDIDATES) try {
		const pkg = JSON.parse(readFileSync(new URL(candidate, import.meta.url), "utf8"));
		if (pkg.name === "@vlo/sdk" && typeof pkg.version === "string") return pkg.version;
	} catch {
		continue;
	}
	throw new Error("vlo: could not find the SDK's package.json");
}
//#endregion
//#region src/cli/dev.ts
/**
* `vlo dev` — the whole engine on a laptop: SQLite, a file blob store, every role in one
* process. No hot reload and no console yet; the point is that `vlo dev` and a Cloud Run
* deployment run the same `serve()`.
*
* The profile is `--profile`, then `VLO_PROFILE`, then `local` if the config has one, then
* the config's only profile. A config with several profiles and no `local` needs the flag.
*/
const USAGE$4 = "vlo dev [--config <path>] [--profile <name>] [--port <n>]";
async function dev(argv, cwd = process.cwd()) {
	const { values } = parseArgs({
		args: [...argv],
		options: {
			config: { type: "string" },
			profile: { type: "string" },
			port: { type: "string" }
		}
	});
	const profile = profileArg(values);
	return start({
		cwd,
		...profile !== void 0 ? { profile } : {},
		implicitProfile: true,
		...values.config !== void 0 ? { configPath: values.config } : {},
		...values.port !== void 0 ? { port: Number(values.port) } : {}
	});
}
//#endregion
//#region src/deploy/cloud-run-tf.ts
/** Terraform identifiers cannot contain `-`. */
function varName(plan) {
	return plan.service.replace(/[^A-Za-z0-9_]/g, "_");
}
function service(plan) {
	const v = varName(plan);
	return `// Vlo host on Cloud Run — generated by \`vlo deploy --profile ${plan.profile}\`.
//
// Drop into terraform/ beside cloud-run-video-renderer.tf; this file reuses that module's
// \`local.envs\` (pubsub.tf), \`local.env_buckets\` (storage.tf), \`var.project_id\` and the
// \`google_project_service\` enablements already declared there.

variable "${v}_image" {
  description = "Initial container image. The real image is pushed by the Cloud Build trigger; Terraform ignores later image changes (lifecycle.ignore_changes)."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "${v}_location" {
  description = "Cloud Run region for the Vlo host."
  type        = string
  default     = "${plan.region}"
}

variable "${v}_envs" {
  description = "Envs from local.envs the Vlo host is deployed to."
  type        = list(string)
  default     = ${hclList(plan.envs)}
}

locals {
  ${v}_envs = { for name, env in local.envs : name => env if contains(var.${v}_envs, name) }
}

// ===========================================================================
// Secrets
// ===========================================================================
//
// First service in this project that needs a database, so the first that needs Secret
// Manager. Terraform declares the secret *containers* only — versions hold the values and
// would land in state, so they are added out of band, once per env:
//
//   printf '%s' "$DATABASE_URL" | gcloud secrets versions add <secret-id> --data-file=-
//
// A service revision resolves "latest" at start-up, so rotating a secret is a new version
// plus a restart, with no Terraform run.

resource "google_secret_manager_secret" "${v}_database_url" {
  for_each = local.${v}_envs

  project   = var.project_id
  secret_id = "\${each.value.prefix}-${plan.secretName}-database-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "${v}_token" {
  for_each = local.${v}_envs

  project   = var.project_id
  secret_id = "\${each.value.prefix}-${plan.secretName}-token"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "${v}_push_secret" {
  for_each = local.${v}_envs

  project   = var.project_id
  secret_id = "\${each.value.prefix}-${plan.secretName}-push-secret"

  replication {
    auto {}
  }
}

// ===========================================================================
// Per-env service account (least privilege)
// ===========================================================================

resource "google_service_account" "${v}" {
  for_each = local.${v}_envs

  account_id   = "\${each.value.prefix}-${plan.service}"
  display_name = "Vlo host (\${each.key})"
  description  = "Durable execution host for \${each.key}"
  project      = var.project_id
}

// Blob store: offloaded payloads and checkpoints, in the env's own bucket.
resource "google_storage_bucket_iam_member" "${v}_storage" {
  for_each = local.${v}_envs

  bucket = local.env_buckets[each.key]
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:\${google_service_account.${v}[each.key].email}"
}

resource "google_secret_manager_secret_iam_member" "${v}_database_url" {
  for_each = local.${v}_envs

  project   = var.project_id
  secret_id = google_secret_manager_secret.${v}_database_url[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:\${google_service_account.${v}[each.key].email}"
}

resource "google_secret_manager_secret_iam_member" "${v}_token" {
  for_each = local.${v}_envs

  project   = var.project_id
  secret_id = google_secret_manager_secret.${v}_token[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:\${google_service_account.${v}[each.key].email}"
}

resource "google_secret_manager_secret_iam_member" "${v}_push_secret" {
  for_each = local.${v}_envs

  project   = var.project_id
  secret_id = google_secret_manager_secret.${v}_push_secret[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:\${google_service_account.${v}[each.key].email}"
}

// Structured logs from the dispatcher and the router.
resource "google_project_iam_member" "${v}_log_writer" {
  for_each = local.${v}_envs

  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:\${google_service_account.${v}[each.key].email}"
}

// ===========================================================================
// Cloud Run service
// ===========================================================================

resource "google_cloud_run_v2_service" "${v}" {
  for_each = local.${v}_envs

  name     = "\${each.value.prefix}-${plan.service}"
  location = var.${v}_location
  project  = var.project_id

  template {
    // Long-poll task claims and SSE streams hold a request open; 3600s is the ceiling.
    timeout = "3600s"

    // The host is I/O bound — it waits on Postgres and on worker pushes — so one instance
    // serves many runs.
    max_instance_request_concurrency = 80

    scaling {
      // The dispatcher is a background loop, not a request handler: scaling to zero would
      // stop timers firing and tasks being pushed.
      min_instance_count = 1
      max_instance_count = 3
    }

    service_account = google_service_account.${v}[each.key].email

    containers {
      image = var.${v}_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
        // The dispatcher ticks between requests, so CPU must not be throttled when idle.
        cpu_idle          = false
        startup_cpu_boost = true
      }

      env {
        name  = "VLO_PROFILE"
        value = "${plan.profile}"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "VLO_BUCKET"
        value = local.env_buckets[each.key]
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.${v}_database_url[each.key].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "VLO_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.${v}_token[each.key].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "VLO_PUSH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.${v}_push_secret[each.key].secret_id
            version = "latest"
          }
        }
      }
    }
  }

  ingress = "INGRESS_TRAFFIC_ALL"

  // The image is deployed by the Cloud Build trigger; without this every apply would roll
  // the running code back to the placeholder.
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }

  depends_on = [
    google_project_service.run,
  ]
}

// Open at the network edge, closed at the app layer: every control-plane route requires the
// bearer token in VLO_TOKEN, and inbound task callbacks are HMAC-signed with VLO_PUSH_SECRET.
// IAM invoker checks cannot be used here because the callers are workers on other platforms
// (Vercel functions, pollers) that hold a Vlo token, not a Google identity.
resource "google_cloud_run_v2_service_iam_member" "${v}_invoker" {
  for_each = local.${v}_envs

  project  = var.project_id
  location = var.${v}_location
  name     = google_cloud_run_v2_service.${v}[each.key].name

  role   = "roles/run.invoker"
  member = "allUsers"
}

output "${v}_urls" {
  description = "Public URL of the Vlo host per env; this is VLO_PUBLIC_URL for its peers."
  value       = { for name, service in google_cloud_run_v2_service.${v} : name => service.uri }
}
`;
}
function trigger(plan) {
	const v = varName(plan);
	return `// Vlo deploy automation (Cloud Build triggers) — generated by
// \`vlo deploy --profile ${plan.profile}\`.
//
// Terraform ignores the service's container image (cloud-run-vlo.tf), so deploys happen
// here: per-env triggers watch main and run the generated cloudbuild.yaml
// (build → push → gcloud run deploy). Staging deploys automatically; prod waits for a
// manual approval in the Cloud Build console.
//
// ONE-TIME MANUAL PREREQUISITE: the GitHub repo must be connected to Cloud Build (install
// the Google Cloud Build GitHub App, then connect the repo under Cloud Build →
// Repositories, 1st gen). \`terraform apply\` fails with "repository mapping does not
// exist" until that is done. \`var.github_owner\` / \`var.github_repo\` are declared in
// cloudbuild-video-renderer.tf.

resource "google_artifact_registry_repository" "${v}" {
  project       = var.project_id
  location      = var.${v}_location
  repository_id = "${plan.service}"
  description   = "Vlo host images (deployed via Cloud Build triggers)"
  format        = "DOCKER"

  depends_on = [google_project_service.artifactregistry]
}

// Dedicated deploy SA, so the blast radius of the pipeline is explicit.
resource "google_service_account" "${v}_deployer" {
  project      = var.project_id
  account_id   = "${plan.service}-deployer"
  display_name = "Vlo deployer (Cloud Build)"
  description  = "Builds and deploys the Vlo host Cloud Run services"
}

resource "google_artifact_registry_repository_iam_member" "${v}_deployer_ar_writer" {
  project    = var.project_id
  location   = google_artifact_registry_repository.${v}.location
  repository = google_artifact_registry_repository.${v}.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:\${google_service_account.${v}_deployer.email}"
}

resource "google_cloud_run_v2_service_iam_member" "${v}_deployer_run_developer" {
  for_each = local.${v}_envs

  project  = var.project_id
  location = var.${v}_location
  name     = google_cloud_run_v2_service.${v}[each.key].name
  role     = "roles/run.developer"
  member   = "serviceAccount:\${google_service_account.${v}_deployer.email}"
}

// Deploying a service that runs as the host SA requires actAs on it.
resource "google_service_account_iam_member" "${v}_deployer_act_as" {
  for_each = local.${v}_envs

  service_account_id = google_service_account.${v}[each.key].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:\${google_service_account.${v}_deployer.email}"
}

// Custom-SA builds must write logs explicitly.
resource "google_project_iam_member" "${v}_deployer_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:\${google_service_account.${v}_deployer.email}"
}

resource "google_cloudbuild_trigger" "${v}_deploy" {
  for_each = local.${v}_envs

  project     = var.project_id
  name        = "\${each.value.prefix}-${plan.service}-deploy"
  description = "Build + deploy the Vlo host to \${each.key} on engine or workflow changes"
  location    = "global"

  github {
    owner = var.github_owner
    name  = var.github_repo
    push {
      branch = "^main$"
    }
  }

  included_files = ["packages/vlo/**", "src/**/vlo/**", "vlo.config.ts"]
  filename       = "deploy/vlo/cloud-run/cloudbuild.yaml"

  substitutions = {
    _SERVICE = google_cloud_run_v2_service.${v}[each.key].name
    _REGION  = var.${v}_location
    _REPO    = google_artifact_registry_repository.${v}.repository_id
  }

  service_account = google_service_account.${v}_deployer.id

  dynamic "approval_config" {
    for_each = each.key == "prod" ? [1] : []
    content {
      approval_required = true
    }
  }

  depends_on = [google_project_service.cloudbuild]
}
`;
}
function hclList(values) {
	return `[${values.map((v) => `"${v}"`).join(", ")}]`;
}
//#endregion
//#region src/deploy/cloud-run.ts
/**
* Cloud Run templates.
*
* Shapes: a two-stage node:22-alpine image, a three-step cloudbuild, and per-env
* `for_each = local.envs` Terraform with the image under `lifecycle.ignore_changes`, so a
* generated stack reads like a hand-written one. Two things are new: the service needs a database, which means Secret Manager, and
* it is internet-reachable, which the control plane's bearer token — not IAM — protects.
*/
function renderCloudRun(plan) {
	return [
		{
			path: "cloud-run/Dockerfile",
			contents: dockerfile(plan)
		},
		{
			path: "cloud-run/cloudbuild.yaml",
			contents: cloudbuild(plan)
		},
		{
			path: "cloud-run/cloud-run-vlo.tf",
			contents: service(plan)
		},
		{
			path: "cloud-run/cloudbuild-vlo.tf",
			contents: trigger(plan)
		},
		{
			path: "cloud-run/README.md",
			contents: readme(plan)
		}
	];
}
function cloudRunCommands(plan) {
	const project = plan.project ?? "<project-id>";
	const first = plan.envs[0] ?? "staging";
	return [
		`# 1. copy the Terraform into the root module`,
		`cp deploy/vlo/cloud-run/*.tf terraform/`,
		``,
		`# 2. create the secret containers, then add a version per env (never in Terraform state)`,
		`terraform -chdir=terraform apply -target=google_secret_manager_secret.${varName(plan)}_database_url`,
		...plan.envs.flatMap((env) => [
			`printf '%s' "$DATABASE_URL" | gcloud secrets versions add ${plan.namePrefix}-${env}-${plan.secretName}-database-url --data-file=- --project ${project}`,
			`printf '%s' "$VLO_TOKEN" | gcloud secrets versions add ${plan.namePrefix}-${env}-${plan.secretName}-token --data-file=- --project ${project}`,
			`printf '%s' "$VLO_PUSH_SECRET" | gcloud secrets versions add ${plan.namePrefix}-${env}-${plan.secretName}-push-secret --data-file=- --project ${project}`
		]),
		``,
		`# 3. the rest of the stack`,
		`terraform -chdir=terraform apply`,
		``,
		`# 4. first image (later ones ride the Cloud Build trigger on main)`,
		`gcloud builds submit --config deploy/vlo/cloud-run/cloudbuild.yaml --project ${project} \\`,
		`  --substitutions _SERVICE=${plan.namePrefix}-${first}-${plan.service},_REGION=${plan.region},_REPO=${plan.service}`
	];
}
function dockerfile(plan) {
	return `# Vlo host image — generated by \`vlo deploy --profile ${plan.profile}\`.
# Build context is the repo root: the image needs the workspace, not just this directory.
#
#   docker build -f deploy/vlo/cloud-run/Dockerfile -t vlo .

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/vlo ./packages/vlo
RUN pnpm install --frozen-lockfile --filter @vlo/sdk...
RUN pnpm --filter @vlo/sdk build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
# The profile decides which modules are loaded; the globs in vlo.config.ts resolve
# against this directory, so everything they can match has to be here.
COPY vlo.config.ts ./
COPY src ./src

ENV VLO_PROFILE=${plan.profile}
# Cloud Run injects PORT (default 8080) and \`vlo serve\` honours it.
EXPOSE 8080
CMD ["pnpm", "exec", "vlo", "serve", "--profile", "${plan.profile}"]
`;
}
function cloudbuild(plan) {
	return `# Build + deploy the Vlo host to Cloud Run. Invoked by the per-env Cloud Build
# triggers in cloudbuild-vlo.tf (staging: auto on main; prod: same filter, gated on a
# manual approval). Substitutions:
#   _SERVICE — Cloud Run service name (e.g. ${plan.namePrefix}-prod-${plan.service})
#   _REGION  — Cloud Run + Artifact Registry region
#   _REPO    — Artifact Registry docker repo name
steps:
  - id: build
    name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - deploy/vlo/cloud-run/Dockerfile
      - -t
      - \${_REGION}-docker.pkg.dev/\${PROJECT_ID}/\${_REPO}/${plan.service}:\${SHORT_SHA}
      - -t
      - \${_REGION}-docker.pkg.dev/\${PROJECT_ID}/\${_REPO}/${plan.service}:latest
      - .

  - id: push
    name: gcr.io/cloud-builders/docker
    args:
      - push
      - --all-tags
      - \${_REGION}-docker.pkg.dev/\${PROJECT_ID}/\${_REPO}/${plan.service}

  - id: deploy
    name: gcr.io/google.com/cloudsdktool/cloud-sdk:slim
    entrypoint: gcloud
    args:
      - run
      - deploy
      - \${_SERVICE}
      - --image
      - \${_REGION}-docker.pkg.dev/\${PROJECT_ID}/\${_REPO}/${plan.service}:\${SHORT_SHA}
      - --region
      - \${_REGION}
      - --project
      - \${PROJECT_ID}

images:
  - \${_REGION}-docker.pkg.dev/\${PROJECT_ID}/\${_REPO}/${plan.service}:\${SHORT_SHA}
  - \${_REGION}-docker.pkg.dev/\${PROJECT_ID}/\${_REPO}/${plan.service}:latest

# Required when the trigger runs as a custom service account.
options:
  logging: CLOUD_LOGGING_ONLY
`;
}
function readme(plan) {
	const project = plan.project ?? "<project-id>";
	return `# Vlo on Cloud Run — \`${plan.profile}\`

Generated by \`vlo deploy --profile ${plan.profile}\`. Nothing here has been applied.

| File | Goes to | What it is |
| --- | --- | --- |
| \`Dockerfile\` | keep here | Two-stage image; \`CMD\` is \`vlo serve --profile ${plan.profile}\` |
| \`cloudbuild.yaml\` | keep here | build → push → \`gcloud run deploy\`, run by the triggers |
| \`cloud-run-vlo.tf\` | \`terraform/\` | Service, SA, IAM, Secret Manager containers |
| \`cloudbuild-vlo.tf\` | \`terraform/\` | Artifact Registry, deployer SA, per-env triggers |

Envs: ${plan.envs.join(", ")} · region \`${plan.region}\` · service \`\${prefix}-${plan.service}\`

## One-time setup

1. **Connect the repo to Cloud Build** — install the Google Cloud Build GitHub App and
   connect the repo under Cloud Build → Repositories (1st gen). Terraform cannot do this,
   and applies fail with "repository mapping does not exist" until it is done.
2. **Copy the Terraform** into the root module: \`cp *.tf ../../../terraform/\`.
3. **Create the secret containers**, then add a version per env. Versions are deliberately
   not in Terraform — a value in state is a value in every plan output:

${plan.envs.map((env) => `   \`\`\`bash
   printf '%s' "$DATABASE_URL"    | gcloud secrets versions add ${plan.namePrefix}-${env}-${plan.secretName}-database-url --data-file=- --project ${project}
   printf '%s' "$VLO_TOKEN"       | gcloud secrets versions add ${plan.namePrefix}-${env}-${plan.secretName}-token --data-file=- --project ${project}
   printf '%s' "$VLO_PUSH_SECRET" | gcloud secrets versions add ${plan.namePrefix}-${env}-${plan.secretName}-push-secret --data-file=- --project ${project}
   \`\`\``).join("\n")}
4. \`terraform -chdir=terraform apply\`.
5. Push to \`main\`. Staging builds and deploys; prod waits for approval in the Cloud Build
   console.

## Then

- \`vlo doctor --profile ${plan.profile}\` from a shell with the same env, before the first deploy.
- The service is reachable from the internet and protected by \`VLO_TOKEN\`; put a load
  balancer or IAP in front of it if you need network-level restriction too.
- Rotating a secret is \`gcloud secrets versions add\` plus a revision restart — no apply.
`;
}
//#endregion
//#region src/deploy/vercel.ts
const TICK_PATH = "/api/vlo/v1/timers/tick";
function renderVercel(plan) {
	const files = [{
		path: "vercel/route.ts",
		contents: route(plan)
	}, {
		path: "vercel/env.md",
		contents: envChecklist(plan)
	}];
	if (plan.roles.includes("orchestrator")) files.splice(1, 0, {
		path: "vercel/vercel-crons.json",
		contents: crons(plan)
	});
	return files;
}
function vercelCommands(plan) {
	return [
		`# 1. drop the route in`,
		`mkdir -p src/app/api/vlo/\\[\\[...path\\]\\]`,
		`cp deploy/vlo/vercel/route.ts "src/app/api/vlo/[[...path]]/route.ts"`,
		``,
		`# 2. environment (repeat for preview if you run one)`,
		...envNames(plan).map((name) => `vercel env add ${name} production`),
		``,
		...plan.roles.includes("orchestrator") ? [
			`# 3. merge deploy/vlo/vercel/vercel-crons.json into the "crons" array in vercel.json`,
			``,
			`# 4. ship`
		] : [`# 3. ship`],
		`vercel deploy --prod`
	];
}
function route(plan) {
	const queueLines = plan.queues.filter((q) => q.mode === "push").map((q) => `    ${key(q.name)}: { url: required("${envVar(q.name)}"), secret: required("VLO_PUSH_SECRET") },`);
	return `/**
 * Vlo control plane — generated by \`vlo deploy --profile ${plan.profile}\`.
 * Drop in at \`app/api/vlo/[[...path]]/route.ts\`.
 *
 * Roles: ${plan.roles.join(", ")}. The dispatcher runs in \`manual\` mode because a
 * serverless function has no process to tick in — the cron in vercel-crons.json calls
 * POST /v1/timers/tick instead, and every tick does one full dispatcher pass.
 */

import { handler } from "@vlo/sdk/host";
// Globs cannot be bundled into a function, so the modules are imported explicitly.
// \`vlo deploy\` found ${plan.workflows.length === 0 ? "no workflows" : `these workflows: ${plan.workflows.join(", ")}`}; re-export them from these two barrels.
import { workflows } from "@/vlo/workflows";
import { workers } from "@/vlo/workers";

// A tick and a long task push both need more than the default 10s.
export const maxDuration = 300;

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") throw new Error(\`vlo: \${name} is not set\`);
  return value;
}

export const { GET, POST } = handler({
  journal: required("DATABASE_URL"),
  blob: ${blobExpression(plan)},
  workflows,
  workers,
  roles: [${plan.roles.map((r) => `"${r}"`).join(", ")}],
  basePath: "/api/vlo",
  dispatcher: { mode: "manual" },
  queues: {
${queueLines.length === 0 ? "    // no push queues in this profile" : queueLines.join("\n")}
  },
  auth: { token: required("VLO_TOKEN"), pushSecret: required("VLO_PUSH_SECRET") },
  publicUrl: required("VLO_PUBLIC_URL"),
});
`;
}
function crons(plan) {
	return `${JSON.stringify({ crons: [{
		path: TICK_PATH,
		schedule: plan.cron
	}] }, null, 2)}\n`;
}
function envChecklist(plan) {
	const rows = [
		["`DATABASE_URL`", "Postgres journal. Pooled connection string — functions are short-lived."],
		["`VLO_TOKEN`", "Bearer token every control-plane route requires. The same value its clients hold."],
		["`VLO_PUSH_SECRET`", "HMAC secret shared with the workers this host pushes to and accepts callbacks from."],
		["`VLO_PUBLIC_URL`", "This deployment's own origin, e.g. `https://example.com`. Fills `complete_url` on a push."],
		...plan.queues.filter((q) => q.mode === "push").map((q) => [`\`${envVar(q.name)}\``, `Push endpoint for the \`${q.name}\` queue.`])
	];
	if (plan.bucket !== void 0) rows.push(["`VLO_BUCKET`", "Bucket holding offloaded payloads and checkpoints."]);
	if (plan.blobScheme === "gcs") rows.push(["`GCP_SERVICE_ACCOUNT_KEY_BASE64`", "Base64 service-account JSON for the blob bucket. Only needed off Google infrastructure — on Cloud Run, ADC covers it."]);
	return `# Environment — \`${plan.profile}\` on Vercel

Set every variable below on the Vercel project before the first deploy. Vlo reads them at
request time, so a change needs a redeploy only if the value is baked into a build.

| Variable | What it is |
| --- | --- |
${rows.map(([name, description]) => `| ${name} | ${description} |`).join("\n")}

## Checks

- \`vlo doctor --profile ${plan.profile}\` with the same variables exported locally, before deploying.
${plan.roles.includes("orchestrator") ? `- The cron in \`vercel-crons.json\` (\`${plan.cron}\`) is what advances timers, retries and task
  pushes. Without it, runs start and then sit still.` : `- This deployment holds no \`orchestrator\` role, so something else must run the dispatcher.`}
- Blob store: \`${plan.blobScheme}\`${plan.bucket !== void 0 ? ` · bucket \`${plan.bucket}\`` : ""}.
`;
}
function envNames(plan) {
	return [
		"DATABASE_URL",
		"VLO_TOKEN",
		"VLO_PUSH_SECRET",
		"VLO_PUBLIC_URL",
		...plan.queues.filter((q) => q.mode === "push").map((q) => envVar(q.name)),
		...plan.bucket !== void 0 ? ["VLO_BUCKET"] : [],
		...plan.blobScheme === "gcs" ? ["GCP_SERVICE_ACCOUNT_KEY_BASE64"] : []
	];
}
/** A function's filesystem is ephemeral, so anything but a bucket is a dev-only fallback. */
function blobExpression(plan) {
	return plan.bucket !== void 0 ? "`gcs://${required(\"VLO_BUCKET\")}/vlo`" : "\"file:///tmp/vlo-blobs\"";
}
function key(queue) {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(queue) ? queue : JSON.stringify(queue);
}
function envVar(queue) {
	return `VLO_QUEUE_${queue.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_URL`;
}
//#endregion
//#region src/deploy/render.ts
const DEFAULTS = {
	region: "europe-west4",
	namePrefix: "vlo",
	service: "vlo",
	secretName: "vlo",
	cron: "* * * * *",
	envs: ["staging", "prod"]
};
function planDeploy(loaded) {
	const deploy = loaded.profile.deploy;
	if (deploy === void 0) throw new Error(`profile "${loaded.profile.name}" has no \`deploy\` block; add deploy: { target: "cloud-run" | "vercel" } to vlo.config.ts`);
	const queues = Object.entries(loaded.profile.queues).map(([name, config]) => ({
		name,
		mode: config.mode === "pull" ? "pull" : config.url !== void 0 ? "push" : "in-process"
	}));
	return {
		profile: loaded.profile.name,
		target: deploy.target,
		...deploy.project !== void 0 ? { project: deploy.project } : {},
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
		workflows: loaded.workflows.map((w) => w.name).sort()
	};
}
function render(plan) {
	return plan.target === "cloud-run" ? renderCloudRun(plan) : renderVercel(plan);
}
/** What `--apply` prints. Vlo never runs these: applying is the operator's call. */
function commands(plan) {
	return plan.target === "cloud-run" ? cloudRunCommands(plan) : vercelCommands(plan);
}
function bucketOf(explicit, blobUrl) {
	if (explicit !== void 0) return { bucket: explicit };
	if (!blobUrl.startsWith("gcs://")) return {};
	const [bucket] = blobUrl.slice(6).split("/");
	return bucket !== void 0 && bucket.length > 0 ? { bucket } : {};
}
function schemeOf(url) {
	const end = url.indexOf("://");
	return end === -1 ? url : url.slice(0, end);
}
//#endregion
//#region src/cli/deploy.ts
/**
* `vlo deploy` — write the platform templates for a profile, and stop there.
*
* Generation is not application. The files land in `--out` for review and commit; `--apply`
* prints the exact `gcloud` / `terraform` / `vercel` commands rather than running them, so
* the thing that touches a cloud account is always a human with credentials.
*/
const USAGE$3 = "vlo deploy --profile <name> [--config <path>] [--out deploy/vlo] [--apply]";
/** Renders and writes; returns what was written, so tests can snapshot it. */
async function deploy(options) {
	const plan = planDeploy(await loadConfig(options.cwd, options.profile, options.configPath));
	const files = render(plan);
	const out = resolve(options.cwd, options.out ?? "deploy/vlo");
	for (const file of files) {
		const target = resolve(out, file.path);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, file.contents, "utf8");
		process.stdout.write(`  ✓ ${relative(options.cwd, target)}\n`);
	}
	if (options.apply === true) {
		process.stdout.write(`\n  ${plan.target} — run these yourself:\n\n`);
		for (const command of commands(plan)) process.stdout.write(command.length === 0 ? "\n" : `    ${command}\n`);
		process.stdout.write("\n");
	}
	return files;
}
async function deployCommand(argv, cwd = process.cwd()) {
	const { values } = parseArgs({
		args: [...argv],
		options: {
			config: { type: "string" },
			profile: { type: "string" },
			out: { type: "string" },
			apply: {
				type: "boolean",
				default: false
			}
		}
	});
	await deploy({
		cwd,
		profile: requireProfile(values, USAGE$3),
		...values.config !== void 0 ? { configPath: values.config } : {},
		...values.out !== void 0 ? { out: values.out } : {},
		apply: values.apply === true
	});
}
//#endregion
//#region src/cli/checks.ts
/**
* The checks behind `vlo doctor`.
*
* Every check is a real round trip, not a config read: the point is to fail here rather
* than three minutes into a deploy. They use only the public journal, blob and kernel
* surfaces, and they are cheap enough to run on every boot of a new environment — the blob
* probe is content-addressed, so a re-run writes nothing.
*/
const PROBE_BYTES = 1024;
const MAX_WASM_BYTES = 1048576;
const QUEUE_TIMEOUT_MS = 3e3;
/** Same relative shape as `kernel/load.ts`: `wasm/` sits beside `src/` and beside `dist/`. */
const WASM_CANDIDATES = ["../../wasm/vlo_kernel_bg.wasm", "../wasm/vlo_kernel_bg.wasm"];
async function runChecks(loaded, options) {
	const checks = [];
	const journal = await checkJournal(checks, loaded, options);
	await checkBlob(checks, loaded);
	await checkKernel(checks);
	if (journal !== null) await checkSchemas(checks, loaded, journal);
	await checkQueues(checks, loaded, options.fetch ?? fetch);
	checkRoles(checks, loaded);
	if (journal !== null) await journal.close().catch(() => void 0);
	return checks;
}
/** Returns the open journal when it is usable, so later checks can reuse the connection. */
async function checkJournal(checks, loaded, options) {
	const url = loaded.profile.journal;
	const dialect = url.startsWith("sqlite://") ? "sqlite" : "postgres";
	let journal;
	try {
		journal = openJournal(url);
	} catch (error) {
		checks.push({
			check: "journal",
			status: "fail",
			detail: message(error),
			hint: "journal must be a sqlite:// or postgres:// url"
		});
		return null;
	}
	let migrated;
	if (options.migrate) try {
		await journal.migrate();
		migrated = {
			check: "migrate",
			status: "ok",
			detail: "schema up to date"
		};
	} catch (error) {
		checks.push({
			check: "migrate",
			status: "fail",
			detail: message(error),
			hint: migrateHint(error)
		});
		await journal.close().catch(() => void 0);
		return null;
	}
	else migrated = {
		check: "migrate",
		status: "warn",
		detail: "skipped (--no-migrate)",
		hint: "re-run without --no-migrate to apply pending migrations"
	};
	const startedAt = Date.now();
	try {
		await journal.transaction((tx) => tx.lockRun("vlo-doctor"));
	} catch (error) {
		checks.push({
			check: "journal",
			status: "fail",
			detail: `${dialect} · ${message(error)}`,
			hint: options.migrate ? "check the journal url and that the database is reachable" : "the schema may be missing; re-run without --no-migrate"
		});
		checks.push(migrated);
		await journal.close().catch(() => void 0);
		return null;
	}
	checks.push({
		check: "journal",
		status: "ok",
		detail: `${dialect} · commit round trip ${Date.now() - startedAt} ms`
	}, migrated);
	return journal;
}
async function checkBlob(checks, loaded) {
	const url = loaded.profile.blob;
	try {
		const store = openBlobStore(url);
		const probe = new Uint8Array(PROBE_BYTES).fill(118);
		const digest = await store.put(probe);
		if (digest !== sha256Hex(probe)) {
			checks.push({
				check: "blob",
				status: "fail",
				detail: `${url} · put returned ${digest}, which is not the sha256 of the bytes`,
				hint: "the store is not content-addressed; payload refs would not resolve"
			});
			return;
		}
		const read = await store.get(digest);
		if (read.length !== probe.length) {
			checks.push({
				check: "blob",
				status: "fail",
				detail: `${url} · read back ${read.length} bytes, wrote ${probe.length}`,
				hint: "the store is truncating writes"
			});
			return;
		}
		checks.push({
			check: "blob",
			status: "ok",
			detail: `${url} · 1 KiB round trip`
		});
	} catch (error) {
		checks.push({
			check: "blob",
			status: "fail",
			detail: `${url} · ${message(error)}`,
			hint: "check the blob url and that the process may write there"
		});
	}
}
async function checkKernel(checks) {
	const bytes = wasmSize();
	if (bytes === null) {
		checks.push({
			check: "kernel",
			status: "fail",
			detail: "wasm not found",
			hint: "run scripts/build-kernel.sh from the vlo repo root, or set VLO_KERNEL_WASM"
		});
		return;
	}
	try {
		const kernel = await loadKernel();
		const kib = Math.round(bytes / 1024);
		const oversized = bytes > MAX_WASM_BYTES;
		checks.push({
			check: "kernel",
			status: oversized ? "warn" : "ok",
			detail: `protocol ${kernel.version().protocol} · ${kib} KiB`,
			...oversized ? { hint: `over the ${MAX_WASM_BYTES / 1024} KiB budget; build with --release` } : {}
		});
	} catch (error) {
		checks.push({
			check: "kernel",
			status: "fail",
			detail: message(error),
			hint: `this SDK speaks protocol 1; rebuild the kernel`
		});
	}
}
function wasmSize() {
	const override = process.env["VLO_KERNEL_WASM"];
	const candidates = override !== void 0 && override !== "" ? [override] : WASM_CANDIDATES.map((c) => new URL(c, import.meta.url));
	for (const candidate of candidates) try {
		return statSync(candidate).size;
	} catch {
		continue;
	}
	return null;
}
/**
* Registered activities and signals against the `schemas` table. A miss is not an error:
* the host upserts every schema on boot. It is worth saying out loud, because a miss also
* means no other process has booted this build yet.
*/
async function checkSchemas(checks, loaded, journal) {
	const wanted = [...loaded.activities.map((a) => ({
		name: a.name,
		version: a.hash
	})), ...loaded.signals.map((s) => ({
		name: s.name,
		version: s.hash
	}))].filter((s) => s.version !== void 0);
	if (wanted.length === 0) {
		checks.push({
			check: "schemas",
			status: "ok",
			detail: "none declared"
		});
		return;
	}
	try {
		const missing = await journal.transaction(async (tx) => {
			const absent = [];
			for (const { name, version } of wanted) if (await tx.getSchema(name, version) === null) absent.push(name);
			return absent;
		});
		checks.push({
			check: "schemas",
			status: missing.length === 0 ? "ok" : "warn",
			detail: missing.length === 0 ? `${wanted.length} registered` : `${wanted.length - missing.length}/${wanted.length} registered · missing ${missing.join(" · ")}`,
			...missing.length === 0 ? {} : { hint: "these register on the next host boot" }
		});
	} catch (error) {
		checks.push({
			check: "schemas",
			status: "fail",
			detail: message(error)
		});
	}
}
async function checkQueues(checks, loaded, doFetch) {
	const queues = Object.entries(loaded.profile.queues);
	if (queues.length === 0) {
		checks.push({
			check: "queues",
			status: "ok",
			detail: "none configured · in-process only"
		});
		return;
	}
	for (const [name, config] of queues) {
		const label = `queue:${name}`;
		if (config.mode === "pull") {
			checks.push({
				check: label,
				status: "ok",
				detail: "pull · served by pollers"
			});
			continue;
		}
		if (config.url === void 0) {
			const worker = loaded.workers.find((w) => w.queues.includes(name));
			checks.push(worker !== void 0 ? {
				check: label,
				status: "ok",
				detail: "in-process"
			} : {
				check: label,
				status: "fail",
				detail: "no url and no in-process worker",
				hint: `give the queue a url, or export defineWorker({ … }, { queues: ["${name}"] })`
			});
			continue;
		}
		checks.push(await probeQueue(label, config.url, config.secret, doFetch));
	}
}
async function probeQueue(label, url, secret, doFetch) {
	const unsigned = secret === void 0 || secret.length === 0;
	let health;
	try {
		health = new URL("/healthz", url);
	} catch {
		return {
			check: label,
			status: "fail",
			detail: `${url} is not a url`,
			hint: "queue url must be absolute"
		};
	}
	try {
		const response = await doFetch(health, { signal: AbortSignal.timeout(QUEUE_TIMEOUT_MS) });
		if (!response.ok) return {
			check: label,
			status: "fail",
			detail: `push · ${health.href} → ${response.status}`,
			hint: "the worker host is up but not healthy"
		};
	} catch (error) {
		return {
			check: label,
			status: "fail",
			detail: `push · ${health.href} unreachable: ${message(error)}`,
			hint: "start the worker host, or fix the queue url"
		};
	}
	return {
		check: label,
		status: unsigned ? "warn" : "ok",
		detail: `push · ${health.href} reachable${unsigned ? " · no secret" : ""}`,
		...unsigned ? { hint: "set `secret` on the queue; unsigned pushes are rejected by the worker" } : {}
	};
}
function checkRoles(checks, loaded) {
	const { roles, dispatcher, deploy } = loaded.profile;
	const listed = roles ?? [
		"orchestrator",
		"api",
		"worker:*"
	];
	const mode = dispatcher?.mode ?? "loop";
	const detail = `${listed.join(" · ")} · dispatcher ${mode}`;
	const stalled = listed.includes("orchestrator") && mode === "manual" && deploy?.cron === void 0;
	checks.push({
		check: "roles",
		status: stalled ? "warn" : "ok",
		detail,
		...stalled ? { hint: "a manual dispatcher only advances on POST /v1/timers/tick; set `deploy.cron`" } : {}
	});
}
function message(error) {
	return error instanceof Error ? error.message : String(error);
}
/** A hint that matches the failure: reachability and auth are far more common than DDL rights. */
function migrateHint(error) {
	const text = message(error);
	if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|timeout/i.test(text)) return "the journal is unreachable: check the url, host and port, and that the database is running";
	if (/password|authentication|no pg_hba/i.test(text)) return "the journal rejected the credentials in the url";
	if (/does not exist/i.test(text)) return "the database named in the url does not exist";
	if (/permission denied for database/i.test(text)) return "the journal user cannot create the schema: GRANT CREATE ON DATABASE to it, or have a DBA run CREATE SCHEMA <name> AUTHORIZATION <user>";
	return "the journal user needs CREATE on its schema";
}
//#endregion
//#region src/cli/doctor.ts
/**
* `vlo doctor` — is this profile actually wired up?
*
* Every line is a real round trip (see `checks.ts`), rendered as one table with a fix hint
* on anything that is not ✓. Any ✗ sets a non-zero exit code, so a deploy pipeline can gate
* on it; `--json` prints the same array for a machine.
*/
const USAGE$2 = "vlo doctor --profile <name> [--config <path>] [--json] [--no-migrate]";
const ICONS = {
	ok: "✓",
	warn: "⚠",
	fail: "✗"
};
/** The whole verb minus argument parsing and printing, so tests can assert on the checks. */
async function doctor(options) {
	return runChecks(await loadConfig(options.cwd, options.profile, options.configPath), {
		migrate: options.migrate ?? true,
		...options.fetch !== void 0 ? { fetch: options.fetch } : {}
	});
}
async function doctorCommand(argv, cwd = process.cwd()) {
	const { values } = parseArgs({
		args: [...argv],
		allowNegative: true,
		options: {
			config: { type: "string" },
			profile: { type: "string" },
			json: {
				type: "boolean",
				default: false
			},
			migrate: {
				type: "boolean",
				default: true
			}
		}
	});
	const checks = await doctor({
		cwd,
		profile: requireProfile(values, USAGE$2),
		...values.config !== void 0 ? { configPath: values.config } : {},
		migrate: values.migrate !== false
	});
	process.stdout.write(values.json === true ? `${JSON.stringify(checks, null, 2)}\n` : table(checks));
	if (checks.some((c) => c.status === "fail")) process.exitCode = 1;
}
function table(checks) {
	const width = Math.max(0, ...checks.map((c) => c.check.length));
	let out = "";
	for (const check of checks) {
		out += `  ${ICONS[check.status]} ${check.check.padEnd(width)}  ${check.detail}\n`;
		if (check.hint !== void 0) out += `  ${" ".repeat(width + 3)} → ${check.hint}\n`;
	}
	return out;
}
//#endregion
//#region src/cli/serve.ts
/**
* `vlo serve` — the production twin of `vlo dev`.
*
* Same code path, no conveniences: the profile is required (there is no SQLite fallback to
* silently land on), nothing is created on disk, and `PORT` is honoured because that is how
* Cloud Run and every other container platform tells a process where to listen.
*/
const USAGE$1 = "vlo serve --profile <name> [--config <path>] [--port <n>]";
async function serveCommand(argv, cwd = process.cwd()) {
	const { values } = parseArgs({
		args: [...argv],
		options: {
			config: { type: "string" },
			profile: { type: "string" },
			port: { type: "string" }
		}
	});
	const profile = requireProfile(values, USAGE$1);
	const port = values.port ?? process.env["PORT"];
	return start({
		cwd,
		profile,
		...values.config !== void 0 ? { configPath: values.config } : {},
		...port !== void 0 && port.length > 0 ? { port: Number(port) } : {}
	});
}
//#endregion
//#region src/cli.ts
/**
* The `vlo` command: one verb per file under `cli/`.
*
* `dev` and `serve` are the same host with different defaults — that is deliberate, and it
* is why `doctor` and `deploy` read the same profile: whatever runs on a laptop, what a
* check reports and what a template deploys all come from one place in `vlo.config.ts`.
*/
const VERB_USAGE = {
	dev: USAGE$4,
	serve: USAGE$1,
	doctor: USAGE$2,
	deploy: USAGE$3
};
const USAGE = [
	...Object.values(VERB_USAGE),
	"vlo --help | -h | help",
	"vlo --version | -v"
].join("\n");
async function main(argv = process.argv.slice(2), cwd = process.cwd()) {
	const [verb, ...rest] = argv;
	if (verb === void 0 || verb === "help" || wantsHelp([verb])) {
		process.stdout.write(`${USAGE}\n`);
		return;
	}
	if (verb === "--version" || verb === "-v") {
		process.stdout.write(`${version()}\n`);
		return;
	}
	const usage = VERB_USAGE[verb];
	if (usage !== void 0 && wantsHelp(rest)) {
		process.stdout.write(`${usage}\n`);
		return;
	}
	switch (verb) {
		case "dev":
			await dev(rest, cwd);
			return;
		case "serve":
			await serveCommand(rest, cwd);
			return;
		case "doctor":
			await doctorCommand(rest, cwd);
			return;
		case "deploy":
			await deployCommand(rest, cwd);
			return;
		default:
			process.stderr.write(`unknown command "${verb}"\n${USAGE}\n`);
			process.exitCode = 1;
	}
}
if (process.argv[1] !== void 0 && import.meta.url === `file://${process.argv[1]}`) main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
//#endregion
export { main };
