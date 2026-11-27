---
url: /vlo/api/host/interfaces/SignalRegistration.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / SignalRegistration

# Interface: SignalRegistration

Defined in: [sdk/ts/sdk/src/host/context.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L53)

A signal as the host knows it: a name and a validator for incoming payloads.

## Properties

### hash?

> `readonly` `optional` **hash?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:59](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L59)

Content hash of the signal definition; the registry version.

***

### jsonSchema?

> `readonly` `optional` **jsonSchema?**: `unknown`

Defined in: [sdk/ts/sdk/src/host/context.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L61)

JSON Schema of the payload, written to the registry on boot when `hash` is also present.

***

### name

> `readonly` **name**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:55](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L55)

Signal name, as the workflow waits for it.

***

### schema

> `readonly` **schema**: [`Validator`](Validator.md)

Defined in: [sdk/ts/sdk/src/host/context.ts:57](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L57)

Validates a payload before delivery; a failure is a `BadRequest`.
