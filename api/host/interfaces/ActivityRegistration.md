---
url: /vlo/api/host/interfaces/ActivityRegistration.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / ActivityRegistration

# Interface: ActivityRegistration

Defined in: [sdk/ts/sdk/src/host/context.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L39)

An activity as the host knows it: a name and a validator for the worker's output.
`hash` and `jsonSchema` are present on real `Activity` values and drive registry
upserts on boot; a bare `{ name, output }` still validates.

## Properties

### hash?

> `readonly` `optional` **hash?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L45)

Content hash of the activity definition; the registry version.

***

### jsonSchema?

> `readonly` `optional` **jsonSchema?**: `object`

Defined in: [sdk/ts/sdk/src/host/context.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L47)

JSON Schema for both sides, written to the registry on boot when `hash` is also present.

#### input

> **input**: `unknown`

#### output

> **output**: `unknown`

***

### name

> `readonly` **name**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:41](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L41)

Activity name, as the workflow schedules it.

***

### output

> `readonly` **output**: [`Validator`](Validator.md)

Defined in: [sdk/ts/sdk/src/host/context.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L43)

Validates a worker's output before it is folded; a failure fails the attempt with `schema_violation`.

***

### retry?

> `readonly` `optional` **retry?**: `unknown`

Defined in: [sdk/ts/sdk/src/host/context.ts:49](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L49)

Retry policy, journaled next to the schema as byte-exact JSON.
