# Vlo

[![npm version](https://img.shields.io/npm/v/@oona/vlo)](https://www.npmjs.com/package/@oona/vlo)

**Durable execution for workflows and AI agents, as a library on the database you already run.**

Long-running work fails halfway: an agent on its fortieth step, a render that takes three
hours, an approval that takes two days. Vlo keeps that work alive through crashes and
restarts, and it does so without a cluster, a broker or a vendor platform.

| | What you get | Proof |
| --- | --- | --- |
| **Tiny** | An engine that is a dependency, with no service to stand up. | A 298 KB wasm kernel, under 600 KB with the host. Size caps are enforced in CI. |
| **Performant** | Steps and resumes that stay fast as a run grows. | A run with 20,018 events resumes as fast as a run with 38. See [Performance](docs/performance.md). |
| **Reliable** | Work that is never lost, and state that is never silently wrong. | Commit before acknowledge everywhere, and a hash check on every checkpoint. See [Reliability](docs/reliability.md). |
| **Efficient** | You pay for compute only while a step runs. | A waiting run is about 2 KB of rows and no process. An agent that reaches its budget parks instead of burning money. |
| **Built for the edge** | One engine that can run beside your data. | The kernel has no I/O and runs anywhere wasm runs. Cloud Run, Vercel and containers work today; the edge host is not built yet. See [Status](docs/status.md). |

One design principle makes all five possible. A workflow is a pure reducer:

```
(state, event) → (state, commands)
```

An event comes in, new state and commands come out, and both are saved in one database
transaction. Between events a run is only rows in your Postgres or a SQLite file. Nothing
stays suspended, so there is no stack to save, no sandbox to run and no code to replay.

## Why teams building agents pick it

- **An agent survives a crash mid-thought.** Every decision, tool call and score is one
  journaled event. Kill the process and the run continues from its last event.
- **A budget parks the run instead of killing it.** The kernel meters tokens and cost on
  every event, including failed attempts. An agent that runs out waits for a top-up and
  keeps everything it has already paid for.
- **Waiting costs nothing.** A run waiting on a person, a webhook or a budget holds no
  compute and no connection.
- **A human approval is one signed link.** Opening the link changes nothing; confirming it
  resumes the run.
- **Tools run anywhere, in any language.** A worker is an HTTP endpoint or a polling
  process, with typed inputs and outputs.
- **The journal is the trace.** Every step, retry, token and decision is a row you can
  query.

Start with [Build an agent harness](docs/agent-harness.md), or read [Why Vlo](docs/why-vlo.md)
for the full argument and the honest list of what Vlo does not have yet.

## Try it

```sh
pnpm add @oona/vlo zod        # Node ≥ 22.5
```

A complete program is three files: a workflow, a worker and a config.

```ts
// hello.workflow.ts
import { activity, cmd, defineWorkflow, WorkflowFailure } from "@oona/vlo";
import { z } from "zod";

export const greet = activity("hello.greet", {
  input: z.object({ name: z.string() }),
  output: z.object({ greeting: z.string() }),
});

export default defineWorkflow("hello", {
  init: (input: { name: string }) => ({ name: input.name }),
  on: {
    started: (state) => [state, [cmd.task(greet, { name: state.name })]],
    task_done: (state, event) => {
      if (event.status !== "succeeded") throw new WorkflowFailure(event.error ?? "greet failed");
      return [state, [cmd.complete(event.output ?? null)]];
    },
  },
});
```

```ts
// hello.worker.ts
import { defineWorker } from "@oona/vlo";

export default defineWorker({
  "hello.greet": (input: { name: string }) => ({ greeting: `Hello, ${input.name}!` }),
});
```

```ts
// vlo.config.ts
import { defineConfig } from "@oona/vlo";

export default defineConfig({
  workflows: ["*.workflow.ts"],
  workers: ["*.worker.ts"],
  profiles: {
    dev: {
      journal: "sqlite://.vlo/hello.db",
      blob: "file://.vlo/blobs",
      roles: ["orchestrator", "api", "worker:default"],
      dispatcher: { mode: "loop" },
    },
  },
});
```

```sh
vlo dev --profile dev                                       # SQLite + file blobs, every role, :4100
curl -s -X POST localhost:4100/v1/runs -H 'content-type: application/json' \
  -d '{"workflow":"hello","input":{"name":"world"}}'      # → {"run_id":"run_…"}
curl -s localhost:4100/v1/runs/<run_id>                    # → "status":"completed", "output":{"greeting":"Hello, world!"}
```

Most pipelines do not need a hand-written reducer. The `sequence` helper reads as a list of
steps, and `agentLoop` builds a whole agent:

```ts
sequence([step(plan), fanOut(work, selectItems, { concurrency: 2 }), waitFor(approve), step(finish)]);

agentLoop({ decide, tools: { search, write }, evaluate, threshold: 0.9, budget: { tokens: 20_000 } });
```

Three runnable examples live in [`examples/`](examples/hello/README.md), each started with
one command:

| Example | What it shows |
| --- | --- |
| [hello](examples/hello/README.md) | One workflow, one activity, and the journal printed event by event. |
| [pipeline](examples/pipeline/README.md) | Plan, fan out two at a time, wait for a human, finish. |
| [agent](examples/agent/README.md) | An agent that spends 18 tokens against a budget of 15, parks, and resumes on a top-up. |

## What is inside

- **Kernel**: Rust with no I/O, compiled to wasm. `crates/`.
- **Host**: TypeScript on Node. Runs on Cloud Run, Vercel, a container or a laptop. `sdk/ts/sdk`.
- **Journal**: your Postgres (it works behind transaction-mode poolers) or a SQLite file. It
  is also the task queue, so there is no broker.
- **Workers**: any language, pushed over signed HTTP or pulling from the API.
- **Agents**: `@oona/vlo/agent`, in the same package. `sdk/ts/sdk/src/agent`.

## Documentation

The docs are published at **<https://oonalab.github.io/vlo/>**, with the TypeScript and Rust
API references alongside.

| If you want to | Read |
| --- | --- |
| Get a run going in ten minutes | [Getting started](docs/getting-started.md) |
| Decide whether Vlo fits | [Why Vlo](docs/why-vlo.md), [Performance](docs/performance.md), [Reliability](docs/reliability.md), [Status and roadmap](docs/status.md) |
| Build an agent | [Build an agent harness](docs/agent-harness.md), [Agents](docs/agents.md) |
| Find a how-to | [Recipes](docs/recipes.md), [FAQ](docs/faq.md) |
| See everything | [The full index](docs/README.md) |

To build the API reference locally: `pnpm --filter @oona/vlo docs:api` (TypeDoc) and
`cargo doc --workspace --open`. `pnpm docs:dev` previews the site.

## Layout

```
crates/types        wire types + generated JSON Schema (schema/kernel-protocol.schema.json)
crates/kernel       pure logic, native tests, proptests, golden fixtures (fixtures/kernel/)
crates/kernel-wasm  wasm-bindgen exports → sdk/ts/sdk/wasm/ (committed)
crates/traits       Journal / BlobStore / TaskTransport for a future Rust host
sdk/ts/sdk          @oona/vlo: authoring, journal, host, client, cli
  src/agent         @oona/vlo/agent: decision(), agentLoop(), budgetTopup()
examples/           hello, pipeline, agent
docs/               user documentation
```

## Develop

```sh
rustup show                              # toolchain pinned in rust-toolchain.toml
cargo test --workspace                   # kernel
./scripts/build-kernel.sh                # rebuild wasm after kernel changes (commit the output)
pnpm install                             # once, from the repo root
pnpm --filter @oona/vlo test             # SDK on SQLite; set VLO_TEST_DATABASE_URL for Postgres
pnpm --filter @oona/vlo exec tsx src/cli.ts --help
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the CI gates and how to regenerate the schema and
fixtures. Security reports: [SECURITY.md](SECURITY.md).

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
