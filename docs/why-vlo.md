# Why Vlo

Durable execution is a crowded field. This page says what Vlo does differently, what that
buys you, and what it does not have yet. Claims about other systems come from their public
documentation as of September 2026; check them before relying on them.

## Four ways to survive a crash

Every durable-execution system has to answer one question: when the process dies halfway
through a workflow, how does the work continue from where it was? There are four answers.

| Model | How progress survives | Systems built this way | What it asks of you |
| --- | --- | --- | --- |
| **Replayed code** | The workflow function runs again from the top; recorded step results are memoised, so it fast-forwards to where it stopped. | Temporal, Restate, DBOS, Inngest, Cloudflare Workflows, Vercel Workflow, Azure Durable Functions | Workflow code must be deterministic: no clock, no randomness, no I/O outside a step. Replay time grows with history. A sandbox, lint or "replay failed" error catches mistakes after the fact. |
| **State-machine definition** | The workflow is data, not code; the service stores the current state. | AWS Step Functions, Netflix Conductor, Windmill flows | Logic lives in JSON or YAML. Branches and loops are verbose; the service is vendor-hosted. |
| **Snapshotted runtime** | The whole WASM instance is checkpointed and resumed. | Golem, Obelisk | A server owns the runtime; everything compiles to WASM components; snapshots are large. |
| **Event-sourced reducer** | Each event is folded into a state snapshot inside one transaction. There is nothing to replay. | **Vlo** | A workflow is `(state, event) → (state, commands)`. Linear flows use the `sequence` helper; there is no `await` inside a workflow. |

Vlo is the only one in the last row. Everything else on this page follows from that choice.

## What the reducer buys you

**No determinism rules on your code.** A replay system has to trust that your workflow
function behaves the same the second time. Vlo's reducer cannot misbehave that way: it is
handed an event and returns commands, and every source of non-determinism (time, randomness,
task outputs, signal payloads) arrives on the event. The kernel proves it, too: every
checkpoint carries a hash, and a rebuilt state that disagrees with the journal fails the run
with `nondeterminism_detected` instead of silently diverging. See
[workflows.md](./workflows.md#determinism).

**Your database is the engine.** The journal is your Postgres, or a SQLite file on a laptop
or in CI. It is also the task queue, so there is no broker, no server cluster and no vendor
state store. DBOS is the closest relative here; Vlo adds SQLite, the queue-in-the-journal
design, and a host that works behind transaction-mode poolers. See [journal.md](./journal.md).

**Portable by construction.** The kernel is a wasm module with no I/O; the host is a
small Node package. Together they are under 600 KB. They run on Cloud Run, Vercel, a
container or your laptop today, and the design reserves a place for an edge journal in a
Durable Object. Platform-bound systems run on one cloud; server-bound systems need a
machine you operate.

**Workers in any language, typed.** Activities are declared with Zod schemas, which become
a JSON Schema registry. A worker is any HTTP endpoint that verifies an HMAC, or any process
that polls. Replay systems need both the workflow and its activities in an SDK language.
See [activities-and-workers.md](./activities-and-workers.md).

**Agents are a first-class workload.** Usage is metered by the kernel on every event, so a
budget is a reducer decision, not a wrapper. A run that exhausts its budget parks on a
top-up signal instead of failing, and a human approval is one signed link. See
[agents.md](./agents.md) and [signals-and-humans.md](./signals-and-humans.md).

## What Vlo does not have yet

Be honest with yourself before choosing it:

- **No console.** Every system named above ships a web UI with a run tree. Vlo has the
  journal, the SSE stream, the HTTP API and the CLI. See [observability.md](./observability.md).
- **Workflows are TypeScript only.** Workers can be anything; the reducer runs in the Node
  host. Temporal and Restate let you write the workflow itself in several languages.
- **No managed cloud.** You run the host. `vlo deploy` renders the Cloud Run or Vercel
  files, but nobody else operates it for you.
- **The edge journal is a design, not a feature.** See [limits.md](./limits.md).
- **It is young.** The systems above have years of production history and the bug reports
  to prove it.

## When to pick it

Pick Vlo when you want durable workflows and agents without operating a server, when your
Postgres is the system of record you already trust, when workers live in more than one
language or more than one place, or when the cost of "my workflow code replayed differently"
is one you would rather make impossible than detect.

Pick a replay system when your team writes long, linear workflows and wants them to read as
plain `await` code, or when you need a console and a support contract on day one.
