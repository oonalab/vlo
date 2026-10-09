# pipeline

`sequence([step(plan), fanOut(work, …, { concurrency: 2 }), waitFor(approve), step(finish)])`:
plan three items, upper-case them two at a time, park until a human approves, then report.

```sh
pnpm dev:pipeline                                 # from packages/vlo/examples; API on :4100
curl -s -X POST localhost:4100/v1/runs -H 'content-type: application/json' \
  -d '{"workflow":"pipeline","input":{"n":3}}'               # → {"run_id":"run_…"}
curl -s localhost:4100/v1/runs/<run_id>                        # "status":"awaiting_signal" once the fan-out is done
curl -s -X POST localhost:4100/v1/runs/<run_id>/signals/pipeline.approve \
  -H 'content-type: application/json' -d '{"by":"you"}'      # → {"signal_id":"sig_…","delivered":true}
curl -s localhost:4100/v1/runs/<run_id>                        # "status":"completed"
```

`output["pipeline.finish"].report` is `ITEM-0,ITEM-1,ITEM-2 approved by you`.
