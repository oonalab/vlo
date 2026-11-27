---
url: /vlo/api/index/functions/canonicalJson.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / canonicalJson

# Function: canonicalJson()

> **canonicalJson**(`value`): `string`

Defined in: [sdk/ts/sdk/src/core/hash.ts:22](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/hash.ts#L22)

Deterministic JSON: object keys sorted recursively, arrays in order, no whitespace.
Throws on anything JSON cannot represent losslessly (undefined, NaN, Infinity, bigint,
function, symbol) rather than silently dropping it, because a dropped field would make
two different schemas hash the same.

## Parameters

### value

`unknown`

## Returns

`string`
