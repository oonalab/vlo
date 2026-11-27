---
url: /vlo/api/host/functions/openJournal.md
---
[@oona/vlo](../../packages.md) / [host](../index.md) / openJournal

# Function: openJournal()

> **openJournal**(`url`, `opts?`): [`Journal`](../interfaces/Journal.md)

Defined in: [sdk/ts/sdk/src/journal/open.ts:27](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/open.ts#L27)

Opens a journal by URL: `sqlite://:memory:`, `sqlite://./.vlo/dev.db`,
`sqlite:///abs/path.db`, `postgres://…` or `postgresql://…`. Nothing is created or
migrated until `migrate()`. Throws a plain `Error` on any other scheme.

## Parameters

### url

`string`

### opts?

[`PostgresJournalOptions`](../interfaces/PostgresJournalOptions.md) = `{}`

## Returns

[`Journal`](../interfaces/Journal.md)

## Example

```ts
import { openJournal } from "@oona/vlo/host";

const journal = openJournal("postgres://user:pass@localhost/app", { schema: "vlo", max: 5 });
await journal.migrate();
const run = await journal.getRun("run_1");
await journal.close();
```
