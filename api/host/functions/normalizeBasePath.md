---
url: /vlo/api/host/functions/normalizeBasePath.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / normalizeBasePath

# Function: normalizeBasePath()

> **normalizeBasePath**(`value`): `string` | `undefined`

Defined in: [sdk/ts/sdk/src/host/api/router.ts:39](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/api/router.ts#L39)

`"api/vlo"`, `"/api/vlo/"` and `"/api/vlo"` all normalise to `"/api/vlo"`; `""` to none.

## Parameters

### value

`string` | `undefined`

## Returns

`string` | `undefined`
