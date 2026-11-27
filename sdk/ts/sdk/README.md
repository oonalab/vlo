# @oona/vlo

[Vlo](https://github.com/oonalab/vlo) is durable execution for workflows and AI agents, as
a library on the database you already run. It keeps long-running work alive through
crashes and restarts, with no cluster, broker or vendor platform.

- **Tiny.** A 298 KB wasm kernel inside your process. Nothing to stand up.
- **Performant.** One transaction per step. A run with 20,000 events resumes as fast as a
  run with 38.
- **Reliable.** Nothing is acknowledged before it is saved, and every checkpoint is
  hash-checked.
- **Efficient.** A waiting run holds no compute. An agent that reaches its budget parks
  instead of burning money.
- **Built for the edge.** The kernel has no I/O and runs anywhere wasm runs. It runs on
  Node today (Cloud Run, Vercel, containers); the edge host is not built yet.

One design principle makes all five possible: a workflow is a pure reducer,
`(state, event) → (state, commands)`. Each step is saved in one transaction to your
Postgres or a SQLite file, which is also the task queue. Between steps a run is only rows,
so there is nothing to keep alive and nothing to replay.

```sh
pnpm add @oona/vlo zod          # Node ≥ 22.5
```

| Entry | What it gives you |
|---|---|
| `@oona/vlo` | authoring: `activity`, `signal`, `defineWorkflow`, `cmd`, `sequence`, `fanOut`, `waitFor`, `defineWorker`, `defineConfig`, `env` |
| `@oona/vlo/agent` | agent loop: `decision`, `agentLoop`, `budgetTopup`, `approvalSignal` |
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

`@oona/vlo/agent` builds a decide → tool → evaluate loop that survives crashes and stays
inside a budget.

```ts
import { defineWorkflow } from "@oona/vlo";
import { agentLoop } from "@oona/vlo/agent";

export default defineWorkflow(
  "research",
  agentLoop({ decide, tools: { search, write }, evaluate, threshold: 0.9, budget: { tokens: 50_000 } }),
);
```

- `decision()` declares the activity behind which your model call lives. Its output is
  limited to the tools you registered, or `"done"`.
- `agentLoop()` builds the workflow. It runs until the decision returns `"done"`, the score
  clears the threshold, or the iteration cap is hit.
- `budgetTopup()` declares the signal that resumes a run parked on a spent budget.
- `approval: { tools: [...] }` makes the named tools wait for a person's yes or no;
  `approvalSignal(i)` is the signal that answers call `i`.

Every decision, tool call and score is one journaled event, so an agent continues from its
last event after a crash. The kernel meters usage on every event, including failed
attempts; a run that reaches its budget parks and keeps its work until someone tops it up.

## Documentation

- [Getting started](https://oonalab.github.io/vlo/getting-started)
- [Why Vlo](https://oonalab.github.io/vlo/why-vlo), with what it does not have yet
- [Build an agent harness](https://oonalab.github.io/vlo/agent-harness)
- [Recipes](https://oonalab.github.io/vlo/recipes) and [FAQ](https://oonalab.github.io/vlo/faq)
- [Performance](https://oonalab.github.io/vlo/performance) and [Reliability](https://oonalab.github.io/vlo/reliability)
- [Full index](https://oonalab.github.io/vlo/)
- [API reference](https://oonalab.github.io/vlo/api/)
- [Examples](https://github.com/oonalab/vlo/tree/main/examples): the smallest program, a
  fan-out pipeline with a human approval, and a budgeted agent loop.

Apache-2.0.
