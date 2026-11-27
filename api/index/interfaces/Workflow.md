---
url: /vlo/api/index/interfaces/Workflow.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Workflow

# Interface: Workflow\<S, I>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:52](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L52)

A defined workflow: the value [defineWorkflow](../functions/defineWorkflow.md) returns and the host registers.
`S` is the state type, `I` the start-input type.

## Type Parameters

### S

`S` = `unknown`

### I

`I` = `unknown`

## Properties

### def

> `readonly` **def**: [`WorkflowDef`](WorkflowDef.md)<`S`, `I`>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:60](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L60)

The definition, as given.

***

### digest

> `readonly` **digest**: `string`

Defined in: [sdk/ts/sdk/src/core/workflow.ts:58](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L58)

Content hash of `name`; runs pin it as their component digest.

***

### kind

> `readonly` **kind**: `"workflow"`

Defined in: [sdk/ts/sdk/src/core/workflow.ts:54](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L54)

Discriminator the config loader uses to find workflows among a module's exports.

***

### name

> `readonly` **name**: `string`

Defined in: [sdk/ts/sdk/src/core/workflow.ts:56](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L56)

The name given to [defineWorkflow](../functions/defineWorkflow.md); what a run is started by.

## Methods

### reduce()

> **reduce**(`stateJson`, `event`, `initInput?`): [`ReductionWire`](ReductionWire.md)

Defined in: [sdk/ts/sdk/src/core/workflow.ts:66](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L66)

Drive one event. Pass `initInput` for the `started` event (state is built by `init`);
otherwise `stateJson` is the checkpoint to fold onto. Throws when no handler is
registered for the event type.

#### Parameters

##### stateJson

`string` | `null`

##### event

[`ReducerEvent`](../type-aliases/ReducerEvent.md)

##### initInput?

[`Json`](../type-aliases/Json.md)

#### Returns

[`ReductionWire`](ReductionWire.md)
