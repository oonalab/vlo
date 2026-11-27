# harness

An agent harness, end to end: a decision backed by a model worker, two tools, a scorer, and
a pipeline that waits for a person before acting on what the agent wrote. It is the code
behind [Build an agent harness](../../docs/agent-harness.md).

The model is scripted (`model.ts`), so no API key is needed. Swap the four functions in that
file for your model client and tools; nothing else changes.

| File | What it is |
| --- | --- |
| `activities.ts` | The tools, the decision, the scorer, the publish step and the approval signal. |
| `model.ts` | Scripted stand-ins for the model, the search tool and the grader. |
| `research.workflow.ts` | The agent: `agentLoop` with a budget and a score threshold. |
| `research.worker.ts` | The handlers. Each model call reports the tokens and cost it spent. |
| `publish.workflow.ts` | Runs the agent as a child run, waits for approval, then publishes. |
| `harness.test.ts` | Both workflows on the real engine, with no socket. |

```sh
pnpm dev:harness                                  # from examples/; API on :4100
curl -s -X POST localhost:4100/v1/runs -H 'content-type: application/json' \
  -d '{"workflow":"publish","input":{"topic":"durable execution"}}'   # → {"run_id":"run_…"}
curl -s localhost:4100/v1/runs/<run_id>                        # "status":"awaiting_signal" once the agent is done
curl -s -X POST localhost:4100/v1/runs/<run_id>/signals/publish.approve \
  -H 'content-type: application/json' -d '{"by":"you"}'      # → {"signal_id":"sig_…","delivered":true}
curl -s localhost:4100/v1/runs/<run_id>                        # "status":"completed"
```

`output["publish.post"].url` is `https://example.com/posts/approved-by-you`. To run the agent
on its own, start the `research` workflow with the same input: it searches, writes a short
report, scores 0.95 and completes, having spent 1,400 tokens.

```sh
pnpm test                                         # from examples/; every example's tests
```
