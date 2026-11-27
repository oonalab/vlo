---
url: /vlo/api/host/interfaces/AuthConfig.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / AuthConfig

# Interface: AuthConfig

Defined in: [sdk/ts/sdk/src/host/context.ts:75](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L75)

Every credential a host reads. All optional; an empty config is an open host.

## Properties

### callbackToken?

> `optional` **callbackToken?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:81](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L81)

Bearer token this host's worker role sends when it calls a task back.

***

### linkSecret?

> `optional` **linkSecret?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:86](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L86)

HMAC secret for signed action links. Falls back to `token`, then `pushSecret`; with
none of the three configured, minting and verifying links is refused.

***

### pushSecret?

> `optional` **pushSecret?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:79](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L79)

HMAC secret this host's worker role verifies inbound pushes with.

***

### token?

> `optional` **token?**: `string`

Defined in: [sdk/ts/sdk/src/host/context.ts:77](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/context.ts#L77)

Bearer token required on the control-plane routes. Absent ⇒ open host.
