---
url: /vlo/api/index.md
---
[@oona/vlo](../packages.md) / index

# index

## Classes

* [ActivityInputError](classes/ActivityInputError.md)
* [WorkflowFailure](classes/WorkflowFailure.md)

## Interfaces

* [Activity](interfaces/Activity.md)
* [ActivityOptions](interfaces/ActivityOptions.md)
* [AwaitHumanOptions](interfaces/AwaitHumanOptions.md)
* [AwaitSignalOptions](interfaces/AwaitSignalOptions.md)
* [ChildResult](interfaces/ChildResult.md)
* [DeployProfile](interfaces/DeployProfile.md)
* [DispatcherProfile](interfaces/DispatcherProfile.md)
* [Domain](interfaces/Domain.md)
* [DomainDef](interfaces/DomainDef.md)
* [EnvRef](interfaces/EnvRef.md)
* [FanOutOptions](interfaces/FanOutOptions.md)
* [FanOutRunsOptions](interfaces/FanOutRunsOptions.md)
* [FanState](interfaces/FanState.md)
* [Handlers](interfaces/Handlers.md)
* [Profile](interfaces/Profile.md)
* [QueueProfile](interfaces/QueueProfile.md)
* [ReductionWire](interfaces/ReductionWire.md)
* [RetryOptions](interfaces/RetryOptions.md)
* [RetryPolicy](interfaces/RetryPolicy.md)
* [SeqState](interfaces/SeqState.md)
* [SequenceOptions](interfaces/SequenceOptions.md)
* [SignalDef](interfaces/SignalDef.md)
* [SpawnOptions](interfaces/SpawnOptions.md)
* [StepOptions](interfaces/StepOptions.md)
* [TaskContext](interfaces/TaskContext.md)
* [TaskOptions](interfaces/TaskOptions.md)
* [TimerOptions](interfaces/TimerOptions.md)
* [Usage](interfaces/Usage.md)
* [VloConfig](interfaces/VloConfig.md)
* [WaitForOptions](interfaces/WaitForOptions.md)
* [Worker](interfaces/Worker.md)
* [WorkerOptions](interfaces/WorkerOptions.md)
* [Workflow](interfaces/Workflow.md)
* [WorkflowDef](interfaces/WorkflowDef.md)

## Type Aliases

* [ActivityHandler](type-aliases/ActivityHandler.md)
* [ActivityImpls](type-aliases/ActivityImpls.md)
* [Backoff](type-aliases/Backoff.md)
* [Cause](type-aliases/Cause.md)
* [ChildStatus](type-aliases/ChildStatus.md)
* [Command](type-aliases/Command.md)
* [DeployTarget](type-aliases/DeployTarget.md)
* [ErasedActivity](type-aliases/ErasedActivity.md)
* [Jitter](type-aliases/Jitter.md)
* [Json](type-aliases/Json.md)
* [OnFailure](type-aliases/OnFailure.md)
* [OnTimeout](type-aliases/OnTimeout.md)
* [ReducerEvent](type-aliases/ReducerEvent.md)
* [Reduction](type-aliases/Reduction.md)
* [Ref](type-aliases/Ref.md)
* [RunStatus](type-aliases/RunStatus.md)
* [SeqStep](type-aliases/SeqStep.md)
* [Status](type-aliases/Status.md)

## Variables

* [ANNOTATION_KEYWORDS](variables/ANNOTATION_KEYWORDS.md)
* [cmd](variables/cmd.md)
* [DEFAULT_LEASE_MS](variables/DEFAULT_LEASE_MS.md)
* [DEFAULT_QUEUE](variables/DEFAULT_QUEUE.md)
* [DEFAULT_RETRY](variables/DEFAULT_RETRY.md)
* [~~humanTimeoutStepId~~](variables/humanTimeoutStepId.md)
* [NAMED_SCHEMA_MAPS](variables/NAMED_SCHEMA_MAPS.md)
* [SCHEMA_HASH_VERSION](variables/SCHEMA_HASH_VERSION.md)
* [TERMINAL_RUN_STATUSES](variables/TERMINAL_RUN_STATUSES.md)

## Functions

* [activity](functions/activity.md)
* [canonicalJson](functions/canonicalJson.md)
* [contentHash](functions/contentHash.md)
* [defineConfig](functions/defineConfig.md)
* [defineDomain](functions/defineDomain.md)
* [defineWorker](functions/defineWorker.md)
* [defineWorkflow](functions/defineWorkflow.md)
* [env](functions/env.md)
* [fanOut](functions/fanOut.md)
* [fanOutResultsOf](functions/fanOutResultsOf.md)
* [fanOutRuns](functions/fanOutRuns.md)
* [fanOutRunsResultsOf](functions/fanOutRunsResultsOf.md)
* [isTerminalRunStatus](functions/isTerminalRunStatus.md)
* [projectSchema](functions/projectSchema.md)
* [resultOf](functions/resultOf.md)
* [sequence](functions/sequence.md)
* [sha256Hex](functions/sha256Hex.md)
* [signal](functions/signal.md)
* [signalOf](functions/signalOf.md)
* [signalTimeoutStepId](functions/signalTimeoutStepId.md)
* [sleep](functions/sleep.md)
* [step](functions/step.md)
* [waitFor](functions/waitFor.md)
* [withRetryInput](functions/withRetryInput.md)
