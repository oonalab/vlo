---
url: /vlo/api/host/interfaces/TxOutcome.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / TxOutcome

# Interface: TxOutcome

Defined in: [sdk/ts/sdk/src/host/transition.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transition.ts#L43)

What one `applyEvent` call did.

## Properties

### applied

> **applied**: `boolean`

Defined in: [sdk/ts/sdk/src/host/transition.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transition.ts#L45)

False when the source decided there was nothing to submit.

***

### duplicate

> **duplicate**: `boolean`

Defined in: [sdk/ts/sdk/src/host/transition.ts:47](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transition.ts#L47)

True for an at-least-once redelivery the kernel has already folded.

***

### followUps

> **followUps**: [`EventInput`](EventInput.md)\[]

Defined in: [sdk/ts/sdk/src/host/transition.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transition.ts#L53)

Buffered signals that matched a wait this transition opened; applied after commit.

***

### run

> **run**: [`RunRow`](RunRow.md)

Defined in: [sdk/ts/sdk/src/host/transition.ts:49](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transition.ts#L49)

The run row as it was locked, before the transition.

***

### transition?

> `optional` **transition?**: [`Transition`](Transition.md)

Defined in: [sdk/ts/sdk/src/host/transition.ts:51](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transition.ts#L51)

The kernel's write-set. Present only when `applied` is true.
