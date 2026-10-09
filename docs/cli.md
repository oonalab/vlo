# CLI

The `vlo` command ships with `@vlo/sdk` (`npx vlo …`). Four verbs, one profile: whatever
runs on your laptop, what `doctor` checks and what `deploy` renders all come from the same
entry in `vlo.config.ts`. See [configuration.md](./configuration.md).

```
vlo dev    [--config <path>] [--profile <name>] [--port <n>]
vlo serve  --profile <name>  [--config <path>] [--port <n>]
vlo doctor --profile <name>  [--config <path>] [--json] [--no-migrate]
vlo deploy --profile <name>  [--config <path>] [--out deploy/vlo] [--apply]
vlo --help | -h
vlo --version
```

Shared flags:

| Flag | Meaning |
| --- | --- |
| `--config <path>` | Config file to load instead of auto-detecting `vlo.config.{ts,js,mjs}`. |
| `--profile <name>` | Profile inside the config. Every verb falls back to `VLO_PROFILE`; `serve`, `doctor` and `deploy` fail without one, `dev` picks `local` or the only profile. |
| `--help`, `-h` | Print usage to stdout and exit 0. |
| `--version` | Print the SDK version to stdout and exit 0. |

`--help` and `--version` are being added alongside this documentation; earlier builds print
usage to stderr and exit 1 for any unknown verb.

## `vlo dev`

The whole engine on a laptop: SQLite journal, file blob store, every role in one process.

```
$ npx vlo dev
  ✓ journal  sqlite:///home/me/app/.vlo/dev.db
  ✓ found 2 workflows   example · hello
  ✓ found 1 worker   in-process
  ✓ api      http://localhost:4100
```

- Profile: `--profile`, else `VLO_PROFILE`, else `local`, else the only profile in the file;
  with no config file the built-in `local` profile is used.
- Relative `sqlite://` and `file://` paths resolve against the config file's directory, and
  the journal and blob store create their own directories.
- Migrates the journal, imports every module the globs match, binds the port, starts the
  dispatcher in the profile's mode (`loop` unless configured otherwise).
- No hot reload: restart after editing a workflow.
- The third line is one of `found N workers   in-process`, `workers   remote via queues …`,
  or a stderr warning `⚠ no workers found` when there are neither.
- Dispatcher warnings (a push refused, a task with no transport) go to stderr as `⚠ …`.
- `SIGINT` / `SIGTERM` stop the dispatcher, wait up to 5 s for in-process handlers, then
  close the journal.

## `vlo serve`

The production twin of `dev`: identical code path, no conveniences.

- `--profile` (or `VLO_PROFILE`) is required. There is no SQLite fallback.
- Nothing is created on disk.
- Port: `--port`, then `PORT`, then the profile's `port`, then `4100`.
- Prints the same ✓ lines as `dev`; `/healthz` answers `{ ok, roles, workflows }`.

`vlo serve --profile prod` is what the generated Cloud Run image runs.

## `vlo doctor`

Is this profile actually wired up? Every check is a real round trip, so it fails here
rather than three minutes into a deploy. Cheap enough to run on every boot of a new
environment.

```
$ vlo doctor --profile prod
  ✓ journal    postgres · commit round trip 4 ms
  ✓ migrate    schema up to date
  ✓ blob       gcs://my-bucket/vlo · 1 KiB round trip
  ✓ kernel     protocol 1 · 288 KiB
  ⚠ schemas    2/4 registered · missing example.plan · example.approve
               → these register on the next host boot
  ✓ queue:llm  push · https://workers.example.com/healthz reachable
  ✓ queue:media  pull · served by pollers
  ✓ roles      orchestrator · api · dispatcher loop
```

| Check | What it does | ⚠ / ✗ when |
| --- | --- | --- |
| `journal` | Opens the URL and runs one empty write transaction (lock + commit). | ✗ unreachable, bad credentials, missing database, unsupported scheme. |
| `migrate` | Applies pending migrations. | ✗ migration failed; ⚠ skipped with `--no-migrate`. |
| `blob` | Writes a 1 KiB probe and reads it back. Content-addressed, so re-runs write nothing. | ✗ cannot write, digest mismatch, truncated read. |
| `kernel` | Finds the wasm, loads it, compares protocol versions. | ✗ not found or protocol mismatch; ⚠ over the 1 MiB budget. |
| `schemas` | Looks up every registered activity and signal hash in the `schemas` table. | ⚠ some not registered yet (a host boot registers them). |
| `queue:<name>` | One per queue. Push: `GET <url>/healthz` with a 3 s timeout. Pull: always ok. No URL: needs an in-process worker. | ✗ unreachable, unhealthy, no URL and no worker, URL not absolute; ⚠ push URL with no `secret`. |
| `roles` | Roles versus dispatcher mode. | ⚠ orchestrator in `manual` mode with no `deploy.cron`: nothing would ever tick. |

Flags:

| Flag | Meaning |
| --- | --- |
| `--json` | Print the checks as a JSON array instead of the table. |
| `--no-migrate` | Never write to the journal. A missing schema then shows up as a failed commit. |

`--json` shape, one object per check:

```json
[
  { "check": "journal", "status": "ok", "detail": "sqlite · commit round trip 1 ms" },
  { "check": "schemas", "status": "warn", "detail": "1/2 registered · missing demo.echo",
    "hint": "these register on the next host boot" }
]
```

`status` is `"ok"`, `"warn"` or `"fail"`; `hint` is present on anything that is not ok.
Any `fail` sets exit code 1, so a pipeline can gate on it.

## `vlo deploy`

Renders the platform files for a profile and stops there. Generation is not application:
nothing touches a cloud account without a human running the printed commands.

```
$ vlo deploy --profile prod
  ✓ deploy/vlo/cloud-run/Dockerfile
  ✓ deploy/vlo/cloud-run/cloudbuild.yaml
  ✓ deploy/vlo/cloud-run/cloud-run-vlo.tf
  ✓ deploy/vlo/cloud-run/cloudbuild-vlo.tf
  ✓ deploy/vlo/cloud-run/README.md
```

| Flag | Meaning |
| --- | --- |
| `--out <dir>` | Output directory, relative to the working directory. Default `deploy/vlo`. |
| `--apply` | After writing, print the exact `gcloud` / `terraform` / `vercel` commands to run. Nothing is executed. |

Requires `deploy: { target: "cloud-run" | "vercel", … }` on the profile; the error names
the profile otherwise. Resolved secrets (the journal URL, tokens) never reach a generated
file; templates read them from environment variables or Secret Manager at run time. The
file-by-file contents are described in [deployment.md](./deployment.md).

## Exit codes

| Code | When |
| --- | --- |
| `0` | The verb finished; `doctor` found no ✗. |
| `1` | Unknown verb (usage on stderr); any thrown error (message on stderr), including a missing `--profile`, an unknown profile, an unset `env()` variable; `doctor` with at least one ✗. |

## Running from source

From a checkout of the repository:

```sh
pnpm --filter @vlo/sdk exec tsx src/cli.ts dev --config ../../../examples/hello/vlo.config.ts
```

The kernel wasm is committed at `sdk/ts/sdk/wasm/vlo_kernel_bg.wasm`; rebuild it after
kernel changes with `./scripts/build-kernel.sh` (needs `wasm-pack` and the pinned Rust
toolchain), or point `VLO_KERNEL_WASM` at a freshly built file. `pnpm --filter @vlo/sdk
test` runs the SDK suite on SQLite; set `VLO_TEST_DATABASE_URL` to also run it on Postgres.

Every verb is also a library call: `dev()`, `serveCommand()`, `doctor()` / `runChecks()`
and `deploy()` under `sdk/ts/sdk/src/cli/` take an options object and return what they
started, checked or wrote.
