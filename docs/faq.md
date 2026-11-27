# FAQ

Quick answers and common objections. For the full argument see [why-vlo.md](./why-vlo.md).

## Choosing Vlo

### What is Vlo, in one sentence?

An open-source durable execution engine for workflows and AI agents that runs as a library
on your own Postgres or a SQLite file.

### What do I need to run it?

Node 22.5 or later and a database: Postgres for production, a SQLite file for a laptop, CI
or a small single-process host. There is no server, broker or cluster to install.

### I want to write plain `await` code. Can I?

No, and that is the one real trade. A Vlo workflow is a reducer, not a function that
pauses. The `sequence` helper makes pipelines read as a list of steps, and `agentLoop`
builds an agent in one call. If straight `await a(); await b();` code matters most to your
team, a replay-based engine is the better fit.

### Reducers sound hard. Are they?

The hello-world workflow is about ten lines. Most workflows are a `sequence` and never
touch a reducer directly. When you do write one, it is a plain function you can unit test
with no engine running. See [testing.md](./testing.md).

### Is it production-ready?

It is young, and it says so. The kernel is small enough to audit, tested with property
tests and golden fixtures, and every checkpoint is hash-checked on load. It has no
console, no managed cloud and no benchmark at scale. Read [status.md](./status.md) and
[limits.md](./limits.md) before you commit to it.

### Is there a UI?

Not yet. The journal is a table you can query, every run has a live event stream, and the
HTTP API and CLI cover the rest. See [observability.md](./observability.md).

### What about lock-in?

Vlo is Apache-2.0. The state is rows in your database, on your cloud. Nothing is hosted for
you.

### Does it run on the edge?

Not yet. The kernel is built for it: a wasm module with no I/O. The host and journals need
Node today, and the Cloudflare host is the next platform milestone. See
[status.md](./status.md#about-built-for-the-edge).

## Performance and scale

### How fast is it?

On a laptop with local Postgres, a 3-step workflow finishes in under 8 ms and a resume
takes about 10 ms whether the run has 38 events or 20,000. Those are local numbers with no
network. See [performance.md](./performance.md) for the setup and the caveats.

### Is my database fast enough to be the queue?

For most products, yes: the design is bounded by the database, in the low thousands of
tasks per second on Postgres. If you already run a broker, it can carry tasks as a delivery
transport, and the journal still records everything.

### Where should the host run?

In the same region as its journal. One step makes about 15 database round trips, so a slow
link to the database makes every step slow.

### Can one run fan out to thousands of tasks?

Use child runs for that. One run with very many tasks slows down sharply; `fanOutRuns`
gives each item its own run and avoids the problem. See [limits.md](./limits.md#known-weak-spots).

### How much does a waiting run cost?

About 2 KB of rows on Postgres and no compute. A run waiting two days for an approval
holds no process, no connection and no stack.

## Building

### Can I write workflows in Python or Go?

Not yet. Workflows are TypeScript. Workers can be written in any language that can serve
or call HTTP. See [recipes.md](./recipes.md#write-a-worker-in-another-language).

### Which model providers does the agent layer support?

All of them, because it calls none of them. Your worker makes the model call and reports
what it spent. See [agent-harness.md](./agent-harness.md).

### What happens when an agent runs out of budget?

The run parks. Its status becomes `awaiting_signal`, it keeps its memory and its best
result, and it resumes when someone sends a top-up. It does not fail and it does not keep
spending. See [agents.md](./agents.md#parking-and-top-ups).

### How long can a task run?

As long as it needs. A task is held by a lease that the worker renews, so there is no
broker deadline. Set `timeoutMs` only if you want a ceiling.

### Will my handler ever run twice?

It can. Execution is at-least-once and recording is exactly-once. Make a handler idempotent
on `ctx.taskId` and `ctx.attempt` when its side effect matters. See
[reliability.md](./reliability.md#exactly-once-recording-at-least-once-execution).

### Can I change a workflow while runs are in flight?

Carefully. A run pins the workflow's name, not its code. If you change a reducer's logic
and a live run is later rebuilt from its journal, the rebuild no longer matches and the run
fails with `nondeterminism_detected`. Let in-flight runs finish, or register the changed
workflow under a new name. See [workflows.md](./workflows.md#determinism).

### What must a reducer not do?

Read the clock, generate randomness, or do I/O. Time and entropy arrive on the event as
`ts_ms` and `random`; everything else belongs in an activity. Nothing enforces this yet, so
treat it as a rule of the road.

### How do I test a workflow?

Call `workflow.reduce` directly for unit tests, or start an in-process host on a throwaway
SQLite journal for end-to-end tests. See [testing.md](./testing.md).

## Operating

### Does it work on serverless?

Yes. The host runs with a manual dispatcher: the request that starts or signals a run
drains it, and a cron tick is the backstop. `vlo deploy` renders the files for Vercel and
Cloud Run. See [deployment.md](./deployment.md#serverless-manual-dispatch).

### Does it work behind a connection pooler?

Yes, including transaction-mode poolers. The Postgres journal keeps no session state. See
[journal.md](./journal.md#postgres-adapter).

### How do I see what a run did?

`GET /v1/runs/{id}/events` or `client.events(runId)` returns the journal: every step,
attempt, retry, cause, error and usage figure. See [observability.md](./observability.md).

### A run failed with `nondeterminism_detected`. What now?

Treat it as a bug report. A reducer no longer reproduces the history it wrote, usually
because it read a clock or random value, or its logic changed under a live run. The error
names the event where it diverged. See [errors.md](./errors.md).

### Something is misconfigured. Where do I start?

`vlo doctor --profile <name>`. It runs real round trips against the journal, the blob
store, the kernel and each queue, and prints a hint for anything that fails. See
[cli.md](./cli.md).
