/**
 * Tool approval: a person says yes or no before a gated tool runs.
 *
 * The wait is an ordinary signal wait, so a run holds no compute while somebody decides.
 * Each gated call waits on its own signal name, `<name>:<iteration>`, which is what makes an
 * approval single-use: a duplicate, a late reply or a signed link for one call can never
 * approve the next one.
 */

import { signal, type Json, type SignalDef } from "../index.ts";
import { z } from "zod";

/** Prefix of the signal a gated tool call waits on; the iteration is appended. */
export const DEFAULT_APPROVAL_SIGNAL = "agent.tool_approval";

/**
 * The reply to an approval request. An empty payload approves, so a signed link's
 * confirmation form is enough; `approved: false` rejects.
 */
export interface ToolApproval {
  /** `false` rejects the call. Absent or `true` approves it. */
  approved?: boolean | undefined;
  /** Why, shown to the decider when the call is rejected. */
  reason?: string | undefined;
  /** Who replied. */
  by?: string | undefined;
}

/** What `agentLoop({ approval })` takes. */
export interface ApprovalOptions {
  /** Names of the tools that need a yes before they run. Each must be a key of `tools`. */
  tools: readonly string[];
  /** Signal name prefix. Default {@link DEFAULT_APPROVAL_SIGNAL}. */
  name?: string | undefined;
  /** How long to wait for a reply. Without one the run waits until somebody answers. */
  timeoutMs?: number | undefined;
  /**
   * What an unanswered request becomes: `"reject"` (default) tells the decider the call was
   * not approved and carries on; `"fail"` fails the run.
   */
  onTimeout?: "reject" | "fail" | undefined;
}

const APPROVAL_SCHEMA = z.object({
  approved: z.boolean().optional(),
  reason: z.string().optional(),
  by: z.string().optional(),
});

/**
 * The signal the gated call of `iteration` waits on. Pass it to `client.signal` or
 * `client.signalLink`; the iteration is the suffix of the wait's step id, `approve#<i>`.
 *
 * @example
 * ```ts
 * await client.signal(runId, approvalSignal(2), { approved: false, reason: "wrong audience" });
 * ```
 */
export function approvalSignal(
  iteration: number,
  name: string = DEFAULT_APPROVAL_SIGNAL,
): SignalDef<ToolApproval> {
  return signal(`${name}:${iteration}`, APPROVAL_SCHEMA);
}

/**
 * Reads a reply. No payload approves (a signed link's form sends none); a payload that is
 * not a {@link ToolApproval} rejects, because an approval nobody can read is not one.
 */
export function readApproval(payload: Json): ToolApproval & { approved: boolean } {
  const parsed = APPROVAL_SCHEMA.safeParse(payload ?? {});
  if (!parsed.success) return { approved: false, reason: "the approval reply was not valid" };
  return { ...parsed.data, approved: parsed.data.approved !== false };
}
