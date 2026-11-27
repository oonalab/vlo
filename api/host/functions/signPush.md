---
url: /vlo/api/host/functions/signPush.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / signPush

# Function: signPush()

> **signPush**(`secret`, `taskId`, `attempt`, `tsMs`, `body`): `string`

Defined in: [sdk/ts/sdk/src/host/worker/signature.ts:32](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/worker/signature.ts#L32)

Signs a push: `v1=` + HMAC-SHA256 over `taskId.attempt.tsMs.sha256(body)`, hex. The
dispatcher's HTTP transport calls this; a custom transport signs the same way.

## Parameters

### secret

`string`

### taskId

`string`

### attempt

`number`

### tsMs

`number`

### body

`string`

## Returns

`string`
