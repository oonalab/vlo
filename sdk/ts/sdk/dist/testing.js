import { afterEach, beforeEach, describe, expect, it } from "vitest";
//#region src/journal/fixtures.ts
/**
* A {@link Clock} that starts at `startMs` and only moves when `advance` is called, so
* leases, timers and timeouts expire exactly when a test says so.
*
* @example
* ```ts
* import { fakeClock } from "@vlo/sdk/testing";
*
* const clock = fakeClock(1_700_000_000_000);
* const host = createHost({
*   journal: "sqlite://:memory:",
*   workflows: [workflow],
*   now: clock.now,
*   dispatcher: { tickMs: 10 },
* });
* await host.start();
* clock.advance(60_001); // one whole default lease and a millisecond
* ```
*/
function fakeClock(startMs) {
	let current = startMs;
	return {
		now: () => current,
		advance: (ms) => {
			current += ms;
		}
	};
}
const T0 = 17e11;
const RETRY = {
	max_attempts: 3,
	backoff: "exponential",
	initial_ms: 1e3,
	max_ms: 6e4,
	factor: 2,
	jitter: "full"
};
let counter = 0;
const nextRunId = () => `run-${++counter}-${Math.random().toString(36).slice(2, 8)}`;
function newRun(runId, workflow = "example") {
	return {
		run_id: runId,
		workflow,
		component_digest: "digest-1",
		status: "created"
	};
}
function event(runId, seq) {
	return {
		run_id: runId,
		seq,
		step_id: `step-${seq}`,
		attempt: 1,
		kind: "marker",
		status: "succeeded",
		ts_ms: T0 + seq,
		random: "0".repeat(32),
		state_hash: `hash-${seq}`
	};
}
function newTask(runId, stepId, attempt = 1, queue = "default", timeoutMs) {
	return {
		task_id: `${runId}:${stepId}`,
		step_id: stepId,
		attempt,
		activity: "echo",
		queue,
		input: { stepId },
		idempotency_key: `${runId}:${stepId}:${attempt}`,
		retry: RETRY,
		lease_ttl_ms: 3e4,
		...timeoutMs !== void 0 ? { timeout_ms: timeoutMs } : {}
	};
}
/** A minimal well-formed write-set carrying one event at `seq`. */
function transitionAt(runId, seq, parts = {}) {
	const status = parts.status ?? "running";
	return {
		run: {
			status,
			last_seq: seq
		},
		kernel_state: {
			v: 1,
			status,
			step_no: seq,
			steps: {},
			closed_steps: 0,
			usage_total: {
				cpu_ms: 0,
				tokens: 0,
				cost_micro_usd: 0
			}
		},
		state: JSON.stringify({ seq }),
		state_hash: `hash-${seq}`,
		state_inline: true,
		events: [event(runId, seq)],
		tasks: parts.tasks ?? [],
		task_updates: parts.task_updates ?? [],
		timers: parts.timers ?? [],
		spawns: [],
		signal_waits: parts.signal_waits ?? [],
		emits: [],
		...parts.continue_as_new !== void 0 ? { continue_as_new: parts.continue_as_new } : {}
	};
}
//#endregion
//#region src/journal/conformance-claims.ts
/**
* The claim half of the conformance suite: the promises the outbox dispatcher relies on.
*
* Every claim is the same bargain — concurrent claimers get disjoint sets, a claimed row is
* invisible until its hold lapses, and the terminal mark hides it for good. Tasks, timers and
* closed child runs each keep it with their own column.
*/
function claimCases(suite) {
	it("hands concurrent dispatchers disjoint task claims", async () => {
		const journal = suite.journal();
		const runId = await suite.seedTasks(4);
		const clock = fakeClock(1700000001e3);
		const claim = () => journal.transaction((tx) => tx.claimUndispatchedTasks(clock.now(), 4, 3e4));
		const [first, second] = await Promise.all([claim(), claim()]);
		const mine = [...first, ...second].filter((t) => t.run_id === runId);
		const claimed = mine.map((t) => t.task_id);
		expect(claimed).toHaveLength(4);
		expect(new Set(claimed).size).toBe(4);
		expect(mine.every((t) => t.dispatch_attempts === 1)).toBe(true);
		clock.advance(1);
		const again = await journal.transaction((tx) => tx.claimUndispatchedTasks(clock.now(), 4, 3e4));
		expect(again.filter((t) => t.run_id === runId)).toHaveLength(0);
	});
	it("claims one queue, or every queue but the excluded ones", async () => {
		const journal = suite.journal();
		const runId = await suite.seed();
		await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 1, { tasks: [
			newTask(runId, "d0", 1, "default"),
			newTask(runId, "m0", 1, "media"),
			newTask(runId, "m1", 1, "media")
		] }), { nowMs: T0 }));
		const claim = (nowMs, filter) => journal.transaction((tx) => tx.claimUndispatchedTasks(nowMs, 10, 0, filter)).then((rows) => rows.filter((r) => r.run_id === runId).map((r) => r.step_id).sort());
		expect(await claim(1700000000001, { queue: "media" })).toEqual(["m0", "m1"]);
		expect(await claim(1700000000002, { excludeQueues: ["media"] })).toEqual(["d0"]);
		expect(await claim(1700000000003, { excludeQueues: ["media", "default"] })).toEqual([]);
		expect(await claim(1700000000004, {
			queue: "media",
			excludeQueues: ["media"]
		})).toEqual([]);
		expect(await claim(1700000000005)).toEqual([
			"d0",
			"m0",
			"m1"
		]);
	});
	it("returns due timers in fire order and claims them once", async () => {
		const journal = suite.journal();
		const runId = await suite.seed();
		await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 1, { timers: [
			{
				step_id: "late",
				fire_at_ms: 1700000000300
			},
			{
				step_id: "early",
				fire_at_ms: 1700000000100
			},
			{
				step_id: "middle",
				fire_at_ms: 1700000000200
			},
			{
				step_id: "future",
				fire_at_ms: 1700000009e3
			}
		] }), { nowMs: T0 }));
		const due = await journal.dueTimers(1700000000350, 2);
		expect(due.map((t) => t.step_id)).toEqual(["early", "middle"]);
		const steps = async (limit) => {
			return (await journal.transaction((tx) => tx.claimDueTimers(1700000000350, limit, 6e4))).filter((t) => t.run_id === runId).map((t) => t.step_id).sort();
		};
		expect(await steps(2)).toEqual(["early", "middle"]);
		expect(await steps(10)).toEqual(["late"]);
		expect(await steps(10)).toEqual([]);
	});
	it("walks the run outbox: created runs, then closed children", async () => {
		const journal = suite.journal();
		const parent = await suite.seed();
		const children = [nextRunId(), nextRunId()].sort();
		await journal.transaction((tx) => tx.applyTransition(parent, transitionAt(parent, 1), {
			nowMs: T0,
			childRuns: children.map((runId, i) => ({
				...newRun(runId),
				parent_run_id: parent,
				parent_step_id: `spawn-${i}`
			}))
		}));
		const created = await journal.transaction((tx) => tx.claimCreatedRuns(T0, 50, 3e4));
		expect(created.map((r) => r.run_id)).toEqual(expect.arrayContaining(children));
		const heldBack = await journal.transaction((tx) => tx.claimCreatedRuns(1700000000001, 50, 3e4));
		expect(heldBack.map((r) => r.run_id)).not.toEqual(expect.arrayContaining(children));
		for (const childId of children) await journal.transaction((tx) => tx.applyTransition(childId, {
			...transitionAt(childId, 1),
			run: {
				status: "completed",
				last_seq: 1
			},
			completion: {
				status: "completed",
				output: { ok: true }
			}
		}, { nowMs: 1700000000100 }));
		const claim = (nowMs) => journal.transaction((tx) => tx.claimClosedUnnotified(nowMs, 50, 3e4));
		const [first, second] = await Promise.all([claim(1700000000200), claim(1700000000200)]);
		expect([...first, ...second].map((r) => r.run_id).sort()).toEqual(children);
		expect(await claim(1700000000300)).toHaveLength(0);
		const afterHold = await claim(1700000030201);
		expect(afterHold.map((r) => r.run_id).sort()).toEqual(children);
		for (const childId of children) await journal.transaction((tx) => tx.markParentNotified(childId, 1700000000300));
		expect(await claim(17000001e5)).toHaveLength(0);
		const child = await journal.getRun(children[0]);
		expect(child?.output).toBe("{\"ok\":true}");
		expect(child?.closed_at_ms).toBe(1700000000100);
		expect(child?.parent_notified_at_ms).toBe(1700000000300);
	});
}
//#endregion
//#region src/journal/conformance.ts
/**
* The journal conformance suite.
*
* Every `Journal` implementation must pass it unchanged: these are the
* durability promises the host builds on — gap-free sequencing, all-or-nothing
* transitions, disjoint outbox claims, deduped timers and buffered signals.
* The suite is kernel-independent; hashes here are opaque strings.
*
* The outbox claims live in `conformance-claims.ts`, run from the same block.
*/
/**
* Registers the journal conformance suite as a vitest `describe` block named `name`.
*
* `open` is called before every case and must return a fresh, empty journal; the suite
* runs `migrate()` on it and `close()`s it afterwards. The cases check the durability
* promises the host relies on: gap-free `seq` under concurrent transactions, all-or-nothing
* transitions, stale-attempt and terminal-task rejection, lease and timeout reaping,
* once-only timers, schema upserts, signal buffering, run queries and idempotent migration.
* Call it from a test file, not from application code.
*
* @example
* ```ts
* import { openJournal } from "@vlo/sdk/host";
* import { journalConformance } from "@vlo/sdk/testing";
*
* let index = 0;
* journalConformance("sqlite journal", async () =>
*   openJournal(`sqlite://./.vlo/conformance-${++index}.db`),
* );
* ```
*/
function journalConformance(name, open) {
	describe(name, () => {
		let journal;
		beforeEach(async () => {
			journal = await open();
			await journal.migrate();
		});
		afterEach(async () => {
			await journal.close();
		});
		const seed = async (workflow) => {
			const runId = nextRunId();
			await journal.transaction((tx) => tx.createRun(newRun(runId, workflow), T0));
			return runId;
		};
		/** Seeds a run with `count` scheduled tasks and returns the run id. */
		const seedTasks = async (count) => {
			const runId = await seed();
			const tasks = Array.from({ length: count }, (_, i) => newTask(runId, `s${i}`));
			await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 1, { tasks }), { nowMs: T0 }));
			return runId;
		};
		claimCases({
			journal: () => journal,
			seed,
			seedTasks
		});
		it("appends gap-free, strictly increasing seq under concurrent transactions", async () => {
			const runId = await seed();
			const appends = Array.from({ length: 50 }, () => journal.transaction(async (tx) => {
				const seq = ((await tx.lockRun(runId))?.last_seq ?? 0) + 1;
				await tx.applyTransition(runId, transitionAt(runId, seq), { nowMs: T0 + seq });
			}));
			await Promise.all(appends);
			const events = await journal.readEvents(runId);
			expect(events.map((e) => e.seq)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
			expect((await journal.getRun(runId))?.last_seq).toBe(50);
			expect((await journal.getState(runId))?.seq).toBe(50);
			expect(await journal.readEvents(runId, 48)).toHaveLength(2);
		});
		it("rolls a transition back when the transaction fails", async () => {
			const runId = await seed();
			await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 1), { nowMs: T0 }));
			await expect(journal.transaction(async (tx) => {
				await tx.applyTransition(runId, transitionAt(runId, 2, { tasks: [newTask(runId, "s0")] }), { nowMs: T0 });
				throw new Error("boom");
			})).rejects.toThrow("boom");
			expect(await journal.readEvents(runId)).toHaveLength(1);
			expect((await journal.getRun(runId))?.last_seq).toBe(1);
			expect(await journal.listTasks(runId)).toHaveLength(0);
			await expect(journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 1), { nowMs: T0 }))).rejects.toThrow();
			expect(await journal.readEvents(runId)).toHaveLength(1);
		});
		it("refuses markDispatched on a stale attempt", async () => {
			const taskId = `${await seedTasks(1)}:s0`;
			const now = 1700000001e3;
			expect(await journal.transaction((tx) => tx.markDispatched(taskId, 2, now, 1700000031e3))).toBe(false);
			expect(await journal.transaction((tx) => tx.markDispatched(taskId, 1, now, 1700000031e3, "w1"))).toBe(true);
			expect(await journal.transaction((tx) => tx.markDispatched(taskId, 1, now, 1700000031e3))).toBe(false);
			const task = await journal.getTask(taskId);
			expect(task?.status).toBe("running");
			expect(task?.worker_id).toBe("w1");
			expect(task?.lease_until_ms).toBe(1700000031e3);
			const expired = await journal.expiredLeases(1700000061e3, 10);
			expect(expired.map((t) => t.task_id)).toContain(taskId);
		});
		it("finds running attempts past their timeout, and only those", async () => {
			const runId = await seed();
			await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 1, { tasks: [newTask(runId, "bounded", 1, "default", 5e3), newTask(runId, "unbounded", 1, "default")] }), { nowMs: T0 }));
			const bounded = `${runId}:bounded`;
			const due = (nowMs) => journal.expiredTimeouts(nowMs, 10).then((rows) => rows.filter((r) => r.run_id === runId).map((r) => r.task_id));
			expect(await due(1700001e6)).toEqual([]);
			await journal.transaction((tx) => tx.markDispatched(bounded, 1, T0, 170000003e4, "w1"));
			await journal.transaction((tx) => tx.markDispatched(`${runId}:unbounded`, 1, T0, 170000003e4, "w1"));
			expect(await due(1700000004999)).toEqual([]);
			expect(await due(1700000005001)).toEqual([bounded]);
			await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 2, { task_updates: [{
				task_id: bounded,
				attempt: 1,
				status: "succeeded"
			}] }), { nowMs: 1700000006e3 }));
			expect(await due(17000001e5)).toEqual([]);
		});
		it("stops heartbeats once the task is terminal", async () => {
			const runId = await seedTasks(1);
			const taskId = `${runId}:s0`;
			const now = 1700000001e3;
			await journal.transaction((tx) => tx.markDispatched(taskId, 1, now, 1700000031e3));
			expect(await journal.transaction((tx) => tx.heartbeat(taskId, 1, 1700000061e3, now))).toBe(true);
			await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 2, { task_updates: [{
				task_id: taskId,
				attempt: 1,
				status: "succeeded"
			}] }), { nowMs: now }));
			expect(await journal.transaction((tx) => tx.heartbeat(taskId, 1, 1700000091e3, now))).toBe(false);
			const task = await journal.getTask(taskId);
			expect(task?.status).toBe("succeeded");
			expect(task?.lease_until_ms).toBeUndefined();
		});
		it("clears dispatch and lease state when a task is rescheduled", async () => {
			const runId = await seedTasks(1);
			const taskId = `${runId}:s0`;
			const now = 1700000001e3;
			await journal.transaction((tx) => tx.markDispatched(taskId, 1, now, 1700000031e3, "w1"));
			await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 2, { task_updates: [{
				task_id: taskId,
				attempt: 2,
				status: "scheduled",
				not_before_ms: 1700000006e3
			}] }), { nowMs: now }));
			const task = await journal.getTask(taskId);
			expect(task?.status).toBe("scheduled");
			expect(task?.attempt).toBe(2);
			expect(task?.not_before_ms).toBe(1700000006e3);
			expect(task?.dispatched_at_ms).toBeUndefined();
			expect(task?.lease_until_ms).toBeUndefined();
			expect(task?.worker_id).toBeUndefined();
			const tooEarly = await journal.transaction((tx) => tx.claimUndispatchedTasks(1700000002e3, 10, 3e4));
			expect(tooEarly.map((t) => t.task_id)).not.toContain(taskId);
			const dueNow = await journal.transaction((tx) => tx.claimUndispatchedTasks(1700000006e3, 10, 3e4));
			expect(dueNow.map((t) => t.task_id)).toContain(taskId);
		});
		it("fires each timer once", async () => {
			const runId = await seed();
			await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 1, { timers: [{
				step_id: "t1",
				fire_at_ms: 1700000000100
			}] }), { nowMs: T0 }));
			expect(await journal.transaction((tx) => tx.markTimerFired(runId, "t1", 1700000000100))).toBe(true);
			expect(await journal.transaction((tx) => tx.markTimerFired(runId, "t1", 1700000000200))).toBe(false);
			expect(await journal.dueTimers(1700000001e3, 10)).toHaveLength(0);
		});
		it("stores and reads activity schemas", async () => {
			await journal.transaction((tx) => tx.upsertSchema({
				name: "echo",
				version: "v1",
				json_schema: "{\"type\":\"object\"}"
			}, T0));
			await journal.transaction((tx) => tx.upsertSchema({
				name: "echo",
				version: "v1",
				json_schema: "{\"type\":\"string\"}",
				retry_policy: "{}"
			}, 1700000000001));
			const stored = await journal.transaction((tx) => tx.getSchema("echo", "v1"));
			expect(stored?.json_schema).toBe("{\"type\":\"string\"}");
			expect(stored?.retry_policy).toBe("{}");
			expect(await journal.transaction((tx) => tx.getSchema("echo", "v2"))).toBeNull();
		});
		it("buffers signals that arrive before the wait and delivers the oldest first", async () => {
			const runId = await seed();
			await journal.transaction(async (tx) => {
				await tx.putSignal({
					signal_id: "sig-a",
					run_id: runId,
					name: "approve"
				}, 1700000000010);
				await tx.putSignal({
					signal_id: "sig-b",
					run_id: runId,
					name: "approve",
					payload: "{\"ok\":true}"
				}, 1700000000020);
				await tx.putSignal({
					signal_id: "sig-c",
					run_id: runId,
					name: "other"
				}, 1700000000030);
			});
			await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 1, { signal_waits: [{
				step_id: "w1",
				name: "approve"
			}] }), { nowMs: 1700000000040 }));
			await journal.transaction(async (tx) => {
				expect((await tx.getSignalWaits(runId)).map((w) => w.step_id)).toEqual(["w1"]);
				const first = await tx.takeSignal(runId, "approve");
				expect(first?.signal_id).toBe("sig-a");
				expect((await tx.takeSignal(runId, "approve"))?.signal_id).toBe("sig-a");
				await tx.markSignalDelivered("sig-a", "w1", 1700000000050);
				const second = await tx.takeSignal(runId, "approve");
				expect(second?.signal_id).toBe("sig-b");
				expect(second?.payload).toBe("{\"ok\":true}");
				await tx.removeSignalWait(runId, "w1");
				expect(await tx.getSignalWaits(runId)).toHaveLength(0);
			});
		});
		it("filters queries by status and workflow", async () => {
			const running = await seed("alpha");
			await journal.transaction((tx) => tx.applyTransition(running, transitionAt(running, 1), { nowMs: T0 }));
			const created = await seed("alpha");
			await seed("beta");
			const byStatus = await journal.query({
				status: "created",
				workflow: "alpha"
			});
			expect(byStatus.map((r) => r.run_id)).toEqual([created]);
			const byWorkflow = await journal.query({ workflow: "alpha" });
			expect(byWorkflow.map((r) => r.run_id).sort()).toEqual([created, running].sort());
			expect(await journal.query({
				workflow: "alpha",
				limit: 1
			})).toHaveLength(1);
			expect(await journal.query({ namespace: "nowhere" })).toHaveLength(0);
		});
		it("creates runs idempotently", async () => {
			const runId = nextRunId();
			await journal.transaction(async (tx) => {
				await tx.createRun(newRun(runId, "alpha"), T0);
				await tx.createRun({
					...newRun(runId, "beta"),
					input: "{\"n\":1}"
				}, 1700000000001);
			});
			const run = await journal.getRun(runId);
			expect(run?.workflow).toBe("alpha");
			expect(run?.input).toBeUndefined();
			expect(run?.status).toBe("created");
			expect(run?.namespace).toBe("default");
		});
		it("links a continued run to the successor inserted in the same transition", async () => {
			const runId = await seed("alpha");
			const successorId = `${runId}-next`;
			await journal.transaction((tx) => tx.applyTransition(runId, transitionAt(runId, 1, {
				status: "continued",
				continue_as_new: { input: { n: 2 } }
			}), {
				nowMs: T0,
				successorRun: {
					...newRun(successorId, "alpha"),
					continued_from: runId,
					input: "{\"n\":2}"
				}
			}));
			const original = await journal.getRun(runId);
			expect(original?.status).toBe("continued");
			expect(original?.continued_to).toBe(successorId);
			expect(original?.closed_at_ms).toBe(T0);
			const successor = await journal.getRun(successorId);
			expect(successor?.status).toBe("created");
			expect(successor?.continued_from).toBe(runId);
			expect(successor?.input).toBe("{\"n\":2}");
			const claimed = await journal.transaction((tx) => tx.claimCreatedRuns(T0, 10, 1e3));
			expect(claimed.map((r) => r.run_id)).toContain(successorId);
		});
		it("migrates twice without effect", async () => {
			const runId = await seed();
			await journal.migrate();
			await journal.migrate();
			expect(await journal.getRun(runId)).not.toBeNull();
		});
	});
}
//#endregion
export { fakeClock, journalConformance };
