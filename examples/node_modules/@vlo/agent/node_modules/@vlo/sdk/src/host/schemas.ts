/**
 * Schema registry upserts. Every activity and signal the host knows
 * about is written to `schemas` on boot, keyed by its content hash. Hashes are immutable,
 * so re-registering is a no-op and two versions of one name coexist.
 */

import type { HostContext } from "./context.ts";

export async function registerSchemas(ctx: HostContext): Promise<void> {
  const nowMs = ctx.now();
  const rows = [
    ...[...ctx.activities.values()].flatMap((a) =>
      a.hash === undefined || a.jsonSchema === undefined
        ? []
        : [
            {
              name: a.name,
              version: a.hash,
              json_schema: JSON.stringify(a.jsonSchema),
              ...(a.retry !== undefined ? { retry_policy: JSON.stringify(a.retry) } : {}),
            },
          ],
    ),
    ...[...ctx.signals.values()].flatMap((s) =>
      s.hash === undefined || s.jsonSchema === undefined
        ? []
        : [{ name: s.name, version: s.hash, json_schema: JSON.stringify(s.jsonSchema) }],
    ),
  ];
  if (rows.length === 0) return;

  await ctx.journal.transaction(async (tx) => {
    for (const row of rows) await tx.upsertSchema(row, nowMs);
  });
}
