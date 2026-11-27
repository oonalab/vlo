---
url: /vlo/api/host/type-aliases/EventSource.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / EventSource

# Type Alias: EventSource

> **EventSource** = [`EventInput`](../interfaces/EventInput.md) | ((`tx`, `run`) => `Promise`<[`EventInput`](../interfaces/EventInput.md) | `null`>)

Defined in: [sdk/ts/sdk/src/host/transition.ts:61](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/transition.ts#L61)

The event to submit. A function form runs inside the transaction with the run already
locked, so it can read and write journal rows before deciding — returning `null` commits
whatever it did without folding anything.
