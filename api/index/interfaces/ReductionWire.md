---
url: /vlo/api/index/interfaces/ReductionWire.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / ReductionWire

# Interface: ReductionWire

Defined in: [sdk/ts/sdk/src/core/workflow.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L41)

The wire form of one reduction: state as byte-exact JSON, plus plain `Command` objects.

## Properties

### commands

> **commands**: [`Command`](../type-aliases/Command.md)\[]

Defined in: [sdk/ts/sdk/src/core/workflow.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L45)

The commands the handler returned, copied.

***

### state

> **state**: `string`

Defined in: [sdk/ts/sdk/src/core/workflow.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L43)

The next state, as `JSON.stringify` produced it.
