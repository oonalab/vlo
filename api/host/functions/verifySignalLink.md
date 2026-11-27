---
url: /vlo/api/host/functions/verifySignalLink.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / verifySignalLink

# Function: verifySignalLink()

> **verifySignalLink**(`secret`, `token`, `runId`, `name`, `nowMs`): `boolean`

Defined in: [sdk/ts/sdk/src/host/links.ts:62](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/links.ts#L62)

True when `token` was signed with `secret` for exactly this `(runId, name)` and has not
expired at `nowMs`. Malformed tokens are false, never thrown; the comparison is timing-safe.

## Parameters

### secret

`string`

### token

`string`

### runId

`string`

### name

`string`

### nowMs

`number`

## Returns

`boolean`
