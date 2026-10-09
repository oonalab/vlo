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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claimCases } from "./conformance-claims.ts";
import { T0, newRun, newTask, nextRunId, transitionAt } from "./fixtures.ts";
import type { Journal } from "./types.ts";

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
export function journalConformance(name: string, open: () => Promise<Journal>): void {
  describe(name, () => {
    let journal: Journal;

    beforeEach(async () => {
      journal = await open();
      await journal.migrate();
    });

    afterEach(async () => {
      await journal.close();
    });

    const seed = async (workflow?: string): Promise<string> => {
      const runId = nextRunId();
      await journal.transaction((tx) => tx.createRun(newRun(runId, workflow), T0));
      return runId;
    };

    /** Seeds a run with `count` scheduled tasks and returns the run id. */
    const seedTasks = async (count: number): Promise<string> => {
      const runId = await seed();
      const tasks = Array.from({ length: count }, (_, i) => newTask(runId, `s${i}`));
      await journal.transaction((tx) =>
        tx.applyTransition(runId, transitionAt(runId, 1, { tasks }), { nowMs: T0 }),
      );
      return runId;
    };

    claimCases({ journal: () => journal, seed, seedTasks });

    it("appends gap-free, strictly increasing seq under concurrent transactions", async () => {
      const runId = await seed();
      const appends = Array.from({ length: 50 }, () =>
        journal.transaction(async (tx) => {
          const run = await tx.lockRun(runId);
          const seq = (run?.last_seq ?? 0) + 1;
          await tx.applyTransition(runId, transitionAt(runId, seq), { nowMs: T0 + seq });
        }),
      );
      await Promise.all(appends);

      const events = await journal.readEvents(runId);
      expect(events.map((e) => e.seq)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
      expect((await journal.getRun(runId))?.last_seq).toBe(50);
      expect((await journal.getState(runId))?.seq).toBe(50);
      expect(await journal.readEvents(runId, 48)).toHaveLength(2);
    });

    it("rolls a transition back when the transaction fails", async () => {
      const runId = await seed();
      await journal.transaction((tx) =>
        tx.applyTransition(runId, transitionAt(runId, 1), { nowMs: T0 }),
      );

      await expect(
        journal.transaction(async (tx) => {
          await tx.applyTransition(runId, transitionAt(runId, 2, { tasks: [newTask(runId, "s0")] }), {
            nowMs: T0,
          });
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      expect(await journal.readEvents(runId)).toHaveLength(1);
      expect((await journal.getRun(runId))?.last_seq).toBe(1);
      expect(await journal.listTasks(runId)).toHaveLength(0);

      // The (run_id, seq) primary key is the backstop against a double append.
      await expect(
        journal.transaction((tx) =>
          tx.applyTransition(runId, transitionAt(runId, 1), { nowMs: T0 }),
        ),
      ).rejects.toThrow();
      expect(await journal.readEvents(runId)).toHaveLength(1);
    });

    it("refuses markDispatched on a stale attempt", async () => {
      const runId = await seedTasks(1);
      const taskId = `${runId}:s0`;
      const now = T0 + 1_000;

      expect(
        await journal.transaction((tx) => tx.markDispatched(taskId, 2, now, now + 30_000)),
      ).toBe(false);
      expect(
        await journal.transaction((tx) => tx.markDispatched(taskId, 1, now, now + 30_000, "w1")),
      ).toBe(true);
      // No longer scheduled, so a second push cannot take the lease.
      expect(
        await journal.transaction((tx) => tx.markDispatched(taskId, 1, now, now + 30_000)),
      ).toBe(false);

      const task = await journal.getTask(taskId);
      expect(task?.status).toBe("running");
      expect(task?.worker_id).toBe("w1");
      expect(task?.lease_until_ms).toBe(now + 30_000);
      const expired = await journal.expiredLeases(now + 60_000, 10);
      expect(expired.map((t) => t.task_id)).toContain(taskId);
    });

    it("finds running attempts past their timeout, and only those", async () => {
      const runId = await seed();
      await journal.transaction((tx) =>
        tx.applyTransition(
          runId,
          transitionAt(runId, 1, {
            tasks: [
              newTask(runId, "bounded", 1, "default", 5_000),
              newTask(runId, "unbounded", 1, "default"),
            ],
          }),
          { nowMs: T0 },
        ),
      );
      const bounded = `${runId}:bounded`;
      const due = (nowMs: number): Promise<string[]> =>
        journal
          .expiredTimeouts(nowMs, 10)
          .then((rows) => rows.filter((r) => r.run_id === runId).map((r) => r.task_id));

      // Scheduled, not running: a task nobody has picked up yet cannot be over its budget.
      expect(await due(T0 + 1_000_000)).toEqual([]);

      await journal.transaction((tx) => tx.markDispatched(bounded, 1, T0, T0 + 30_000, "w1"));
      await journal.transaction((tx) =>
        tx.markDispatched(`${runId}:unbounded`, 1, T0, T0 + 30_000, "w1"),
      );
      expect(await due(T0 + 4_999)).toEqual([]);
      // The unbounded task stays out of the result however long it runs.
      expect(await due(T0 + 5_001)).toEqual([bounded]);

      await journal.transaction((tx) =>
        tx.applyTransition(
          runId,
          transitionAt(runId, 2, {
            task_updates: [{ task_id: bounded, attempt: 1, status: "succeeded" }],
          }),
          { nowMs: T0 + 6_000 },
        ),
      );
      expect(await due(T0 + 100_000)).toEqual([]);
    });

    it("stops heartbeats once the task is terminal", async () => {
      const runId = await seedTasks(1);
      const taskId = `${runId}:s0`;
      const now = T0 + 1_000;
      await journal.transaction((tx) => tx.markDispatched(taskId, 1, now, now + 30_000));

      expect(await journal.transaction((tx) => tx.heartbeat(taskId, 1, now + 60_000, now))).toBe(
        true,
      );
      await journal.transaction((tx) =>
        tx.applyTransition(
          runId,
          transitionAt(runId, 2, {
            task_updates: [{ task_id: taskId, attempt: 1, status: "succeeded" }],
          }),
          { nowMs: now },
        ),
      );

      expect(await journal.transaction((tx) => tx.heartbeat(taskId, 1, now + 90_000, now))).toBe(
        false,
      );
      const task = await journal.getTask(taskId);
      expect(task?.status).toBe("succeeded");
      expect(task?.lease_until_ms).toBeUndefined();
    });

    it("clears dispatch and lease state when a task is rescheduled", async () => {
      const runId = await seedTasks(1);
      const taskId = `${runId}:s0`;
      const now = T0 + 1_000;
      await journal.transaction((tx) => tx.markDispatched(taskId, 1, now, now + 30_000, "w1"));

      await journal.transaction((tx) =>
        tx.applyTransition(
          runId,
          transitionAt(runId, 2, {
            task_updates: [
              { task_id: taskId, attempt: 2, status: "scheduled", not_before_ms: now + 5_000 },
            ],
          }),
          { nowMs: now },
        ),
      );

      const task = await journal.getTask(taskId);
      expect(task?.status).toBe("scheduled");
      expect(task?.attempt).toBe(2);
      expect(task?.not_before_ms).toBe(now + 5_000);
      expect(task?.dispatched_at_ms).toBeUndefined();
      expect(task?.lease_until_ms).toBeUndefined();
      expect(task?.worker_id).toBeUndefined();

      const tooEarly = await journal.transaction((tx) =>
        tx.claimUndispatchedTasks(now + 1_000, 10, 30_000),
      );
      expect(tooEarly.map((t) => t.task_id)).not.toContain(taskId);
      const dueNow = await journal.transaction((tx) =>
        tx.claimUndispatchedTasks(now + 5_000, 10, 30_000),
      );
      expect(dueNow.map((t) => t.task_id)).toContain(taskId);
    });

    it("fires each timer once", async () => {
      const runId = await seed();
      await journal.transaction((tx) =>
        tx.applyTransition(
          runId,
          transitionAt(runId, 1, { timers: [{ step_id: "t1", fire_at_ms: T0 + 100 }] }),
          { nowMs: T0 },
        ),
      );

      expect(await journal.transaction((tx) => tx.markTimerFired(runId, "t1", T0 + 100))).toBe(
        true,
      );
      expect(await journal.transaction((tx) => tx.markTimerFired(runId, "t1", T0 + 200))).toBe(
        false,
      );
      expect(await journal.dueTimers(T0 + 1_000, 10)).toHaveLength(0);
    });

    it("stores and reads activity schemas", async () => {
      await journal.transaction((tx) =>
        tx.upsertSchema(
          { name: "echo", version: "v1", json_schema: '{"type":"object"}' },
          T0,
        ),
      );
      await journal.transaction((tx) =>
        tx.upsertSchema(
          { name: "echo", version: "v1", json_schema: '{"type":"string"}', retry_policy: "{}" },
          T0 + 1,
        ),
      );

      const stored = await journal.transaction((tx) => tx.getSchema("echo", "v1"));
      expect(stored?.json_schema).toBe('{"type":"string"}');
      expect(stored?.retry_policy).toBe("{}");
      expect(await journal.transaction((tx) => tx.getSchema("echo", "v2"))).toBeNull();
    });

    it("buffers signals that arrive before the wait and delivers the oldest first", async () => {
      const runId = await seed();
      await journal.transaction(async (tx) => {
        await tx.putSignal({ signal_id: "sig-a", run_id: runId, name: "approve" }, T0 + 10);
        await tx.putSignal(
          { signal_id: "sig-b", run_id: runId, name: "approve", payload: '{"ok":true}' },
          T0 + 20,
        );
        await tx.putSignal({ signal_id: "sig-c", run_id: runId, name: "other" }, T0 + 30);
      });

      await journal.transaction((tx) =>
        tx.applyTransition(
          runId,
          transitionAt(runId, 1, {
            signal_waits: [{ step_id: "w1", name: "approve" }],
          }),
          { nowMs: T0 + 40 },
        ),
      );

      await journal.transaction(async (tx) => {
        expect((await tx.getSignalWaits(runId)).map((w) => w.step_id)).toEqual(["w1"]);
        const first = await tx.takeSignal(runId, "approve");
        expect(first?.signal_id).toBe("sig-a");
        // takeSignal does not consume, so a failed transition can retry it.
        expect((await tx.takeSignal(runId, "approve"))?.signal_id).toBe("sig-a");

        await tx.markSignalDelivered("sig-a", "w1", T0 + 50);
        const second = await tx.takeSignal(runId, "approve");
        expect(second?.signal_id).toBe("sig-b");
        expect(second?.payload).toBe('{"ok":true}');

        await tx.removeSignalWait(runId, "w1");
        expect(await tx.getSignalWaits(runId)).toHaveLength(0);
      });
    });

    it("filters queries by status and workflow", async () => {
      const running = await seed("alpha");
      await journal.transaction((tx) =>
        tx.applyTransition(running, transitionAt(running, 1), { nowMs: T0 }),
      );
      const created = await seed("alpha");
      await seed("beta");

      const byStatus = await journal.query({ status: "created", workflow: "alpha" });
      expect(byStatus.map((r) => r.run_id)).toEqual([created]);

      const byWorkflow = await journal.query({ workflow: "alpha" });
      expect(byWorkflow.map((r) => r.run_id).sort()).toEqual([created, running].sort());
      expect(await journal.query({ workflow: "alpha", limit: 1 })).toHaveLength(1);
      expect(await journal.query({ namespace: "nowhere" })).toHaveLength(0);
    });

    it("creates runs idempotently", async () => {
      const runId = nextRunId();
      await journal.transaction(async (tx) => {
        await tx.createRun(newRun(runId, "alpha"), T0);
        await tx.createRun({ ...newRun(runId, "beta"), input: '{"n":1}' }, T0 + 1);
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
      await journal.transaction((tx) =>
        tx.applyTransition(
          runId,
          transitionAt(runId, 1, { status: "continued", continue_as_new: { input: { n: 2 } } }),
          {
            nowMs: T0,
            successorRun: { ...newRun(successorId, "alpha"), continued_from: runId, input: '{"n":2}' },
          },
        ),
      );

      const original = await journal.getRun(runId);
      expect(original?.status).toBe("continued");
      expect(original?.continued_to).toBe(successorId);
      expect(original?.closed_at_ms).toBe(T0);

      const successor = await journal.getRun(successorId);
      expect(successor?.status).toBe("created");
      expect(successor?.continued_from).toBe(runId);
      expect(successor?.input).toBe('{"n":2}');
      // The successor is an outbox row like any other `created` run.
      const claimed = await journal.transaction((tx) => tx.claimCreatedRuns(T0, 10, 1_000));
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
