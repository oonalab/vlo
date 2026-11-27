---
url: /vlo/api/index/interfaces/AwaitSignalOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / AwaitSignalOptions

# Interface: AwaitSignalOptions

Defined in: [sdk/ts/sdk/src/core/commands.ts:48](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L48)

Per-call overrides for `cmd.awaitSignal`.

## Properties

### id?

> `optional` **id?**: `string`

Defined in: [sdk/ts/sdk/src/core/commands.ts:50](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L50)

Step id of the wait. Defaults to a kernel-derived id.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Defined in: [sdk/ts/sdk/src/core/commands.ts:56](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L56)

Deadline for the wait, counted from the timestamp of the event being reduced. A `timer`
event with step id `<id>:timeout` reaches the reducer when the deadline passes; the
losing side of the race is cancelled by the kernel. Requires an explicit `id`.
