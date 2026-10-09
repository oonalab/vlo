/* tslint:disable */
/* eslint-disable */

/**
 * Hash `(kernel_state, state)`; input `StateHashInput`, value `StateHashOutput`.
 */
export function compute_state_hash(input: string): string;

/**
 * Derive `task_id`, `idempotency_key` and `child_run_id`; input `DeriveIdsInput`, value `DeriveIdsOutput`.
 */
export function derive_ids(input: string): string;

/**
 * Kernel crate version, protocol version and feature list.
 */
export function kernel_version(): string;

/**
 * Plan the next attempt from policy, cause and journaled `random`; input `PlanRetryInput`, value `RetryPlan`.
 */
export function plan_retry(input: string): string;

/**
 * Classify an event into a reducer call or a lifecycle write-set; input `PrepareEventInput`, value `Prepared`.
 */
export function prepare_event(input: string): string;

/**
 * Turn a reducer's `(state, commands)` into the write-set; input `ReduceStepInput`, value `Transition`.
 */
export function reduce_step(input: string): string;

/**
 * Find the first divergent `(seq, hash)` between journal and re-fold; input `RefoldCheckInput`, value `RefoldCheckOutput`.
 */
export function refold_check(input: string): string;

/**
 * Field and enum checks on an event envelope; input `EventInput`, value `ValidateEventOutput`.
 */
export function validate_event(input: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly compute_state_hash: (a: number, b: number, c: number) => void;
    readonly derive_ids: (a: number, b: number, c: number) => void;
    readonly kernel_version: (a: number) => void;
    readonly plan_retry: (a: number, b: number, c: number) => void;
    readonly prepare_event: (a: number, b: number, c: number) => void;
    readonly reduce_step: (a: number, b: number, c: number) => void;
    readonly refold_check: (a: number, b: number, c: number) => void;
    readonly validate_event: (a: number, b: number, c: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
