# Configuration

`vlo.config.ts` says where the code lives and how each environment is wired. It is a
TypeScript module the CLI imports; `defineConfig` gives you types and `env()` keeps secrets
out of the file.

```ts
import { defineConfig, env } from "@oona/vlo";

export default defineConfig({
  workflows: ["src/**/*.workflow.ts"],
  workers: ["src/**/*.worker.ts"],
  activities: ["src/**/activities.ts"],
  profiles: {
    local: { journal: "sqlite://.vlo/dev.db", blob: "file://.vlo/blobs" },
    prod: {
      journal: env("DATABASE_URL"),
      blob: "gcs://my-bucket/vlo",
      publicUrl: env("VLO_PUBLIC_URL"),
      roles: ["orchestrator", "api"],
      dispatcher: { mode: "loop", tickMs: 500 },
      queues: {
        llm: { url: env("VLO_QUEUE_LLM_URL"), secret: env("VLO_PUSH_SECRET") },
        media: { mode: "pull" },
      },
      auth: { token: env("VLO_TOKEN"), pushSecret: env("VLO_PUSH_SECRET") },
      port: 8080,
      deploy: { target: "cloud-run", region: "europe-west4" },
    },
  },
});
```

## File and loading rules

- Looked up as `vlo.config.ts`, `vlo.config.js`, then `vlo.config.mjs` in the working
  directory, or wherever `--config <path>` points.
- The module must `export default defineConfig({ … })`.
- It is imported by Node, not bundled: relative imports inside it (and inside the modules it
  points at) need explicit extensions, and path aliases are not resolved. A `.ts` config
  needs a Node that strips types natively; `.js` / `.mjs` always work.
- With no config file at all, the built-in default is used: workflows
  `**/*.workflow.{ts,js,mjs}`, workers `**/*.worker.{ts,js,mjs}`, one profile `local` with
  `sqlite://.vlo/dev.db` and `file://.vlo/blobs`, resolved against the working directory
  because there is no config file to be relative to.
- `defineConfig` throws when `profiles` is empty.

## Top level

| Field | Type | Meaning |
| --- | --- | --- |
| `workflows` | `string \| string[]` | Globs, relative to the config file. Every match is imported. |
| `workers` | `string \| string[]` | Optional. Modules exporting `defineWorker(...)`. |
| `activities` | `string \| string[]` | Optional. Modules exporting `activity()` / `signal()` definitions to register. |
| `profiles` | `Record<string, Profile>` | At least one. |

Discovery is by export shape, not by file name: any export with `kind: "workflow"`,
`"worker"`, `"activity"` or `"signal"` from any matched module is collected, default or
named. Re-exporting an activity from a workflow file registers it. Named things are deduped
by `name`; `node_modules` is always excluded.

## `env(name, { optional? })`

Records the *name* of an environment variable. The value is resolved when the profile
loads; a missing required variable fails with a message naming it. `optional: true` yields
`undefined` instead. Any `Ref` field below accepts either a literal string or an `env()`.

`env()` returns an object, so it cannot be concatenated: write the full value into one
variable rather than `env("HOST") + "/path"`.

## `profiles.<name>`

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `journal` | `Ref` | required | `sqlite://<path>` (`sqlite://:memory:`, `sqlite://.vlo/x.db`, `sqlite:///abs/x.db`) or `postgres://…` / `postgresql://…`. A relative SQLite path resolves against the config file's directory. |
| `blob` | `Ref` | `file://.vlo/blobs` | `file://<dir>` or `gcs://<bucket>[/<prefix>]`. A relative `file://` directory resolves against the config file's directory. Payloads over 256 KiB go here. |
| `publicUrl` | `Ref` | none | Base URL peers reach this host on. Fills `complete_url` on pushes and the origin of signed links. `host` is a deprecated alias. |
| `port` | `number` | `4100` | Listening port. See precedence below. |
| `roles` | `Role[]` | all | `"orchestrator"`, `"api"`, `"worker:<queue>"`. Absent ⇒ orchestrator + api + a worker role for every queue an in-process worker declares. |
| `queues` | `Record<string, QueueProfile>` | `{}` | See below. |
| `auth` | `{ token?, pushSecret? }` | `{}` | Both `Ref`s. See below. |
| `dispatcher` | `DispatcherProfile` | `{ mode: "loop" }` | See below. |
| `deploy` | `DeployProfile` | none | Only read by `vlo deploy`. |

### `queues.<name>`

| Field | Meaning |
| --- | --- |
| `url` | Where the orchestrator pushes this queue's tasks (`https://…/v1/tasks/push`). Absent ⇒ in-process only. |
| `secret` | HMAC secret shared with the worker at `url`. Required for push; an empty secret refuses to push. |
| `mode` | `"push"` (default) or `"pull"`. Pull queues are never pushed; workers poll them. |

`vlo doctor` fails a queue that has neither a `url` nor an in-process worker.

### `auth`

| Field | Meaning |
| --- | --- |
| `token` | Bearer token required on every control-plane route. Absent ⇒ open host. Also the default secret for signed links. |
| `pushSecret` | HMAC secret this host's `worker:*` roles verify inbound pushes with. |

`createHost` additionally accepts `callbackToken` (bearer a worker host sends on result
callbacks; defaults to `token`) and `linkSecret` (signed-link secret; falls back to `token`,
then `pushSecret`). Those two are not fields of the config profile.

### `dispatcher`

| Field | Default | Meaning |
| --- | --- | --- |
| `mode` | `"loop"` | `"loop"` ticks on an interval and on every write. `"manual"` never ticks by itself: something must call `POST /v1/timers/tick` or `Host.drain()`. Use `manual` on serverless. |
| `tickMs` | `500` | Interval in loop mode. |

`createHost({ dispatcher })` also takes `batch` (50), `claimHoldMs` (30 000), `backoffBaseMs`
(1 000), `maxBackoffMs` (60 000), `unroutableBackoffMs` (60 000) and `workerId`.

### `deploy`

Never a secret: only names, regions and modes. Everything here is safe to write into a
generated file.

| Field | Default | Meaning |
| --- | --- | --- |
| `target` | required | `"cloud-run"` or `"vercel"`. |
| `project` | none | Cloud project id, printed into commands. |
| `region` | `"europe-west4"` | Cloud Run region. |
| `namePrefix` | `"vlo"` | Leading segment of every generated resource name: `<namePrefix>-<env>-<service>`. |
| `service` | `"vlo"` | Component segment of the per-env names. |
| `bucket` | from `blob` | Blob bucket; derived from a `gcs://` blob URL when absent. |
| `envs` | `["staging", "prod"]` | Environments the templates are instantiated for. |
| `secretName` | `"vlo"` | Middle segment of generated secret ids: `<namePrefix>-<env>-<secretName>-database-url` and friends. |
| `cron` | `"* * * * *"` | Schedule for the tick route on serverless targets. |

What each target renders is in [deployment.md](./deployment.md).

## Environment variables and precedence

| Variable | Read by | Meaning |
| --- | --- | --- |
| `VLO_PROFILE` | every verb | Profile to use when `--profile` is not given. `dev` also falls back to `local`, then to the only profile in the file. |
| `PORT` | `serve` | Listening port when `--port` is not given. Set by most container platforms. |
| `VLO_KERNEL_WASM` | host, `doctor` | Absolute path to a kernel wasm to load instead of the one shipped in the package. |
| anything named in `env()` | config load | Resolved into the profile. |

Precedence:

- Profile: `--profile` > `VLO_PROFILE` > (`dev` only) `local` > (`dev` only) the sole profile. Otherwise the error lists the profile names.
- Port: `--port` > `PORT` (`serve` only) > `profiles.<name>.port` > `4100`.
- Config path: `--config` > auto-detected file > built-in default.

## What the host receives

Loading a profile yields the options `serve()` / `createHost()` take: `journal`, `blob`,
`workflows`, `workers`, `activities`, `signals`, `queues`, `auth`, `roles`, `dispatcher`,
`publicUrl`, `port`. You can skip the config file entirely and call
`serve({ … })` from `@oona/vlo/host` yourself with the same fields plus `basePath`,
`streamPollMs`, `namespace`, `hostname` and `domains` (values from `defineDomain`, flattened
onto the four registries; `workflows` becomes optional when a domain supplies them).
