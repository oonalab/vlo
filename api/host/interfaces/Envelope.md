---
url: /vlo/api/host/interfaces/Envelope.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / Envelope

# Interface: Envelope

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:98](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L98)

A journaled event.

## Extends

* [`EventInput`](EventInput.md)

## Properties

### attempt

> **attempt**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:82](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L82)

#### Inherited from

[`EventInput`](EventInput.md).[`attempt`](EventInput.md#attempt)

***

### cause?

> `optional` **cause?**: [`Cause`](../../index/type-aliases/Cause.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:85](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L85)

#### Inherited from

[`EventInput`](EventInput.md).[`cause`](EventInput.md#cause)

***

### error?

> `optional` **error?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:94](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L94)

#### Inherited from

[`EventInput`](EventInput.md).[`error`](EventInput.md#error)

***

### kind

> **kind**: [`Kind`](../type-aliases/Kind.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:83](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L83)

#### Inherited from

[`EventInput`](EventInput.md).[`kind`](EventInput.md#kind)

***

### parent_run_id?

> `optional` **parent_run_id?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:100](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L100)

***

### parent_step_id?

> `optional` **parent_step_id?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:101](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L101)

***

### payload?

> `optional` **payload?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:92](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L92)

Inline JSON payload, byte-exact. Exactly one of payload / payload_ref.

#### Inherited from

[`EventInput`](EventInput.md).[`payload`](EventInput.md#payload)

***

### payload_ref?

> `optional` **payload_ref?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:93](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L93)

#### Inherited from

[`EventInput`](EventInput.md).[`payload_ref`](EventInput.md#payload-ref)

***

### random

> **random**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:89](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L89)

32 hex chars of host-generated randomness, journaled.

#### Inherited from

[`EventInput`](EventInput.md).[`random`](EventInput.md#random)

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:80](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L80)

#### Inherited from

[`EventInput`](EventInput.md).[`run_id`](EventInput.md#run-id)

***

### schema_ref?

> `optional` **schema_ref?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:90](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L90)

#### Inherited from

[`EventInput`](EventInput.md).[`schema_ref`](EventInput.md#schema-ref)

***

### seq

> **seq**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:99](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L99)

***

### state_hash

> **state_hash**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:102](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L102)

***

### status

> **status**: [`Status`](../../index/type-aliases/Status.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:84](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L84)

#### Inherited from

[`EventInput`](EventInput.md).[`status`](EventInput.md#status)

***

### step_id

> **step_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L81)

#### Inherited from

[`EventInput`](EventInput.md).[`step_id`](EventInput.md#step-id)

***

### ts_ms

> **ts_ms**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:87](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L87)

#### Inherited from

[`EventInput`](EventInput.md).[`ts_ms`](EventInput.md#ts-ms)

***

### usage?

> `optional` **usage?**: [`Usage`](../../index/interfaces/Usage.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:86](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L86)

#### Inherited from

[`EventInput`](EventInput.md).[`usage`](EventInput.md#usage)
