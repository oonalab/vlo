import { a as withRetryInput, i as findWorker, n as mergeDomains, o as TERMINAL_RUN_STATUSES, r as defineWorker, s as isTerminalRunStatus, t as defineDomain } from "./domain-C6_UPgcw.js";
import { $ as loadKernel, A as getRunView, B as signSignalLink, C as localReporter, D as failTask, E as completeTask, F as applyEvent, G as Nondeterminism, H as BadRequest, I as foldEvent, J as RunTerminal, K as ReducerFailed, L as rebuildCheckpoint, M as readRunEvents, N as signalRun, O as heartbeatTask, P as startRun, Q as WorkflowRejected, R as DEFAULT_LINK_TTL_MS, S as verifySignature, T as handleTask, U as IllegalEvent, V as verifySignalLink, W as LeaseLost, X as Unauthorized, Y as TaskNotFound, Z as VloError, _ as ATTEMPT_HEADER, a as createHost, b as TIMESTAMP_HEADER, c as listen, d as Dispatcher, et as openJournal, f as InProcessTracker, g as normalizeBasePath, h as createRouter, i as SHUTDOWN_GRACE_MS, j as listRuns, k as cancelRun, l as DEFAULT_DRAIN_MAX_MS, m as HttpPushTransport, n as DEFAULT_PORT, nt as openBlobStore, o as handler, p as InProcessTransport, q as RunNotFound, r as DEFAULT_STREAM_POLL_MS, rt as GcsBlobStore, s as serve, t as DEFAULT_BLOB_URL, tt as JournalClosed, u as drainHost, v as SIGNATURE_HEADER, w as remoteReporter, x as signPush, y as TASK_ID_HEADER, z as linkSecret } from "./roles-BlkU0x0U.js";
import { randomBytes } from "node:crypto";
//#region src/host/worker/pull.ts
/**
* `runPullWorker` — a worker process that asks a host for work instead of being pushed to.
*
* Everything after the poll is the push path unchanged: `handleTask` runs the activity and
* `remoteReporter` calls the result back over the same three verbs. Only the delivery differs,
* which is what keeps a pull queue a deployment choice rather than a second execution model.
*/
const DEFAULT_WAIT_MS = 2e4;
const DEFAULT_CONCURRENCY = 4;
const MAX_PER_POLL = 10;
/** Backoff after a failed poll, so an unreachable host is not hammered. */
const RETRY_MS = 1e3;
/** Pause after an empty zero-wait poll. */
const IDLE_MS = 50;
/**
* Runs until `signal` aborts, then resolves once the tasks in flight have reported. Throws
* a `TypeError` when there is no queue to poll. A failed poll goes to `onError` and the loop
* retries after 1 s. Runs on the worker side; the host only needs the `api` role.
*
* @example
* ```ts
* import { defineWorker, runPullWorker } from "@vlo/sdk/host";
*
* const abort = new AbortController();
* const loop = runPullWorker({
*   baseUrl: "https://vlo.example.com",
*   token: "control-plane-token",
*   worker: defineWorker(
*     { "pull.render": (input: { clip: string }) => ({ rendered: input.clip.toUpperCase() }) },
*     { queues: ["media"] },
*   ),
*   waitMs: 5_000,
*   signal: abort.signal,
*   onError: (error) => console.error(error),
* });
* process.once("SIGTERM", () => abort.abort());
* await loop;
* ```
*/
async function runPullWorker(options) {
	const baseUrl = options.baseUrl.replace(/\/$/, "");
	const queues = options.queues ?? options.worker.queues;
	if (queues.length === 0) throw new TypeError("runPullWorker: no queues to poll");
	const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
	const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
	const workerId = options.workerId ?? `vlo-pull-${randomBytes(4).toString("hex")}`;
	const signal = options.signal;
	const fetchImpl = options.fetch ?? globalThis.fetch;
	const inFlight = /* @__PURE__ */ new Set();
	const aborted = () => signal?.aborted === true;
	let next = 0;
	while (!aborted()) {
		if (inFlight.size >= concurrency) {
			await Promise.race(inFlight);
			continue;
		}
		const queue = queues[next % queues.length];
		next += 1;
		let tasks;
		try {
			tasks = await poll(fetchImpl, {
				baseUrl,
				queue,
				workerId,
				waitMs,
				max: Math.min(concurrency - inFlight.size, MAX_PER_POLL),
				...options.token !== void 0 ? { token: options.token } : {},
				...signal !== void 0 ? { signal } : {}
			});
		} catch (error) {
			if (aborted()) break;
			options.onError?.(error);
			await sleep(RETRY_MS, signal);
			continue;
		}
		if (tasks.length === 0) {
			if (waitMs === 0) await sleep(IDLE_MS, signal);
			continue;
		}
		for (const task of tasks) {
			const reporter = remoteReporter(completeUrl(baseUrl, task), options.token, fetchImpl);
			const running = handleTask(options.worker, task, reporter, { ...signal !== void 0 ? { signal } : {} }).catch((error) => options.onError?.(error)).finally(() => inFlight.delete(running));
			inFlight.add(running);
		}
	}
	await Promise.all(inFlight);
}
async function poll(fetchImpl, a) {
	const response = await fetchImpl(`${a.baseUrl}/v1/tasks/poll`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...a.token !== void 0 ? { authorization: `Bearer ${a.token}` } : {}
		},
		body: JSON.stringify({
			queue: a.queue,
			worker_id: a.workerId,
			wait_ms: a.waitMs,
			max: a.max
		}),
		...a.signal !== void 0 ? { signal: a.signal } : {}
	});
	if (!response.ok) throw new Error(`poll ${a.queue} failed: ${response.status} ${await response.text()}`);
	return (await response.json()).tasks ?? [];
}
/** The host fills `complete_url` when it knows its own URL; otherwise we know it. */
function completeUrl(baseUrl, task) {
	return task.complete_url ?? `${baseUrl}/v1/tasks/${encodeURIComponent(task.task_id)}`;
}
function sleep(ms, signal) {
	return new Promise((resolve) => {
		const timer = setTimeout(done, ms);
		timer.unref();
		signal?.addEventListener("abort", done, { once: true });
		function done() {
			clearTimeout(timer);
			signal?.removeEventListener("abort", done);
			resolve();
		}
	});
}
//#endregion
//#region src/client/sse.ts
/** Yields one frame per blank-line-terminated block. Releases the reader when the consumer stops. */
async function* parseSse(body) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let split = buffer.indexOf("\n\n");
			while (split !== -1) {
				const frame = parseFrame(buffer.slice(0, split));
				buffer = buffer.slice(split + 2);
				if (frame !== null) yield frame;
				split = buffer.indexOf("\n\n");
			}
		}
	} finally {
		reader.releaseLock();
	}
}
function parseFrame(block) {
	const frame = { data: "" };
	const data = [];
	for (const raw of block.split("\n")) {
		const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
		if (line.length === 0 || line.startsWith(":")) continue;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
		if (field === "id") frame.id = value;
		else if (field === "event") frame.event = value;
		else if (field === "data") data.push(value);
	}
	if (data.length === 0 && frame.event === void 0) return null;
	frame.data = data.join("\n");
	return frame;
}
//#endregion
//#region src/client/index.ts
const IN_PROCESS_BASE = "http://vlo.localhost";
const POLL_MS = 50;
const DEFAULT_MAX_CHAIN = 50;
/**
* Builds a {@link Client}. With no options it talks to `http://vlo.localhost` over
* `globalThis.fetch`, which is only useful together with `fetch: host.fetch`.
*
* @example
* ```ts
* import { createClient } from "@vlo/sdk/host";
*
* const client = createClient({ baseUrl: "http://127.0.0.1:4100", token: "control-plane-token" });
* const run = await client.start(pipeline, { clip: "reel" });
* await client.signal(run.run_id, "approve", { by: "me" });
* const done = await client.waitFor(run.run_id, "completed");
* console.log(done.output);
* ```
*/
function createClient(options = {}) {
	const base = (options.baseUrl ?? IN_PROCESS_BASE).replace(/\/$/, "");
	const call = options.fetch ?? ((request) => globalThis.fetch(request));
	async function send(method, path, body) {
		const init = {
			method,
			headers: {
				...body !== void 0 ? { "content-type": "application/json" } : {},
				...options.token !== void 0 ? { authorization: `Bearer ${options.token}` } : {}
			},
			...body !== void 0 ? { body: JSON.stringify(body) } : {}
		};
		const response = await call(new Request(`${base}${path}`, init));
		return {
			response,
			text: await response.text()
		};
	}
	async function request(method, path, body) {
		const { response, text } = await send(method, path, body);
		if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text}`);
		return text.length > 0 ? JSON.parse(text) : null;
	}
	const runPath = (runId) => `/v1/runs/${encodeURIComponent(runId)}`;
	const nameOf = (name) => typeof name === "string" ? name : name.name;
	const client = {
		async start(workflow, input, startOptions) {
			const { run_id } = await request("POST", "/v1/runs", {
				workflow: typeof workflow === "string" ? workflow : workflow.name,
				input,
				...startOptions?.runId !== void 0 ? { run_id: startOptions.runId } : {},
				...startOptions?.search !== void 0 ? { search: startOptions.search } : {}
			});
			return client.get(run_id);
		},
		signal(runId, name, payload) {
			return request("POST", `${runPath(runId)}/signals/${encodeURIComponent(nameOf(name))}`, payload);
		},
		signalLink(runId, name, linkOptions = {}) {
			return request("POST", `${runPath(runId)}/links/${encodeURIComponent(nameOf(name))}`, linkOptions.expiresInMs !== void 0 ? { expires_in_ms: linkOptions.expiresInMs } : {});
		},
		async startFresh(workflow, input, freshOptions) {
			const maxChain = freshOptions.maxChain ?? DEFAULT_MAX_CHAIN;
			for (let n = 1; n <= maxChain; n += 1) {
				const runId = n === 1 ? freshOptions.runId : `${freshOptions.runId}_${String(n)}`;
				const existing = await client.find(runId);
				if (existing === null) return {
					run: await client.start(workflow, input, {
						runId,
						...freshOptions.search !== void 0 ? { search: freshOptions.search } : {}
					}),
					joined: false
				};
				if (!isTerminalRunStatus(existing.status)) return {
					run: existing,
					joined: true
				};
			}
			throw new Error(`startFresh: ${String(maxChain)} runs under "${freshOptions.runId}" have ended; raise maxChain`);
		},
		get: (runId) => request("GET", runPath(runId)),
		async find(runId) {
			const { response, text } = await send("GET", runPath(runId));
			if (response.status === 404) return null;
			if (!response.ok) throw new Error(`GET ${runPath(runId)} → ${response.status} ${text}`);
			return JSON.parse(text);
		},
		events: (runId, since = 0) => request("GET", `${runPath(runId)}/events?since=${since}`),
		stream(runId, streamOptions = {}) {
			return streamRun(call, {
				url: `${base}${runPath(runId)}/events?stream=1&since=${streamOptions.since ?? 0}`,
				...options.token !== void 0 ? { token: options.token } : {},
				...streamOptions.signal !== void 0 ? { signal: streamOptions.signal } : {}
			});
		},
		cancel: (runId) => request("POST", `${runPath(runId)}/cancel`, {}),
		list(query = {}) {
			const search = new URLSearchParams();
			if (query.status !== void 0) search.set("status", query.status);
			if (query.workflow !== void 0) search.set("workflow", query.workflow);
			if (query.limit !== void 0) search.set("limit", String(query.limit));
			return request("GET", `/v1/runs${search.size > 0 ? `?${search.toString()}` : ""}`);
		},
		async waitFor(runId, status, timeoutMs = 1e4) {
			const wanted = new Set(Array.isArray(status) ? status : [status]);
			const deadline = Date.now() + timeoutMs;
			for (;;) {
				const view = await client.get(runId);
				if (wanted.has(view.status)) return view;
				if (Date.now() >= deadline) throw new Error(`run ${runId} is ${view.status} after ${timeoutMs}ms, waiting for ${[...wanted].join("|")}`);
				await new Promise((resolve) => setTimeout(resolve, POLL_MS));
			}
		}
	};
	return client;
}
async function* streamRun(call, o) {
	const response = await call(new Request(o.url, {
		headers: {
			accept: "text/event-stream",
			...o.token !== void 0 ? { authorization: `Bearer ${o.token}` } : {}
		},
		...o.signal !== void 0 ? { signal: o.signal } : {}
	}));
	if (!response.ok || response.body === null) throw new Error(`GET ${o.url} → ${response.status} ${await response.text()}`);
	for await (const frame of parseSse(response.body)) {
		const message = decode(frame.event, frame.data, frame.id);
		if (message !== null) yield message;
		if (message?.type === "end") return;
	}
}
function decode(event, data, id) {
	switch (event) {
		case "journal": return {
			type: "journal",
			seq: Number(id ?? 0),
			data: JSON.parse(data)
		};
		case "emit": return {
			type: "emit",
			data: JSON.parse(data)
		};
		case "end": return {
			type: "end",
			data: JSON.parse(data)
		};
		default: return null;
	}
}
//#endregion
export { ATTEMPT_HEADER, BadRequest, DEFAULT_BLOB_URL, DEFAULT_DRAIN_MAX_MS, DEFAULT_LINK_TTL_MS, DEFAULT_PORT, DEFAULT_STREAM_POLL_MS, Dispatcher, GcsBlobStore, HttpPushTransport, IllegalEvent, InProcessTracker, InProcessTransport, JournalClosed, LeaseLost, Nondeterminism, ReducerFailed, RunNotFound, RunTerminal, SHUTDOWN_GRACE_MS, SIGNATURE_HEADER, TASK_ID_HEADER, TERMINAL_RUN_STATUSES, TIMESTAMP_HEADER, TaskNotFound, Unauthorized, VloError, WorkflowRejected, applyEvent, cancelRun, completeTask, createClient, createHost, createRouter, defineDomain, defineWorker, drainHost, failTask, findWorker, foldEvent, getRunView, handleTask, handler, heartbeatTask, isTerminalRunStatus, linkSecret, listRuns, listen, loadKernel, localReporter, mergeDomains, normalizeBasePath, openBlobStore, openJournal, readRunEvents, rebuildCheckpoint, remoteReporter, runPullWorker, serve, signPush, signSignalLink, signalRun, startRun, verifySignalLink, verifySignature, withRetryInput };
