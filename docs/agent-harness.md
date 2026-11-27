# Build an agent harness

An agent harness is the code around a model: it calls the model, runs the tools the model
picks, keeps memory, enforces a budget and waits for people. This guide builds one on Vlo
and shows what the engine gives you for free.

| A harness has to | On Vlo |
| --- | --- |
| Survive a crash on step 40 | Every decision, tool call and score is one journaled event. The run continues from the last one. |
| Stop a runaway agent | The kernel meters tokens and cost on every event. A spent budget parks the run. |
| Not lose work when it stops | A parked run keeps its memory and its best result, and resumes on a top-up. |
| Wait for a person for hours or days | A waiting run holds no compute and no connection. |
| Cope with bad model output | An unknown tool or invalid arguments becomes an observation, and the model decides again. |
| Run tools wherever they live | A tool is an activity. Its worker can be in-process, a serverless function or a Python service. |
| Show what happened | The journal is the trace: every step, retry and token is a row. |

The reference for every option is [agents.md](./agents.md).

**Everything on this page is runnable.** The code is
[`../examples/harness/`](../examples/harness/), which uses a scripted model so it needs no
API key. It is typechecked and tested in CI. From a checkout:

```sh
pnpm install                       # once, from the repository root
cd examples && pnpm dev:harness    # API on :4100
```

## How the loop works

`agentLoop` builds a decide → tool → evaluate loop as a reducer. Nothing loops at runtime:
each arrow below is one event folded into state.

```mermaid
flowchart TD
  S([start: goal]) --> D[decide: the model picks a tool]
  D -->|tool| T[tool: a worker runs it]
  D -->|done| F([complete])
  T --> E[evaluate: score the result]
  E -->|"score ≥ threshold"| F
  E -->|below| B{budget left?}
  B -->|yes| D
  B -->|no| P[park until a top-up]
  P -->|top-up signal| D
```

## 1. Declare the tools

A tool is an ordinary activity with typed input and output. `activities.ts`:

<!-- snippet: examples/harness/activities.ts -->
```ts
export const search = activity("research.search", {
  input: z.object({ query: z.string() }),
  output: z.object({ results: z.array(z.string()) }),
});

export const write = activity("research.write", {
  input: z.object({ notes: z.string() }),
  output: z.object({ text: z.string() }),
});

export const evaluate = activity("research.evaluate", {
  input: z.object({ goal: z.unknown(), candidate: z.unknown() }),
  output: z.object({ score: z.number() }),
});
```

## 2. Declare the decision

`decision` is the activity behind which your model call lives. Its output is fixed by the
tool registry, so the model can only name a tool the loop can run, or `"done"`.

<!-- snippet: examples/harness/activities.ts -->
```ts
export const decide = decision("research.decide", {
  input: z.object({
    goal: z.unknown(),
    memory: z.array(z.unknown()),
    candidate: z.unknown(),
    score: z.unknown(),
  }),
  tools: { search, write },
});

export const topup = budgetTopup();
```

The decision returns `{ tool, args?, rationale?, final? }`.

## 3. Build the loop

`research.workflow.ts`:

<!-- snippet: examples/harness/research.workflow.ts -->
```ts
import { defineWorkflow } from "@oona/vlo";
import { agentLoop } from "@oona/vlo/agent";
import { decide, evaluate, search, topup, write } from "./activities.ts";

export default defineWorkflow(
  "research",
  agentLoop({
    decide,
    tools: { search, write },
    evaluate,
    threshold: 0.9,
    budget: { tokens: 50_000, costMicroUsd: 2_000_000 },
    topup,
    maxIterations: 30,
  }),
);
```

That is the whole agent. `budget` is the ceiling; `threshold` is the score at which the
run completes on its own.

## 4. Put the model in a worker

The worker is where the model call happens. Report what each call spent, so the budget
means something. `research.worker.ts`:

<!-- snippet: examples/harness/research.worker.ts -->
```ts
import { defineWorker } from "@oona/vlo";
import { decideNext, grade, webSearch, writeReport, type DecideInput } from "./model.ts";

export default defineWorker({
  "research.decide": async (input: DecideInput, ctx) => {
    const reply = await decideNext(input);
    ctx.reportUsage({ tokens: reply.tokens, costMicroUsd: reply.costMicroUsd });
    return { tool: reply.tool, args: reply.args ?? null, rationale: reply.why };
  },

  "research.search": async (input: { query: string }) => ({
    results: await webSearch(input.query),
  }),

  "research.write": async (input: { notes: string }, ctx) => {
    const reply = await writeReport(input.notes);
    ctx.reportUsage({ tokens: reply.tokens, costMicroUsd: reply.costMicroUsd });
    return { text: reply.text };
  },

  "research.evaluate": async (input: { goal: unknown; candidate: unknown }) => ({
    score: await grade(input.goal, input.candidate),
  }),
});
```

`decideNext`, `writeReport`, `webSearch` and `grade` live in
[`model.ts`](../examples/harness/model.ts). In the example they are scripted stand-ins; in
your harness they are your model client and your tools. Vlo does not ship a model client
and has no price table: `costMicroUsd` is whatever you report.

Usage is banked on failed attempts too, so a model call that times out and retries still
counts against the budget.

## 5. Run it

`vlo.config.ts`:

<!-- snippet: examples/harness/vlo.config.ts -->
```ts
import { defineConfig } from "@oona/vlo";

export default defineConfig({
  workflows: ["*.workflow.ts"],
  workers: ["*.worker.ts"],
  activities: ["activities.ts"],
  profiles: {
    dev: {
      journal: "sqlite://.vlo/harness.db",
      blob: "file://.vlo/blobs",
      roles: ["orchestrator", "api", "worker:default"],
      dispatcher: { mode: "loop" },
    },
  },
});
```

```sh
pnpm dev:harness
```

```ts
import { createClient } from "@oona/vlo/host";

const client = createClient({ baseUrl: "http://localhost:4100" });
const run = await client.start("research", { topic: "durable execution" });
```

The run input is the agent's goal. With the scripted model the agent searches, writes a
short report, scores 0.95 and completes, having spent 1,400 tokens.

## 6. Watch it think

Follow the run live. Journal frames are durable, so reconnecting with the last `seq` loses
nothing.

```ts
for await (const message of client.stream(run.run_id)) {
  if (message.type === "journal") console.log(message.seq, message.data.step_id, message.data.status);
  if (message.type === "end") console.log("finished:", message.data.status);
}
```

Step ids tell you where the agent is: `decide#0`, `tool#0`, `evaluate#0`, `decide#1`, and so
on. After the run, `client.events(runId)` returns the same history, including each
attempt's `usage`. See [observability.md](./observability.md).

## 7. When the budget runs out

The run does not fail. Its status becomes `awaiting_signal`, it holds no compute, and it
keeps its memory and its best candidate.

```ts
const parked = await client.waitFor(run.run_id, "awaiting_signal");

// Somebody decides to keep going.
await client.signal(run.run_id, topup, { tokens: 20_000 });
```

- To find every parked run: `client.list({ status: "awaiting_signal" })`.
- To stop instead: `client.cancel(runId)`.
- To let a person approve the extra spend from an email, mint a signed link:
  `client.signalLink(runId, topup)`. See
  [signals-and-humans.md](./signals-and-humans.md#signed-links).

## 8. When the model misbehaves

The decider is a model, so bad output is an ordinary outcome, not a crash.

| The model | What the loop does |
| --- | --- |
| Names a tool that is not registered | Records the error as an observation and decides again. |
| Sends arguments the tool's schema rejects | Records `invalid args` as an observation and decides again. |
| Picks a tool that fails after its retries | Records the failure as an observation and decides again. |
| Returns no `tool` at all | Fails the run. |

Because each recovery is another iteration, it counts against `budget.steps` and
`maxIterations`. The agent cannot loop on a mistake forever.

## 9. Add a human approval

`agentLoop` has no built-in approval step. Run the agent as a child of a pipeline that
waits for a person before acting on the result. `publish.workflow.ts`:

<!-- snippet: examples/harness/publish.workflow.ts -->
```ts
import { defineWorkflow, fanOutRuns, fanOutRunsResultsOf, sequence, signalOf, step, waitFor } from "@oona/vlo";
import { approve, publish } from "./activities.ts";
import research from "./research.workflow.ts";

export default defineWorkflow(
  "publish",
  sequence([
    fanOutRuns(research, (state) => [state.input], { concurrency: 1 }),
    waitFor(approve, { timeoutMs: 172_800_000, onTimeout: "fail" }),
    step(publish, (state) => ({
      draft: fanOutRunsResultsOf(state, research)[0]?.output ?? null,
      approvedBy: signalOf(state, approve).by ?? "link",
    })),
  ]),
);
```

`publish` and `approve` are declared in `activities.ts` like the tools in step 1. The
pipeline waits up to two days and costs nothing while it does. Approve it with:

<!-- snippet: examples/harness/harness.test.ts -->
```ts
await client.signal(run.run_id, approve, { by: "dana" });
```

To approve a single tool call inside the loop, write the loop as your own reducer and add
a `cmd.awaitSignal` before the task; see [workflows.md](./workflows.md).

## 10. Run agents in parallel

Each agent is a run, so a team of agents is a fan-out of child runs with a concurrency
limit:

<!-- snippet: examples/recipes/recipes.ts -->
```ts
export const agents = fanOutRuns(
  "research",
  (state) => (state.input as { topics: string[] }).topics.map((topic) => ({ topic })),
  { concurrency: 4 },
);
```

Each child has its own journal, its own budget and its own usage total. A parent does not
see what its children spent; read each child's `output.spent`.

## 11. Move the model call off the host

A tool can run somewhere else without changing the workflow. Give the activity a queue and
point the queue at a worker:

```ts
export const decide = decision("research.decide", { input: …, tools: { search, write }, queue: "llm" });
```

```ts
// in the production profile
queues: { llm: { url: env("VLO_QUEUE_LLM_URL"), secret: env("VLO_PUSH_SECRET") } },
```

The worker can be a serverless function that exists only while it works, or a service in
another language that verifies the signature and calls back. See
[activities-and-workers.md](./activities-and-workers.md#where-workers-run).

## What Vlo does not do for you

- **It does not call the model.** Bring your own client and prompts.
- **It does not price tokens.** You report cost; the kernel banks it.
- **It does not manage long context.** The loop keeps the last 20 observations
  (`memoryLimit`) and drops older ones. Summarise in a tool if you need more.
- **It does not approve individual tool calls.** See step 9.
- **It does not roll child usage up to a parent.**

## Next

- [agents.md](./agents.md): every option, the state shape and the result shape.
- [testing.md](./testing.md#testing-an-agent): test the loop with a scripted model and no API key.
- [recipes.md](./recipes.md): short answers to common tasks.
