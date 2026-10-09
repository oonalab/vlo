/**
 * Raw database rows to typed rows.
 *
 * The two dialects disagree on three details and nothing else: Postgres returns
 * `bigint` columns as strings, returns `jsonb` already parsed, and returns NULL
 * where SQLite may return `null` too. `num` and `parseJson` absorb all three.
 */

import type { Envelope, Json, RetryPolicy, RunStatus, Status, Usage } from "../kernel/protocol.ts";
import type {
  RunRow,
  SchemaRow,
  SignalRow,
  SignalWaitRow,
  StateRow,
  TaskRow,
  TimerRow,
} from "./types.ts";

export type Raw = Record<string, unknown>;

export function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value as string | bigint);
}

function optNum(value: unknown): number | null {
  return value == null ? null : num(value);
}

function parseJson(value: unknown): unknown {
  if (value == null) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

/** Copies the entries that are actually present, leaving absent columns off the row. */
function withPresent<T extends object>(row: T, optional: Record<string, unknown>): T {
  const sink = row as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(optional)) {
    if (value !== null && value !== undefined) sink[key] = value;
  }
  return row;
}

export function mapRun(r: Raw): RunRow {
  const row: RunRow = {
    run_id: String(r.run_id),
    namespace: String(r.namespace),
    workflow: String(r.workflow),
    component_digest: String(r.component_digest),
    status: r.status as RunStatus,
    last_seq: num(r.last_seq),
    search: (parseJson(r.search) as Record<string, Json> | null) ?? {},
    created_at_ms: num(r.created_at_ms),
    updated_at_ms: num(r.updated_at_ms),
  };
  return withPresent(row, {
    parent_run_id: r.parent_run_id,
    parent_step_id: r.parent_step_id,
    continued_from: r.continued_from,
    continued_to: r.continued_to,
    input: r.input,
    input_ref: r.input_ref,
    output: r.output,
    output_ref: r.output_ref,
    assignee: r.assignee,
    started_at_ms: optNum(r.started_at_ms),
    closed_at_ms: optNum(r.closed_at_ms),
    parent_notified_at_ms: optNum(r.parent_notified_at_ms),
    start_claimed_until_ms: optNum(r.start_claimed_until_ms),
    notify_claimed_until_ms: optNum(r.notify_claimed_until_ms),
  });
}

export function mapEvent(r: Raw): Envelope {
  const row: Envelope = {
    run_id: String(r.run_id),
    seq: num(r.seq),
    step_id: String(r.step_id),
    attempt: num(r.attempt),
    kind: r.kind as Envelope["kind"],
    status: r.status as Status,
    ts_ms: num(r.ts_ms),
    random: String(r.random),
    state_hash: String(r.state_hash),
  };
  return withPresent(row, {
    cause: r.cause,
    schema_ref: r.schema_ref,
    payload: r.payload,
    payload_ref: r.payload_ref,
    error: r.error,
    usage: parseJson(r.usage) as Usage | null,
    parent_run_id: r.parent_run_id,
    parent_step_id: r.parent_step_id,
  });
}

export function mapState(r: Raw): StateRow {
  const row: StateRow = {
    run_id: String(r.run_id),
    seq: num(r.seq),
    bundle_digest: String(r.bundle_digest),
    kernel_state: String(r.kernel_state),
    state_hash: String(r.state_hash),
  };
  return withPresent(row, { state: r.state, state_ref: r.state_ref });
}

export function mapTask(r: Raw): TaskRow {
  const row: TaskRow = {
    task_id: String(r.task_id),
    run_id: String(r.run_id),
    step_id: String(r.step_id),
    attempt: num(r.attempt),
    activity: String(r.activity),
    queue: String(r.queue),
    retry_policy: parseJson(r.retry_policy) as RetryPolicy,
    status: r.status as Status,
    idempotency_key: String(r.idempotency_key),
    not_before_ms: num(r.not_before_ms),
    dispatch_attempts: num(r.dispatch_attempts),
    lease_ttl_ms: num(r.lease_ttl_ms),
    created_at_ms: num(r.created_at_ms),
    updated_at_ms: num(r.updated_at_ms),
  };
  return withPresent(row, {
    schema_ref: r.schema_ref,
    input: r.input,
    input_ref: r.input_ref,
    dispatched_at_ms: optNum(r.dispatched_at_ms),
    dispatch_claimed_until_ms: optNum(r.dispatch_claimed_until_ms),
    timeout_ms: optNum(r.timeout_ms),
    lease_until_ms: optNum(r.lease_until_ms),
    worker_id: r.worker_id,
    heartbeat_at_ms: optNum(r.heartbeat_at_ms),
  });
}

export function mapTimer(r: Raw): TimerRow {
  const row: TimerRow = {
    run_id: String(r.run_id),
    step_id: String(r.step_id),
    fire_at_ms: num(r.fire_at_ms),
  };
  return withPresent(row, {
    fired_at_ms: optNum(r.fired_at_ms),
    claimed_until_ms: optNum(r.claimed_until_ms),
  });
}

export function mapSignalWait(r: Raw): SignalWaitRow {
  const row: SignalWaitRow = {
    run_id: String(r.run_id),
    step_id: String(r.step_id),
    name: String(r.name),
  };
  return withPresent(row, {
    schema_ref: r.schema_ref,
    expires_at_ms: optNum(r.expires_at_ms),
  });
}

export function mapSignal(r: Raw): SignalRow {
  const row: SignalRow = {
    signal_id: String(r.signal_id),
    run_id: String(r.run_id),
    name: String(r.name),
    created_at_ms: num(r.created_at_ms),
  };
  return withPresent(row, {
    payload: r.payload,
    payload_ref: r.payload_ref,
    sender: r.sender,
    delivered_at_ms: optNum(r.delivered_at_ms),
    delivered_step_id: r.delivered_step_id,
  });
}

export function mapSchema(r: Raw): SchemaRow {
  const row: SchemaRow = {
    name: String(r.name),
    version: String(r.version),
    json_schema: String(r.json_schema),
  };
  return withPresent(row, { retry_policy: r.retry_policy });
}
