import { WorkflowFailure, activity, cmd, signal } from "@vlo/sdk";
import { z } from "zod";
//#region src/decision.ts
/**
* `decision` — the decider is an ordinary activity whose output is a typed, journaled
* action. The tool registry fixes its output schema, so an LLM worker is
* constrained to names the loop can actually dispatch.
*/
/** Reserved tool name: the decider is finished and `final` (or the last candidate) is the answer. */
const DONE = "done";
const JSON_VALUE = z.lazy(() => z.union([
	z.null(),
	z.boolean(),
	z.number(),
	z.string(),
	z.array(JSON_VALUE),
	z.record(z.string(), JSON_VALUE)
]));
function decision(name, options) {
	const tools = Object.keys(options.tools);
	if (tools.length === 0) throw new TypeError("decision: no tools given");
	if (tools.includes("done")) throw new TypeError(`decision: "${DONE}" is a reserved tool name`);
	return activity(name, {
		input: options.input,
		output: z.object({
			tool: z.enum([...tools, DONE]),
			args: z.unknown().optional(),
			rationale: z.string().optional(),
			final: JSON_VALUE.optional()
		}),
		...options.retry !== void 0 ? { retry: options.retry } : {},
		...options.queue !== void 0 ? { queue: options.queue } : {},
		...options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {}
	});
}
//#endregion
//#region src/budget.ts
/**
* The budget: ceilings on what one run may spend, and the signal that raises them.
*
* Exhaustion parks the run rather than failing it, so the work already paid
* for survives while a human decides whether to keep going.
*/
const DEFAULT_TOPUP_SIGNAL = "agent.budget_topup";
const TOPUP_SCHEMA = z.object({
	tokens: z.number().nonnegative().optional(),
	costMicroUsd: z.number().nonnegative().optional(),
	steps: z.number().int().nonnegative().optional()
});
/** The signal a parked agent waits on. Pass the result to `agentLoop({ topup })`. */
function budgetTopup(name = DEFAULT_TOPUP_SIGNAL) {
	return signal(name, TOPUP_SCHEMA);
}
/** True once any configured ceiling is reached. Absent ceilings never bind. */
function isExhausted(budget, spent, iteration) {
	if (budget.tokens !== void 0 && spent.tokens >= budget.tokens) return true;
	if (budget.costMicroUsd !== void 0 && spent.cost_micro_usd >= budget.costMicroUsd) return true;
	if (budget.steps !== void 0 && iteration >= budget.steps) return true;
	return false;
}
/**
* Raises the ceilings a top-up names. A ceiling that was never set stays unbounded —
* granting 100 tokens to an unlimited budget must not turn it into a limit of 100.
*/
function grant(budget, topup) {
	return {
		...budget.tokens !== void 0 ? { tokens: budget.tokens + (topup.tokens ?? 0) } : {},
		...budget.costMicroUsd !== void 0 ? { costMicroUsd: budget.costMicroUsd + (topup.costMicroUsd ?? 0) } : {},
		...budget.steps !== void 0 ? { steps: budget.steps + (topup.steps ?? 0) } : {}
	};
}
//#endregion
//#region src/state.ts
const NO_USAGE = {
	cpu_ms: 0,
	tokens: 0,
	cost_micro_usd: 0
};
/** The run total the kernel banked, including the event that carries it. */
function spentOf(event) {
	return event.usage_total;
}
/** These shapes are JSON by construction; TypeScript cannot see it through optional keys. */
function asJson(value) {
	return value;
}
//#endregion
//#region src/loop.ts
/**
* `agentLoop` — decide → tool → evaluate, as a pure reducer.
*
* Nothing loops at runtime: every arrow below is one journaled event folded into state, so
* the run survives a crash mid-thought and replays deterministically. The budget is a
* reducer decision over the usage the kernel banks on each event — exhaustion parks the run
* on a top-up signal instead of failing it.
*/
const DEFAULT_MAX_ITERATIONS = 50;
const DEFAULT_MEMORY_LIMIT = 20;
/** One step id per phase per iteration, so a replay asks the kernel for the same step. */
const STEP_ID = {
	decide: (i) => `decide#${i}`,
	tool: (i) => `tool#${i}`,
	evaluate: (i) => `evaluate#${i}`,
	topup: (i) => `topup#${i}`
};
function agentLoop(options) {
	const cfg = compile(options);
	return {
		init: (goal) => ({
			phase: "decide",
			goal,
			iteration: 0,
			memory: [],
			budget: cfg.budget,
			spent: NO_USAGE
		}),
		on: {
			started: (state) => decide(cfg, state),
			task_done: (state, event) => onTaskDone(cfg, state, event),
			signal: (state, event) => onSignal(cfg, state, event)
		}
	};
}
function compile(options) {
	const tools = new Map(Object.entries(options.tools).map(([name, target]) => [name, erase(target)]));
	if (tools.size === 0) throw new TypeError("agentLoop: no tools given");
	const maxIterations = options.maxIterations ?? 50;
	const memoryLimit = options.memoryLimit ?? 20;
	if (maxIterations < 1) throw new TypeError("agentLoop: maxIterations must be >= 1");
	if (memoryLimit < 1) throw new TypeError("agentLoop: memoryLimit must be >= 1");
	return {
		decide: erase(options.decide),
		tools,
		evaluate: options.evaluate === void 0 ? void 0 : erase(options.evaluate),
		threshold: options.threshold,
		budget: options.budget,
		topup: options.topup ?? budgetTopup(),
		maxIterations,
		memoryLimit
	};
}
const erase = (target) => target;
function decide(cfg, state) {
	const at = {
		...clearPending(state),
		phase: "decide"
	};
	const input = asJson({
		goal: at.goal,
		memory: at.memory,
		candidate: at.candidate ?? null,
		score: at.score ?? null
	});
	return [at, [cmd.task(cfg.decide, input, { id: STEP_ID.decide(at.iteration) })]];
}
/**
* A result the loop is not waiting for — a duplicate delivery, or one from an iteration
* already left behind — is folded and ignored, exactly as the `sequence` helper does.
*/
function onTaskDone(cfg, state, event) {
	if (state.phase === "parked" || state.phase === "done") return [state, []];
	if (event.step_id !== STEP_ID[state.phase](state.iteration)) return [state, []];
	const at = {
		...state,
		spent: spentOf(event)
	};
	if (event.status !== "succeeded") return observeFailure(cfg, at, event);
	if (state.phase === "decide") return onDecided(cfg, at, event);
	if (state.phase === "tool") return onToolDone(cfg, at, event);
	return onEvaluated(cfg, at, event);
}
/** Agents route around failures: a task that exhausted its retries becomes an observation. */
function observeFailure(cfg, state, event) {
	return advance(cfg, remember(cfg, state, {
		tool: state.pending?.tool ?? event.activity,
		error: event.error ?? event.status
	}));
}
function onDecided(cfg, state, event) {
	const decision = readDecision(event.output ?? null);
	if (decision.tool === "done") return complete(state, decision.final ?? state.candidate ?? null, false);
	const target = cfg.tools.get(decision.tool);
	if (target === void 0) {
		const error = `unknown tool "${decision.tool}"`;
		return advance(cfg, remember(cfg, state, {
			tool: decision.tool,
			error
		}));
	}
	const parsed = target.input.safeParse(decision.args ?? null);
	if (!parsed.success) {
		const error = `invalid args: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`;
		return advance(cfg, remember(cfg, state, {
			tool: decision.tool,
			args: asJson(decision.args ?? null),
			error
		}));
	}
	const args = parsed.data;
	return [{
		...state,
		phase: "tool",
		pending: {
			tool: decision.tool,
			args
		}
	}, [cmd.task(target, args, { id: STEP_ID.tool(state.iteration) })]];
}
function onToolDone(cfg, state, event) {
	const output = event.output ?? null;
	const pending = state.pending;
	const at = {
		...remember(cfg, state, {
			tool: pending?.tool ?? event.activity,
			...pending !== void 0 ? { args: pending.args } : {},
			output
		}),
		candidate: output
	};
	if (cfg.evaluate === void 0) return advance(cfg, at);
	const input = asJson({
		goal: at.goal,
		candidate: output
	});
	return [{
		...at,
		phase: "evaluate"
	}, [cmd.task(cfg.evaluate, input, { id: STEP_ID.evaluate(state.iteration) })]];
}
function onEvaluated(cfg, state, event) {
	const score = readScore(event.output ?? null);
	const at = {
		...state,
		score,
		memory: scoreLast(state.memory, score)
	};
	if (cfg.threshold !== void 0 && score >= cfg.threshold) return complete(at, at.candidate ?? null, false);
	return advance(cfg, at);
}
function onSignal(cfg, state, event) {
	if (state.phase !== "parked" || event.name !== cfg.topup.name) return [state, []];
	const granted = cfg.topup.schema.safeParse(event.payload);
	return decide(cfg, {
		...state,
		spent: spentOf(event),
		budget: grant(state.budget, granted.success ? granted.data : {})
	});
}
/** One cycle is over: charge it against the ceilings, then decide again — or park. */
function advance(cfg, state) {
	const at = {
		...state,
		iteration: state.iteration + 1
	};
	if (at.iteration >= cfg.maxIterations) return complete(at, at.candidate ?? null, true);
	if (isExhausted(at.budget, at.spent, at.iteration)) return park(cfg, at);
	return decide(cfg, at);
}
function park(cfg, state) {
	const at = {
		...clearPending(state),
		phase: "parked"
	};
	const parked = asJson({ parked: {
		iteration: at.iteration,
		budget: at.budget,
		spent: at.spent,
		candidate: at.candidate ?? null,
		score: at.score ?? null
	} });
	return [at, [cmd.emit("agent", parked), cmd.awaitSignal(cfg.topup, { id: STEP_ID.topup(at.iteration) })]];
}
function complete(state, candidate, exhausted) {
	const result = {
		candidate,
		...state.score !== void 0 ? { score: state.score } : {},
		iterations: exhausted ? state.iteration : state.iteration + 1,
		spent: state.spent,
		...exhausted ? { exhausted: true } : {}
	};
	return [{
		...state,
		phase: "done",
		candidate
	}, [cmd.complete(asJson(result))]];
}
function remember(cfg, state, observation) {
	return {
		...state,
		memory: [...state.memory, observation].slice(-cfg.memoryLimit)
	};
}
function scoreLast(memory, score) {
	const last = memory[memory.length - 1];
	if (last === void 0) return [];
	return [...memory.slice(0, -1), {
		...last,
		score
	}];
}
/** A new decision supersedes whatever the previous one dispatched. */
function clearPending(state) {
	const next = { ...state };
	delete next.pending;
	return next;
}
function readDecision(output) {
	if (output === null || typeof output !== "object" || Array.isArray(output)) throw new WorkflowFailure("agent: decide returned no decision object", output);
	const tool = output["tool"];
	if (typeof tool !== "string") throw new WorkflowFailure("agent: decide returned no `tool`", output);
	return {
		tool,
		args: output["args"],
		rationale: typeof output["rationale"] === "string" ? output["rationale"] : void 0,
		final: output["final"]
	};
}
function readScore(output) {
	if (typeof output === "number") return output;
	if (output !== null && typeof output === "object" && !Array.isArray(output)) {
		const score = output["score"];
		if (typeof score === "number") return score;
	}
	throw new WorkflowFailure("agent: evaluate returned no numeric `score`", output);
}
//#endregion
export { DEFAULT_MAX_ITERATIONS, DEFAULT_MEMORY_LIMIT, DEFAULT_TOPUP_SIGNAL, DONE, agentLoop, budgetTopup, decision };
