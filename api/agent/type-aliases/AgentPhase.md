---
url: /vlo/api/agent/type-aliases/AgentPhase.md
---
[@oona/vlo](../../packages.md) / [agent](../index.md) / AgentPhase

# Type Alias: AgentPhase

> **AgentPhase** = `"decide"` | `"approval"` | `"tool"` | `"evaluate"` | `"parked"` | `"done"`

Defined in: [sdk/ts/sdk/src/agent/state.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/agent/state.ts#L43)

`approval` is a gated tool call waiting for a person; `parked` is a spent budget waiting for a top-up.
