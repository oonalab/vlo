# agent

`agentLoop` from `@vlo/agent`: decide → tool → evaluate as a reducer, with a token budget.
The worker's tools are deterministic stubs, so no LLM key is needed. The first cycle spends
18 tokens against a budget of 15, so the run parks on `agent.budget_topup` instead of
failing; a top-up resumes it, the rewrite scores above the threshold and the run completes.

```sh
pnpm dev:agent                                    # from packages/vlo/examples; API on :4100
curl -s -X POST localhost:4100/v1/runs -H 'content-type: application/json' \
  -d '{"workflow":"agent","input":{"topic":"durable execution"}}'   # → {"run_id":"run_…"}
curl -s localhost:4100/v1/runs/<run_id>                        # "status":"awaiting_signal" after cycle 0
curl -s -X POST localhost:4100/v1/runs/<run_id>/signals/agent.budget_topup \
  -H 'content-type: application/json' -d '{"tokens":100}'    # → {"delivered":true}
curl -s localhost:4100/v1/runs/<run_id>                        # "status":"completed", output.spent.tokens = 36
```
