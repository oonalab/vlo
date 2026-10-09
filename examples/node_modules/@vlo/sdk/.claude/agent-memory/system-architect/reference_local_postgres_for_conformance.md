---
name: local-postgres-for-conformance
description: How to get a throwaway Postgres for the @vlo/sdk journal conformance tests on this machine (no Docker daemon, Homebrew postgres 14)
metadata:
  type: reference
---

The Postgres half of the journal conformance suite only runs when
`VLO_TEST_DATABASE_URL` is set. On this machine Docker's daemon is not running,
but Homebrew's `postgres` 14 (`/opt/homebrew/bin/{initdb,pg_ctl,createdb}`) is
installed and there is no server on 5432.

Throwaway instance:

```
initdb -D <dir>/pgdata -U vlo --auth=trust
pg_ctl -D <dir>/pgdata -l <dir>/pg.log -o "-p 55432 -h 127.0.0.1 -c unix_socket_directories=" start
createdb -h 127.0.0.1 -p 55432 -U vlo vlo_test
VLO_TEST_DATABASE_URL="postgres://vlo@127.0.0.1:55432/vlo_test" pnpm --filter @vlo/sdk test
pg_ctl -D <dir>/pgdata stop -m fast
```

**Why:** `unix_socket_directories=` must be emptied — the session scratchpad path
is longer than Postgres' 103-byte Unix-socket limit and the server refuses to
start otherwise. TCP on a non-default port keeps it clear of any real instance.

**How to apply:** use this whenever journal or host work needs the Postgres path
actually exercised; the SQLite suite alone will not catch dialect bugs
(`$n` placeholders, `search_path`, advisory locks, `SKIP LOCKED`, bigint-as-string).
Never point `VLO_TEST_DATABASE_URL` at the Orbi dev or prod database: the suite
creates and drops a `vlo_t_<rand>` schema.
