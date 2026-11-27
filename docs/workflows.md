# Workflows

A workflow is a pure reducer. `defineWorkflow` gives it a name; the engine calls its
handlers with the current state and one event, and expects the next state and a list of
commands back.

```ts
import { cmd, defineWorkflow, type Reduction } from "@oona/vlo";
import { plan } from "./activities.ts";

interface State { stage: "planning" | "done"; n: number }

export default defineWorkflow("count", {
  init: (input: { n: number }): State => ({ stage: "planning", n: input.n }),
  on: {
    started: (state) => [state, [cmd.task(plan, { n: state.n })]],
    task_done: (state, event): Reduction<State> =>
      [{ ...state, stage: "done" }, [cmd.complete(event.output ?? null)]],
  },
});
```

## The contract

`defineWorkflow<S, I>(name, def)` takes:

| Field | Type | Notes |
| --- | --- | --- |
| `init` | `(input: I) => S` | Builds the state for the `started` event. `I` is whatever the run was started with. |
| `on.started` | `(state, event) => Reduction<S>` | Required. The first event of every run. |
| `on.task_done` | `(state, event) => Reduction<S>` | Required. A task attempt ended: `succeeded`, `failed` or `cancelled`. |
| `on.signal` | optional | A signal was delivered to an open wait. |
| `on.timer` | optional | A timer fired. |
| `on.child_done` | optional | A child run ended. |

`Reduction<S>` is `readonly [S, readonly Command[]]`. State must be JSON-serialisable: it is
stored as text, byte for byte, and handed back to the next handler with `JSON.parse`. No
classes, `Map`s or `Date`s.

An event with no handler throws, which fails the run. If you schedule a timer, implement
`on.timer`.

### Events

Every variant carries `type`, `ts_ms`, `random` (32 hex chars) and `usage_total`
(`{ cpu_ms, tokens, cost_micro_usd }`, the run's banked total including this event).

| Event | Extra fields |
| --- | --- |
| `started` | `input` |
| `task_done` | `step_id`, `attempt`, `activity`, `status`, `output?`, `cause?`, `error?`, `usage` (this attempt's own spend) |
| `signal` | `step_id`, `name`, `payload` |
| `timer` | `step_id` |
| `child_done` | `step_id`, `child_run_id`, `status`, `output?` |

Only a task attempt's *final* outcome reaches the reducer. Retries happen below it: a failed
attempt that the retry policy allows to try again is journaled as `retrying` and never
becomes a `task_done` event.

## Commands

Commands are plain objects. `cmd.*` builds them and validates what it can up front.

| Constructor | Command | Notes |
| --- | --- | --- |
| `cmd.task(activity, input, { id?, queue? })` | `task` | Validates `input` against the activity's Zod schema and throws `ActivityInputError` if it does not match. Carries the activity's `schema_ref`, retry policy, lease and timeout. |
| `cmd.timer({ ms } \| { atMs }, id?)` | `timer` | Exactly one of `ms` (relative) or `atMs` (absolute epoch ms). |
| `cmd.spawn(workflow, input, { id? })` | `spawn` | `workflow` is a name or a `Workflow`. See [Child runs](#child-runs). |
| `cmd.awaitSignal(signal, { id?, timeoutMs? })` | `await_signal` | Parks the run on `awaiting_signal` until a signal with that name arrives. With `timeoutMs` the kernel also opens a timer step `${id}:timeout` (`signalTimeoutStepId(id)`); whichever fires first reaches the reducer and the kernel cancels the other. |
| `cmd.awaitHuman(signal, { id, timeoutMs?, context? })` | *array* | Sugar: an `await_signal` with `id` and `timeoutMs`, plus an `emit` on channel `"human"` when `context` is set. Spread it into the command list. See [signals-and-humans.md](./signals-and-humans.md). |
| `cmd.emit(channel, data)` | `emit` | Side channel. Not journaled: broadcast to the host's `events` emitter and to open SSE streams as `event: emit`. |
| `cmd.complete(output)` | `complete` | Ends the run as `completed` with `output`. |
| `cmd.continueAsNew(input)` | `continue_as_new` | Ends the run as `continued`, journals `input` on a `continue` marker, and the host starts a successor run of the same workflow with that input in the same transaction. The two are linked by `continued_from` / `continued_to`; a parent is notified once, by the run that finally closes. |

Rules the kernel enforces on a reduction:

- At most one `complete` or `continue_as_new`, and no command after it.
- An explicit `id` must be non-empty and not already open on this run.
- Default step ids are `task#N`, `timer#N`, `child#N`, `signal#N`, where `N` is a
  run-wide counter over every step ever opened.

Step ids are how a reducer tells results apart. Give a step an explicit `id` whenever you
fan out or need to recognise the reply later (`event.step_id`).

There is no `cmd.fail`. A run fails when its reducer throws — see
[Failing a run](#failing-a-run).

## The `sequence` helper

For linear pipelines, `sequence([...phases])` compiles to the same `WorkflowDef` a
hand-written reducer produces. Phases run in order; `state.phase` is the index in flight.

```ts
import {
  defineWorkflow, fanOut, fanOutResultsOf, resultOf, sequence, signalOf, sleep, step, waitFor,
} from "@oona/vlo";
import { approve, finish, plan, work } from "./activities.ts";

export const exampleWorkflow = defineWorkflow(
  "example",
  sequence([
    step(plan),
    fanOut(
      work,
      (state) => resultOf(state, plan).items.map((item) => ({ item })),
      { concurrency: 2 },
    ),
    waitFor(approve, { timeoutMs: 86_400_000, onTimeout: "fail" }),
    step(finish, (state) => ({
      uppers: fanOutResultsOf(state, work).map((o) => o.upper),
      approvedBy: signalOf(state, approve).by,
    })),
  ]),
);
```

| Phase | Behaviour |
| --- | --- |
| `step(activity, mapInput?, { id?, when?, onFailure? })` | One task. Input is `mapInput(state)` when given; otherwise the workflow input for phase 0, and the previous phase's stored value afterwards (skipping `sleep`s). `id` pins the step id (default `task#n`). `when(state)` returning `false` stores `null` and skips the task. |
| `fanOut(activity, select, { concurrency, onFailure? })` | One task per item from `select(state)`, at most `concurrency` in flight, step ids `${activity}#${index}`. `select` must be pure: it is re-evaluated on every event. An empty selection stores `[]` and moves on. |
| `fanOutRuns(workflow, select, { concurrency, onFailure? })` | One **child run** per item from `select(state)` (each item is the child's start input), at most `concurrency` in flight, step ids `${workflow}#${index}`. Stores a `ChildResult { status, output, child_run_id }` per item; read with `fanOutRunsResultsOf`. Same purity rule and empty-selection behaviour as `fanOut`. |
| `waitFor(signal, { timeoutMs?, onTimeout?, context? })` | Parks until the signal arrives (step id `wait#<phase>`). With `timeoutMs`, a deadline timer `wait#<phase>:timeout` races it: `onTimeout: "fail"` (default) fails the run, `"continue"` stores `null` and advances. `context` is emitted on the `human` channel. |
| `sleep(ms)` | Parks on a timer (step id `sleep#<phase>`). Stores nothing. |

State shape (`SeqState`): `{ phase, input, results, signals, fan?, usage? }`. Step, fanOut
and fanOutRuns outputs land in `results[name]`; signal payloads in `signals[signalName]`.
Two phases using the same name share a key. `usage` is the run's banked usage as of the last
event (`event.usage_total`), so a charge step can read `state.usage?.tokens`. After the last
phase the run completes with `results`, or with `output(state)` when
`sequence(steps, { output })` is given.

**Failure tolerance.** A task or child that did not succeed throws `WorkflowFailure`, which
fails the run — unless its phase says `onFailure: "continue"`: a `step` then stores `null`,
a `fanOut` stores `null` for that item, and a `fanOutRuns` records the child's `status` with
a `null` output. `null` is also what `when: false` and a `waitFor` `onTimeout: "continue"`
store, so narrow it yourself when those options are in play. Events that do not belong to
the current phase (a late deadline, a duplicate delivery, a signal nobody is waiting for, a
failed task from a phase already left behind) are ignored: same state, no commands.

## Child runs

`cmd.spawn(childWorkflow, input, { id? })` opens a `child` step and creates a run of
`childWorkflow` with `parent_run_id` and `parent_step_id` set. The child's `run_id` is
derived deterministically by the kernel. The child workflow must be registered on the same
host, otherwise the parent's reducer fails.

```ts
on: {
  started: (state) => [state, [cmd.spawn(render, { clip: state.clip }, { id: "render" })]],
  child_done: (state, event) =>
    event.step_id === "render" && event.status === "succeeded"
      ? [state, [cmd.complete(event.output ?? null)]]
      : [state, [cmd.complete(null)]],
}
```

The dispatcher starts the child on its next tick and, when the child reaches a terminal
status, delivers `child_done` to the parent with `status` (`succeeded` for `completed`,
`failed`, or `cancelled`) and the child's `output`. The event carries no error text; a
failed child's reason is on its own `RunView.error` (`client.get(child_run_id)`).

In a `sequence`, `fanOutRuns` does the spawning and the `child_done` bookkeeping for you —
see [the `sequence` helper](#the-sequence-helper).

## Failing a run

Throw `WorkflowFailure(message, details?)` — or anything else — from a handler:

```ts
import { WorkflowFailure } from "@oona/vlo";

task_done: (state, event) => {
  if (event.status !== "succeeded") {
    throw new WorkflowFailure(`${event.activity} ${event.status}`, { step_id: event.step_id });
  }
  …
}
```

The host catches the throw, appends a `fail` marker (`cause: "app_error"`, `error` = the
message, the event that was being folded as the payload) and marks the run `failed`. The
checkpoint from before that event is kept. The message is surfaced as `RunView.error`
(with `cause`) on `GET /v1/runs/{id}`, so a caller can show why the run stopped without
reading the journal.

## Determinism

A handler may read only its arguments. In particular:

- No `Date.now()`, `Math.random()`, `fetch`, timers or environment. Use `event.ts_ms` and
  `event.random` when you need time or entropy.
- Do the non-deterministic work in an activity and read its output from `task_done`.
- Budgets are decisions over `event.usage_total`, not over a tally you keep.
- Expect at-least-once delivery: ignore an event you are not waiting for instead of acting
  on it twice. `sequence` and `agentLoop` do this by checking `step_id` and phase.

Nothing enforces these rules yet: a reducer is a plain function, and no lint or sandbox
stops it from reading the clock. A mistake is caught when a run is rebuilt from its
journal, as described next.

The host verifies the checkpoint's hash every time it loads one. If the checkpoint is
missing, or was written by a different workflow digest, it folds the journal from seq 0
and compares every transition's `state_hash` with the one journaled on that event. Any
mismatch appends a `nondeterminism` marker with `cause: "nondeterminism_detected"` and fails
the run. Changing a reducer's logic under a live run therefore surfaces as a failed run,
not as silently different state.

## Testing a reducer

`Workflow.reduce(stateJson, event, initInput?)` runs one handler with no host, journal or
kernel. Pass `initInput` for `started`; pass the previous `state` string afterwards.

```ts
const begun = exampleWorkflow.reduce(
  null,
  { type: "started", ts_ms: 1, random: "0".repeat(32), input: { n: 1 }, usage_total: NONE },
  { n: 1 },
);
const next = exampleWorkflow.reduce(begun.state, {
  type: "task_done", ts_ms: 2, random: "0".repeat(32), step_id: "task#1", attempt: 1,
  activity: "example.plan", status: "succeeded", output: { items: ["a"] },
  usage: NONE, usage_total: NONE,
});
// next.state is JSON text; next.commands is the Command[] the handler returned.
```

`NONE` is `{ cpu_ms: 0, tokens: 0, cost_micro_usd: 0 }`. End-to-end tests on an in-process
host, and tests for agents, are covered in [testing.md](./testing.md). The reference tests in
[`../sdk/ts/sdk/test/human.test.ts`](../sdk/ts/sdk/test/human.test.ts) are written this way.
