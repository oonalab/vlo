---
url: /vlo/api/index/interfaces/FanOutRunsOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / FanOutRunsOptions

# Interface: FanOutRunsOptions

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:67](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L67)

Options for [fanOutRuns](../functions/fanOutRuns.md).

## Properties

### concurrency

> **concurrency**: `number`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:69](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L69)

Maximum child runs in flight at once; an integer ≥ 1.

***

### onFailure?

> `optional` **onFailure?**: [`OnFailure`](../type-aliases/OnFailure.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:71](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L71)

`"fail"` (default) fails the run on any child that did not complete; `"continue"` records its status and moves on.
