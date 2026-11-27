---
url: /vlo/api/index/type-aliases/Backoff.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Backoff

# Type Alias: Backoff

> **Backoff** = `"fixed"` | `"exponential"`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:106](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L106)

`fixed` repeats `initial_ms`; `exponential` multiplies it by `factor` per attempt.
