# Vlo documentation

Vlo is a durable execution engine built around one idea: a workflow is a pure reducer,
`(state, event) → (state, commands)`. The kernel appends each event to the run's journal,
folds it, and persists the new state together with the commands it produced in a single
transaction. The host then turns those commands into tasks for workers, timers, child runs
and signal waits. Nothing suspends and nothing is replayed to resume: the checkpoint is the
state, every checkpoint carries a hash, and a lost or suspect checkpoint is rebuilt from
`seq 0` by folding the journal again. The journal (your Postgres, or a SQLite file) is also
the task queue, so there is no broker to run. The kernel is Rust compiled to wasm; the host,
SDK and CLI are TypeScript on Node.

## Reading order

| # | Page | Read it when |
| --- | --- | --- |
| **Learn** | | |
| 1 | [Getting started](getting-started.md) | You want a run going on a laptop in ten minutes. |
| 2 | [Concepts](concepts.md) | You need the vocabulary: run, step, event, command, role, profile. |
| 3 | [Why Vlo](why-vlo.md) | You are deciding between Vlo and a replay-based engine, or explaining the choice. |
| 4 | [Workflows](workflows.md) | You are writing a reducer, or using `sequence`, `fanOut`, `waitFor`, `sleep`. |
| 5 | [Activities and workers](activities-and-workers.md) | You are implementing the code a task runs, in-process or over HTTP. |
| 6 | [Signals and humans](signals-and-humans.md) | A run has to wait for a person, a webhook or a deadline. |
| 7 | [Agents](agents.md) | You are building a decide → tool → evaluate loop with a budget. |
| **Reference** | | |
| 8 | [Configuration](configuration.md) | `vlo.config.ts`: profiles, queues, roles, dispatcher mode, `env()`. |
| 9 | [CLI](cli.md) | `vlo dev`, `vlo serve`, `vlo doctor`, `vlo deploy`. |
| 10 | [HTTP API](http-api.md) | Every route, its auth, its JSON, the SSE stream, push and poll. |
| 11 | [Journal](journal.md) | The tables, the Postgres and SQLite adapters, blob stores, URL forms. |
| 12 | [Errors](errors.md) | Host errors, kernel error codes, `vlo doctor` hints and what to do. |
| 13 | [Limits](limits.md) | Payload caps, size budgets, single-writer SQLite, what edge runtimes cannot do yet. |
| 14 | [Observability](observability.md) | The journal as the trace, usage accounting, the side channel, health. |
| 15 | [Deployment](deployment.md) | Long-lived hosts, serverless hosts with a cron, pull workers. |
| **Internals** | | |
| 16 | [Architecture](architecture.md) | Layers, the write path, the task lifecycle, how roles split across processes. |
| 17 | [Kernel protocol](kernel-protocol.md) | The JSON-in / JSON-out contract between host and kernel, hashing, fixtures. |
| 18 | [Design decisions](design-decisions.md) | Why a reducer, why the journal is the queue, why Rust on wasm. |
| 18 | README | This index. |

## Generated API reference

- **TypeScript** (`@oona/vlo` and its `/host`, `/agent` and `/testing` entries): TypeDoc renders every exported symbol into
  `docs/api/`. Build it with `pnpm --filter @oona/vlo docs:api`; the output is produced in CI and
  is not committed, so you will not find it in a checkout.
- **Rust** (`vlo-types`, `vlo-kernel`, `vlo-kernel-wasm`, `vlo-traits`): run `cargo doc
  --workspace --no-deps --open` from the repository root.

## Conventions used in these pages

- Paths are relative to the repository root unless they start with `src/`, in which case
  they are relative to `sdk/ts/sdk/`.
- Wire fields are `snake_case` (`cost_micro_usd`); authoring options are `camelCase`
  (`costMicroUsd`). The wire form is what you see in the journal and on the HTTP API.
- Every instant is a millisecond Unix epoch and every such column or field ends in `_ms`.
