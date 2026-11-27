/**
 * Where your model client goes. These are scripted stand-ins: each is a pure function of its
 * input, so the example runs with no API key and a redelivered task gets the same answer.
 * Replace the bodies with real calls and keep the shapes.
 */

export interface DecideInput {
  goal: unknown;
  memory: unknown[];
  candidate: unknown;
}

export interface ModelDecision {
  tool: "search" | "write" | "done";
  args?: unknown;
  why: string;
  tokens: number;
  costMicroUsd: number;
}

/** The model picks the next tool from what it has seen so far. */
export async function decideNext(input: DecideInput): Promise<ModelDecision> {
  const usage = { tokens: 400, costMicroUsd: 1_200 };
  const topic = (input.goal as { topic?: string } | null)?.topic ?? "the topic";
  if (input.memory.length === 0) {
    return { tool: "search", args: { query: topic }, why: "nothing gathered yet", ...usage };
  }
  if (input.memory.length === 1) {
    const results = (input.candidate as { results?: string[] } | null)?.results ?? [];
    return { tool: "write", args: { notes: results.join("; ") }, why: "enough to write", ...usage };
  }
  return { tool: "done", why: "the report is written", ...usage };
}

/** The model turns notes into prose. */
export async function writeReport(notes: string): Promise<{ text: string; tokens: number; costMicroUsd: number }> {
  return { text: `A short report. ${notes}.`, tokens: 600, costMicroUsd: 1_800 };
}

/** A search tool. */
export async function webSearch(query: string): Promise<string[]> {
  return [`what ${query} is`, `why ${query} matters`];
}

/** Scores a candidate against the goal, 0 to 1. */
export async function grade(_goal: unknown, candidate: unknown): Promise<number> {
  const text = (candidate as { text?: string } | null)?.text ?? "";
  return text.includes("report") ? 0.95 : 0.3;
}
