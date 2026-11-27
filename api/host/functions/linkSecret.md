---
url: /vlo/api/host/functions/linkSecret.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / linkSecret

# Function: linkSecret()

> **linkSecret**(`auth`): `string` | `undefined`

Defined in: [sdk/ts/sdk/src/host/links.ts:34](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/links.ts#L34)

The secret signed links are minted with. Falls back to the control-plane token and then
the push secret so a single-secret deployment gets links for free; `undefined` disables
them rather than signing with an empty key.

## Parameters

### auth

[`AuthConfig`](../interfaces/AuthConfig.md)

## Returns

`string` | `undefined`
