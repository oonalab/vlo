---
url: /vlo/api/index/interfaces/TimerOptions.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / TimerOptions

# Interface: TimerOptions

Defined in: [sdk/ts/sdk/src/core/commands.ts:32](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L32)

When a `cmd.timer` fires. Exactly one of `ms` / `atMs` is required.

## Properties

### atMs?

> `optional` **atMs?**: `number`

Defined in: [sdk/ts/sdk/src/core/commands.ts:36](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L36)

Absolute epoch time in milliseconds.

***

### id?

> `optional` **id?**: `string`

Defined in: [sdk/ts/sdk/src/core/commands.ts:38](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L38)

Step id. Defaults to a kernel-derived id.

***

### ms?

> `optional` **ms?**: `number`

Defined in: [sdk/ts/sdk/src/core/commands.ts:34](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/commands.ts#L34)

Delay in milliseconds, counted from the timestamp of the event being reduced.
