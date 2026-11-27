---
url: /vlo/api/host/interfaces/SignalLinkClaims.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / SignalLinkClaims

# Interface: SignalLinkClaims

Defined in: [sdk/ts/sdk/src/host/links.ts:20](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/links.ts#L20)

What a link token binds: one run, one signal, one deadline.

## Properties

### expiresAtMs

> **expiresAtMs**: `number`

Defined in: [sdk/ts/sdk/src/host/links.ts:26](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/links.ts#L26)

Epoch milliseconds after which the token is refused. Floored to an integer when signed.

***

### name

> **name**: `string`

Defined in: [sdk/ts/sdk/src/host/links.ts:24](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/links.ts#L24)

The signal's name.

***

### runId

> **runId**: `string`

Defined in: [sdk/ts/sdk/src/host/links.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/links.ts#L22)

The run the signal is delivered to.
