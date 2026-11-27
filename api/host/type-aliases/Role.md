---
url: /vlo/api/host/type-aliases/Role.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Role

# Type Alias: Role

> **Role** = `"orchestrator"` | `"api"` | `` `worker:${string}` ``

Defined in: [sdk/ts/sdk/src/host/context.ts:93](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L93)

One of the engine's roles: `orchestrator` moves the outbox, `api` serves the control
plane, `worker:<queue>` runs that queue's activities in-process and accepts pushes for it.
