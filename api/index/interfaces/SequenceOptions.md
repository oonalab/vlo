---
url: /vlo/api/index/interfaces/SequenceOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / SequenceOptions

# Interface: SequenceOptions

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:88](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L88)

Options for [sequence](../functions/sequence.md).

## Properties

### output?

> `optional` **output?**: (`state`) => [`Json`](../type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/core/helpers/sequence-types.ts:90](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/helpers/sequence-types.ts#L90)

Shapes the completion output; default: `state.results`. Pure.

#### Parameters

##### state

[`SeqState`](SeqState.md)

#### Returns

[`Json`](../type-aliases/Json.md)
