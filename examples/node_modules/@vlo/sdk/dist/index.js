import { _ as canonicalJson, a as withRetryInput, c as DEFAULT_LEASE_MS, d as activity, f as signal, g as projectSchema, h as SCHEMA_HASH_VERSION, l as DEFAULT_QUEUE, m as NAMED_SCHEMA_MAPS, o as TERMINAL_RUN_STATUSES, p as ANNOTATION_KEYWORDS, r as defineWorker, s as isTerminalRunStatus, t as defineDomain, u as DEFAULT_RETRY, v as contentHash, y as sha256Hex } from "./domain-C6_UPgcw.js";
import { n as defineConfig, r as env } from "./define-B5qX4EZX.js";
//#region src/core/commands.ts
/** Thrown synchronously by `cmd.task` when the input does not match the activity's schema. */
var ActivityInputError = class extends Error {
	/** Name of the activity whose input schema rejected the value. */
	activity;
	/** @param detail - The Zod issues, joined as `path: message; …`. */
	constructor(activity, detail) {
		super(`Invalid input for activity "${activity}": ${detail}`);
		this.name = "ActivityInputError";
		this.activity = activity;
	}
};
/**
* Requests one attempt-tracked execution of `target` with `input`.
*
* `input` is parsed with the activity's Zod schema; the parsed value (defaults applied) is
* what travels. The activity's `queue`, `retry`, `leaseMs` and `timeoutMs` are copied onto
* the command; `options.queue` overrides the queue for this call.
*
* @throws {@link ActivityInputError} when the input does not match the activity's schema.
*/
function task(target, input, options) {
	const parsed = target.input.safeParse(input);
	if (!parsed.success) {
		const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ");
		throw new ActivityInputError(target.name, detail);
	}
	return {
		type: "task",
		activity: target.name,
		schema_ref: target.schemaRef,
		input: parsed.data,
		queue: options?.queue ?? target.queue,
		retry: target.retry,
		lease_ttl_ms: target.leaseMs,
		...target.timeoutMs !== void 0 ? { timeout_ms: target.timeoutMs } : {},
		...options?.id !== void 0 ? { id: options.id } : {}
	};
}
/**
* Schedules a `timer` event for the run. `ms` is relative to the timestamp of the event
* being reduced; `atMs` is absolute epoch milliseconds.
*
* Throws a `TypeError` synchronously when neither or both of `ms` / `atMs` are given.
*/
function timer(options) {
	if (options.ms === void 0 && options.atMs === void 0) throw new TypeError("cmd.timer requires either `ms` or `atMs`");
	if (options.ms !== void 0 && options.atMs !== void 0) throw new TypeError("cmd.timer takes either `ms` or `atMs`, not both");
	return {
		type: "timer",
		...options.ms !== void 0 ? { fire_in_ms: options.ms } : {},
		...options.atMs !== void 0 ? { fire_at_ms: options.atMs } : {},
		...options.id !== void 0 ? { id: options.id } : {}
	};
}
/**
* Starts a child run of `workflow` (a name, or anything with a `name` such as a
* {@link Workflow}) with `input`. The child's terminal status and output come back to this
* run as a `child_done` event on the spawn's step id. The workflow must be registered on
* the host that dispatches the command.
*/
function spawn(workflow, input, options) {
	return {
		type: "spawn",
		workflow: typeof workflow === "string" ? workflow : workflow.name,
		input,
		...options?.id !== void 0 ? { id: options.id } : {}
	};
}
/**
* Parks the run until a signal named after `definition` is delivered; the payload arrives
* on a `signal` event. A signal that arrived before the wait was opened is buffered and
* delivered immediately, oldest first. The run holds no compute while parked. With
* `timeoutMs` the kernel also opens a timer step `<id>:timeout` and cancels whichever of
* the two loses; see {@link signalTimeoutStepId}.
*/
function awaitSignal(definition, options) {
	return {
		type: "await_signal",
		name: definition.name,
		schema_ref: definition.schemaRef,
		...options?.timeoutMs !== void 0 ? { timeout_ms: options.timeoutMs } : {},
		...options?.id !== void 0 ? { id: options.id } : {}
	};
}
/**
* Publishes `data` on a side channel. Emits never enter the run's history and never come
* back to the reducer; the host forwards them to event-stream subscribers, which is where
* progress ticks and UI hints belong.
*/
function emit(channel, data) {
	return {
		type: "emit",
		channel,
		data
	};
}
/**
* Closes the run as `completed` with `output`. It must be the last command of the reduction;
* the kernel rejects any command after it.
*/
function complete(output) {
	return {
		type: "complete",
		output
	};
}
/**
* Closes the run as `continued`, carrying `input` as the start input of a successor run. It
* must be the last command of the reduction. The host starts the successor (same workflow,
* this `input`) in the same transaction and links the two runs by `continued_from` and
* `continued_to`; a parent run is notified once, by the run that finally closes.
*/
function continueAsNew(input) {
	return {
		type: "continue_as_new",
		input
	};
}
/**
* Step id of the timer the kernel pairs with a signal wait `id` that carries a
* `timeoutMs`. A `timer` event with this step id means the deadline won the race.
*/
function signalTimeoutStepId(id) {
	return `${id}:timeout`;
}
/** @deprecated Use {@link signalTimeoutStepId}; same string. */
const humanTimeoutStepId = signalTimeoutStepId;
/**
* Ask a human. Sugar over `await_signal` (with its deadline) + `emit`: the wait reserves
* `id` and the kernel opens `${id}:timeout` beside it, so whichever arrives first wins and
* the kernel cancels the loser. Returns commands — spread it into a reduction.
*/
function awaitHuman(definition, options) {
	const commands = [awaitSignal(definition, {
		id: options.id,
		...options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {}
	})];
	if (options.context !== void 0) commands.push(emit("human", {
		signal: definition.name,
		id: options.id,
		context: options.context
	}));
	return commands;
}
/**
* The command constructors a reducer returns to the engine. Each builds a plain
* {@link Command}; nothing runs until the host applies the reduction. `task`, `timer`,
* `spawn` and `awaitSignal` open a step, `emit` records a side effect, `complete` and
* `continueAsNew` close the run and must come last.
*
* @example
* ```ts
* import { cmd, defineWorkflow } from "@vlo/sdk";
* import { approve, work } from "./activities.ts";
*
* export default defineWorkflow("review", {
*   init: (input: { item: string }) => ({ item: input.item, upper: null as string | null }),
*   on: {
*     started: (s) => [s, [cmd.task(work, { item: s.item })]],
*     task_done: (s, e) => [
*       { ...s, upper: (e.output as { upper: string }).upper },
*       cmd.awaitHuman(approve, { id: "approval", timeoutMs: 86_400_000 }),
*     ],
*     signal: (s) => [s, [cmd.complete({ upper: s.upper })]],
*     timer: (s) => [s, [cmd.complete(null)]],
*   },
* });
* ```
*/
const cmd = {
	/** Runs an activity once, with retries. Throws {@link ActivityInputError} on bad input. */
	task,
	/** Fires a `timer` event after `ms` or at `atMs`. */
	timer,
	/** Starts a child run; its result arrives as `child_done`. */
	spawn,
	/** Parks the run until the named signal is delivered. */
	awaitSignal,
	/** `awaitSignal` with a deadline + `emit("human", …)`; returns a `Command[]`. */
	awaitHuman,
	/** Publishes on a side channel; never journaled. */
	emit,
	/** Closes the run as `completed`. Must be last. */
	complete,
	/** Closes the run as `continued` with a fresh start input. Must be last. */
	continueAsNew
};
//#endregion
//#region src/core/workflow.ts
/**
* Fails the run. There is no `cmd.fail`: a run fails when its reducer throws, which keeps
* failure out of the command vocabulary and off the happy path.
*
* Host contract: the host catches a throw from `Workflow.reduce`, appends a `failed` event
* (`cause: "app_error"`, `error` = this message) and marks the run `failed`. The state
* checkpoint from before the event is kept, so the run can be rewound and forked.
*/
var WorkflowFailure = class extends Error {
	/** Structured context for the failure, as given; `undefined` when none was. */
	details;
	/** @param details - Anything JSON that helps explain the failure, e.g. the step id and cause. */
	constructor(message, details) {
		super(message);
		this.name = "WorkflowFailure";
		this.details = details;
	}
};
/**
* Defines a workflow: a named, pure reducer over the run's events.
*
* `def` is either a hand-written {@link WorkflowDef} or the output of {@link sequence}.
* Handlers must not read a clock, generate randomness or do I/O; time and randomness arrive
* on the event. State must be JSON-serialisable: it is stringified after every reduction.
* A handler that throws fails the run (see {@link WorkflowFailure}); so does an event
* whose handler is not registered, or a handler returning anything but `[state, Command[]]`.
*
* @example
* ```ts
* import { cmd, defineWorkflow } from "@vlo/sdk";
* import { work } from "./activities.ts";
*
* export default defineWorkflow("uppercase", {
*   init: (input: { item: string }) => ({ item: input.item }),
*   on: {
*     started: (s) => [s, [cmd.task(work, { item: s.item })]],
*     task_done: (s, e) => [s, [cmd.complete(e.output ?? null)]],
*   },
* });
* ```
*/
function defineWorkflow(name, def) {
	return {
		kind: "workflow",
		name,
		digest: contentHash({
			name,
			v: 1
		}),
		def,
		reduce(stateJson, event, initInput) {
			const state = initialState(name, def, stateJson, initInput);
			const handler = def.on[event.type];
			if (typeof handler !== "function") throw new Error(`workflow "${name}": no handler for event "${event.type}"`);
			return toWire(name, handler(state, event));
		}
	};
}
function initialState(name, def, stateJson, initInput) {
	if (initInput !== void 0) return def.init(initInput);
	if (stateJson === null) throw new Error(`workflow "${name}": reduce() needs either a state checkpoint or initInput`);
	return JSON.parse(stateJson);
}
function toWire(name, result) {
	if (!Array.isArray(result) || result.length !== 2 || !Array.isArray(result[1])) throw new TypeError(`workflow "${name}": a handler must return [state, Command[]]`);
	const state = JSON.stringify(result[0]);
	if (state === void 0) throw new TypeError(`workflow "${name}": state must be JSON-serialisable`);
	return {
		state,
		commands: [...result[1]]
	};
}
/** A sleep's step id is derived from its phase, so a replay asks for the same timer. */
const sleepStepId = (phase) => `sleep#${phase}`;
/** Likewise for a wait, which also names its deadline timer `${waitStepId}:timeout`. */
const waitStepId = (phase) => `wait#${phase}`;
/** Every handler folds the event's banked usage into state before anything else. */
function withUsage(state, event) {
	return {
		...state,
		usage: event.usage_total
	};
}
function enterPhase(steps, options, state, phase) {
	const { fan: _fan, ...rest } = state;
	const at = {
		...rest,
		phase
	};
	const spec = steps[phase];
	if (spec === void 0) return [at, [cmd.complete(options.output ? options.output(at) : at.results)]];
	switch (spec.kind) {
		case "step": {
			if (spec.when !== void 0 && !spec.when(at)) return enterPhase(steps, options, withResult(at, spec.key, null), phase + 1);
			const input = spec.mapInput ? spec.mapInput(at) : defaultInput(steps, at, phase);
			return [at, [cmd.task(spec.activity, input, spec.id !== void 0 ? { id: spec.id } : {})]];
		}
		case "fan_out":
		case "fan_out_runs": {
			const items = spec.select(at);
			if (items.length === 0) return enterPhase(steps, options, withResult(at, spec.key, []), phase + 1);
			const fan = {
				activity: spec.kind === "fan_out" ? spec.activity.name : spec.workflow,
				total: items.length,
				next: 0,
				outstanding: [],
				outputs: new Array(items.length).fill(null)
			};
			const commands = [];
			while (fan.next < fan.total && fan.outstanding.length < spec.concurrency) commands.push(dispatchNext(spec, fan, items));
			return [{
				...at,
				fan
			}, commands];
		}
		case "wait_for": return [at, cmd.awaitHuman(spec.signal, {
			id: waitStepId(phase),
			...spec.timeoutMs !== void 0 ? { timeoutMs: spec.timeoutMs } : {},
			...spec.context !== void 0 ? { context: spec.context } : {}
		})];
		case "sleep": return [at, [cmd.timer({
			ms: spec.ms,
			id: sleepStepId(phase)
		})]];
	}
}
function onTaskDone(steps, options, state, event) {
	const spec = steps[state.phase];
	if (spec === void 0) return [state, []];
	if (spec.kind === "step") {
		if (spec.activity.name !== event.activity) return [state, []];
		if (spec.id !== void 0 && spec.id !== event.step_id) return [state, []];
		if (event.status !== "succeeded" && (spec.onFailure ?? "fail") === "fail") throw taskFailure(event);
		const value = event.status === "succeeded" ? event.output ?? null : null;
		return enterPhase(steps, options, withResult(state, spec.key, value), state.phase + 1);
	}
	if (spec.kind === "fan_out") {
		if (!inFlight(state, event.step_id)) return [state, []];
		if (event.status !== "succeeded" && (spec.onFailure ?? "fail") === "fail") throw taskFailure(event);
		const value = event.status === "succeeded" ? event.output ?? null : null;
		return settleFan(steps, options, spec, state, event.step_id, value);
	}
	return [state, []];
}
function onChildDone(steps, options, state, event) {
	const spec = steps[state.phase];
	if (spec === void 0 || spec.kind !== "fan_out_runs") return [state, []];
	if (!inFlight(state, event.step_id)) return [state, []];
	if (event.status !== "succeeded" && (spec.onFailure ?? "fail") === "fail") throw new WorkflowFailure(`child run "${spec.workflow}" ${event.status}`, {
		workflow: spec.workflow,
		step_id: event.step_id,
		child_run_id: event.child_run_id,
		status: event.status
	});
	const value = {
		status: event.status,
		output: event.output ?? null,
		child_run_id: event.child_run_id
	};
	return settleFan(steps, options, spec, state, event.step_id, value);
}
/** Records one fan-out item's value, dispatches the next item or advances when none is left. */
function settleFan(steps, options, spec, state, stepId, value) {
	const fan = state.fan;
	if (fan === void 0) return [state, []];
	const index = fanIndex(stepId);
	const outputs = [...fan.outputs];
	if (index !== void 0 && index < outputs.length) outputs[index] = value;
	const nextFan = {
		...fan,
		outputs,
		outstanding: fan.outstanding.filter((id) => id !== stepId)
	};
	if (nextFan.next < nextFan.total) {
		const command = dispatchNext(spec, nextFan, spec.select(state));
		return [{
			...state,
			fan: nextFan
		}, [command]];
	}
	if (nextFan.outstanding.length > 0) return [{
		...state,
		fan: nextFan
	}, []];
	return enterPhase(steps, options, withResult(state, spec.key, outputs), state.phase + 1);
}
function onSignal(steps, options, state, event) {
	const spec = steps[state.phase];
	if (spec === void 0 || spec.kind !== "wait_for" || spec.signal.name !== event.name) return [state, []];
	return enterPhase(steps, options, {
		...state,
		signals: {
			...state.signals,
			[spec.key]: event.payload
		}
	}, state.phase + 1);
}
/**
* Timers belong to exactly one phase: a sleep's own timer, or a wait's deadline. Anything
* else — a deadline for a wait the signal already resolved, a timer from a phase left
* behind — is folded and ignored.
*/
function onTimer(steps, options, state, event) {
	const spec = steps[state.phase];
	if (spec === void 0) return [state, []];
	if (spec.kind === "sleep") {
		if (event.step_id !== sleepStepId(state.phase)) return [state, []];
		return enterPhase(steps, options, state, state.phase + 1);
	}
	if (spec.kind === "wait_for") {
		if (event.step_id !== signalTimeoutStepId(waitStepId(state.phase))) return [state, []];
		if ((spec.onTimeout ?? "fail") === "fail") throw new WorkflowFailure(`human timeout: ${spec.signal.name}`, {
			signal: spec.signal.name,
			step_id: event.step_id
		});
		return enterPhase(steps, options, {
			...state,
			signals: {
				...state.signals,
				[spec.key]: null
			}
		}, state.phase + 1);
	}
	return [state, []];
}
/** Emits the next pending fan-out task or spawn and advances `fan` in place (always a fresh object). */
function dispatchNext(spec, fan, items) {
	const index = fan.next;
	if (index >= items.length) throw new WorkflowFailure(`${spec.kind === "fan_out" ? "fanOut" : "fanOutRuns"} "${spec.key}": select() is not pure — it returned ${items.length} items, expected ${fan.total}`);
	const id = `${fan.activity}#${index}`;
	fan.next = index + 1;
	fan.outstanding = [...fan.outstanding, id];
	const item = items[index];
	return spec.kind === "fan_out" ? cmd.task(spec.activity, item, { id }) : cmd.spawn(spec.workflow, item, { id });
}
function inFlight(state, stepId) {
	return state.fan !== void 0 && state.fan.outstanding.includes(stepId);
}
function taskFailure(event) {
	return new WorkflowFailure(`activity "${event.activity}" ${event.status}${event.error ? `: ${event.error}` : ""}`, {
		activity: event.activity,
		step_id: event.step_id,
		status: event.status,
		...event.cause !== void 0 ? { cause: event.cause } : {}
	});
}
function fanIndex(stepId) {
	const at = stepId.lastIndexOf("#");
	if (at < 0) return void 0;
	const parsed = Number(stepId.slice(at + 1));
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : void 0;
}
/** The previous phase's stored value, skipping sleeps, which store nothing. */
function defaultInput(steps, state, phase) {
	for (let at = phase - 1; at >= 0; at -= 1) {
		const previous = steps[at];
		if (previous === void 0) break;
		if (previous.kind === "sleep") continue;
		return (previous.kind === "wait_for" ? state.signals : state.results)[previous.key] ?? null;
	}
	return state.input;
}
function withResult(state, key, value) {
	return {
		...state,
		results: {
			...state.results,
			[key]: value
		}
	};
}
//#endregion
//#region src/core/helpers/sequence.ts
/**
* A {@link sequence} phase that runs `target` once.
*
* Without `mapInput` the task input is the run's start input for phase 0 and the previous
* phase's stored value afterwards (sleeps are skipped). The output is stored in
* `results[target.name]`. A task that does not succeed fails the run, unless
* `onFailure: "continue"` stores `null` instead; `when` returning `false` also stores `null`
* and skips the task. `id` pins the step id for handlers that key on it.
*
* @example
* ```ts
* import { defineWorkflow, resultOf, sequence, step } from "@vlo/sdk";
* import { finish, notify, plan } from "./activities.ts";
*
* export default defineWorkflow("example", sequence([
*   step(plan),
*   step(finish, (state) => ({ uppers: resultOf(state, plan).items, approvedBy: "auto" })),
*   step(notify, undefined, { onFailure: "continue", when: (s) => resultOf(s, plan).items.length > 0 }),
* ]));
* ```
*/
function step(target, mapInput, options = {}) {
	return {
		kind: "step",
		key: target.name,
		activity: target,
		...mapInput !== void 0 ? { mapInput } : {},
		...options.id !== void 0 ? { id: options.id } : {},
		...options.onFailure !== void 0 ? { onFailure: options.onFailure } : {},
		...options.when !== void 0 ? { when: options.when } : {}
	};
}
/**
* A {@link sequence} phase that runs `target` once per item `select` returns, at most
* `concurrency` at a time, with step ids `${target.name}#${index}`.
*
* `select` must be pure and read only state written by earlier phases: it is re-evaluated
* on every event of the phase and the run fails if it returns a different count. Outputs
* are stored in `results[target.name]` in item order; an empty selection stores `[]` and
* moves on. A task that does not succeed fails the run, unless `onFailure: "continue"`
* stores `null` for that item.
*
* Throws a `TypeError` synchronously unless `concurrency` is an integer ≥ 1.
*
* @example
* ```ts
* import { defineWorkflow, fanOut, resultOf, sequence, step } from "@vlo/sdk";
* import { plan, work } from "./activities.ts";
*
* export default defineWorkflow("example", sequence([
*   step(plan),
*   fanOut(work, (state) => resultOf(state, plan).items.map((item) => ({ item })), { concurrency: 2 }),
* ]));
* ```
*/
function fanOut(target, select, options) {
	assertConcurrency("fanOut", options.concurrency);
	return {
		kind: "fan_out",
		key: target.name,
		activity: target,
		select,
		concurrency: options.concurrency,
		...options.onFailure !== void 0 ? { onFailure: options.onFailure } : {}
	};
}
/**
* A {@link sequence} phase that spawns one child run of `target` per item `select` returns,
* at most `concurrency` at a time, with step ids `${workflow}#${index}`.
*
* `select` has the same purity rule as {@link fanOut}. Each item is the child's start input.
* The phase stores a {@link ChildResult} per item in `results[workflow]`, in item order;
* read it with {@link fanOutRunsResultsOf}. An empty selection stores `[]` and moves on.
* A child that did not complete fails the run, unless `onFailure: "continue"` records its
* status and moves on. The child workflow must be registered on the same host.
*
* Throws a `TypeError` synchronously unless `concurrency` is an integer ≥ 1.
*
* @example
* ```ts
* import { defineWorkflow, fanOutRuns, fanOutRunsResultsOf, resultOf, sequence, step } from "@vlo/sdk";
* import { plan, summarise } from "./activities.ts";
* import { readSource } from "./read-source.workflow.ts";
*
* export default defineWorkflow("research", sequence([
*   step(plan),
*   fanOutRuns(readSource, (s) => resultOf(s, plan).sourceIds.map((sourceId) => ({ sourceId })), {
*     concurrency: 5,
*     onFailure: "continue",
*   }),
*   step(summarise, (s) => ({ read: fanOutRunsResultsOf(s, readSource).filter((r) => r.status === "succeeded").length })),
* ]));
* ```
*/
function fanOutRuns(target, select, options) {
	assertConcurrency("fanOutRuns", options.concurrency);
	return {
		kind: "fan_out_runs",
		key: nameOf(target),
		workflow: nameOf(target),
		select,
		concurrency: options.concurrency,
		...options.onFailure !== void 0 ? { onFailure: options.onFailure } : {}
	};
}
/**
* A {@link sequence} phase that parks the run until `definition` is delivered.
*
* The payload is stored in `signals[definition.name]`. With `timeoutMs` the wait races the
* kernel's paired deadline timer (the loser is cancelled): `onTimeout: "fail"` (default)
* fails the run, `"continue"` stores `null` and advances. `context` is emitted on the
* `human` channel when the wait opens. A signal or deadline arriving for a phase already
* left behind is ignored.
*
* @example
* ```ts
* import { defineWorkflow, sequence, signalOf, step, waitFor } from "@vlo/sdk";
* import { approve, finish, plan } from "./activities.ts";
*
* export default defineWorkflow("example", sequence([
*   step(plan),
*   waitFor(approve, { timeoutMs: 86_400_000, onTimeout: "fail", context: { what: "plan" } }),
*   step(finish, (state) => ({ uppers: [], approvedBy: signalOf(state, approve).by })),
* ]));
* ```
*/
function waitFor(definition, options = {}) {
	return {
		kind: "wait_for",
		key: definition.name,
		signal: definition,
		...options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {},
		...options.onTimeout !== void 0 ? { onTimeout: options.onTimeout } : {},
		...options.context !== void 0 ? { context: options.context } : {}
	};
}
/**
* A {@link sequence} phase that parks the run on a timer for `ms` milliseconds. It stores
* nothing: the phase after it receives the value of the last phase that stored one.
*
* @example
* ```ts
* import { defineWorkflow, sequence, sleep, step } from "@vlo/sdk";
* import { plan, finish } from "./activities.ts";
*
* export default defineWorkflow("example", sequence([
*   step(plan),
*   sleep(60_000),
*   step(finish, (state) => ({ uppers: [], approvedBy: "timer" })),
* ]));
* ```
*/
function sleep(ms) {
	return {
		kind: "sleep",
		ms
	};
}
/**
* Compiles an ordered list of phases into a {@link WorkflowDef} for {@link defineWorkflow}.
*
* Phases run one after another: {@link step}, {@link fanOut}, {@link fanOutRuns},
* {@link waitFor} and {@link sleep}. Outputs go to `results` keyed by activity or workflow
* name and signal payloads to `signals` keyed by signal name, so two phases on the same
* target share a key. After the last phase the run completes with `results`, or with
* `options.output(state)`. `state.usage` always holds the run's banked usage as of the
* last event. Events that do not belong to the current phase are ignored: state
* unchanged, no commands.
*
* @example
* ```ts
* import {
*   defineWorkflow, fanOut, fanOutResultsOf, resultOf, sequence, signalOf, step, waitFor,
* } from "@vlo/sdk";
* import { approve, finish, plan, work } from "./activities.ts";
*
* export default defineWorkflow("example", sequence([
*   step(plan),
*   fanOut(work, (s) => resultOf(s, plan).items.map((item) => ({ item })), { concurrency: 2 }),
*   waitFor(approve),
*   step(finish, (s) => ({
*     uppers: fanOutResultsOf(s, work).map((o) => o.upper),
*     approvedBy: signalOf(s, approve).by,
*   })),
* ], { output: (s) => ({ report: resultOf(s, finish).report, tokens: s.usage?.tokens ?? 0 }) }));
* ```
*/
function sequence(steps, options = {}) {
	return {
		init: (input) => ({
			phase: 0,
			input,
			results: {},
			signals: {}
		}),
		on: {
			started: (state, event) => enterPhase(steps, options, withUsage(state, event), 0),
			task_done: (state, event) => onTaskDone(steps, options, withUsage(state, event), event),
			child_done: (state, event) => onChildDone(steps, options, withUsage(state, event), event),
			signal: (state, event) => onSignal(steps, options, withUsage(state, event), event),
			timer: (state, event) => onTimer(steps, options, withUsage(state, event), event)
		}
	};
}
function assertConcurrency(helper, concurrency) {
	if (!Number.isInteger(concurrency) || concurrency < 1) throw new TypeError(`${helper}: concurrency must be an integer >= 1`);
}
function nameOf(target) {
	return typeof target === "string" ? target : target.name;
}
//#endregion
//#region src/core/helpers/sequence-access.ts
/**
* The output of an earlier {@link step} on `target`, typed as the activity's output.
*
* @example
* ```ts
* step(finish, (state) => ({ uppers: resultOf(state, plan).items, approvedBy: "auto" }))
* ```
*/
function resultOf(state, target) {
	return stored(state.results, target.name, "result");
}
/**
* The outputs of an earlier {@link fanOut} on `target`, in item order. An empty
* selection stored `[]`.
*
* @example
* ```ts
* step(finish, (state) => ({
*   uppers: fanOutResultsOf(state, work).map((output) => output.upper),
*   approvedBy: "auto",
* }))
* ```
*/
function fanOutResultsOf(state, target) {
	return stored(state.results, target.name, "fan-out result");
}
/**
* The outcomes of an earlier {@link fanOutRuns} on `target`, in item order: one
* {@link ChildResult} per child, whose `output` is `null` unless the child completed. An
* empty selection stored `[]`. `O` is the child workflow's completion output type.
*
* @example
* ```ts
* step(summarise, (state) => ({
*   read: fanOutRunsResultsOf<{ ok: boolean }>(state, readSource).filter((r) => r.output?.ok).length,
* }))
* ```
*/
function fanOutRunsResultsOf(state, target) {
	const name = typeof target === "string" ? target : target.name;
	return stored(state.results, name, "fan-out runs result");
}
/**
* The payload an earlier {@link waitFor} on `definition` received, typed as the signal's
* payload. After an `onTimeout: "continue"` deadline the stored value is `null`, which
* this returns as-is; narrow it yourself when that option is in play.
*
* @example
* ```ts
* step(finish, (state) => ({ uppers: [], approvedBy: signalOf(state, approve).by }))
* ```
*/
function signalOf(state, definition) {
	return stored(state.signals, definition.name, "signal");
}
function stored(store, key, what) {
	const value = store[key];
	if (value === void 0) throw new TypeError(`no ${what} for "${key}" yet: only phases earlier in the sequence have a value`);
	return value;
}
//#endregion
export { ANNOTATION_KEYWORDS, ActivityInputError, DEFAULT_LEASE_MS, DEFAULT_QUEUE, DEFAULT_RETRY, NAMED_SCHEMA_MAPS, SCHEMA_HASH_VERSION, TERMINAL_RUN_STATUSES, WorkflowFailure, activity, canonicalJson, cmd, contentHash, defineConfig, defineDomain, defineWorker, defineWorkflow, env, fanOut, fanOutResultsOf, fanOutRuns, fanOutRunsResultsOf, humanTimeoutStepId, isTerminalRunStatus, projectSchema, resultOf, sequence, sha256Hex, signal, signalOf, signalTimeoutStepId, sleep, step, waitFor, withRetryInput };
