/**
 * Folding events into state — once for the live event, or from seq 0 to rebuild a lost
 * checkpoint.
 *
 * A rebuild re-derives every transition and checks its `state_hash` against the one the
 * journal recorded on the trigger event. The first disagreement is nondeterminism: the
 * workflow code no longer reproduces the history it wrote. (`kernel.refoldCheck` answers
 * the same question over two full hash lists; comparing per event gives the same seq and
 * stops before folding on top of a divergence.)
 */

import type { Workflow } from "../core/workflow.ts";
import type { RunRow } from "../journal/types.ts";
import type { Envelope, EventInput, KernelState, RunRef, RunStatus, Transition } from "../kernel/protocol.ts";
import type { HostContext } from "./context.ts";
import { Nondeterminism, ReducerFailed } from "./errors.ts";
import { isInputEvent, toEventInput, unwrap } from "./events.ts";

/** The checkpoint a fold starts from. Both fields are absent before the `started` event. */
export interface FoldState {
  /** Kernel-owned state at the checkpoint. */
  kernelState?: KernelState;
  /** User state at the checkpoint, byte-exact JSON text. */
  state?: string;
}

/** A checkpoint rebuilt from the journal by {@link rebuildCheckpoint}. */
export interface Rebuilt {
  /** Kernel-owned state after the last input event. */
  kernelState: KernelState;
  /** User state after the last input event, byte-exact JSON text. */
  state: string;
  /** Hash of the pair above, equal to the last journaled `state_hash`. */
  stateHash: string;
  /** Seq of the last event folded. */
  seq: number;
  /** Run status after the last event folded. */
  status: RunStatus;
}

/**
 * One event → one write-set. The reducer runs here and nowhere else. Pure: nothing is
 * journaled, the caller applies the returned transition.
 *
 * @throws {@link ReducerFailed} when the workflow's reducer throws; carries the trigger event.
 * @throws {@link IllegalEvent} when the kernel refuses to prepare or reduce the event.
 */
export function foldEvent(
  ctx: HostContext,
  workflow: Workflow,
  run: RunRef,
  at: FoldState,
  event: EventInput,
): Transition {
  const prepared = unwrap(
    ctx.kernel.prepareEvent({
      run,
      ...(at.kernelState !== undefined ? { kernel_state: at.kernelState } : {}),
      ...(at.state !== undefined ? { state: at.state } : {}),
      event,
    }),
  );

  if (prepared.mode === "lifecycle") return prepared.transition;

  let reduction;
  try {
    reduction = workflow.reduce(at.state ?? null, prepared.reducer_event, prepared.init_input);
  } catch (error) {
    // The trigger event is rolled back with the transaction, so the marker has to carry
    // enough of it to explain the failure in the journal.
    const reason = messageOf(error);
    throw new ReducerFailed(run.run_id, `${reason} [while folding ${describe(event)}]`, event, reason);
  }

  return unwrap(
    ctx.kernel.reduceStep({
      run,
      kernel_state: prepared.kernel_state,
      event,
      reduction,
    }),
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describe(event: EventInput): string {
  const cause = event.cause !== undefined ? ` cause=${event.cause}` : "";
  const error = event.error !== undefined ? ` error=${event.error}` : "";
  return `${event.kind} ${event.step_id}#${event.attempt} ${event.status}${cause}${error}`;
}

/**
 * Replays every input event in the journal. Kernel outputs (scheduled tasks, signal waits,
 * the `complete` marker) are recomputed, never re-fed.
 *
 * @throws {@link Nondeterminism} at the first event whose replayed `seq` or `state_hash`
 * differs from the journaled one, or when `events` holds nothing foldable.
 */
export function rebuildCheckpoint(
  ctx: HostContext,
  workflow: Workflow,
  run: RunRow,
  events: readonly Envelope[],
): Rebuilt {
  let at: FoldState = {};
  let stateHash = "";
  let lastSeq = 0;
  let status: RunStatus = "created";

  for (const envelope of events) {
    if (!isInputEvent(envelope)) continue;

    const ref: RunRef = {
      run_id: run.run_id,
      workflow: run.workflow,
      bundle_digest: run.component_digest,
      status,
      last_seq: lastSeq,
      ...(run.parent_run_id !== undefined ? { parent_run_id: run.parent_run_id } : {}),
      ...(run.parent_step_id !== undefined ? { parent_step_id: run.parent_step_id } : {}),
    };

    const transition = foldEvent(ctx, workflow, ref, at, toEventInput(envelope));
    const trigger = transition.events[0];
    if (trigger === undefined || trigger.seq !== envelope.seq) {
      throw new Nondeterminism(
        run.run_id,
        envelope.seq,
        `replay produced seq ${trigger?.seq ?? "none"} for a journaled seq ${envelope.seq}`,
      );
    }
    if (trigger.state_hash !== envelope.state_hash) {
      throw new Nondeterminism(
        run.run_id,
        envelope.seq,
        `state hash ${trigger.state_hash} does not match the journaled ${envelope.state_hash}`,
      );
    }

    at = { kernelState: transition.kernel_state, state: transition.state };
    stateHash = transition.state_hash;
    lastSeq = transition.run.last_seq;
    status = transition.run.status;
  }

  if (at.kernelState === undefined || at.state === undefined) {
    throw new Nondeterminism(run.run_id, 0, "the journal holds no foldable events for this run");
  }
  return { kernelState: at.kernelState, state: at.state, stateHash, seq: lastSeq, status };
}
