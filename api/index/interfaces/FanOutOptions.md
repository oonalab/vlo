---
url: /vlo/api/index/interfaces/FanOutOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / FanOutOptions

# Interface: FanOutOptions

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:59](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L59)

Options for [fanOut](../functions/fanOut.md).

## Properties

### concurrency

> **concurrency**: `number`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L61)

Maximum tasks in flight at once; an integer ≥ 1.

***

### onFailure?

> `optional` **onFailure?**: [`OnFailure`](../type-aliases/OnFailure.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:63](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L63)

`"fail"` (default) fails the run on any task that did not succeed; `"continue"` stores `null` for that item.
