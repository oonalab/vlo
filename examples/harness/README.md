# harness

An agent harness, end to end: a decision backed by a model worker, three tools, a scorer, a
budget, and a tool that waits for a person before it runs. It is the code behind
[Build an agent harness](../../docs/agent-harness.md).

The model is scripted (`model.ts`), so no API key is needed. Swap the functions in that file
for your model client and tools; nothing else changes.

| File | What it is |
| --- | --- |
| `activities.ts` | The tools (`search`, `write`, `publish`), the decision and the scorer. |
| `model.ts` | Scripted stand-ins for the model, the tools and the grader. |
| `research.workflow.ts` | The agent: `agentLoop` with a budget, a score threshold and `publish` gated on approval. |
| `research.worker.ts` | The handlers. Each model call reports the tokens and cost it spent. |
| `harness.test.ts` | The agent on the real engine with no socket: approved, rejected, and approved by signed link. |

The agent searches, writes a short report, then asks to publish it. That is its third cycle,
so it waits on the signal `agent.tool_approval:2`.

```sh
pnpm dev:harness                                  # from examples/; API on :4100
curl -s -X POST localhost:4100/v1/runs -H 'content-type: application/json' \
  -d '{"workflow":"research","input":{"topic":"durable execution"}}'  # → {"run_id":"run_…"}
curl -s localhost:4100/v1/runs/<run_id>                        # "status":"awaiting_signal": it wants to publish
curl -s -X POST localhost:4100/v1/runs/<run_id>/signals/agent.tool_approval:2 \
  -H 'content-type: application/json' -d '{"approved":true,"by":"you"}'   # → {"signal_id":"sig_…","delivered":true}
curl -s localhost:4100/v1/runs/<run_id>                        # "status":"completed"
```

`output.candidate.url` is the published post and `output.spent.tokens` is 1800. Send
`{"approved":false,"reason":"not this week"}` instead and the run still completes, with the
report as its candidate and nothing published.

```sh
pnpm test                                         # from examples/; every example's tests
```
