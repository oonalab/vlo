/**
 * The reducer behind {@link sequence}: entering a phase, settling its task, child, signal
 * or timer, and moving to the next one. Pure functions over {@link SeqState}; the
 * constructors live in `sequence.ts`.
 */

import type { Command, Json, ReducerEvent } from "../../kernel/protocol.ts";
import { cmd, signalTimeoutStepId } from "../commands.ts";
import { WorkflowFailure, type Reduction } from "../workflow.ts";
import type { FanState, SeqState, SeqStep, SequenceOptions } from "./sequence-types.ts";

type FanStep = Extract<SeqStep, { kind: "fan_out" }>;
type FanRunsStep = Extract<SeqStep, { kind: "fan_out_runs" }>;
type TaskDone = Extract<ReducerEvent, { type: "task_done" }>;
type ChildDone = Extract<ReducerEvent, { type: "child_done" }>;
type SignalEvent = Extract<ReducerEvent, { type: "signal" }>;
type TimerEvent = Extract<ReducerEvent, { type: "timer" }>;

/** Separates a fan-out's target name from the item index in its step ids. */
export const FAN_SEPARATOR = "#";
/** A sleep's step id is derived from its phase, so a replay asks for the same timer. */
export const sleepStepId = (phase: number): string => `sleep${FAN_SEPARATOR}${phase}`;
/** Likewise for a wait, which also names its deadline timer `${waitStepId}:timeout`. */
export const waitStepId = (phase: number): string => `wait${FAN_SEPARATOR}${phase}`;

/** Every handler folds the event's banked usage into state before anything else. */
export function withUsage(state: SeqState, event: ReducerEvent): SeqState {
  return { ...state, usage: event.usage_total };
}

export function enterPhase(
  steps: readonly SeqStep[],
  options: SequenceOptions,
  state: SeqState,
  phase: number,
): Reduction<SeqState> {
  const { fan: _fan, ...rest } = state;
  const at: SeqState = { ...rest, phase };
  const spec = steps[phase];
  if (spec === undefined) {
    return [at, [cmd.complete(options.output ? options.output(at) : at.results)]];
  }

  switch (spec.kind) {
    case "step": {
      if (spec.when !== undefined && !spec.when(at)) {
        return enterPhase(steps, options, withResult(at, spec.key, null), phase + 1);
      }
      const input = spec.mapInput ? spec.mapInput(at) : defaultInput(steps, at, phase);
      return [at, [cmd.task(spec.activity, input, spec.id !== undefined ? { id: spec.id } : {})]];
    }
    case "fan_out":
    case "fan_out_runs": {
      const items = spec.select(at);
      if (items.length === 0) {
        return enterPhase(steps, options, withResult(at, spec.key, []), phase + 1);
      }
      const fan: FanState = {
        activity: spec.kind === "fan_out" ? spec.activity.name : spec.workflow,
        total: items.length,
        next: 0,
        outstanding: [],
        outputs: new Array<Json>(items.length).fill(null),
      };
      const commands: Command[] = [];
      while (fan.next < fan.total && fan.outstanding.length < spec.concurrency) {
        commands.push(dispatchNext(spec, fan, items));
      }
      return [{ ...at, fan }, commands];
    }
    case "wait_for":
      return [
        at,
        cmd.awaitHuman(spec.signal, {
          id: waitStepId(phase),
          ...(spec.timeoutMs !== undefined ? { timeoutMs: spec.timeoutMs } : {}),
          ...(spec.context !== undefined ? { context: spec.context } : {}),
        }),
      ];
    case "sleep":
      return [at, [cmd.timer({ ms: spec.ms, id: sleepStepId(phase) })]];
  }
}

export function onTaskDone(
  steps: readonly SeqStep[],
  options: SequenceOptions,
  state: SeqState,
  event: TaskDone,
): Reduction<SeqState> {
  const spec = steps[state.phase];
  if (spec === undefined) return [state, []];

  if (spec.kind === "step") {
    if (spec.activity.name !== event.activity) return [state, []];
    if (spec.id !== undefined && spec.id !== event.step_id) return [state, []];
    if (event.status !== "succeeded" && (spec.onFailure ?? "fail") === "fail") {
      throw taskFailure(event);
    }
    const value = event.status === "succeeded" ? (event.output ?? null) : null;
    return enterPhase(steps, options, withResult(state, spec.key, value), state.phase + 1);
  }

  if (spec.kind === "fan_out") {
    if (!inFlight(state, event.step_id)) return [state, []];
    if (event.status !== "succeeded" && (spec.onFailure ?? "fail") === "fail") {
      throw taskFailure(event);
    }
    const value = event.status === "succeeded" ? (event.output ?? null) : null;
    return settleFan(steps, options, spec, state, event.step_id, value);
  }

  return [state, []];
}

export function onChildDone(
  steps: readonly SeqStep[],
  options: SequenceOptions,
  state: SeqState,
  event: ChildDone,
): Reduction<SeqState> {
  const spec = steps[state.phase];
  if (spec === undefined || spec.kind !== "fan_out_runs") return [state, []];
  if (!inFlight(state, event.step_id)) return [state, []];

  if (event.status !== "succeeded" && (spec.onFailure ?? "fail") === "fail") {
    throw new WorkflowFailure(`child run "${spec.workflow}" ${event.status}`, {
      workflow: spec.workflow,
      step_id: event.step_id,
      child_run_id: event.child_run_id,
      status: event.status,
    });
  }
  const value: Json = {
    status: event.status,
    output: event.output ?? null,
    child_run_id: event.child_run_id,
  };
  return settleFan(steps, options, spec, state, event.step_id, value);
}

/** Records one fan-out item's value, dispatches the next item or advances when none is left. */
function settleFan(
  steps: readonly SeqStep[],
  options: SequenceOptions,
  spec: FanStep | FanRunsStep,
  state: SeqState,
  stepId: string,
  value: Json,
): Reduction<SeqState> {
  const fan = state.fan;
  if (fan === undefined) return [state, []];

  const index = fanIndex(stepId);
  const outputs = [...fan.outputs];
  if (index !== undefined && index < outputs.length) outputs[index] = value;

  const nextFan: FanState = {
    ...fan,
    outputs,
    outstanding: fan.outstanding.filter((id) => id !== stepId),
  };

  if (nextFan.next < nextFan.total) {
    const command = dispatchNext(spec, nextFan, spec.select(state));
    return [{ ...state, fan: nextFan }, [command]];
  }
  if (nextFan.outstanding.length > 0) return [{ ...state, fan: nextFan }, []];
  return enterPhase(steps, options, withResult(state, spec.key, outputs), state.phase + 1);
}

export function onSignal(
  steps: readonly SeqStep[],
  options: SequenceOptions,
  state: SeqState,
  event: SignalEvent,
): Reduction<SeqState> {
  const spec = steps[state.phase];
  if (spec === undefined || spec.kind !== "wait_for" || spec.signal.name !== event.name) {
    return [state, []];
  }
  const advanced: SeqState = { ...state, signals: { ...state.signals, [spec.key]: event.payload } };
  return enterPhase(steps, options, advanced, state.phase + 1);
}

/**
 * Timers belong to exactly one phase: a sleep's own timer, or a wait's deadline. Anything
 * else — a deadline for a wait the signal already resolved, a timer from a phase left
 * behind — is folded and ignored.
 */
export function onTimer(
  steps: readonly SeqStep[],
  options: SequenceOptions,
  state: SeqState,
  event: TimerEvent,
): Reduction<SeqState> {
  const spec = steps[state.phase];
  if (spec === undefined) return [state, []];

  if (spec.kind === "sleep") {
    if (event.step_id !== sleepStepId(state.phase)) return [state, []];
    return enterPhase(steps, options, state, state.phase + 1);
  }

  if (spec.kind === "wait_for") {
    if (event.step_id !== signalTimeoutStepId(waitStepId(state.phase))) return [state, []];
    if ((spec.onTimeout ?? "fail") === "fail") {
      throw new WorkflowFailure(`human timeout: ${spec.signal.name}`, {
        signal: spec.signal.name,
        step_id: event.step_id,
      });
    }
    const advanced: SeqState = { ...state, signals: { ...state.signals, [spec.key]: null } };
    return enterPhase(steps, options, advanced, state.phase + 1);
  }

  return [state, []];
}

/** Emits the next pending fan-out task or spawn and advances `fan` in place (always a fresh object). */
function dispatchNext(spec: FanStep | FanRunsStep, fan: FanState, items: readonly Json[]): Command {
  const index = fan.next;
  if (index >= items.length) {
    throw new WorkflowFailure(
      `${spec.kind === "fan_out" ? "fanOut" : "fanOutRuns"} "${spec.key}": select() is not pure — it returned ${items.length} items, expected ${fan.total}`,
    );
  }
  const id = `${fan.activity}${FAN_SEPARATOR}${index}`;
  fan.next = index + 1;
  fan.outstanding = [...fan.outstanding, id];
  const item = items[index] as Json;
  return spec.kind === "fan_out"
    ? cmd.task(spec.activity, item, { id })
    : cmd.spawn(spec.workflow, item, { id });
}

function inFlight(state: SeqState, stepId: string): boolean {
  return state.fan !== undefined && state.fan.outstanding.includes(stepId);
}

function taskFailure(event: TaskDone): WorkflowFailure {
  return new WorkflowFailure(
    `activity "${event.activity}" ${event.status}${event.error ? `: ${event.error}` : ""}`,
    {
      activity: event.activity,
      step_id: event.step_id,
      status: event.status,
      ...(event.cause !== undefined ? { cause: event.cause } : {}),
    },
  );
}

function fanIndex(stepId: string): number | undefined {
  const at = stepId.lastIndexOf(FAN_SEPARATOR);
  if (at < 0) return undefined;
  const parsed = Number(stepId.slice(at + 1));
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/** The previous phase's stored value, skipping sleeps, which store nothing. */
function defaultInput(steps: readonly SeqStep[], state: SeqState, phase: number): Json {
  for (let at = phase - 1; at >= 0; at -= 1) {
    const previous = steps[at];
    if (previous === undefined) break;
    if (previous.kind === "sleep") continue;
    const store = previous.kind === "wait_for" ? state.signals : state.results;
    return store[previous.key] ?? null;
  }
  return state.input;
}

function withResult(state: SeqState, key: string, value: Json): SeqState {
  return { ...state, results: { ...state.results, [key]: value } };
}
