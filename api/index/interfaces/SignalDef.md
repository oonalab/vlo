---
url: /vlo/api/index/interfaces/SignalDef.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / SignalDef

# Interface: SignalDef\<T>

Defined in: [sdk/ts/sdk/src/core/activity.ts:121](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L121)

A defined signal: the value [signal](../functions/signal.md) returns, passed to `cmd.awaitSignal`,
`cmd.awaitHuman` and [waitFor](../functions/waitFor.md). `T` is the inferred payload type.

## Type Parameters

### T

`T` = `unknown`

## Properties

### hash

> `readonly` **hash**: `string`

Defined in: [sdk/ts/sdk/src/core/activity.ts:127](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L127)

Content hash of `name` and the JSON schema. It is the version.

***

### jsonSchema

> `readonly` **jsonSchema**: [`Json`](../type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/core/activity.ts:133](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L133)

JSON Schema of `schema`, as registered with the host and used for the hash.

***

### kind

> `readonly` **kind**: `"signal"`

Defined in: [sdk/ts/sdk/src/core/activity.ts:123](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L123)

Discriminator the config loader uses to find signals among a module's exports.

***

### name

> `readonly` **name**: `string`

Defined in: [sdk/ts/sdk/src/core/activity.ts:125](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L125)

The name given to [signal](../functions/signal.md); the name a sender delivers the signal under.

***

### schema

> `readonly` **schema**: `ZodType`<`T`>

Defined in: [sdk/ts/sdk/src/core/activity.ts:131](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L131)

Payload schema, as given. A host that has the signal registered validates inbound payloads against it.

***

### schemaRef

> `readonly` **schemaRef**: `string`

Defined in: [sdk/ts/sdk/src/core/activity.ts:129](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/activity.ts#L129)

`${name}@${hash}` — the `schema_ref` on the wire.
