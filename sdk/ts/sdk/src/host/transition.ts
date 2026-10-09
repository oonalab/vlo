/**
 * The single writer path. Every durable change to a run goes through `applyEvent`.
 *
 * One transaction: take the run's write lock, load the checkpoint, fold the event, apply
 * the kernel's write-set. Cross-run effects (starting a child, telling a parent) and HTTP
 * pushes stay outside — SQLite serialises transactions through one connection, so holding
 * one across a network call would stall the whole host.
 */

import { offloadIfOversized, readBlobText } from "../blob/offload.ts";
import type { Workflow } from "../core/workflow.ts";
import type { ApplyTransitionOptions, JournalTx, NewRunRow, RunRow, StateRow } from "../journal/types.ts";
import {
  CANCEL_STEP_ID,
  CONTINUE_STEP_ID,
  FAIL_STEP_ID,
  NONDETERMINISM_STEP_ID,
  type EventInput,
  type KernelState,
  type RunRef,
  type Transition,
} from "../kernel/protocol.ts";
import type { HostContext, TaskScheduled } from "./context.ts";
import { IllegalEvent, Nondeterminism, ReducerFailed, RunNotFound, RunTerminal, WorkflowRejected } from "./errors.ts";
import {
  failEvent,
  isDuplicate,
  isTerminalRun,
  nondeterminismEvent,
  signalEvent,
  unwrap,
} from "./events.ts";
import { foldEvent, rebuildCheckpoint, type FoldState } from "./refold.ts";

/** Markers that end a run. They echo whatever checkpoint exists and never call the reducer. */
const CLOSING_MARKERS: ReadonlySet<string> = new Set([
  CANCEL_STEP_ID,
  FAIL_STEP_ID,
  NONDETERMINISM_STEP_ID,
]);

/** What one `applyEvent` call did. */
export interface TxOutcome {
  /** False when the source decided there was nothing to submit. */
  applied: boolean;
  /** True for an at-least-once redelivery the kernel has already folded. */
  duplicate: boolean;
  /** The run row as it was locked, before the transition. */
  run: RunRow;
  /** The kernel's write-set. Present only when `applied` is true. */
  transition?: Transition;
  /** Buffered signals that matched a wait this transition opened; applied after commit. */
  followUps: EventInput[];
}

/**
 * The event to submit. A function form runs inside the transaction with the run already
 * locked, so it can read and write journal rows before deciding — returning `null` commits
 * whatever it did without folding anything.
 */
export type EventSource =
  | EventInput
  | ((tx: JournalTx, run: RunRow) => Promise<EventInput | null>);

/** Extra journal work to commit atomically with the transition. */
export type AfterApply = (tx: JournalTx, outcome: TxOutcome) => Promise<void>;

/**
 * Submits one event. Owns its transaction, recovers a reducer throw or a divergence into
 * the matching marker, then runs the post-commit work (buffered signals, emits, kick).
 *
 * A `ReducerFailed` is swallowed: the run is failed with an `app_error` marker and that
 * outcome is returned. A `Nondeterminism` is recorded as a marker and then rethrown.
 *
 * @throws {@link RunNotFound} when no run has that id.
 * @throws {@link RunTerminal} when the run ended and the event is not a task result or a closing marker.
 * @throws {@link WorkflowRejected} when the run's workflow is not registered on this host.
 * @throws {@link IllegalEvent} when the kernel refuses the event for a reason other than a duplicate.
 * @throws {@link Nondeterminism} after journaling the divergence.
 */
export async function applyEvent(
  ctx: HostContext,
  runId: string,
  source: EventSource,
  after?: AfterApply,
): Promise<TxOutcome> {
  let outcome: TxOutcome;
  try {
    outcome = await ctx.journal.transaction((tx) => runTransition(ctx, tx, runId, source, after));
  } catch (error) {
    if (error instanceof ReducerFailed) {
      // Contract from `core/workflow.ts`: the run fails and the pre-event checkpoint stays.
      return applyEvent(
        ctx,
        runId,
        failEvent({ runId, nowMs: ctx.now() }, error.reason, error.trigger),
      );
    }
    if (error instanceof Nondeterminism) {
      await applyEvent(ctx, runId, nondeterminismEvent({ runId, nowMs: ctx.now() }, error.message));
      throw error;
    }
    throw error;
  }

  await afterCommit(ctx, runId, outcome);
  return outcome;
}

async function afterCommit(ctx: HostContext, runId: string, outcome: TxOutcome): Promise<void> {
  for (const emit of outcome.transition?.emits ?? []) {
    ctx.events.emit("emit", { run_id: runId, channel: emit.channel, data: emit.data });
  }
  // Committed, so a poller that wakes on this will find the row.
  for (const task of outcome.transition?.tasks ?? []) {
    const scheduled: TaskScheduled = { run_id: runId, task_id: task.task_id, queue: task.queue };
    ctx.events.emit("task_scheduled", scheduled);
  }
  for (const followUp of outcome.followUps) {
    await applyEvent(ctx, runId, followUp);
  }
  if (outcome.applied) ctx.kick();
}

async function runTransition(
  ctx: HostContext,
  tx: JournalTx,
  runId: string,
  source: EventSource,
  after: AfterApply | undefined,
): Promise<TxOutcome> {
  const run = await tx.lockRun(runId);
  if (run === null) throw new RunNotFound(runId);

  const event = typeof source === "function" ? await source(tx, run) : source;
  if (event === null) {
    return finish(tx, { applied: false, duplicate: false, run, followUps: [] }, after);
  }

  const closing = event.kind === "marker" && CLOSING_MARKERS.has(event.step_id);
  if (isTerminalRun(run.status)) {
    // A late worker result for a run that already ended is not an error; it is a redelivery.
    if (event.kind === "task" || closing) {
      return finish(tx, { applied: false, duplicate: true, run, followUps: [] }, after);
    }
    throw new RunTerminal(runId, run.status);
  }

  const workflow = ctx.workflows.get(run.workflow);
  if (workflow === undefined) throw new WorkflowRejected(run.workflow);

  const at = await loadCheckpoint(ctx, tx, run, workflow, closing);

  let transition: Transition;
  try {
    transition = foldEvent(ctx, workflow, runRef(run), at, event);
  } catch (error) {
    if (error instanceof IllegalEvent && isDuplicate(error.kernelError)) {
      return finish(tx, { applied: false, duplicate: true, run, followUps: [] }, after);
    }
    throw error;
  }

  const nowMs = ctx.now();
  const opts: ApplyTransitionOptions = {
    nowMs,
    ...(await offloadedRefs(ctx, transition)),
    childRuns: childRuns(ctx, run, transition),
    ...successorRun(ctx, run, transition),
  };
  await tx.applyTransition(runId, transition, opts);

  const followUps = await pickUpBufferedSignals(ctx, tx, runId, transition, nowMs);
  return finish(tx, { applied: true, duplicate: false, run, transition, followUps }, after);
}

async function finish(
  tx: JournalTx,
  outcome: TxOutcome,
  after: AfterApply | undefined,
): Promise<TxOutcome> {
  if (after !== undefined) await after(tx, outcome);
  return outcome;
}

/**
 * The checkpoint to fold onto.
 *
 * Only one checkpoint is kept per run, so the plan's "re-fold the last N events" becomes a
 * hash check: re-hashing the stored pair must reproduce the stored `state_hash`. A missing
 * checkpoint, or one written by a different bundle, is rebuilt from seq 0 instead.
 */
async function loadCheckpoint(
  ctx: HostContext,
  tx: JournalTx,
  run: RunRow,
  workflow: Workflow,
  closing: boolean,
): Promise<FoldState> {
  if (run.last_seq === 0) return {};

  const checkpoint = await tx.getState(run.run_id);
  // A closing marker must always land, even on a run whose checkpoint is the problem.
  if (closing) return checkpoint === null ? {} : await readCheckpoint(ctx, checkpoint);

  if (checkpoint === null || checkpoint.bundle_digest !== run.component_digest) {
    const events = await tx.readEvents(run.run_id, 0);
    const rebuilt = rebuildCheckpoint(ctx, workflow, run, events);
    return { kernelState: rebuilt.kernelState, state: rebuilt.state };
  }

  const at = await readCheckpoint(ctx, checkpoint);
  if (at.kernelState === undefined || at.state === undefined) {
    throw new Nondeterminism(run.run_id, checkpoint.seq, "the checkpoint has no body");
  }
  const hash = ctx.kernel.stateHash({ kernel_state: at.kernelState, state: at.state });
  if (!hash.ok || hash.value.hash !== checkpoint.state_hash) {
    throw new Nondeterminism(
      run.run_id,
      checkpoint.seq,
      `the checkpoint hashes to ${hash.ok ? hash.value.hash : hash.error.code}, not the stored ${checkpoint.state_hash}`,
    );
  }
  return at;
}

async function readCheckpoint(ctx: HostContext, row: StateRow): Promise<FoldState> {
  const state = row.state ?? (row.state_ref ? await readBlobText(ctx.blob, row.state_ref) : undefined);
  return {
    kernelState: JSON.parse(row.kernel_state) as KernelState,
    ...(state !== undefined ? { state } : {}),
  };
}

async function offloadedRefs(
  ctx: HostContext,
  t: Transition,
): Promise<Pick<ApplyTransitionOptions, "stateRef" | "outputRef">> {
  const refs: { stateRef?: string; outputRef?: string } = {};
  if (!t.state_inline) {
    const ref = await offloadIfOversized(ctx.blob, t.state);
    if (ref !== null) refs.stateRef = ref;
  }
  if (t.completion?.output !== undefined) {
    const ref = await offloadIfOversized(ctx.blob, JSON.stringify(t.completion.output));
    if (ref !== null) refs.outputRef = ref;
  }
  return refs;
}

/** Child runs land as `created` rows; the outbox starts them in their own transaction. */
function childRuns(ctx: HostContext, run: RunRow, t: Transition): NewRunRow[] {
  return t.spawns.map((spawn) => {
    const child = ctx.workflows.get(spawn.workflow);
    if (child === undefined) {
      throw new ReducerFailed(
        run.run_id,
        `cannot spawn "${spawn.workflow}": no such workflow is registered on this host`,
      );
    }
    return {
      run_id: spawn.child_run_id,
      namespace: run.namespace,
      workflow: spawn.workflow,
      component_digest: child.digest,
      status: "created",
      parent_run_id: run.run_id,
      parent_step_id: spawn.step_id,
      input: JSON.stringify(spawn.input),
    };
  });
}

/**
 * The successor of a `continue_as_new`, as a `created` row the outbox will start. Its id is
 * derived from the `continue` step, so re-deriving it lands on the same row (`ON CONFLICT DO
 * NOTHING`). It inherits the parent link: whichever run in the chain finally closes is the
 * one that tells the parent, and a `continued` run never does.
 */
function successorRun(
  ctx: HostContext,
  run: RunRow,
  t: Transition,
): Pick<ApplyTransitionOptions, "successorRun"> {
  if (t.continue_as_new === undefined) return {};
  const workflow = ctx.workflows.get(run.workflow);
  if (workflow === undefined) {
    throw new ReducerFailed(
      run.run_id,
      `cannot continue "${run.workflow}": no such workflow is registered on this host`,
    );
  }
  const ids = unwrap(
    ctx.kernel.deriveIds({ run_id: run.run_id, step_id: CONTINUE_STEP_ID, attempt: 0 }),
  );
  return {
    successorRun: {
      run_id: ids.child_run_id,
      namespace: run.namespace,
      workflow: run.workflow,
      component_digest: workflow.digest,
      status: "created",
      continued_from: run.run_id,
      input: JSON.stringify(t.continue_as_new.input),
      search: run.search,
      ...(run.parent_run_id !== undefined ? { parent_run_id: run.parent_run_id } : {}),
      ...(run.parent_step_id !== undefined ? { parent_step_id: run.parent_step_id } : {}),
    },
  };
}

/** A signal that arrived before anyone waited for it is delivered as soon as a wait opens. */
async function pickUpBufferedSignals(
  ctx: HostContext,
  tx: JournalTx,
  runId: string,
  t: Transition,
  nowMs: number,
): Promise<EventInput[]> {
  const followUps: EventInput[] = [];
  for (const wait of t.signal_waits) {
    const buffered = await tx.takeSignal(runId, wait.name);
    if (buffered === null) continue;
    await tx.markSignalDelivered(buffered.signal_id, wait.step_id, nowMs);
    await tx.removeSignalWait(runId, wait.step_id);
    followUps.push(signalEvent({ runId, nowMs }, wait.step_id, await signalPayload(ctx, buffered)));
  }
  return followUps;
}

async function signalPayload(
  ctx: HostContext,
  row: { payload?: string; payload_ref?: string },
): Promise<string> {
  if (row.payload !== undefined) return row.payload;
  if (row.payload_ref !== undefined) return readBlobText(ctx.blob, row.payload_ref);
  return "null";
}

/** The run identity the kernel folds against, taken from its row. */
export function runRef(run: RunRow): RunRef {
  return {
    run_id: run.run_id,
    workflow: run.workflow,
    bundle_digest: run.component_digest,
    status: run.status,
    last_seq: run.last_seq,
    ...(run.parent_run_id !== undefined ? { parent_run_id: run.parent_run_id } : {}),
    ...(run.parent_step_id !== undefined ? { parent_step_id: run.parent_step_id } : {}),
  };
}
