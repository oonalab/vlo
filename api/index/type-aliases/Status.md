---
url: /vlo/api/index/type-aliases/Status.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Status

# Type Alias: Status

> **Status** = `"scheduled"` | `"running"` | `"succeeded"` | `"failed"` | `"retrying"` | `"cancelled"` | `"awaiting_signal"`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:26](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L26)

Status of one step (a task, timer, signal wait or child), as carried on every event.
`scheduled` → `running` → `succeeded` | `failed` | `retrying` | `cancelled`;
`awaiting_signal` is a parked wait. `succeeded`, `failed` and `cancelled` are terminal.
