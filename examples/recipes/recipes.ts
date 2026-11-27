/**
 * The code behind docs/recipes.md. Nothing here runs: the file exists so every recipe is
 * typechecked against the SDK. `scripts/check-snippets.mjs` keeps the page and this file in
 * step, so change a recipe here and copy it to the page.
 */

import {
  activity,
  cmd,
  defineWorker,
  fanOut,
  fanOutRuns,
  resultOf,
  sequence,
  signal,
  signalOf,
  sleep,
  step,
  waitFor,
  withRetryInput,
  type Reduction,
} from "@oona/vlo";
import { agentLoop, approvalSignal, budgetTopup, decision } from "@oona/vlo/agent";
import { createClient, runPullWorker } from "@oona/vlo/host";
import { z } from "zod";

// ── Stand-ins the recipes refer to ──────────────────────────────────────────────────────

const nothing = z.object({});
const prepare = activity("order.prepare", { input: z.unknown(), output: nothing });
const ship = activity("order.ship", { input: z.object({ approvedBy: z.string() }), output: nothing });
const polish = activity("doc.polish", { input: z.unknown(), output: nothing });
const notify = activity("team.notify", { input: z.unknown(), output: nothing });
const sendInvite = activity("invite.send", { input: z.unknown(), output: nothing });
const sendReminder = activity("invite.remind", { input: z.unknown(), output: nothing });
const list = activity("images.list", { input: z.unknown(), output: z.object({ images: z.array(z.string()) }) });
const resize = activity("images.resize", { input: z.object({ image: z.string() }), output: nothing });
const fetchSource = activity("sources.fetch", { input: z.object({ url: z.string() }), output: nothing });
const search = activity("agent.search", { input: z.object({ query: z.string() }), output: nothing });
const decide = decision("agent.decide", { input: z.unknown(), tools: { search } });
const tools = { search };
const topup = budgetTopup();

const client = createClient({ baseUrl: "http://localhost:4100" });
const runId = "run_example";
const reviewer = "dana@example.com";
const team = "growth";
const isoWeek = "2026-W48";
const mediaWorker = defineWorker({}, { queues: ["media"] });

declare function sendEmail(message: { to: string; body: string }): Promise<void>;
declare function render(stepId: string, status: string): void;
declare function renderHint(hint: unknown): void;
declare function finish(status: string): void;

// ── Wait for an approval, with a deadline ───────────────────────────────────────────────

export const approve = signal("order.approve", z.object({ by: z.string() }));

export const order = sequence([
  step(prepare),
  waitFor(approve, { timeoutMs: 86_400_000, onTimeout: "fail" }),
  step(ship, (state) => ({ approvedBy: signalOf(state, approve).by })),
]);

export async function deliverApproval() {
  await client.signal(runId, approve, { by: "dana" });
}

// ── Send an approval link ───────────────────────────────────────────────────────────────

export async function sendApprovalLink() {
  const link = await client.signalLink(runId, approve, { expiresInMs: 86_400_000 });
  await sendEmail({ to: reviewer, body: `Approve here: ${link.url}` });
}

// ── Cap an agent's spend ────────────────────────────────────────────────────────────────

export const capped = agentLoop({
  decide,
  tools,
  budget: { tokens: 50_000, costMicroUsd: 2_000_000, steps: 25 },
  topup,
});

export async function topUp() {
  await client.signal(runId, topup, { tokens: 20_000 });
}

// ── Stop a pipeline when it has spent too much ──────────────────────────────────────────

export const frugal = step(polish, undefined, {
  when: (state) => (state.usage?.tokens ?? 0) < 100_000,
});

// ── Retry a flaky call ──────────────────────────────────────────────────────────────────

export const summarise = activity("doc.summarise", {
  input: z.object({ text: z.string(), compact: z.boolean().optional() }),
  output: z.object({ summary: z.string() }),
  retry: { maxAttempts: 5, backoff: "exponential", initialMs: 2_000, maxMs: 60_000 },
  timeoutMs: 120_000,
});

declare function callModel(input: { text: string; compact?: boolean | undefined }): Promise<{ summary: string }>;

export const summariser = defineWorker({
  "doc.summarise": withRetryInput(callModel, (input, attempt) => ({ ...input, compact: attempt > 1 })),
});

// ── Fan out, narrow or wide ─────────────────────────────────────────────────────────────

export const narrow = fanOut(
  resize,
  (state) => resultOf(state, list).images.map((image) => ({ image })),
  { concurrency: 4 },
);

export const wide = fanOutRuns(
  "process-image",
  (state) => resultOf(state, list).images.map((image) => ({ image })),
  { concurrency: 20 },
);

export const agents = fanOutRuns(
  "research",
  (state) => (state.input as { topics: string[] }).topics.map((topic) => ({ topic })),
  { concurrency: 4 },
);

// ── Tolerate a failure ──────────────────────────────────────────────────────────────────

export const tolerant = [
  step(notify, undefined, { onFailure: "continue" }),
  fanOut(fetchSource, () => [{ url: "https://example.com" }], { concurrency: 4, onFailure: "continue" }),
];

// ── Stream progress to a UI ─────────────────────────────────────────────────────────────

export async function follow() {
  for await (const message of client.stream(runId)) {
    if (message.type === "journal") render(message.data.step_id, message.data.status);
    if (message.type === "emit") renderHint(message.data);
    if (message.type === "end") finish(message.data.status);
  }
}

export const progress = cmd.emit("progress", { percent: 40 });

// ── Start a run idempotently ────────────────────────────────────────────────────────────

export async function startOnce() {
  await client.start("weekly-report", { team }, { runId: `weekly_${team}_${isoWeek}` });
}

// ── Sleep or wait until a time ──────────────────────────────────────────────────────────

export const reminder = sequence([step(sendInvite), sleep(3 * 86_400_000), step(sendReminder)]);

// ── Pull tasks instead of receiving pushes ──────────────────────────────────────────────

export async function pull() {
  await runPullWorker({ baseUrl: "https://vlo.example.com", token: process.env.VLO_TOKEN!, worker: mediaWorker });
}

// ── Compact a very long run ─────────────────────────────────────────────────────────────

export function compact(state: { cursor: number }): Reduction<{ cursor: number }> {
  return [state, [cmd.continueAsNew({ cursor: state.cursor })]];
}

// ── Cancel a run ────────────────────────────────────────────────────────────────────────

export async function stop() {
  await client.cancel(runId);
}

// ── Approve a tool call ─────────────────────────────────────────────────────────────────

export const careful = agentLoop({
  decide,
  tools,
  budget: { tokens: 50_000 },
  approval: { tools: ["search"], timeoutMs: 86_400_000 },
});

export async function answer() {
  await client.signal(runId, approvalSignal(3), { approved: true, by: "dana" });
  await client.signal(runId, approvalSignal(3), { approved: false, reason: "wrong audience" });
}

export async function answerByLink() {
  const link = await client.signalLink(runId, approvalSignal(3));
  await sendEmail({ to: reviewer, body: `The agent wants to search. Approve: ${link.url}` });
}
