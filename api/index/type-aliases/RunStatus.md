---
url: /vlo/api/index/type-aliases/RunStatus.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / RunStatus

# Type Alias: RunStatus

> **RunStatus** = `"created"` | `"running"` | `"awaiting_signal"` | `"completed"` | `"failed"` | `"cancelled"` | `"continued"`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L53)

Status of a run. `created` until `started` is folded, then `running` or
`awaiting_signal`; `completed`, `failed`, `cancelled` and `continued` are terminal.
