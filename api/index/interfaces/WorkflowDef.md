---
url: /vlo/api/index/interfaces/WorkflowDef.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / WorkflowDef

# Interface: WorkflowDef\<S, I>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:33](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L33)

What [defineWorkflow](../functions/defineWorkflow.md) takes: how to build the initial state and the handlers.

## Type Parameters

### S

`S`

### I

`I`

## Properties

### on

> **on**: [`Handlers`](Handlers.md)<`S`>

Defined in: [sdk/ts/sdk/src/core/workflow.ts:37](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L37)

The event handlers.

## Methods

### init()

> **init**(`input`): `S`

Defined in: [sdk/ts/sdk/src/core/workflow.ts:35](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/workflow.ts#L35)

Builds the initial state from the start input. Called once, just before `on.started`.

#### Parameters

##### input

`I`

#### Returns

`S`
