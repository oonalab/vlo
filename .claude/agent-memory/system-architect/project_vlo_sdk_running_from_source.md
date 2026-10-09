---
name: vlo-sdk-running-from-source
description: Running @vlo/sdk TypeScript source directly needs tsx — node's --experimental-strip-types fails on the package's TS parameter properties
metadata:
  type: project
---

To run `@vlo/sdk` from `src/` (e.g. `src/cli.ts dev` during development), use `tsx`, not
`node --experimental-strip-types`.

**Why:** several SDK modules use TypeScript *parameter properties*
(`constructor(private readonly x: T)`) — `journal/postgres.ts`, `journal/sqlite.ts`,
`host/dispatcher.ts`, the transports. Node's strip-only TS mode refuses those with
`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`. The *shipped* CLI is unaffected: it runs from
`dist/cli.mjs`, which tsdown compiles.

The user's own `vlo.config.ts` *is* loaded by Node's native TS stripping (that is the
design), so a config file must stick to relative imports with explicit extensions and
avoid parameter properties.

**How to apply:** when verifying the CLI or any SDK entry point from source, run
`PATH=<pkg>/node_modules/.bin:$PATH tsx src/cli.ts dev`. Reach for `pnpm build` first if
you want to test what users actually get.
