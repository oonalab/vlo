/**
 * The claim half of the conformance suite: the promises the outbox dispatcher relies on.
 *
 * Every claim is the same bargain — concurrent claimers get disjoint sets, a claimed row is
 * invisible until its hold lapses, and the terminal mark hides it for good. Tasks, timers and
 * closed child runs each keep it with their own column.
 */

import { expect, it } from "vitest";
import { T0, fakeClock, newRun, newTask, nextRunId, transitionAt } from "./fixtures.ts";
import type { Journal, RunRow, TaskClaimFilter } from "./types.ts";

/** The shared state of one `journalConformance` describe block. */
export interface Suite {
  journal(): Journal;
  seed(workflow?: string): Promise<string>;
  seedTasks(count: number): Promise<string>;
}

export function claimCases(suite: Suite): void {
  it("hands concurrent dispatchers disjoint task claims", async () => {
    const journal = suite.journal();
    const runId = await suite.seedTasks(4);
    const clock = fakeClock(T0 + 1_000);
    const claim = () =>
      journal.transaction((tx) => tx.claimUndispatchedTasks(clock.now(), 4, 30_000));

    const [first, second] = await Promise.all([claim(), claim()]);
    const mine = [...first, ...second].filter((t) => t.run_id === runId);
    const claimed = mine.map((t) => t.task_id);
    expect(claimed).toHaveLength(4);
    expect(new Set(claimed).size).toBe(4);
    expect(mine.every((t) => t.dispatch_attempts === 1)).toBe(true);

    clock.advance(1);
    const again = await journal.transaction((tx) =>
      tx.claimUndispatchedTasks(clock.now(), 4, 30_000),
    );
    expect(again.filter((t) => t.run_id === runId)).toHaveLength(0);
  });

  it("claims one queue, or every queue but the excluded ones", async () => {
    const journal = suite.journal();
    const runId = await suite.seed();
    await journal.transaction((tx) =>
      tx.applyTransition(
        runId,
        transitionAt(runId, 1, {
          tasks: [
            newTask(runId, "d0", 1, "default"),
            newTask(runId, "m0", 1, "media"),
            newTask(runId, "m1", 1, "media"),
          ],
        }),
        { nowMs: T0 },
      ),
    );

    const claim = (nowMs: number, filter?: TaskClaimFilter): Promise<string[]> =>
      journal
        .transaction((tx) => tx.claimUndispatchedTasks(nowMs, 10, 0, filter))
        .then((rows) =>
          rows
            .filter((r) => r.run_id === runId)
            .map((r) => r.step_id)
            .sort(),
        );

    expect(await claim(T0 + 1, { queue: "media" })).toEqual(["m0", "m1"]);
    // A zero hold releases the claim immediately, so the same rows are claimable again.
    expect(await claim(T0 + 2, { excludeQueues: ["media"] })).toEqual(["d0"]);
    expect(await claim(T0 + 3, { excludeQueues: ["media", "default"] })).toEqual([]);
    expect(await claim(T0 + 4, { queue: "media", excludeQueues: ["media"] })).toEqual([]);
    expect(await claim(T0 + 5)).toEqual(["d0", "m0", "m1"]);
  });

  it("returns due timers in fire order and claims them once", async () => {
    const journal = suite.journal();
    const runId = await suite.seed();
    await journal.transaction((tx) =>
      tx.applyTransition(
        runId,
        transitionAt(runId, 1, {
          timers: [
            { step_id: "late", fire_at_ms: T0 + 300 },
            { step_id: "early", fire_at_ms: T0 + 100 },
            { step_id: "middle", fire_at_ms: T0 + 200 },
            { step_id: "future", fire_at_ms: T0 + 9_000 },
          ],
        }),
        { nowMs: T0 },
      ),
    );

    const due = await journal.dueTimers(T0 + 350, 2);
    expect(due.map((t) => t.step_id)).toEqual(["early", "middle"]);

    // A claim selects in fire order and honours the limit; `RETURNING` order
    // is not a promise either dialect makes, so compare as a set.
    const steps = async (limit: number): Promise<string[]> => {
      const rows = await journal.transaction((tx) => tx.claimDueTimers(T0 + 350, limit, 60_000));
      return rows
        .filter((t) => t.run_id === runId)
        .map((t) => t.step_id)
        .sort();
    };
    expect(await steps(2)).toEqual(["early", "middle"]);
    expect(await steps(10)).toEqual(["late"]);
    expect(await steps(10)).toEqual([]);
  });

  it("walks the run outbox: created runs, then closed children", async () => {
    const journal = suite.journal();
    const parent = await suite.seed();
    const children = [nextRunId(), nextRunId()].sort();
    await journal.transaction((tx) =>
      tx.applyTransition(parent, transitionAt(parent, 1), {
        nowMs: T0,
        childRuns: children.map((runId, i) => ({
          ...newRun(runId),
          parent_run_id: parent,
          parent_step_id: `spawn-${i}`,
        })),
      }),
    );

    const created = await journal.transaction((tx) => tx.claimCreatedRuns(T0, 50, 30_000));
    expect(created.map((r) => r.run_id)).toEqual(expect.arrayContaining(children));
    const heldBack = await journal.transaction((tx) => tx.claimCreatedRuns(T0 + 1, 50, 30_000));
    expect(heldBack.map((r) => r.run_id)).not.toEqual(expect.arrayContaining(children));

    for (const childId of children) {
      await journal.transaction((tx) =>
        tx.applyTransition(
          childId,
          {
            ...transitionAt(childId, 1),
            run: { status: "completed", last_seq: 1 },
            completion: { status: "completed", output: { ok: true } },
          },
          { nowMs: T0 + 100 },
        ),
      );
    }

    const claim = (nowMs: number): Promise<RunRow[]> =>
      journal.transaction((tx) => tx.claimClosedUnnotified(nowMs, 50, 30_000));

    // Two orchestrators at once: every child is claimed, none of them twice.
    const [first, second] = await Promise.all([claim(T0 + 200), claim(T0 + 200)]);
    expect([...first, ...second].map((r) => r.run_id).sort()).toEqual(children);

    expect(await claim(T0 + 300)).toHaveLength(0);
    const afterHold = await claim(T0 + 200 + 30_001);
    expect(afterHold.map((r) => r.run_id).sort()).toEqual(children);

    for (const childId of children) {
      await journal.transaction((tx) => tx.markParentNotified(childId, T0 + 300));
    }
    expect(await claim(T0 + 100_000)).toHaveLength(0);

    const child = await journal.getRun(children[0] as string);
    expect(child?.output).toBe('{"ok":true}');
    expect(child?.closed_at_ms).toBe(T0 + 100);
    expect(child?.parent_notified_at_ms).toBe(T0 + 300);
  });
}
