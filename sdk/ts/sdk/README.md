# @oona/vlo

[Vlo](https://github.com/oonalab/vlo) is an event-sourced durable execution engine for
workflows and agents. A workflow is a pure reducer `(state, event) → (state, commands)`; the
Rust kernel (bundled as wasm) folds events, and your Postgres or a SQLite file is both the
journal and the task queue. Nothing suspends, so there is no code replay.

```sh
pnpm add @oona/vlo zod          # Node ≥ 22.5
```

| Entry | What it gives you |
|---|---|
| `@oona/vlo` | authoring: `activity`, `signal`, `defineWorkflow`, `cmd`, `sequence`, `fanOut`, `waitFor`, `defineWorker`, `defineConfig`, `env` |
| `@oona/vlo/agent` | agent loop: `decision`, `agentLoop`, `budgetTopup` |
| `@oona/vlo/host` | runtime: `createHost`, `serve`, `handler`, `createClient`, `drainHost`, `runPullWorker`, journals, blob stores, errors |
| `@oona/vlo/testing` | `journalConformance`, `fakeClock` |
| `vlo` (bin) | `vlo dev`, `vlo serve`, `vlo doctor`, `vlo deploy` |

## A workflow

```ts
import { activity, defineWorkflow, sequence, step } from "@oona/vlo";
import { z } from "zod";

const greet = activity("greet", { input: z.object({ name: z.string() }), output: z.string() });

export default defineWorkflow("hello", sequence([step(greet, (input) => input)]));
```

## An agent

`@oona/vlo/agent` is decide → act → evaluate as a pure reducer, with a budget that parks the
run on a top-up signal instead of failing it.

- `decision()` declares the activity that chooses the next tool from an observation.
- `agentLoop()` builds a workflow that runs decision, tool and evaluator steps until the
  decision returns `DONE`, the iteration cap is hit, or the budget is spent.
- `budgetTopup()` declares the signal that resumes a parked run with more budget.

Usage is accounted by the kernel on every event, so the budget check is deterministic and
survives restarts. Nothing in this entry does I/O: `agentLoop` returns a workflow definition
you hand to `defineWorkflow`.

## Documentation

- [Getting started](https://oonalab.github.io/vlo/getting-started)
- [Concepts](https://oonalab.github.io/vlo/concepts)
- [Agents](https://oonalab.github.io/vlo/agents)
- [Full index](https://oonalab.github.io/vlo/)
- [API reference](https://oonalab.github.io/vlo/api/)
- [Examples](https://github.com/oonalab/vlo/tree/main/examples): the smallest program, a
  fan-out pipeline with a human approval, and a budgeted agent loop.

Apache-2.0.
