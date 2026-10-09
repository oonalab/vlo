# @vlo/agent

The agent layer over [`@vlo/sdk`](../sdk/README.md): decide → act → evaluate as a pure
reducer, with a budget that parks the run on a top-up signal instead of failing it.

```sh
pnpm add @vlo/sdk @vlo/agent zod
```

- `decision()` declares the activity that chooses the next tool from an observation.
- `agentLoop()` builds a workflow that runs decision, tool and evaluator steps until the
  decision returns `DONE`, the iteration cap is hit, or the budget is spent.
- `budgetTopup()` declares the signal that resumes a parked run with more budget.

Usage is accounted by the kernel on every event, so the budget check is deterministic and
survives restarts.

Read [Agents](../../../docs/agents.md) and run [`examples/agent`](../../../examples/agent/README.md).

Apache-2.0.
