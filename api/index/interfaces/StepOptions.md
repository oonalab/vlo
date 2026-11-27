---
url: /vlo/api/index/interfaces/StepOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / StepOptions

# Interface: StepOptions

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:49](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L49)

Options for [step](../functions/step.md).

## Properties

### id?

> `optional` **id?**: `string`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:51](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L51)

Explicit step id; default: the kernel-derived `task#n`. Set it when a handler keys on the step id.

***

### onFailure?

> `optional` **onFailure?**: [`OnFailure`](../type-aliases/OnFailure.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L53)

`"fail"` (default) fails the run on a task that did not succeed; `"continue"` stores `null` and advances.

***

### when?

> `optional` **when?**: (`state`) => `boolean`

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:55](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L55)

Pure gate evaluated when the phase is entered; `false` stores `null` and advances without a task.

#### Parameters

##### state

[`SeqState`](SeqState.md)

#### Returns

`boolean`
