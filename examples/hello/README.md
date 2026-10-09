# hello

The smallest Vlo program: one workflow that schedules one activity and completes with its
output. `vlo.config.ts` has a single `dev` profile on SQLite and file blobs, every role in one
process.

```sh
pnpm dev:hello                                    # from packages/vlo/examples; API on :4100
curl -s -X POST localhost:4100/v1/runs -H 'content-type: application/json' \
  -d '{"workflow":"hello","input":{"name":"world"}}'         # → {"run_id":"run_…"}
curl -s localhost:4100/v1/runs/<run_id>                        # poll until "status":"completed"
curl -s localhost:4100/v1/runs/<run_id>/events                 # the journal, event by event
```

The completed run's `output` is `{"greeting":"Hello, world!"}`. Ctrl-C stops the host.
