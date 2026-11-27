---
url: /vlo/testing.md
---
# Testing

A Vlo workflow is a pure function, so most of it can be tested with no engine, no database
and no network. This page covers three levels. Every test on it is a real file under
[`../examples/`](../examples/) and runs in CI with `pnpm --filter @oona/vlo-examples test`.

| Level | What runs | Use it for |
| --- | --- | --- |
| [Unit](#unit-test-a-reducer) | One call to your reducer | Logic: which commands follow which event. |
| [End to end](#end-to-end-in-process) | A real host on a throwaway SQLite journal, no socket | Whole runs: tasks, signals, retries, parking. |
| [Agent](#testing-an-agent) | The same, with a scripted model | Agent loops, with no API key and no cost. |

## Unit test a reducer

`workflow.reduce(stateJson, event, initInput?)` runs one handler. Pass `initInput` for
`started`; pass the previous `state` string afterwards. This is the test for the
[hello example](../examples/hello/):

```ts
import { expect, it } from "vitest";
import workflow from "./hello.workflow.ts";

const NONE = { cpu_ms: 0, tokens: 0, cost_micro_usd: 0 };
const base = { ts_ms: 1, random: "0".repeat(32), usage_total: NONE };

it("asks for a greeting, then completes with it", () => {
  const begun = workflow.reduce(null, { ...base, type: "started", input: { name: "world" } }, { name: "world" });
  expect(begun.commands).toMatchObject([{ type: "task", input: { name: "world" } }]);

  const done = workflow.reduce(begun.state, {
    ...base, type: "task_done", step_id: "task#1", attempt: 1,
    activity: "hello.greet", status: "succeeded", output: { greeting: "Hello, world!" }, usage: NONE,
  });
  expect(done.commands).toEqual([{ type: "complete", output: { greeting: "Hello, world!" } }]);
});

it("fails the run when the greeting fails", () => {
  const begun = workflow.reduce(null, { ...base, type: "started", input: { name: "world" } }, { name: "world" });

  expect(() =>
    workflow.reduce(begun.state, {
      ...base, type: "task_done", step_id: "task#1", attempt: 1,
      activity: "hello.greet", status: "failed", error: "no greeter", usage: NONE,
    }),
  ).toThrow("no greeter");
});
```

`state` is JSON text and `commands` is the list the handler returned. Because the reducer
reads only its arguments, the same input always gives the same output; there is nothing to
mock.

Things worth a unit test:

* the failure path: a `task_done` with `status: "failed"`, as above;
* an event you are not waiting for, which should return the same state and no commands;
* a budget decision, by setting `usage_total` on the event.

## End to end, in process

Start a real host on a temporary SQLite file and talk to it through `host.fetch`, which
skips the socket. Everything else is the real engine: the kernel, the journal, the
dispatcher and your workers. This is the test for the
[pipeline example](../examples/pipeline/):

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, createHost, type Host } from "@oona/vlo/host";
import { afterEach, expect, it } from "vitest";
import { approve, finish, plan, work } from "./activities.ts";
import worker from "./pipeline.worker.ts";
import pipeline from "./pipeline.workflow.ts";

let host: Host;
let dir: string;

afterEach(async () => {
  await host.stop();
  await rm(dir, { recursive: true, force: true });
});

it("waits for approval, then finishes", async () => {
  dir = await mkdtemp(join(tmpdir(), "vlo-test-"));
  host = createHost({
    journal: `sqlite://${join(dir, "journal.db")}`,
    blob: `file://${join(dir, "blobs")}`,
    workflows: [pipeline],
    activities: [plan, work, finish],
    signals: [approve],
    workers: [worker],
    dispatcher: { tickMs: 10 },
  });
  await host.start();
  const client = createClient({ fetch: host.fetch });

  const run = await client.start(pipeline, { n: 3 });
  await client.waitFor(run.run_id, "awaiting_signal");

  await client.signal(run.run_id, approve, { by: "test" });
  const done = await client.waitFor(run.run_id, "completed");

  expect(done.output).toMatchObject({
    "pipeline.finish": { report: "ITEM-0,ITEM-1,ITEM-2 approved by test" },
  });
});
```

Notes:

* `dispatcher: { tickMs: 10 }` makes the dispatcher pass often, so tests do not wait for
  the default 500 ms tick.
* `client.waitFor(runId, status, timeoutMs?)` polls until the run reaches a status. The
  default timeout is 10 seconds.
* `client.events(runId)` returns the journal, so a test can assert on exactly which steps
  ran and in what order.
* Use one journal per test. SQLite is single-writer, and a fresh file keeps tests
  independent.

To run the same tests against Postgres, pass a `postgres://` URL as `journal`.

## Testing an agent

Replace the model with a scripted worker: a pure function of the memory it is shown. The
loop, the budget and the parking are all real. This is the decider from the
[agent example](../examples/agent/):

```ts
"agent.decide": (input: { memory: unknown[]; candidate: { text?: string } | null }, ctx) => {
  ctx.reportUsage({ tokens: TOKENS.decide });
  const pass = input.memory.length;
  if (pass === 0) return { tool: "draft", args: { topic: "durable execution" }, rationale: "nothing yet" };
  if (pass === 1 && input.candidate?.text !== undefined) {
    return { tool: "rewrite", args: { text: input.candidate.text }, rationale: "tighten it" };
  }
  return { tool: "done", rationale: "good enough" };
},
```

Its budget is 15 tokens and the first cycle spends 18, so the run parks:

```ts
// The first cycle spends 18 tokens against a budget of 15, so the run parks.
const run = await client.start(agent, { topic: "durable execution" });
await client.waitFor(run.run_id, "awaiting_signal");

await client.signal(run.run_id, topup, { tokens: 100 });
const done = await client.waitFor(run.run_id, "completed");
const result = done.output as unknown as AgentResult;

expect(result.candidate).toEqual({ text: "a polished headline about durable execution" });
expect(result.spent.tokens).toBe(36);
```

Make the scripted decider depend only on its input, never on a counter outside it. A task
can be delivered more than once, and a decider that counts calls would drift.

The harness example tests a longer loop and an approval gate the same way:
[`../examples/harness/harness.test.ts`](../examples/harness/harness.test.ts).

## Testing a journal adapter

If you write your own journal, `journalConformance` from `@oona/vlo/testing` runs the suite
the built-in adapters pass. `fakeClock` from the same entry gives tests a clock they
control. See [journal.md](./journal.md).

## What tests cannot catch yet

Nothing stops a reducer from reading the clock or calling the network, and a unit test
will not notice if it does. An impure reducer is caught only when a run is rebuilt from its
journal. Keep reducers free of `Date`, `Math.random`, `fetch` and environment reads. See
[workflows.md](./workflows.md#determinism).
