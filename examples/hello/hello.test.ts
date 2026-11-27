/** A reducer is a pure function: test it with no host, journal or kernel. */

import { expect, it } from "vitest";
import workflow from "./hello.workflow.ts";

const NONE = { cpu_ms: 0, tokens: 0, cost_micro_usd: 0 };
const base = { ts_ms: 1, random: "0".repeat(32), usage_total: NONE };

it("asks for a greeting, then completes with it", () => {
  const begun = workflow.reduce(null, { ...base, type: "started", input: { name: "world" } }, { name: "world" });
  expect(begun.commands).toMatchObject([{ type: "task", input: { name: "world" } }]);

  const done = workflow.reduce(begun.state, {
    ...base, type: "task_done", step_id: "task#1", attempt: 1,
    activity: "hello.greet", status: "succeeded", output: { greeting: "Hello, world!" }, usage: NONE,
  });
  expect(done.commands).toEqual([{ type: "complete", output: { greeting: "Hello, world!" } }]);
});

it("fails the run when the greeting fails", () => {
  const begun = workflow.reduce(null, { ...base, type: "started", input: { name: "world" } }, { name: "world" });

  expect(() =>
    workflow.reduce(begun.state, {
      ...base, type: "task_done", step_id: "task#1", attempt: 1,
      activity: "hello.greet", status: "failed", error: "no greeter", usage: NONE,
    }),
  ).toThrow("no greeter");
});
