# Getting started

Vlo is a durable execution engine. You write a workflow as a pure reducer,
`(state, event) → [state, commands]`. The engine appends each event to the run's journal,
folds it, and persists the new state and the commands in one transaction. The host then
turns the commands into tasks for workers, timers, child runs and signal waits. State is
the snapshot: nothing replays your code.

## Install

```sh
pnpm add @vlo/sdk zod
```

- Node ≥ 22.5 (the SQLite journal uses `node:sqlite`).
- Zod 4 is a peer dependency. `@google-cloud/storage` is optional and only needed for a
  `gcs://` blob store.
- The `vlo` CLI ships with `@vlo/sdk` (`npx vlo …`).

## The smallest program

Two files in one directory. The config says where the code and the journal live; the
workflow module exports a reducer.

```ts
// vlo.config.ts
import { defineConfig } from "@vlo/sdk";

export default defineConfig({
  workflows: ["*.workflow.ts"],
  profiles: {
    local: { journal: "sqlite://.vlo/dev.db", blob: "file://.vlo/blobs" },
  },
});
```

```ts
// hello.workflow.ts
import { cmd, defineWorkflow } from "@vlo/sdk";

export default defineWorkflow("hello", {
  init: (input: { name: string }) => ({ greeting: `hello, ${input.name}` }),
  on: {
    started: (state) => [state, [cmd.complete(state.greeting)]],
    task_done: (state) => [state, []],
  },
});
```

`init` builds the initial state from the run input. `started` is the first event every run
receives; here it completes the run at once. `task_done` is required by the type even when
the workflow never schedules a task.

Relative imports inside the config and the modules it points at need explicit file
extensions (`./activities.ts`); the files are imported by Node, not bundled.

## Run it

```sh
npx vlo dev
  ✓ journal  sqlite:///home/me/app/.vlo/dev.db
  ✓ found 1 workflow   hello
  ✓ api      http://localhost:4100
```

`vlo dev` uses the `local` profile (or the only profile in the file), migrates the journal, loads every module the globs
match and serves the HTTP API on port 4100. A warning about "no workers found" is expected
here: this workflow has no activities. See [cli.md](./cli.md) for every flag.

## Start a run

With `curl`:

```sh
curl -s -X POST http://localhost:4100/v1/runs \
  -H 'content-type: application/json' \
  -d '{"workflow":"hello","input":{"name":"world"}}'
# {"run_id":"run_…"}

curl -s http://localhost:4100/v1/runs/run_…
# {"run_id":"run_…","workflow":"hello","status":"completed","output":"hello, world",…}
```

With the client (it lives in `@vlo/sdk/host`):

```ts
import { createClient } from "@vlo/sdk/host";

const client = createClient({ baseUrl: "http://localhost:4100" });

const started = await client.start("hello", { name: "world" });
const done = await client.waitFor(started.run_id, "completed");
console.log(done.output); // "hello, world"

// Or follow the journal live over SSE until the run ends.
for await (const message of client.stream(started.run_id)) {
  if (message.type === "journal") console.log(message.seq, message.data.step_id);
  if (message.type === "end") console.log(message.data.status);
}
```

`client.get(runId)` returns the same run view as `GET /v1/runs/{id}`. The full route list
is in [http-api.md](./http-api.md).

## Add an activity and a worker

Real workflows do their non-deterministic work in activities, run by workers. The
`sequence` helper compiles a list of phases into a reducer.

```ts
// activities.ts
import { z } from "zod";
import { activity } from "@vlo/sdk";

export const shout = activity("hello.shout", {
  input: z.object({ text: z.string() }),
  output: z.object({ upper: z.string() }),
});
```

```ts
// shout.workflow.ts
import { defineWorkflow, sequence, step } from "@vlo/sdk";
import { shout } from "./activities.ts";

export default defineWorkflow("shout", sequence([step(shout)]));
```

```ts
// shout.worker.ts
import { defineWorker } from "@vlo/sdk";

export default defineWorker({
  "hello.shout": (input: { text: string }) => ({ upper: input.text.toUpperCase() }),
});
```

Add the worker glob to the config and restart `vlo dev`:

```ts
export default defineConfig({
  workflows: ["*.workflow.ts"],
  workers: ["*.worker.ts"],
  profiles: { local: { journal: "sqlite://.vlo/dev.db", blob: "file://.vlo/blobs" } },
});
```

```ts
const started = await client.start("shout", { text: "hi" });
const done = await client.waitFor(started.run_id, "completed");
// done.output === { "hello.shout": { upper: "HI" } }
```

The worker runs in the same process as the engine. Moving it to another machine is a
config change, not a code change: see [activities-and-workers.md](./activities-and-workers.md).

## Examples

- [`../examples/hello/`](../examples/hello/) — the program above.
- [`../examples/pipeline/`](../examples/pipeline/) — plan → fan out → wait for a human → finish.
- [`../examples/agent/`](../examples/agent/) — an `@vlo/agent` loop with a budget.

## Where next

| Page | What it covers |
| --- | --- |
| [concepts.md](./concepts.md) | Runs, steps, events, commands, roles, the journal |
| [workflows.md](./workflows.md) | The reducer contract, every `cmd.*`, the `sequence` helpers |
| [activities-and-workers.md](./activities-and-workers.md) | Activities, retries, leases, push and pull workers |
| [signals-and-humans.md](./signals-and-humans.md) | Signals, deadlines, signed links |
| [agents.md](./agents.md) | `@vlo/agent`: decide → tool → evaluate with a budget |
| [configuration.md](./configuration.md) | The whole `vlo.config.ts` reference |
| [cli.md](./cli.md) | `vlo dev`, `serve`, `doctor`, `deploy` |
| [deployment.md](./deployment.md) | Self-hosting, serverless, role splitting |
