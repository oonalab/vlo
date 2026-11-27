---
url: /vlo/status.md
---
# Status and roadmap

What is built, what is planned, and what is not on the list. Nothing on this page is a date
or a promise; planned items are listed in the order they are expected.

## Where Vlo runs today

| Target | Status |
| --- | --- |
| A laptop or CI, on a SQLite file | Built |
| Any Node host or container, on Postgres | Built |
| Google Cloud Run | Built, with generated deploy files |
| Vercel (serverless, with a cron tick) | Built, with generated deploy files |
| Edge runtimes (Cloudflare Workers and Durable Objects) | **Not built.** Planned as the next platform milestone |
| AWS (Lambda or ECS, Aurora, S3, EventBridge) | Planned, after Cloudflare |

Vlo needs Node 22.5 or later today.

## What is built

| Piece | Notes |
| --- | --- |
| Kernel as a wasm module with no I/O and no imports | 298 KB, capped at 1 MiB in CI |
| Write-set contract between kernel and storage | The kernel decides, the host persists |
| Postgres and SQLite journals | Postgres works behind transaction-mode poolers |
| Several orchestrators sharing one journal | On Postgres |
| Roles split across services | Push and pull workers anywhere, in any language |
| Serverless mode | A time-boxed drain plus a cron tick |
| Workflows | Hand-written reducers, `sequence`, `fanOut`, `fanOutRuns`, `waitFor`, `sleep`, child runs, `continue_as_new` |
| Signals and signed links | Human approvals, webhooks, deadlines |
| Agents | `@oona/vlo/agent`: decide, tool, evaluate, with budgets that park and tool calls that wait for approval |
| Usage accounting | Tokens, cost and CPU time banked in the kernel on every event |
| CLI | `vlo dev`, `vlo serve`, `vlo doctor`, `vlo deploy` |
| Blob stores | Local files and Google Cloud Storage |

## What is planned

| Piece | Status |
| --- | --- |
| Cloudflare: host in Workers, Durable Object journal, R2 blobs, alarm timers | Planned, the next platform milestone |
| Cross-run index on the edge | Planned; two designs recorded, not decided |
| Conformance test kit for third-party adapters | Planned |
| Native Rust host with no Node | Planned; `crates/traits` sketches the adapter traits |
| AWS adapters | Planned, after Cloudflare |
| Rust workflows as WASM components, Go and Python SDKs | Planned, later |
| A console: run tree, inbox, event timeline | Not built; see [observability.md](./observability.md#not-built-yet) |
| OpenTelemetry export | Not built |
| S3 and Vercel Blob stores | Not built |
| A lint for reducer purity | Not built |

## About "built for the edge"

The edge is the direction of the design, not a feature you can use today.

What is true now:

* The kernel compiles to `wasm32-unknown-unknown` with no imports, which is the form an
  edge runtime needs.
* The kernel returns a declarative write-set, so any storage that can apply one atomic
  write can be a journal.
* Every run has one journal and one writer, which is the shape of a Durable Object.

What is not true yet:

* There is no Durable Object journal adapter and no Workers host.
* The host opens its journal with `pg` or `node:sqlite`, both of which need Node.

So the accurate statement is: Vlo is built to run at the edge, and it does not run there
yet. See [limits.md](./limits.md#not-available-on-edge-runtimes-yet).

## Known weak spots

These are measured and documented, and they are work to do:

* About 15 database round trips per step, so the host must sit beside its journal.
* One run that fans out very wide slows down sharply. Use child runs.
* No benchmark at scale or over a network.

Details are in [performance.md](./performance.md#what-these-numbers-are-not) and
[limits.md](./limits.md#known-weak-spots).

## Stability

Vlo is young. The kernel protocol is versioned and gated by golden fixtures, and the
changelog records every release: see
[`../CHANGELOG.md`](../CHANGELOG.md). Pin a version and read the changelog before you
upgrade.
