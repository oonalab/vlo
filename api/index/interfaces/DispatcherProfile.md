---
url: /vlo/api/index/interfaces/DispatcherProfile.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / DispatcherProfile

# Interface: DispatcherProfile

Defined in: [sdk/ts/sdk/src/config/define.ts:66](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L66)

Outbox dispatcher settings for a profile holding the `orchestrator` role.

## Properties

### mode?

> `optional` **mode?**: `"loop"` | `"manual"`

Defined in: [sdk/ts/sdk/src/config/define.ts:68](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L68)

`manual` never arms the interval: something outside must call the tick route.

***

### tickMs?

> `optional` **tickMs?**: `number`

Defined in: [sdk/ts/sdk/src/config/define.ts:70](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/config/define.ts#L70)

Interval between dispatcher passes in `loop` mode, in milliseconds. Default `500`.
