# Vlo documentation

**Durable execution for workflows and AI agents, as a library on the database you already
run.** Vlo keeps long-running work alive through crashes and restarts: an agent on its
fortieth step, a render that takes three hours, an approval that takes two days.

| | What you get | Read more |
| --- | --- | --- |
| **Tiny** | A 298 KB kernel inside your process. No cluster, no broker, no service to stand up. | [Why Vlo](why-vlo.md#tiny) |
| **Performant** | One transaction per step, and a resume that costs the same at 38 events and at 20,000. | [Performance](performance.md) |
| **Reliable** | Nothing is acknowledged before it is saved, and every checkpoint is hash-checked. | [Reliability](reliability.md) |
| **Efficient** | A waiting run holds no compute. An agent that reaches its budget parks instead of burning money. | [Why Vlo](why-vlo.md#efficient) |
| **Built for the edge** | A kernel with no I/O that runs anywhere wasm runs. The edge host is not built yet. | [Status and roadmap](status.md) |

All five come from one design principle: a workflow is a pure reducer,
`(state, event) → (state, commands)`. An event comes in, new state and commands come out,
and both are saved in one database transaction. Between events a run is only rows in your
Postgres or a SQLite file, so nothing has to be kept alive, captured or replayed.

## Start here

| If you are | Start with |
| --- | --- |
| New to Vlo | [Getting started](getting-started.md): a run on your laptop in ten minutes, then kill the process and watch it continue. |
| Building an AI agent | [Build an agent harness](agent-harness.md): a loop that survives crashes, stays inside a budget and waits for people. |
| Deciding whether to adopt it | [Why Vlo](why-vlo.md), then [Performance](performance.md), [Reliability](reliability.md) and [Status and roadmap](status.md). |
| Looking for a how-to | [Recipes](recipes.md) and the [FAQ](faq.md). |
| Taking it to production | [Deployment](deployment.md), [Configuration](configuration.md) and [Limits](limits.md). |

## All pages

| Page | Read it when |
| --- | --- |
| **Evaluate** | |
| [Why Vlo](why-vlo.md) | You want the argument: what durable execution costs today, what Vlo changes, and what it does not have yet. |
| [Performance](performance.md) | You want measured numbers, with their setup and their limits. |
| [Reliability](reliability.md) | You want to know exactly what Vlo guarantees and how. |
| [Status and roadmap](status.md) | You want to know what is built and what is planned. |
| [FAQ](faq.md) | You have an objection or a quick question. |
| **Build** | |
| [Getting started](getting-started.md) | You want a run going on a laptop in ten minutes. |
| [Concepts](concepts.md) | You need the vocabulary: run, step, event, command, role, profile. |
| [Workflows](workflows.md) | You are writing a reducer, or using `sequence`, `fanOut`, `waitFor`, `sleep`. |
| [Activities and workers](activities-and-workers.md) | You are implementing the code a task runs, in-process or over HTTP. |
| [Signals and humans](signals-and-humans.md) | A run has to wait for a person, a webhook or a deadline. |
| [Build an agent harness](agent-harness.md) | You are building an agent end to end. |
| [Agents](agents.md) | You need the `@oona/vlo/agent` reference: options, step ids, state and result. |
| [Testing](testing.md) | You are testing a reducer, a workflow or an agent. |
| [Recipes](recipes.md) | You want a short answer to "how do I…". |
| **Operate** | |
| [Configuration](configuration.md) | `vlo.config.ts`: profiles, queues, roles, dispatcher mode, `env()`. |
| [CLI](cli.md) | `vlo dev`, `vlo serve`, `vlo doctor`, `vlo deploy`. |
| [Deployment](deployment.md) | Long-lived hosts, serverless hosts with a cron, pull workers. |
| [Observability](observability.md) | The journal as the trace, usage accounting, the side channel, health. |
| [HTTP API](http-api.md) | Every route, its auth, its JSON, the SSE stream, push and poll. |
| [Journal](journal.md) | The tables, the Postgres and SQLite adapters, blob stores, URL forms. |
| [Errors](errors.md) | Host errors, kernel error codes, `vlo doctor` hints and what to do. |
| [Limits](limits.md) | Payload caps, size budgets, known weak spots, what edge runtimes cannot do yet. |
| **Internals** | |
| [Architecture](architecture.md) | Layers, the write path, the task lifecycle, how roles split across processes. |
| [Kernel protocol](kernel-protocol.md) | The JSON-in / JSON-out contract between host and kernel, hashing, fixtures. |
| [Design decisions](design-decisions.md) | Why a reducer, why the journal is the queue, why Rust on wasm. |

## Generated API reference

Both are published with these pages at <https://oonalab.github.io/vlo/>.

- **TypeScript** (`@oona/vlo` and its `/host`, `/agent` and `/testing` entries):
  [oonalab.github.io/vlo/api/](https://oonalab.github.io/vlo/api/). TypeDoc writes a
  page for every exported symbol into `docs/api/`. Build it locally with `pnpm --filter @oona/vlo docs:api`;
  the output is not committed, so you will not find it in a checkout.
- **Rust** (`vlo-types`, `vlo-kernel`, `vlo-kernel-wasm`, `vlo-traits`):
  [oonalab.github.io/vlo/rustdoc/](https://oonalab.github.io/vlo/rustdoc/). Build it locally
  with `cargo doc --workspace --no-deps --open` from the repository root.

## Conventions used in these pages

- Paths are relative to the repository root unless they start with `src/`, in which case
  they are relative to `sdk/ts/sdk/`.
- Wire fields are `snake_case` (`cost_micro_usd`); authoring options are `camelCase`
  (`costMicroUsd`). The wire form is what you see in the journal and on the HTTP API.
- Every instant is a millisecond Unix epoch and every such column or field ends in `_ms`.
