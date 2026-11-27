---
url: /vlo/api/host.md
---
[@oona/vlo](../packages.md) / host

# host

## Classes

* [BadRequest](classes/BadRequest.md)
* [Dispatcher](classes/Dispatcher.md)
* [GcsBlobStore](classes/GcsBlobStore.md)
* [HttpPushTransport](classes/HttpPushTransport.md)
* [IllegalEvent](classes/IllegalEvent.md)
* [InProcessTracker](classes/InProcessTracker.md)
* [InProcessTransport](classes/InProcessTransport.md)
* [JournalClosed](classes/JournalClosed.md)
* [LeaseLost](classes/LeaseLost.md)
* [Nondeterminism](classes/Nondeterminism.md)
* [ReducerFailed](classes/ReducerFailed.md)
* [RunNotFound](classes/RunNotFound.md)
* [RunTerminal](classes/RunTerminal.md)
* [TaskNotFound](classes/TaskNotFound.md)
* [Unauthorized](classes/Unauthorized.md)
* [VloError](classes/VloError.md)
* [WorkflowRejected](classes/WorkflowRejected.md)

## Interfaces

* [ActivityRegistration](interfaces/ActivityRegistration.md)
* [ApplyTransitionOptions](interfaces/ApplyTransitionOptions.md)
* [AuthConfig](interfaces/AuthConfig.md)
* [BlobStore](interfaces/BlobStore.md)
* [Client](interfaces/Client.md)
* [ClientOptions](interfaces/ClientOptions.md)
* [Completion](interfaces/Completion.md)
* [CreateHostOptions](interfaces/CreateHostOptions.md)
* [DeriveIdsOutput](interfaces/DeriveIdsOutput.md)
* [DispatcherOptions](interfaces/DispatcherOptions.md)
* [DrainOptions](interfaces/DrainOptions.md)
* [DrainResult](interfaces/DrainResult.md)
* [Emit](interfaces/Emit.md)
* [Envelope](interfaces/Envelope.md)
* [EventInput](interfaces/EventInput.md)
* [FoldState](interfaces/FoldState.md)
* [GcsBlobStoreOptions](interfaces/GcsBlobStoreOptions.md)
* [GcsBucketLike](interfaces/GcsBucketLike.md)
* [GcsClientLike](interfaces/GcsClientLike.md)
* [GcsFileLike](interfaces/GcsFileLike.md)
* [HandleTaskOptions](interfaces/HandleTaskOptions.md)
* [HashAtSeq](interfaces/HashAtSeq.md)
* [HeaderSource](interfaces/HeaderSource.md)
* [Host](interfaces/Host.md)
* [HostContext](interfaces/HostContext.md)
* [HttpPushOptions](interfaces/HttpPushOptions.md)
* [InProcessOptions](interfaces/InProcessOptions.md)
* [Journal](interfaces/Journal.md)
* [JournalTx](interfaces/JournalTx.md)
* [Kernel](interfaces/Kernel.md)
* [KernelError](interfaces/KernelError.md)
* [KernelReduction](interfaces/KernelReduction.md)
* [KernelState](interfaces/KernelState.md)
* [KernelVersion](interfaces/KernelVersion.md)
* [Listening](interfaces/Listening.md)
* [ListQuery](interfaces/ListQuery.md)
* [NewRunRow](interfaces/NewRunRow.md)
* [NewSignalRow](interfaces/NewSignalRow.md)
* [NewSpawn](interfaces/NewSpawn.md)
* [NewTask](interfaces/NewTask.md)
* [NewTimer](interfaces/NewTimer.md)
* [PlanRetryInput](interfaces/PlanRetryInput.md)
* [PostgresJournalOptions](interfaces/PostgresJournalOptions.md)
* [PrepareEventInput](interfaces/PrepareEventInput.md)
* [PullWorkerOptions](interfaces/PullWorkerOptions.md)
* [PushedTask](interfaces/PushedTask.md)
* [QueueConfig](interfaces/QueueConfig.md)
* [Rebuilt](interfaces/Rebuilt.md)
* [ReduceStepInput](interfaces/ReduceStepInput.md)
* [Registries](interfaces/Registries.md)
* [RunPatch](interfaces/RunPatch.md)
* [RunQuery](interfaces/RunQuery.md)
* [RunRef](interfaces/RunRef.md)
* [RunRow](interfaces/RunRow.md)
* [RunView](interfaces/RunView.md)
* [SchemaRow](interfaces/SchemaRow.md)
* [ServeOptions](interfaces/ServeOptions.md)
* [ServeResult](interfaces/ServeResult.md)
* [SignalLink](interfaces/SignalLink.md)
* [SignalLinkClaims](interfaces/SignalLinkClaims.md)
* [SignalLinkOptions](interfaces/SignalLinkOptions.md)
* [SignalRegistration](interfaces/SignalRegistration.md)
* [SignalResult](interfaces/SignalResult.md)
* [SignalRow](interfaces/SignalRow.md)
* [SignalRunResult](interfaces/SignalRunResult.md)
* [SignalWait](interfaces/SignalWait.md)
* [SignalWaitRow](interfaces/SignalWaitRow.md)
* [StartFreshOptions](interfaces/StartFreshOptions.md)
* [StartFreshResult](interfaces/StartFreshResult.md)
* [StartOptions](interfaces/StartOptions.md)
* [StartRunInput](interfaces/StartRunInput.md)
* [StateRow](interfaces/StateRow.md)
* [StepState](interfaces/StepState.md)
* [StreamOptions](interfaces/StreamOptions.md)
* [TaskClaimFilter](interfaces/TaskClaimFilter.md)
* [TaskReporter](interfaces/TaskReporter.md)
* [TaskResult](interfaces/TaskResult.md)
* [TaskRow](interfaces/TaskRow.md)
* [TaskScheduled](interfaces/TaskScheduled.md)
* [TaskTransport](interfaces/TaskTransport.md)
* [TaskUpdate](interfaces/TaskUpdate.md)
* [TickCounts](interfaces/TickCounts.md)
* [TimerRow](interfaces/TimerRow.md)
* [Transition](interfaces/Transition.md)
* [TxOutcome](interfaces/TxOutcome.md)
* [UsageInput](interfaces/UsageInput.md)
* [Validator](interfaces/Validator.md)

## Type Aliases

* [AfterApply](type-aliases/AfterApply.md)
* [ClientFetch](type-aliases/ClientFetch.md)
* [DispatcherMode](type-aliases/DispatcherMode.md)
* [EventSource](type-aliases/EventSource.md)
* [FetchHandler](type-aliases/FetchHandler.md)
* [FetchLike](type-aliases/FetchLike.md)
* [JournalOptions](type-aliases/JournalOptions.md)
* [KernelResult](type-aliases/KernelResult.md)
* [Kind](type-aliases/Kind.md)
* [Prepared](type-aliases/Prepared.md)
* [PushResult](type-aliases/PushResult.md)
* [RefoldCheckOutput](type-aliases/RefoldCheckOutput.md)
* [RetryPlan](type-aliases/RetryPlan.md)
* [Role](type-aliases/Role.md)
* [StreamMessage](type-aliases/StreamMessage.md)

## Variables

* [ATTEMPT_HEADER](variables/ATTEMPT_HEADER.md)
* [DEFAULT_BLOB_URL](variables/DEFAULT_BLOB_URL.md)
* [DEFAULT_DRAIN_MAX_MS](variables/DEFAULT_DRAIN_MAX_MS.md)
* [DEFAULT_LINK_TTL_MS](variables/DEFAULT_LINK_TTL_MS.md)
* [DEFAULT_PORT](variables/DEFAULT_PORT.md)
* [DEFAULT_STREAM_POLL_MS](variables/DEFAULT_STREAM_POLL_MS.md)
* [SHUTDOWN_GRACE_MS](variables/SHUTDOWN_GRACE_MS.md)
* [SIGNATURE_HEADER](variables/SIGNATURE_HEADER.md)
* [TASK_ID_HEADER](variables/TASK_ID_HEADER.md)
* [TIMESTAMP_HEADER](variables/TIMESTAMP_HEADER.md)

## Functions

* [applyEvent](functions/applyEvent.md)
* [cancelRun](functions/cancelRun.md)
* [completeTask](functions/completeTask.md)
* [createClient](functions/createClient.md)
* [createHost](functions/createHost.md)
* [createRouter](functions/createRouter.md)
* [drainHost](functions/drainHost.md)
* [failTask](functions/failTask.md)
* [findWorker](functions/findWorker.md)
* [foldEvent](functions/foldEvent.md)
* [getRunView](functions/getRunView.md)
* [handler](functions/handler.md)
* [handleTask](functions/handleTask.md)
* [heartbeatTask](functions/heartbeatTask.md)
* [linkSecret](functions/linkSecret.md)
* [listen](functions/listen.md)
* [listRuns](functions/listRuns.md)
* [loadKernel](functions/loadKernel.md)
* [localReporter](functions/localReporter.md)
* [mergeDomains](functions/mergeDomains.md)
* [normalizeBasePath](functions/normalizeBasePath.md)
* [openBlobStore](functions/openBlobStore.md)
* [openJournal](functions/openJournal.md)
* [readRunEvents](functions/readRunEvents.md)
* [rebuildCheckpoint](functions/rebuildCheckpoint.md)
* [remoteReporter](functions/remoteReporter.md)
* [runPullWorker](functions/runPullWorker.md)
* [serve](functions/serve.md)
* [signalRun](functions/signalRun.md)
* [signPush](functions/signPush.md)
* [signSignalLink](functions/signSignalLink.md)
* [startRun](functions/startRun.md)
* [verifySignalLink](functions/verifySignalLink.md)
* [verifySignature](functions/verifySignature.md)

## References

### ActivityHandler

Re-exports [ActivityHandler](../index/type-aliases/ActivityHandler.md)

***

### ActivityImpls

Re-exports [ActivityImpls](../index/type-aliases/ActivityImpls.md)

***

### defineDomain

Re-exports [defineDomain](../index/functions/defineDomain.md)

***

### defineWorker

Re-exports [defineWorker](../index/functions/defineWorker.md)

***

### Domain

Re-exports [Domain](../index/interfaces/Domain.md)

***

### DomainDef

Re-exports [DomainDef](../index/interfaces/DomainDef.md)

***

### isTerminalRunStatus

Re-exports [isTerminalRunStatus](../index/functions/isTerminalRunStatus.md)

***

### TaskContext

Re-exports [TaskContext](../index/interfaces/TaskContext.md)

***

### TERMINAL_RUN_STATUSES

Re-exports [TERMINAL_RUN_STATUSES](../index/variables/TERMINAL_RUN_STATUSES.md)

***

### withRetryInput

Re-exports [withRetryInput](../index/functions/withRetryInput.md)

***

### Worker

Re-exports [Worker](../index/interfaces/Worker.md)

***

### WorkerOptions

Re-exports [WorkerOptions](../index/interfaces/WorkerOptions.md)
