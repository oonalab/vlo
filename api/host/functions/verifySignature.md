---
url: /vlo/api/host/functions/verifySignature.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / verifySignature

# Function: verifySignature()

> **verifySignature**(`secret`, `headers`, `rawBody`, `nowMs?`): `boolean`

Defined in: [sdk/ts/sdk/src/host/worker/signature.ts:53](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/signature.ts#L53)

True when the `vlo-*` headers sign `rawBody` with `secret` and the timestamp is within
5 minutes of `nowMs` (default `Date.now()`). Missing or malformed headers are false, never
thrown; the comparison is timing-safe.

## Parameters

### secret

`string`

### headers

[`HeaderSource`](../interfaces/HeaderSource.md)

### rawBody

`string`

### nowMs?

`number` = `...`

## Returns

`boolean`
