---
url: /vlo/api/host/interfaces/PostgresJournalOptions.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / PostgresJournalOptions

# Interface: PostgresJournalOptions

Defined in: [sdk/ts/sdk/src/journal/postgres.ts:36](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/postgres.ts#L36)

## Properties

### max?

> `optional` **max?**: `number`

Defined in: [sdk/ts/sdk/src/journal/postgres.ts:40](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/postgres.ts#L40)

Maximum pooled connections.

***

### schema?

> `optional` **schema?**: `string`

Defined in: [sdk/ts/sdk/src/journal/postgres.ts:38](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/postgres.ts#L38)

Schema that owns every journal table. Default `vlo`.
