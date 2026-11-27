---
url: /vlo/api/index/interfaces/Activity.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / Activity

# Interface: Activity\<I, O>

Defined in: [sdk/ts/sdk/src/core/activity.ts:92](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L92)

A defined activity: the value [activity](../functions/activity.md) returns, passed to `cmd.task`, [step](../functions/step.md)
and [fanOut](../functions/fanOut.md). `I` and `O` are the inferred input and output types.

## Type Parameters

### I

`I` = `unknown`

### O

`O` = `unknown`

## Properties

### hash

> `readonly` **hash**: `string`

Defined in: [sdk/ts/sdk/src/core/activity.ts:98](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L98)

Content hash of `name`, both JSON schemas and the retry policy. It is the version.

***

### input

> `readonly` **input**: `ZodType`<`I`>

Defined in: [sdk/ts/sdk/src/core/activity.ts:102](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L102)

Input schema, as given.

***

### jsonSchema

> `readonly` **jsonSchema**: `object`

Defined in: [sdk/ts/sdk/src/core/activity.ts:114](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L114)

JSON Schema of both schemas, as registered with the host and used for the hash.

#### input

> **input**: [`Json`](../type-aliases/Json.md)

#### output

> **output**: [`Json`](../type-aliases/Json.md)

***

### kind

> `readonly` **kind**: `"activity"`

Defined in: [sdk/ts/sdk/src/core/activity.ts:94](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L94)

Discriminator the config loader uses to find activities among a module's exports.

***

### leaseMs

> `readonly` **leaseMs**: `number`

Defined in: [sdk/ts/sdk/src/core/activity.ts:110](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L110)

Lease per attempt, in milliseconds.

***

### name

> `readonly` **name**: `string`

Defined in: [sdk/ts/sdk/src/core/activity.ts:96](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L96)

The name given to [activity](../functions/activity.md); the key a worker registers its handler under.

***

### output

> `readonly` **output**: `ZodType`<`O`>

Defined in: [sdk/ts/sdk/src/core/activity.ts:104](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L104)

Output schema, as given.

***

### queue

> `readonly` **queue**: `string`

Defined in: [sdk/ts/sdk/src/core/activity.ts:108](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L108)

Queue tasks are dispatched on.

***

### retry

> `readonly` **retry**: [`RetryPolicy`](RetryPolicy.md)

Defined in: [sdk/ts/sdk/src/core/activity.ts:106](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L106)

Resolved retry policy in wire form.

***

### schemaRef

> `readonly` **schemaRef**: `string`

Defined in: [sdk/ts/sdk/src/core/activity.ts:100](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L100)

`${name}@${hash}` — the `schema_ref` on the wire.

***

### timeoutMs?

> `readonly` `optional` **timeoutMs?**: `number`

Defined in: [sdk/ts/sdk/src/core/activity.ts:112](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L112)

Per-attempt wall-clock budget, in milliseconds; absent when none was set.
