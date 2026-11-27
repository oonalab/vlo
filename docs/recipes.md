# Recipes

Short answers to "how do I…". Each recipe links to the page with the full detail. The
TypeScript on this page is typechecked in CI: it is copied from
[`../examples/recipes/recipes.ts`](../examples/recipes/recipes.ts).

| I want to | Recipe |
| --- | --- |
| Wait for a person | [Wait for an approval, with a deadline](#wait-for-an-approval-with-a-deadline) |
| Approve from an email | [Send an approval link](#send-an-approval-link) |
| Limit what an agent spends | [Cap an agent's spend](#cap-an-agents-spend) |
| Limit what a pipeline spends | [Stop a pipeline when it has spent too much](#stop-a-pipeline-when-it-has-spent-too-much) |
| Call a flaky model or API | [Retry a flaky call](#retry-a-flaky-call) |
| Run something for hours | [Run a task for hours](#run-a-task-for-hours) |
| Process many items | [Fan out, narrow or wide](#fan-out-narrow-or-wide) |
| Keep going when one step fails | [Tolerate a failure](#tolerate-a-failure) |
| Show progress in a UI | [Stream progress to a UI](#stream-progress-to-a-ui) |
| Avoid starting the same work twice | [Start a run idempotently](#start-a-run-idempotently) |
| Wait, then continue | [Sleep or wait until a time](#sleep-or-wait-until-a-time) |
| Write a worker in Python or Go | [Write a worker in another language](#write-a-worker-in-another-language) |
| Run a worker behind a firewall | [Pull tasks instead of receiving pushes](#pull-tasks-instead-of-receiving-pushes) |
| Keep a run going for months | [Compact a very long run](#compact-a-very-long-run) |
| Stop a run | [Cancel a run](#cancel-a-run) |

## Wait for an approval, with a deadline

<!-- snippet: examples/recipes/recipes.ts -->
```ts
export const approve = signal("order.approve", z.object({ by: z.string() }));

export const order = sequence([
  step(prepare),
  waitFor(approve, { timeoutMs: 86_400_000, onTimeout: "fail" }),
  step(ship, (state) => ({ approvedBy: signalOf(state, approve).by })),
]);
```

Deliver the approval with `client.signal(runId, approve, { by: "dana" })`. The run holds no
compute while it waits. Use `onTimeout: "continue"` to carry on without an answer; the
signal value is then `null`. See [signals-and-humans.md](./signals-and-humans.md).

## Send an approval link

<!-- snippet: examples/recipes/recipes.ts -->
```ts
const link = await client.signalLink(runId, approve, { expiresInMs: 86_400_000 });
await sendEmail({ to: reviewer, body: `Approve here: ${link.url}` });
```

Opening the link shows a confirmation form and changes nothing, so mail scanners cannot
approve by accident. A browser form sends no payload, so give a signal meant for links a
schema that accepts an empty one (optional fields, or `z.unknown()`). See
[signals-and-humans.md](./signals-and-humans.md#signed-links).

## Cap an agent's spend

<!-- snippet: examples/recipes/recipes.ts -->
```ts
export const capped = agentLoop({
  decide,
  tools,
  budget: { tokens: 50_000, costMicroUsd: 2_000_000, steps: 25 },
  topup,
});
```

Report usage from each worker with `ctx.reportUsage({ tokens, costMicroUsd })`. When a
ceiling is reached the run parks on `awaiting_signal` and keeps its work. Resume it with
`client.signal(runId, topup, { tokens: 20_000 })`. See [agents.md](./agents.md#parking-and-top-ups).

## Stop a pipeline when it has spent too much

Every event carries the run's banked usage, and `sequence` keeps it in `state.usage`. Skip
an expensive step once a ceiling is passed:

<!-- snippet: examples/recipes/recipes.ts -->
```ts
export const frugal = step(polish, undefined, {
  when: (state) => (state.usage?.tokens ?? 0) < 100_000,
});
```

In a hand-written reducer, read `event.usage_total` and decide. See
[observability.md](./observability.md#usage-accounting).

## Retry a flaky call

Retries are part of the activity, not your handler:

<!-- snippet: examples/recipes/recipes.ts -->
```ts
export const summarise = activity("doc.summarise", {
  input: z.object({ text: z.string(), compact: z.boolean().optional() }),
  output: z.object({ summary: z.string() }),
  retry: { maxAttempts: 5, backoff: "exponential", initialMs: 2_000, maxMs: 60_000 },
  timeoutMs: 120_000,
});
```

Throw from the handler and the policy decides. If repeating the same request would fail
the same way, change the input on later attempts. Here `callModel` is your handler:

<!-- snippet: examples/recipes/recipes.ts -->
```ts
export const summariser = defineWorker({
  "doc.summarise": withRetryInput(callModel, (input, attempt) => ({ ...input, compact: attempt > 1 })),
});
```

See [activities-and-workers.md](./activities-and-workers.md#declaring-an-activity).

## Run a task for hours

Leave `timeoutMs` unset. A task is held by a lease that the SDK worker renews
automatically, so there is no duration ceiling. If the worker dies, the lease lapses and
the retry policy takes over. Pass `ctx.signal` to long calls so they stop when the lease
is lost. See [activities-and-workers.md](./activities-and-workers.md#leases-heartbeats-and-timeouts).

## Fan out, narrow or wide

For up to a few dozen items, fan out tasks inside the run:

<!-- snippet: examples/recipes/recipes.ts -->
```ts
export const narrow = fanOut(
  resize,
  (state) => resultOf(state, list).images.map((image) => ({ image })),
  { concurrency: 4 },
);
```

For hundreds or thousands, fan out child runs. One run with very many tasks slows down
sharply; child runs do not have that problem.

<!-- snippet: examples/recipes/recipes.ts -->
```ts
export const wide = fanOutRuns(
  "process-image",
  (state) => resultOf(state, list).images.map((image) => ({ image })),
  { concurrency: 20 },
);
```

Read results with `fanOutResultsOf` and `fanOutRunsResultsOf`. See
[workflows.md](./workflows.md#the-sequence-helper) and [limits.md](./limits.md#known-weak-spots).

## Tolerate a failure

<!-- snippet: examples/recipes/recipes.ts -->
```ts
step(notify, undefined, { onFailure: "continue" }),
fanOut(fetchSource, () => [{ url: "https://example.com" }], { concurrency: 4, onFailure: "continue" }),
```

A failed step stores `null` instead of failing the run, so narrow the value when you read
it.

## Stream progress to a UI

Durable progress is the journal. Follow it over SSE:

<!-- snippet: examples/recipes/recipes.ts -->
```ts
for await (const message of client.stream(runId)) {
  if (message.type === "journal") render(message.data.step_id, message.data.status);
  if (message.type === "emit") renderHint(message.data);
  if (message.type === "end") finish(message.data.status);
}
```

For extra detail that does not need to survive a reconnect, emit it from the reducer with
`cmd.emit("progress", { percent: 40 })`. Emits are not journaled. From a browser, use the
SSE form of `GET /v1/runs/{id}/events`; see [http-api.md](./http-api.md).

## Start a run idempotently

Choose the run id yourself. A second start with the same id does not create a second run.

<!-- snippet: examples/recipes/recipes.ts -->
```ts
await client.start("weekly-report", { team }, { runId: `weekly_${team}_${isoWeek}` });
```

`client.startFresh` joins a live run under that key, and starts a new one (`<id>_2`, `<id>_3`, …)
once the earlier runs have ended. See [http-api.md](./http-api.md).

## Sleep or wait until a time

<!-- snippet: examples/recipes/recipes.ts -->
```ts
export const reminder = sequence([step(sendInvite), sleep(3 * 86_400_000), step(sendReminder)]);
```

In a hand-written reducer use `cmd.timer({ ms })` or `cmd.timer({ atMs })` and handle
`on.timer`. A sleeping run holds no compute.

## Write a worker in another language

A worker is an HTTP endpoint. It verifies the signature, answers `202`, does the work and
calls back.

```python
import hashlib, hmac, json, requests

def handle_push(headers, raw_body: bytes):
    task_id, attempt, ts = headers["vlo-task-id"], headers["vlo-attempt"], headers["vlo-timestamp"]
    body_hash = hashlib.sha256(raw_body).hexdigest()
    expected = "v1=" + hmac.new(PUSH_SECRET, f"{task_id}.{attempt}.{ts}.{body_hash}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, headers["vlo-signature"]):
        return 401

    task = json.loads(raw_body)
    queue.submit(run_task, task)   # do the work after answering
    return 202

def run_task(task):
    output = predict(task["input"])
    requests.post(
        task["complete_url"] + "/complete",
        headers={"authorization": f"Bearer {VLO_TOKEN}"},
        json={"attempt": task["attempt"], "output": output, "usage": {"tokens": 1200}},
    )
```

Also reject a `vlo-timestamp` more than five minutes old, and heartbeat on
`{complete_url}/heartbeat` for work longer than the lease. The full protocol is in
[activities-and-workers.md](./activities-and-workers.md#push-mode-default-for-remote-queues).

## Pull tasks instead of receiving pushes

Set the queue to `mode: "pull"` and run a poller wherever the worker can reach the API:

<!-- snippet: examples/recipes/recipes.ts -->
```ts
await runPullWorker({ baseUrl: "https://vlo.example.com", token: process.env.VLO_TOKEN!, worker: mediaWorker });
```

See [activities-and-workers.md](./activities-and-workers.md#pull-mode).

## Compact a very long run

A run that loops for months should not carry its whole history. End it and start a
successor with fresh history:

<!-- snippet: examples/recipes/recipes.ts -->
```ts
return [state, [cmd.continueAsNew({ cursor: state.cursor })]];
```

The two runs are linked, and a parent is told once, by the run that finally closes. See
[workflows.md](./workflows.md#commands).

## Cancel a run

<!-- snippet: examples/recipes/recipes.ts -->
```ts
await client.cancel(runId);
```

The run ends as `cancelled`. Cancelling a run that has already ended does nothing.
