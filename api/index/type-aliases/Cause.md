---
url: /vlo/api/index/type-aliases/Cause.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Cause

# Type Alias: Cause

> **Cause** = `"timeout"` | `"heartbeat_lost"` | `"app_error"` | `"user_cancel"` | `"schema_violation"` | `"nondeterminism_detected"`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L41)

Why a step or run failed. `timeout`: the attempt ran past `timeout_ms`; `heartbeat_lost`:
the lease expired; `app_error`: the handler or reducer threw; `user_cancel`: cancelled
through the API; `schema_violation`: a worker's output failed the output schema;
`nondeterminism_detected`: a re-fold diverged from the journal. The last three never retry.
