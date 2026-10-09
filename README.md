# Vlo

A durable execution engine where a workflow is a pure reducer:

```
(state, event) → (state, commands)
```

The kernel appends the event to the run's journal, folds it, and persists the new state and
the commands in one transaction. The host then pushes the commands out as tasks, timers,
child runs or signal waits. Nothing suspends, so there is no code replay, no poll driver and
no sandbox: **state is the snapshot**, and the kernel proves determinism by re-folding the
journal and comparing hashes.

- **Kernel** — Rust, no I/O, compiled to wasm (under 300 KB). `crates/`.
- **Host** — TypeScript on Node, runs on Cloud Run, Vercel, a container or a laptop. `sdk/ts/sdk`.
- **Journal = queue** — your Postgres (works behind transaction-mode poolers) or a SQLite file.
- **Workers** — any language, pushed over signed HTTP or pulling from the API.
- **Agents** — `@vlo/agent`: decide → act → evaluate with a budget that parks, not fails. `sdk/ts/agent`.

## Try it

```sh
pnpm add @vlo/sdk zod        # Node ≥ 22.5
```

```ts
// hello.workflow.ts
import { activity, cmd, defineWorkflow, WorkflowFailure } from "@vlo/sdk";
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
import { defineWorker } from "@vlo/sdk";

export default defineWorker({
  "hello.greet": (input: { name: string }) => ({ greeting: `Hello, ${input.name}!` }),
});
```

```ts
// vlo.config.ts
import { defineConfig } from "@vlo/sdk";

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

That program, plus a fan-out pipeline with a human approval and an agent loop with a budget,
lives in [`examples/`](examples/hello/README.md). Each runs with one command.

## Documentation

Start with [Getting started](docs/getting-started.md), then [Concepts](docs/concepts.md).
The full index is [docs/README.md](docs/README.md): workflows, activities and workers,
signals and humans, agents, configuration, CLI, deployment, journal, HTTP API,
observability, errors, kernel protocol, architecture, design decisions, limits.

API reference: `pnpm --filter @vlo/sdk docs:api` (TypeDoc) and `cargo doc --workspace --open`.

## Layout

```
crates/types        wire types + generated JSON Schema (schema/kernel-protocol.schema.json)
crates/kernel       pure logic, native tests, proptests, golden fixtures (fixtures/kernel/)
crates/kernel-wasm  wasm-bindgen exports → sdk/ts/sdk/wasm/ (committed)
crates/traits       Journal / BlobStore / TaskTransport for a future Rust host
sdk/ts/sdk          @vlo/sdk: authoring, journal, host, client, cli
sdk/ts/agent        @vlo/agent: decision(), agentLoop(), budgetTopup()
examples/           hello, pipeline, agent
docs/               user documentation
```

## Develop

```sh
rustup show                              # toolchain pinned in rust-toolchain.toml
cargo test --workspace                   # kernel
./scripts/build-kernel.sh                # rebuild wasm after kernel changes (commit the output)
pnpm --filter @vlo/sdk test              # SDK on SQLite; set VLO_TEST_DATABASE_URL for Postgres
pnpm --filter @vlo/sdk exec tsx src/cli.ts --help
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the CI gates and how to regenerate the schema and
fixtures. Security reports: [SECURITY.md](SECURITY.md).

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
