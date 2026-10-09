/**
 * Run-level operations behind the API: start, signal, cancel, read.
 *
 * `startRun` only writes a `created` row. The `started` event is folded by the dispatcher's
 * start-runs stage, so there is exactly one code path into a run's first transition and a
 * crash between "row written" and "run started" is recovered by the outbox rather than lost.
 */

import { readBlobText } from "../blob/offload.ts";
import type { NewSignalRow, RunQuery, RunRow } from "../journal/types.ts";
import type { Cause, Envelope, Json, RunStatus } from "../kernel/protocol.ts";
import type { HostContext } from "./context.ts";
import { BadRequest, isStepGone, RunNotFound, WorkflowRejected } from "./errors.ts";
import { cancelEvent, randomHex, signalEvent } from "./events.ts";
import { applyEvent } from "./transition.ts";

/** A run as the API returns it: the row minus internals, with the output inlined. */
export interface RunView {
  /** The run's id. */
  run_id: string;
  /** Workflow name. */
  workflow: string;
  /** Current status. */
  status: RunStatus;
  /** Seq of the last journaled event. */
  last_seq: number;
  /** Caller-supplied search attributes given at start. */
  search: Record<string, Json>;
  /** When the row was created, epoch milliseconds. */
  created_at_ms: number;
  /** When the row last changed, epoch milliseconds. */
  updated_at_ms: number;
  /** When the `started` event was folded, epoch milliseconds. */
  started_at_ms?: number;
  /** When the run reached a terminal status, epoch milliseconds. */
  closed_at_ms?: number;
  /** The parent run, for a spawned child. */
  parent_run_id?: string;
  /** The run this one continued from, when it was started by a `continue_as_new`. */
  continued_from?: string;
  /** The successor this run handed its input to; set once the run is `continued`. */
  continued_to?: string;
  /** Completion output, read back from the blob store when it was offloaded. */
  output?: Json;
  /** Why the run failed: the `error` of its closing marker. Present only when `status` is `failed`. */
  error?: string;
  /** The closing marker's cause (`app_error` or `nondeterminism_detected`). Present with `error`. */
  cause?: Cause;
}

/** What {@link startRun} needs. */
export interface StartRunInput {
  /** Name of a workflow registered on this host. */
  workflow: string;
  /** Start input, journaled on the `started` event. `undefined` is stored as `null`. */
  input: Json;
  /** Caller-chosen id. Default `run_<32 hex>`. Creating an existing id is a no-op. */
  runId?: string;
  /** Search attributes returned on the view and stored on the row. */
  search?: Record<string, Json>;
  /** Namespace to create the run in. Default: the host's. */
  namespace?: string;
}

/**
 * Writes a `created` run row and kicks the dispatcher; the `started` event is folded by the
 * outbox. Idempotent on `runId`. Runs on a host with the `api` role.
 *
 * @throws {@link WorkflowRejected} when the workflow is not registered.
 */
export async function startRun(ctx: HostContext, opts: StartRunInput): Promise<{ run_id: string }> {
  const workflow = ctx.workflows.get(opts.workflow);
  if (workflow === undefined) throw new WorkflowRejected(opts.workflow);

  const runId = opts.runId ?? `run_${randomHex()}`;
  await ctx.journal.transaction((tx) =>
    tx.createRun(
      {
        run_id: runId,
        namespace: opts.namespace ?? ctx.namespace,
        workflow: workflow.name,
        component_digest: workflow.digest,
        status: "created",
        input: JSON.stringify(opts.input ?? null),
        ...(opts.search !== undefined ? { search: opts.search } : {}),
      },
      ctx.now(),
    ),
  );
  ctx.kick();
  return { run_id: runId };
}

/** What {@link signalRun} returns. */
export interface SignalResult {
  /** The stored signal's id, `sig_<32 hex>`. */
  signal_id: string;
  /**
   * True when an open wait folded the signal into the run. False in two cases: nothing was
   * waiting, so the signal is buffered until a wait with that name opens; or the wait it
   * matched had already closed — its timeout fired first, or the run has ended — a late
   * signal. A late signal is recorded against the closed step, never folded, never buffered,
   * and the stale wait row is dropped.
   */
  delivered: boolean;
}

/**
 * Stores a signal and, when the run is waiting on that name, delivers it in the same
 * transaction. Validated against the registered signal schema when there is one. Never
 * answers 409 for an ended run: the signal is stored and reported as not delivered.
 *
 * @throws {@link BadRequest} when the payload fails the schema.
 * @throws {@link RunNotFound} when no run has that id.
 */
export async function signalRun(
  ctx: HostContext,
  runId: string,
  name: string,
  payload: Json,
): Promise<SignalResult> {
  const definition = ctx.signals.get(name);
  let value = payload;
  if (definition !== undefined) {
    const parsed = definition.schema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequest(`signal "${name}" payload is invalid: ${parsed.error.message}`);
    }
    value = parsed.data as Json;
  }

  const row: NewSignalRow = {
    signal_id: `sig_${randomHex()}`,
    run_id: runId,
    name,
    payload: JSON.stringify(value ?? null),
  };

  let matched: string | undefined;
  try {
    // A refusal the kernel treats as a duplicate (`unknown_step`, `already_terminal`) commits
    // these rows and answers `applied: false`, which is exactly the late-signal outcome below.
    const outcome = await applyEvent(ctx, runId, async (tx) => {
      const nowMs = ctx.now();
      await tx.putSignal(row, nowMs);
      const wait = (await tx.getSignalWaits(runId)).find((w) => w.name === name);
      if (wait === undefined) return null;
      matched = wait.step_id;
      await tx.markSignalDelivered(row.signal_id, wait.step_id, nowMs);
      await tx.removeSignalWait(runId, wait.step_id);
      return signalEvent({ runId, nowMs }, wait.step_id, row.payload ?? "null");
    });
    return { signal_id: row.signal_id, delivered: outcome.applied };
  } catch (error) {
    if (matched === undefined || !isStepGone(error)) throw error;
    // The wait's step closed before the signal arrived, so the fold — and the bookkeeping
    // with it — rolled back. Record the late arrival and drop the stale wait instead.
    await recordLateSignal(ctx, row, matched);
    return { signal_id: row.signal_id, delivered: false };
  }
}

function recordLateSignal(ctx: HostContext, row: NewSignalRow, stepId: string): Promise<void> {
  return ctx.journal.transaction(async (tx) => {
    const nowMs = ctx.now();
    await tx.putSignal(row, nowMs);
    await tx.markSignalDelivered(row.signal_id, stepId, nowMs);
    await tx.removeSignalWait(row.run_id, stepId);
  });
}

/**
 * Folds a `cancel` marker and returns the run. Cancelling an ended run is a no-op that
 * still returns the view.
 *
 * @throws {@link RunNotFound} when no run has that id.
 */
export async function cancelRun(ctx: HostContext, runId: string): Promise<RunView> {
  await applyEvent(ctx, runId, cancelEvent({ runId, nowMs: ctx.now() }));
  return getRunView(ctx, runId);
}

/**
 * Reads one run, inlining an offloaded output.
 *
 * @throws {@link RunNotFound} when no run has that id.
 */
export async function getRunView(ctx: HostContext, runId: string): Promise<RunView> {
  const row = await ctx.journal.getRun(runId);
  if (row === null) throw new RunNotFound(runId);
  return toView(ctx, row);
}

/** Lists runs in the host's namespace unless `query.namespace` says otherwise. */
export async function listRuns(ctx: HostContext, query: RunQuery): Promise<RunView[]> {
  const rows = await ctx.journal.query({ namespace: ctx.namespace, ...query });
  return Promise.all(rows.map((row) => toView(ctx, row)));
}

/** Journaled events with `seq > sinceSeq`, ascending. Empty for an unknown run. */
export function readRunEvents(
  ctx: HostContext,
  runId: string,
  sinceSeq: number,
): Promise<Envelope[]> {
  return ctx.journal.readEvents(runId, sinceSeq);
}

async function toView(ctx: HostContext, row: RunRow): Promise<RunView> {
  const outputJson =
    row.output ?? (row.output_ref !== undefined ? await readBlobText(ctx.blob, row.output_ref) : undefined);
  const failure = row.status === "failed" ? await failureOf(ctx, row) : {};

  return {
    run_id: row.run_id,
    workflow: row.workflow,
    status: row.status,
    last_seq: row.last_seq,
    search: row.search,
    created_at_ms: row.created_at_ms,
    updated_at_ms: row.updated_at_ms,
    ...(row.started_at_ms !== undefined ? { started_at_ms: row.started_at_ms } : {}),
    ...(row.closed_at_ms !== undefined ? { closed_at_ms: row.closed_at_ms } : {}),
    ...(row.parent_run_id !== undefined ? { parent_run_id: row.parent_run_id } : {}),
    ...(row.continued_from !== undefined ? { continued_from: row.continued_from } : {}),
    ...(row.continued_to !== undefined ? { continued_to: row.continued_to } : {}),
    ...(outputJson !== undefined ? { output: JSON.parse(outputJson) as Json } : {}),
    ...failure,
  };
}

/**
 * A failed run's last event is its closing marker (`fail` or `nondeterminism`), so one
 * read of `seq > last_seq - 1` gives the reason. Live runs never pay for it.
 */
async function failureOf(ctx: HostContext, row: RunRow): Promise<Pick<RunView, "error" | "cause">> {
  const [last] = await ctx.journal.readEvents(row.run_id, Math.max(0, row.last_seq - 1));
  if (last === undefined || last.kind !== "marker" || last.error === undefined) return {};
  return { error: last.error, ...(last.cause !== undefined ? { cause: last.cause } : {}) };
}
