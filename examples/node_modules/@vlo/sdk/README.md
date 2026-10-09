# @vlo/sdk

The TypeScript SDK and host for [Vlo](../../../README.md), an event-sourced durable
execution engine. A workflow is a pure reducer `(state, event) → (state, commands)`; the
Rust kernel (bundled as wasm) folds events, and your Postgres or a SQLite file is both
the journal and the task queue.

```sh
pnpm add @vlo/sdk zod          # Node ≥ 22.5
```

| Entry | What it gives you |
|---|---|
| `@vlo/sdk` | authoring: `activity`, `signal`, `defineWorkflow`, `cmd`, `sequence`, `fanOut`, `waitFor`, `defineWorker`, `defineConfig`, `env` |
| `@vlo/sdk/host` | runtime: `createHost`, `serve`, `handler`, `createClient`, `drainHost`, `runPullWorker`, journals, blob stores, errors |
| `@vlo/sdk/testing` | `journalConformance`, `fakeClock` |
| `vlo` (bin) | `vlo dev`, `vlo serve`, `vlo doctor`, `vlo deploy` |

```ts
import { activity, cmd, defineWorkflow, sequence, step } from "@vlo/sdk";
import { z } from "zod";

const greet = activity("greet", { input: z.object({ name: z.string() }), output: z.string() });

export default defineWorkflow("hello", sequence([step(greet, (input) => input)]));
```

Start reading at [Getting started](../../../docs/getting-started.md); the full docs index
is [docs/README.md](../../../docs/README.md). Generated API reference: `pnpm docs:api`.

Apache-2.0.
