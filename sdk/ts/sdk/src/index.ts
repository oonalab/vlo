/**
 * `@vlo/sdk` — the authoring surface: activities, signals, workflows, commands and the
 * pipeline helpers. Hosts, journals and the kernel live behind `@vlo/sdk/host` and
 * `@vlo/sdk/testing`; nothing here touches I/O.
 */

export {
  activity,
  signal,
  DEFAULT_LEASE_MS,
  DEFAULT_QUEUE,
  DEFAULT_RETRY,
  type Activity,
  type ActivityOptions,
  type RetryOptions,
  type SignalDef,
} from "./core/activity.ts";

export {
  cmd,
  humanTimeoutStepId,
  signalTimeoutStepId,
  ActivityInputError,
  type AwaitHumanOptions,
  type AwaitSignalOptions,
  type SpawnOptions,
  type TaskOptions,
  type TimerOptions,
} from "./core/commands.ts";

export {
  defineWorkflow,
  WorkflowFailure,
  type Handlers,
  type Reduction,
  type ReductionWire,
  type Workflow,
  type WorkflowDef,
} from "./core/workflow.ts";

export {
  fanOut,
  fanOutRuns,
  sequence,
  sleep,
  step,
  waitFor,
  type ChildResult,
  type ChildStatus,
  type ErasedActivity,
  type FanOutOptions,
  type FanOutRunsOptions,
  type FanState,
  type OnFailure,
  type OnTimeout,
  type SeqState,
  type SeqStep,
  type SequenceOptions,
  type StepOptions,
  type WaitForOptions,
} from "./core/helpers/sequence.ts";

export {
  fanOutResultsOf,
  fanOutRunsResultsOf,
  resultOf,
  signalOf,
} from "./core/helpers/sequence-access.ts";

export { canonicalJson, contentHash, sha256Hex } from "./core/hash.ts";
export { isTerminalRunStatus, TERMINAL_RUN_STATUSES } from "./core/run-status.ts";
export {
  ANNOTATION_KEYWORDS,
  NAMED_SCHEMA_MAPS,
  projectSchema,
  SCHEMA_HASH_VERSION,
} from "./core/schema-projection.ts";

export {
  defineWorker,
  withRetryInput,
  type ActivityHandler,
  type ActivityImpls,
  type TaskContext,
  type Worker,
  type WorkerOptions,
} from "./host/worker/registry.ts";

export { defineDomain, type Domain, type DomainDef } from "./host/domain.ts";

export {
  defineConfig,
  env,
  type DeployProfile,
  type DeployTarget,
  type DispatcherProfile,
  type EnvRef,
  type Ref,
  type Profile,
  type QueueProfile,
  type VloConfig,
} from "./config/define.ts";

export type {
  Backoff,
  Cause,
  Command,
  Jitter,
  Json,
  ReducerEvent,
  RetryPolicy,
  RunStatus,
  Status,
  Usage,
} from "./kernel/protocol.ts";
