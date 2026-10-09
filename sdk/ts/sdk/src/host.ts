/**
 * `@vlo/sdk/host` — everything that touches durable state or the network.
 *
 * The authoring surface (`@vlo/sdk`) has no dependency on any of this: a workflow compiles
 * and unit-tests without a journal, a kernel or a port.
 */

export {
  createHost,
  handler,
  serve,
  DEFAULT_BLOB_URL,
  DEFAULT_PORT,
  DEFAULT_STREAM_POLL_MS,
  SHUTDOWN_GRACE_MS,
  type CreateHostOptions,
  type Host,
  type ServeOptions,
  type ServeResult,
} from "./host/roles.ts";

export type {
  ActivityRegistration,
  AuthConfig,
  HostContext,
  QueueConfig,
  Role,
  SignalRegistration,
  TaskScheduled,
  Validator,
} from "./host/context.ts";

export { defineDomain, mergeDomains, type Domain, type DomainDef, type Registries } from "./host/domain.ts";
export { isTerminalRunStatus, TERMINAL_RUN_STATUSES } from "./core/run-status.ts";
export { defineWorker, findWorker, withRetryInput, type ActivityHandler, type ActivityImpls, type TaskContext, type UsageInput, type Worker, type WorkerOptions } from "./host/worker/registry.ts";
export { handleTask, type HandleTaskOptions, type TaskReporter } from "./host/worker/handle-task.ts";
export { localReporter, remoteReporter } from "./host/worker/reporters.ts";
export { runPullWorker, type PullWorkerOptions } from "./host/worker/pull.ts";
export {
  signPush,
  verifySignature,
  ATTEMPT_HEADER,
  SIGNATURE_HEADER,
  TASK_ID_HEADER,
  TIMESTAMP_HEADER,
  type HeaderSource,
} from "./host/worker/signature.ts";
export { completeTask, failTask, heartbeatTask, type TaskResult } from "./host/worker/complete.ts";

export {
  Dispatcher,
  type DispatcherMode,
  type DispatcherOptions,
  type TickCounts,
} from "./host/dispatcher.ts";
export {
  drainHost,
  DEFAULT_DRAIN_MAX_MS,
  type DrainOptions,
  type DrainResult,
} from "./host/drain.ts";
export { applyEvent, type AfterApply, type EventSource, type TxOutcome } from "./host/transition.ts";
export { foldEvent, rebuildCheckpoint, type FoldState, type Rebuilt } from "./host/refold.ts";

export { HttpPushTransport, type FetchLike, type HttpPushOptions } from "./host/transport/http-push.ts";
export {
  InProcessTracker,
  InProcessTransport,
  type InProcessOptions,
} from "./host/transport/in-process.ts";
export type { PushedTask, PushResult, TaskTransport } from "./host/transport/types.ts";

export {
  cancelRun,
  getRunView,
  listRuns,
  readRunEvents,
  signalRun,
  startRun,
  type RunView,
  type StartRunInput,
  type SignalResult as SignalRunResult,
} from "./host/runs.ts";

export {
  linkSecret,
  signSignalLink,
  verifySignalLink,
  DEFAULT_LINK_TTL_MS,
  type SignalLinkClaims,
} from "./host/links.ts";

export { createRouter, normalizeBasePath, type FetchHandler } from "./host/api/router.ts";
export { listen, type Listening } from "./host/node-server.ts";

export {
  BadRequest,
  IllegalEvent,
  LeaseLost,
  Nondeterminism,
  ReducerFailed,
  RunNotFound,
  RunTerminal,
  TaskNotFound,
  Unauthorized,
  VloError,
  WorkflowRejected,
} from "./host/errors.ts";

export { loadKernel } from "./kernel/load.ts";
export type {
  Completion,
  DeriveIdsOutput,
  Emit,
  Envelope,
  EventInput,
  HashAtSeq,
  Kernel,
  KernelError,
  KernelResult,
  KernelState,
  KernelVersion,
  Kind,
  NewSpawn,
  NewTask,
  NewTimer,
  PlanRetryInput,
  PrepareEventInput,
  Prepared,
  ReduceStepInput,
  RefoldCheckOutput,
  Reduction as KernelReduction,
  RetryPlan,
  RunPatch,
  RunRef,
  SignalWait,
  StepState,
  TaskUpdate,
  Transition,
} from "./kernel/protocol.ts";

export { openJournal, type JournalOptions } from "./journal/open.ts";
export { type PostgresJournalOptions } from "./journal/postgres.ts";
export { JournalClosed } from "./journal/types.ts";
export type {
  ApplyTransitionOptions,
  Journal,
  JournalTx,
  NewRunRow,
  NewSignalRow,
  RunQuery,
  RunRow,
  SchemaRow,
  SignalRow,
  SignalWaitRow,
  StateRow,
  TaskClaimFilter,
  TaskRow,
  TimerRow,
} from "./journal/types.ts";
export { openBlobStore } from "./blob/open.ts";
export {
  GcsBlobStore,
  type GcsBlobStoreOptions,
  type GcsBucketLike,
  type GcsClientLike,
  type GcsFileLike,
} from "./blob/gcs.ts";
export type { BlobStore } from "./blob/types.ts";

export {
  createClient,
  type Client,
  type ClientFetch,
  type ClientOptions,
  type ListQuery,
  type SignalLink,
  type SignalResult,
  type StartOptions,
  type StartFreshOptions,
  type StartFreshResult,
  type SignalLinkOptions,
  type StreamMessage,
  type StreamOptions,
} from "./client/index.ts";
