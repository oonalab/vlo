/**
 * The example pipeline: plan → fan out over the planned items (2 at a time) → wait for a
 * human approval → finish. Earlier phases' values are read with `resultOf`,
 * `fanOutResultsOf` and `signalOf`, which carry the activities' and signal's inferred types.
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
} from "../../src/index.ts";
import { approve, finish, plan, work } from "./activities.ts";

export const exampleWorkflow = defineWorkflow(
  "example",
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

export default exampleWorkflow;
