/**
 * Loads the Rust kernel compiled to wasm and adapts it to the `Kernel` interface.
 *
 * The wasm exports are JSON string in, JSON string out, so every method here is a
 * stringify / call / parse. Instantiation is synchronous (`initSync` over bytes read
 * from disk) and memoised: the kernel is stateless, so one instance serves the process.
 */

import { readFileSync } from "node:fs";

import {
  PROTOCOL_VERSION,
  type DeriveIdsOutput,
  type EventInput,
  type HashAtSeq,
  type Kernel,
  type KernelResult,
  type KernelState,
  type KernelVersion,
  type PlanRetryInput,
  type PrepareEventInput,
  type Prepared,
  type ReduceStepInput,
  type RefoldCheckOutput,
  type RetryPlan,
  type Transition,
} from "./protocol.ts";

/**
 * `wasm/` sits next to `src/` in the repo and next to `dist/` in the published package,
 * so the bytes are one of two places relative to this module. `VLO_KERNEL_WASM` overrides
 * both; CI uses it to run the golden fixtures against a freshly built kernel.
 */
const WASM_CANDIDATES = ["../../wasm/vlo_kernel_bg.wasm", "../wasm/vlo_kernel_bg.wasm"];

let loading: Promise<Kernel> | undefined;

/**
 * Loads the wasm kernel once per process and returns the same instance afterwards. Looks for
 * `vlo_kernel_bg.wasm` in the package's `wasm/` directory, or at `VLO_KERNEL_WASM`. Rejects
 * when the bytes are missing or the kernel speaks a different protocol version.
 */
export async function loadKernel(): Promise<Kernel> {
  loading ??= instantiate();
  return loading;
}

function readWasmBytes(): Uint8Array {
  const override = process.env["VLO_KERNEL_WASM"];
  if (override !== undefined && override !== "") return readFileSync(override);

  const failures: string[] = [];
  for (const candidate of WASM_CANDIDATES) {
    try {
      return readFileSync(new URL(candidate, import.meta.url));
    } catch (error) {
      failures.push(`${candidate}: ${(error as Error).message}`);
    }
  }
  throw new Error(
    `vlo kernel wasm not found; run scripts/build-kernel.sh\n${failures.join("\n")}`,
  );
}

async function instantiate(): Promise<Kernel> {
  const wasm = await import("../../wasm/vlo_kernel.js");
  wasm.initSync({ module: readWasmBytes() });

  const call = <T>(exported: (input: string) => string, input: unknown): KernelResult<T> =>
    JSON.parse(exported(JSON.stringify(input))) as KernelResult<T>;

  const version = unwrap<KernelVersion>(
    JSON.parse(wasm.kernel_version()) as KernelResult<KernelVersion>,
  );
  if (version.protocol !== PROTOCOL_VERSION) {
    throw new Error(
      `vlo kernel speaks protocol ${version.protocol}, this SDK speaks ${PROTOCOL_VERSION}`,
    );
  }

  return {
    version: () => version,
    validateEvent: (event: EventInput) => call<{ normalized: EventInput }>(wasm.validate_event, event),
    prepareEvent: (input: PrepareEventInput) => call<Prepared>(wasm.prepare_event, input),
    reduceStep: (input: ReduceStepInput) => call<Transition>(wasm.reduce_step, input),
    stateHash: (input: { kernel_state: KernelState; state: string }) =>
      call<{ hash: string }>(wasm.compute_state_hash, input),
    planRetry: (input: PlanRetryInput) => call<RetryPlan>(wasm.plan_retry, input),
    refoldCheck: (input: { expected: HashAtSeq[]; actual: HashAtSeq[] }) =>
      call<RefoldCheckOutput>(wasm.refold_check, input),
    deriveIds: (input: { run_id: string; step_id: string; attempt: number }) =>
      call<DeriveIdsOutput>(wasm.derive_ids, input),
  };
}

function unwrap<T>(result: KernelResult<T>): T {
  if (!result.ok) {
    throw new Error(`vlo kernel: ${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}
