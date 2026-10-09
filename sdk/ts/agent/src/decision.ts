/**
 * `decision` — the decider is an ordinary activity whose output is a typed, journaled
 * action. The tool registry fixes its output schema, so an LLM worker is
 * constrained to names the loop can actually dispatch.
 */

import { activity, type Activity, type Json, type RetryOptions } from "@vlo/sdk";
import { z } from "zod";
import type { Decision } from "./state.ts";

/** Reserved tool name: the decider is finished and `final` (or the last candidate) is the answer. */
export const DONE = "done";

export interface DecisionOptions<I extends z.ZodType> {
  /** What the decider is shown. `agentLoop` sends `{ goal, memory, candidate, score }`. */
  input: I;
  /** The tools it may pick from, keyed by the name it returns in `tool`. */
  tools: Record<string, Activity>;
  retry?: RetryOptions;
  queue?: string;
  /** Wall-clock ceiling for one decision; the host fails the task with `cause: "timeout"`. */
  timeoutMs?: number;
}

const JSON_VALUE: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JSON_VALUE),
    z.record(z.string(), JSON_VALUE),
  ]),
);

export function decision<I extends z.ZodType>(
  name: string,
  options: DecisionOptions<I>,
): Activity<z.infer<I>, Decision> {
  const tools = Object.keys(options.tools);
  if (tools.length === 0) throw new TypeError("decision: no tools given");
  if (tools.includes(DONE)) throw new TypeError(`decision: "${DONE}" is a reserved tool name`);

  return activity(name, {
    input: options.input,
    output: z.object({
      tool: z.enum([...tools, DONE]),
      args: z.unknown().optional(),
      rationale: z.string().optional(),
      final: JSON_VALUE.optional(),
    }),
    ...(options.retry !== undefined ? { retry: options.retry } : {}),
    ...(options.queue !== undefined ? { queue: options.queue } : {}),
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  });
}
