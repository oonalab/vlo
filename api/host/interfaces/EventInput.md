---
url: /vlo/api/host/interfaces/EventInput.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / EventInput

# Interface: EventInput

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:79](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L79)

An event as the host submits it, before `seq` and `state_hash` are assigned.

## Extended by

* [`Envelope`](Envelope.md)

## Properties

### attempt

> **attempt**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:82](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L82)

***

### cause?

> `optional` **cause?**: [`Cause`](../../index/type-aliases/Cause.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:85](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L85)

***

### error?

> `optional` **error?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:94](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L94)

***

### kind

> **kind**: [`Kind`](../type-aliases/Kind.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:83](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L83)

***

### payload?

> `optional` **payload?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:92](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L92)

Inline JSON payload, byte-exact. Exactly one of payload / payload_ref.

***

### payload_ref?

> `optional` **payload_ref?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:93](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L93)

***

### random

> **random**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:89](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L89)

32 hex chars of host-generated randomness, journaled.

***

### run_id

> **run_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:80](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L80)

***

### schema_ref?

> `optional` **schema_ref?**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:90](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L90)

***

### status

> **status**: [`Status`](../../index/type-aliases/Status.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:84](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L84)

***

### step_id

> **step_id**: `string`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L81)

***

### ts_ms

> **ts_ms**: `number`

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:87](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L87)

***

### usage?

> `optional` **usage?**: [`Usage`](../../index/interfaces/Usage.md)

Defined in: [sdk/ts/sdk/src/kernel/protocol.ts:86](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/kernel/protocol.ts#L86)
