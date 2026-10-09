import { z } from "zod";
import { createHash } from "node:crypto";
/**
* Deterministic JSON: object keys sorted recursively, arrays in order, no whitespace.
* Throws on anything JSON cannot represent losslessly (undefined, NaN, Infinity, bigint,
* function, symbol) rather than silently dropping it, because a dropped field would make
* two different schemas hash the same.
*/
function canonicalJson(value) {
	switch (typeof value) {
		case "string": return JSON.stringify(value);
		case "boolean": return value ? "true" : "false";
		case "number":
			if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: non-finite number (${String(value)})`);
			return JSON.stringify(value);
		case "object": {
			if (value === null) return "null";
			if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
			const record = value;
			return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
		}
		default: throw new TypeError(`canonicalJson: unsupported value of type ${typeof value}`);
	}
}
/** Full SHA-256 of `data` as 64 lowercase hex characters; strings are hashed as UTF-8. */
function sha256Hex(data) {
	return createHash("sha256").update(data).digest("hex");
}
/** SHA-256 of the canonical encoding, truncated to `HASH_CHARS`. */
function contentHash(value) {
	return sha256Hex(canonicalJson(value)).slice(0, 16);
}
//#endregion
//#region src/core/schema-projection.ts
/** Version tag folded into every activity and signal hash. Bump when the projection changes. */
const SCHEMA_HASH_VERSION = 1;
/** Keywords removed from every schema object before hashing, at any depth. */
const ANNOTATION_KEYWORDS = [
	"$schema",
	"$id",
	"$comment",
	"title",
	"description",
	"examples",
	"default",
	"deprecated",
	"readOnly",
	"writeOnly"
];
/**
* Keywords whose value is a map from a user-chosen name to a schema. The names are opaque
* (a property may be called `default`), only the values are schemas.
*/
const NAMED_SCHEMA_MAPS = [
	"properties",
	"patternProperties",
	"dependentSchemas",
	"$defs",
	"definitions"
];
const STRIPPED = new Set(ANNOTATION_KEYWORDS);
const NAMED_MAPS = new Set(NAMED_SCHEMA_MAPS);
/**
* Returns a copy of `schema` with every annotation keyword removed from every schema
* object in it. Arrays are walked (`anyOf`, `prefixItems`, …) in order; the entries of a
* name-keyed map (`properties`, `$defs`, …) keep their names and have their values
* projected; scalars pass through. The input is never mutated.
*/
function projectSchema(schema) {
	if (Array.isArray(schema)) return schema.map(projectSchema);
	if (schema === null || typeof schema !== "object") return schema;
	const projected = {};
	for (const [key, value] of Object.entries(schema)) {
		if (STRIPPED.has(key)) continue;
		projected[key] = NAMED_MAPS.has(key) ? projectNamedMap(value) : projectSchema(value);
	}
	return projected;
}
function projectNamedMap(map) {
	if (map === null || typeof map !== "object" || Array.isArray(map)) return map;
	const projected = {};
	for (const [name, schema] of Object.entries(map)) projected[name] = projectSchema(schema);
	return projected;
}
//#endregion
//#region src/core/activity.ts
/**
* Activity and signal definitions: a name, Zod schemas, a retry policy, and a content hash
* derived from all three. The hash is the version: `name@hash` is the `schema_ref` carried
* on every event, so a run can span a schema upgrade.
*/
/**
* Retry policy an activity gets when {@link ActivityOptions.retry} is omitted: three
* attempts, exponential backoff from 1 s to a 10 min cap, factor 2, full jitter. Each
* field is also the fallback for any {@link RetryOptions} field left unset.
*/
const DEFAULT_RETRY = {
	max_attempts: 3,
	backoff: "exponential",
	initial_ms: 1e3,
	max_ms: 6e5,
	factor: 2,
	jitter: "full"
};
/**
* Queue an activity is dispatched on when {@link ActivityOptions.queue} is omitted, and the
* queue a worker serves when {@link WorkerOptions.queues} is omitted.
*/
const DEFAULT_QUEUE = "default";
/** Lease a worker holds before it must heartbeat. Long tasks heartbeat, they do not raise this. */
const DEFAULT_LEASE_MS = 6e4;
function toRetryPolicy(options) {
	const o = options ?? {};
	return {
		max_attempts: o.maxAttempts ?? DEFAULT_RETRY.max_attempts,
		backoff: o.backoff ?? DEFAULT_RETRY.backoff,
		initial_ms: o.initialMs ?? DEFAULT_RETRY.initial_ms,
		max_ms: o.maxMs ?? DEFAULT_RETRY.max_ms,
		factor: o.factor ?? DEFAULT_RETRY.factor,
		jitter: o.jitter ?? DEFAULT_RETRY.jitter
	};
}
/**
* Defines an activity: a named unit of work a worker implements and a reducer requests
* with `cmd.task`.
*
* The content hash covers `name`, both schemas (as JSON Schema, projected by
* {@link projectSchema} so annotations such as `description` and `default` are
* hash-neutral) and the resolved retry policy, so changing any of them yields a new
* `schemaRef`; `queue`, `leaseMs` and `timeoutMs` are operational and hash-neutral. Runs
* pin the `schemaRef` per event, so old and new versions coexist.
*
* @example
* ```ts
* import { z } from "zod";
* import { activity } from "@vlo/sdk";
*
* export const work = activity("example.work", {
*   input: z.object({ item: z.string() }),
*   output: z.object({ upper: z.string() }),
*   retry: { maxAttempts: 3 },
*   queue: "default",
*   timeoutMs: 30_000,
* });
* ```
*/
function activity(name, options) {
	const retry = toRetryPolicy(options.retry);
	const jsonSchema = {
		input: toJsonSchema(options.input),
		output: toJsonSchema(options.output)
	};
	const hash = contentHash({
		v: 1,
		name,
		input: projectSchema(jsonSchema.input),
		output: projectSchema(jsonSchema.output),
		retry
	});
	return {
		kind: "activity",
		name,
		hash,
		schemaRef: `${name}@${hash}`,
		input: options.input,
		output: options.output,
		retry,
		queue: options.queue ?? "default",
		leaseMs: options.leaseMs ?? 6e4,
		...options.timeoutMs !== void 0 ? { timeoutMs: options.timeoutMs } : {},
		jsonSchema
	};
}
/**
* Defines a signal: a named, typed message a run can park on with `cmd.awaitSignal`,
* `cmd.awaitHuman` or {@link waitFor}, delivered from outside through the host's API.
*
* The content hash covers `name` and the schema as JSON Schema, projected the same way as
* an activity's. A host that has the definition registered rejects an inbound payload the
* schema does not accept.
*
* @example
* ```ts
* import { z } from "zod";
* import { signal } from "@vlo/sdk";
*
* export const approve = signal("example.approve", z.object({ by: z.string() }));
* ```
*/
function signal(name, schema) {
	const jsonSchema = toJsonSchema(schema);
	const hash = contentHash({
		v: 1,
		name,
		schema: projectSchema(jsonSchema)
	});
	return {
		kind: "signal",
		name,
		hash,
		schemaRef: `${name}@${hash}`,
		schema,
		jsonSchema
	};
}
function toJsonSchema(schema) {
	return z.toJSONSchema(schema);
}
//#endregion
//#region src/core/run-status.ts
/** The statuses a run never leaves: `completed`, `failed`, `cancelled`, `continued`. */
const TERMINAL_RUN_STATUSES = /* @__PURE__ */ new Set([
	"completed",
	"failed",
	"cancelled",
	"continued"
]);
/** True when the run accepts no further events. */
function isTerminalRunStatus(status) {
	return TERMINAL_RUN_STATUSES.has(status);
}
//#endregion
//#region src/host/worker/registry.ts
/**
* Defines a worker: a map from activity name to {@link ActivityHandler} plus the queues it
* serves. Passed to `createHost({ workers })` for in-process execution, `runPullWorker` for
* long-polling, or found by the config loader's `workers` globs.
*
* The worker holds no schemas; validation happens in the reducer (input) and on the host
* (output). Throws a `TypeError` when `impls` is empty.
*
* @example
* ```ts
* import { defineWorker } from "@vlo/sdk";
*
* export default defineWorker(
*   {
*     "example.plan": (input: { n: number }) => ({
*       items: Array.from({ length: input.n }, (_, i) => `item-${i}`),
*     }),
*     "example.work": async (input: { item: string }, ctx) => {
*       await ctx.heartbeat();
*       ctx.reportUsage({ tokens: 12 });
*       return { upper: input.item.toUpperCase() };
*     },
*   },
*   { queues: ["default"] },
* );
* ```
*/
function defineWorker(impls, options = {}) {
	const handlers = /* @__PURE__ */ new Map();
	for (const [name, handler] of Object.entries(impls)) handlers.set(name, handler);
	if (handlers.size === 0) throw new TypeError("defineWorker: no activity implementations given");
	return {
		kind: "worker",
		queues: options.queues ?? ["default"],
		handlers
	};
}
/**
* Wraps a handler so attempts after the first receive `shape(input, attempt)` instead of the
* journaled input. Use it when repeating the same ask would fail the same way — a model
* looping on a long prompt, say — and a smaller or different ask has a chance.
*
* The journaled task input is untouched; only this process's view of it changes, and
* `attempt` is journaled, so the same attempt always sees the same input. `shape` must be
* pure. The shaped input is not re-validated against the activity's input schema.
*
* @example
* ```ts
* defineWorker({
*   "brand.synthesize": withRetryInput(synthesize, (input) => ({ ...input, compact: true })),
* });
* ```
*/
function withRetryInput(handler, shape) {
	return (input, ctx) => handler(ctx.attempt > 1 ? shape(input, ctx.attempt) : input, ctx);
}
/** The first worker in this process that serves both the queue and the activity. */
function findWorker(workers, queue, activity) {
	return workers.find((w) => w.queues.includes(queue) && w.handlers.has(activity));
}
//#endregion
//#region src/host/domain.ts
/**
* Groups one area's workflows, workers, activities and signals under a name, for
* `createHost({ domains: [...] })`.
*
* @example
* ```ts
* import { defineDomain } from "@vlo/sdk";
* import { brandActivities } from "./activities.ts";
* import { brandResearch, brandWeekly } from "./workflows.ts";
* import { brandWorker } from "./worker.ts";
*
* export const brandDomain = defineDomain({
*   name: "brand",
*   workflows: [brandResearch, brandWeekly],
*   workers: [brandWorker],
*   activities: brandActivities,
* });
* ```
*/
function defineDomain(def) {
	return {
		kind: "domain",
		name: def.name,
		workflows: def.workflows ?? [],
		workers: def.workers ?? [],
		activities: def.activities ?? [],
		signals: def.signals ?? []
	};
}
/**
* Flattens `domains` onto the flat registries. Throws a `TypeError` when two domains share
* a name, or when two different workflow or activity values are registered under one name;
* the same value registered twice is fine.
*/
function mergeDomains(options) {
	const seen = /* @__PURE__ */ new Set();
	for (const domain of options.domains ?? []) {
		if (seen.has(domain.name)) throw new TypeError(`defineDomain: two domains are named "${domain.name}"`);
		seen.add(domain.name);
	}
	const domains = options.domains ?? [];
	return {
		workflows: unique("workflow", [...options.workflows ?? [], ...domains.flatMap((d) => d.workflows)]),
		workers: [.../* @__PURE__ */ new Set([...options.workers ?? [], ...domains.flatMap((d) => d.workers)])],
		activities: unique("activity", [...options.activities ?? [], ...domains.flatMap((d) => d.activities)]),
		signals: unique("signal", [...options.signals ?? [], ...domains.flatMap((d) => d.signals)])
	};
}
function unique(what, items) {
	const byName = /* @__PURE__ */ new Map();
	for (const item of items) {
		const prior = byName.get(item.name);
		if (prior !== void 0 && prior !== item) throw new TypeError(`createHost: two different ${what} definitions are named "${item.name}"`);
		byName.set(item.name, item);
	}
	return [...byName.values()];
}
//#endregion
export { canonicalJson as _, withRetryInput as a, DEFAULT_LEASE_MS as c, activity as d, signal as f, projectSchema as g, SCHEMA_HASH_VERSION as h, findWorker as i, DEFAULT_QUEUE as l, NAMED_SCHEMA_MAPS as m, mergeDomains as n, TERMINAL_RUN_STATUSES as o, ANNOTATION_KEYWORDS as p, defineWorker as r, isTerminalRunStatus as s, defineDomain as t, DEFAULT_RETRY as u, contentHash as v, sha256Hex as y };
