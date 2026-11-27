---
url: /vlo/api/host/interfaces/HeaderSource.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / HeaderSource

# Interface: HeaderSource

Defined in: [sdk/ts/sdk/src/host/worker/signature.ts:43](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/signature.ts#L43)

Anything with `Headers.get` semantics.

## Methods

### get()

> **get**(`name`): `string` | `null`

Defined in: [sdk/ts/sdk/src/host/worker/signature.ts:45](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/signature.ts#L45)

The header's value, or null when absent.

#### Parameters

##### name

`string`

#### Returns

`string` | `null`
