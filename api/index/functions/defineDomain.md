---
url: /vlo/api/index/functions/defineDomain.md
---
[@oona/vlo](../../packages.md) / [index](../index.md) / defineDomain

# Function: defineDomain()

> **defineDomain**(`def`): [`Domain`](../interfaces/Domain.md)

Defined in: [sdk/ts/sdk/src/host/domain.ts:73](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/host/domain.ts#L73)

Groups one area's workflows, workers, activities and signals under a name, for
`createHost({ domains: [...] })`.

## Parameters

### def

[`DomainDef`](../interfaces/DomainDef.md)

## Returns

[`Domain`](../interfaces/Domain.md)

## Example

```ts
import { defineDomain } from "@oona/vlo";
import { brandActivities } from "./activities.ts";
import { brandResearch, brandWeekly } from "./workflows.ts";
import { brandWorker } from "./worker.ts";

export const brandDomain = defineDomain({
  name: "brand",
  workflows: [brandResearch, brandWeekly],
  workers: [brandWorker],
  activities: brandActivities,
});
```
