/**
 * plan → fan out over the planned items, two at a time → wait for a human approval → finish.
 *
 * Earlier phases' values are read with `resultOf`, `fanOutResultsOf` and `signalOf`, which
 * carry the activities' and signal's inferred types.
 */

import {
  defineWorkflow,
  fanOut,
  fanOutResultsOf,
  resultOf,
  sequence,
  signalOf,
  step,
  waitFor,
} from "@oona/vlo";
import { approve, finish, plan, work } from "./activities.ts";

export default defineWorkflow(
  "pipeline",
  sequence([
    step(plan),
    fanOut(work, (state) => resultOf(state, plan).items.map((item) => ({ item })), {
      concurrency: 2,
    }),
    waitFor(approve),
    step(finish, (state) => ({
      uppers: fanOutResultsOf(state, work).map((output) => output.upper),
      approvedBy: signalOf(state, approve).by,
    })),
  ]),
);
