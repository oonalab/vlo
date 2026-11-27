---
url: /vlo/api/index/functions/projectSchema.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / projectSchema

# Function: projectSchema()

> **projectSchema**(`schema`): [`Json`](../type-aliases/Json.md)

Defined in: [sdk/ts/sdk/src/core/schema-projection.ts:55](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/core/schema-projection.ts#L55)

Returns a copy of `schema` with every annotation keyword removed from every schema
object in it. Arrays are walked (`anyOf`, `prefixItems`, …) in order; the entries of a
name-keyed map (`properties`, `$defs`, …) keep their names and have their values
projected; scalars pass through. The input is never mutated.

## Parameters

### schema

[`Json`](../type-aliases/Json.md)

## Returns

[`Json`](../type-aliases/Json.md)
