---
url: /vlo/api/host/functions/mergeDomains.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / mergeDomains

# Function: mergeDomains()

> **mergeDomains**(`options`): [`Registries`](../interfaces/Registries.md)

Defined in: [sdk/ts/sdk/src/host/domain.ts:89](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L89)

Flattens `domains` onto the flat registries. Throws a `TypeError` when two domains share
a name, or when two different workflow or activity values are registered under one name;
the same value registered twice is fine.

## Parameters

### options

`Partial`<[`Registries`](../interfaces/Registries.md)> & `object`

## Returns

[`Registries`](../interfaces/Registries.md)
