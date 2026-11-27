---
url: /vlo/api/testing/functions/journalConformance.md
---
[@oona/vlo](../../packages.md) / [testing](../index.md) / journalConformance

# Function: journalConformance()

> **journalConformance**(`name`, `open`): `void`

Defined in: [sdk/ts/sdk/src/journal/conformance.ts:38](https://github.com/oonalab/vlo/blob/a81c115e42e129b4efe8fd86066744a4f8bc3670/sdk/ts/sdk/src/journal/conformance.ts#L38)

Registers the journal conformance suite as a vitest `describe` block named `name`.

`open` is called before every case and must return a fresh, empty journal; the suite
runs `migrate()` on it and `close()`s it afterwards. The cases check the durability
promises the host relies on: gap-free `seq` under concurrent transactions, all-or-nothing
transitions, stale-attempt and terminal-task rejection, lease and timeout reaping,
once-only timers, schema upserts, signal buffering, run queries and idempotent migration.
Call it from a test file, not from application code.

## Parameters

### name

`string`

### open

() => `Promise`<[`Journal`](../../host/interfaces/Journal.md)>

## Returns

`void`

## Example

```ts
import { openJournal } from "@oona/vlo/host";
import { journalConformance } from "@oona/vlo/testing";

let index = 0;
journalConformance("sqlite journal", async () =>
  openJournal(`sqlite://./.vlo/conformance-${++index}.db`),
);
```
