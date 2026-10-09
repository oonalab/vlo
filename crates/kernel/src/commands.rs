//! Command validation and write-set accumulation.
//!
//! Each command either opens a step (task / timer / spawn / await_signal), records a
//! side effect (emit), or closes the run (complete / continue_as_new). Opening a step
//! always produces three things in lockstep: a `StepState`, a row for the journal, and
//! a `scheduled` lifecycle event. An `await_signal` with `timeout_ms` opens two steps:
//! the signal wait and a `<id>:timeout` timer that races it.

use vlo_types::{
    Command, Completion, ContinueAsNew, Emit, Envelope, KernelState, Kind, NewSpawn, NewTask,
    NewTimer, RunRef, RunStatus, SignalWait, Status, StepState, TaskUpdate, Transition,
};

use crate::canonical;
use crate::classify::{timeout_step_id, COMPLETE_STEP_ID, CONTINUE_STEP_ID};
use crate::error::{code, err, err_step, KResult};
use crate::events::{self, LifecycleEvent};
use crate::ids;

/// Lease a task holds before the reaper may re-dispatch it.
pub const DEFAULT_LEASE_TTL_MS: u64 = 60_000;
/// Queue a task lands on when the reducer names none.
pub const DEFAULT_QUEUE: &str = "default";

/// Accumulates one transition's write-set as commands are applied.
pub struct Builder<'a> {
    pub run: &'a RunRef,
    ts_ms: u64,
    random: &'a str,
    pub kernel_state: KernelState,
    seq: u64,
    pub events: Vec<Envelope>,
    pub tasks: Vec<NewTask>,
    pub task_updates: Vec<TaskUpdate>,
    pub timers: Vec<NewTimer>,
    pub spawns: Vec<NewSpawn>,
    pub signal_waits: Vec<SignalWait>,
    pub emits: Vec<Emit>,
    pub completion: Option<Completion>,
    pub continue_as_new: Option<ContinueAsNew>,
}

impl<'a> Builder<'a> {
    /// Start from the kernel state `prepare_event` returned; `seq` continues from `run.last_seq`.
    pub fn new(run: &'a RunRef, kernel_state: KernelState, ts_ms: u64, random: &'a str) -> Self {
        Builder {
            run,
            ts_ms,
            random,
            kernel_state,
            seq: run.last_seq,
            events: Vec::new(),
            tasks: Vec::new(),
            task_updates: Vec::new(),
            timers: Vec::new(),
            spawns: Vec::new(),
            signal_waits: Vec::new(),
            emits: Vec::new(),
            completion: None,
            continue_as_new: None,
        }
    }

    /// Append an already-built event input, assigning the next consecutive seq.
    pub fn push_event(&mut self, input: vlo_types::EventInput) {
        self.seq += 1;
        self.events
            .push(events::envelope(input, self.seq, self.run));
    }

    fn push_lifecycle(&mut self, event: LifecycleEvent<'_>) {
        let input = events::lifecycle_input(&self.run.run_id, self.ts_ms, self.random, event);
        self.push_event(input);
    }

    /// Reserve the next step id. `step_no` counts every step the run has ever opened, so
    /// derived ids never collide with each other even when explicit ids are mixed in.
    fn reserve_step_id(&mut self, prefix: &str, id: Option<&String>) -> KResult<String> {
        self.kernel_state.step_no += 1;
        let step_id = match id {
            Some(id) if id.is_empty() => {
                return Err(err(code::INVALID_COMMAND, "explicit step id is empty"))
            }
            Some(id) => id.clone(),
            None => format!("{prefix}#{}", self.kernel_state.step_no),
        };
        if self.kernel_state.steps.contains_key(&step_id) {
            return Err(err_step(
                code::DUPLICATE_STEP_ID,
                "a step with this id is already open",
                &step_id,
            ));
        }
        Ok(step_id)
    }

    /// Open a timer step on an already reserved id: the state row, the `NewTimer` and its
    /// `scheduled` event. Shared by `timer` and the deadline of `await_signal`.
    fn open_timer(&mut self, step_id: String, fire_at: u64) {
        self.kernel_state.steps.insert(
            step_id.clone(),
            StepState {
                kind: Kind::Timer,
                status: Status::Scheduled,
                attempt: 0,
                activity: None,
                queue: None,
                retry: None,
                child_run_id: None,
                signal: None,
                fire_at_ms: Some(fire_at),
            },
        );
        self.timers.push(NewTimer {
            step_id: step_id.clone(),
            fire_at_ms: fire_at,
        });
        self.push_lifecycle(LifecycleEvent {
            step_id: &step_id,
            attempt: 0,
            kind: Kind::Timer,
            status: Status::Scheduled,
            schema_ref: None,
            payload: None,
        });
    }

    /// Validate one command and record its step, rows and lifecycle event.
    pub fn apply(&mut self, command: &Command) -> KResult<()> {
        match command {
            Command::Task {
                activity,
                schema_ref,
                input,
                queue,
                retry,
                lease_ttl_ms,
                timeout_ms,
                id,
            } => {
                if activity.is_empty() {
                    return Err(err(code::INVALID_COMMAND, "task activity is empty"));
                }
                let step_id = self.reserve_step_id("task", id.as_ref())?;
                let queue = queue.clone().unwrap_or_else(|| DEFAULT_QUEUE.to_string());
                let retry = retry.clone().unwrap_or_default();
                let attempt = 1;

                self.kernel_state.steps.insert(
                    step_id.clone(),
                    StepState {
                        kind: Kind::Task,
                        status: Status::Scheduled,
                        attempt,
                        activity: Some(activity.clone()),
                        queue: Some(queue.clone()),
                        retry: Some(retry.clone()),
                        child_run_id: None,
                        signal: None,
                        fire_at_ms: None,
                    },
                );
                self.tasks.push(NewTask {
                    task_id: ids::task_id(&self.run.run_id, &step_id),
                    step_id: step_id.clone(),
                    attempt,
                    activity: activity.clone(),
                    queue,
                    schema_ref: schema_ref.clone(),
                    input: input.clone(),
                    idempotency_key: ids::idempotency_key(&self.run.run_id, &step_id, attempt),
                    retry,
                    lease_ttl_ms: lease_ttl_ms.unwrap_or(DEFAULT_LEASE_TTL_MS),
                    timeout_ms: *timeout_ms,
                });
                self.push_lifecycle(LifecycleEvent {
                    step_id: &step_id,
                    attempt,
                    kind: Kind::Task,
                    status: Status::Scheduled,
                    schema_ref: schema_ref.clone(),
                    payload: Some(canonical::to_string(input)?),
                });
            }

            Command::Timer {
                fire_in_ms,
                fire_at_ms,
                id,
            } => {
                let fire_at = match (fire_at_ms, fire_in_ms) {
                    (Some(at), _) => *at,
                    (None, Some(delay)) => self.ts_ms.saturating_add(*delay),
                    (None, None) => {
                        return Err(err(
                            code::INVALID_COMMAND,
                            "timer needs fire_at_ms or fire_in_ms",
                        ))
                    }
                };
                let step_id = self.reserve_step_id("timer", id.as_ref())?;
                self.open_timer(step_id, fire_at);
            }

            Command::Spawn {
                workflow,
                input,
                id,
            } => {
                if workflow.is_empty() {
                    return Err(err(code::INVALID_COMMAND, "spawn workflow is empty"));
                }
                let step_id = self.reserve_step_id("child", id.as_ref())?;
                let child_run_id = ids::child_run_id(&self.run.run_id, &step_id);
                self.kernel_state.steps.insert(
                    step_id.clone(),
                    StepState {
                        kind: Kind::Child,
                        status: Status::Scheduled,
                        attempt: 0,
                        activity: None,
                        queue: None,
                        retry: None,
                        child_run_id: Some(child_run_id.clone()),
                        signal: None,
                        fire_at_ms: None,
                    },
                );
                self.spawns.push(NewSpawn {
                    step_id: step_id.clone(),
                    child_run_id,
                    workflow: workflow.clone(),
                    input: input.clone(),
                });
                self.push_lifecycle(LifecycleEvent {
                    step_id: &step_id,
                    attempt: 0,
                    kind: Kind::Child,
                    status: Status::Scheduled,
                    schema_ref: None,
                    payload: Some(canonical::to_string(input)?),
                });
            }

            Command::AwaitSignal {
                name,
                schema_ref,
                timeout_ms,
                id,
            } => {
                if name.is_empty() {
                    return Err(err(code::INVALID_COMMAND, "signal name is empty"));
                }
                let step_id = self.reserve_step_id("signal", id.as_ref())?;
                self.kernel_state.steps.insert(
                    step_id.clone(),
                    StepState {
                        kind: Kind::Signal,
                        status: Status::AwaitingSignal,
                        attempt: 0,
                        activity: None,
                        queue: None,
                        retry: None,
                        child_run_id: None,
                        signal: Some(name.clone()),
                        fire_at_ms: None,
                    },
                );
                self.signal_waits.push(SignalWait {
                    step_id: step_id.clone(),
                    name: name.clone(),
                    schema_ref: schema_ref.clone(),
                    expires_at_ms: timeout_ms.map(|t| self.ts_ms.saturating_add(t)),
                });
                self.push_lifecycle(LifecycleEvent {
                    step_id: &step_id,
                    attempt: 0,
                    kind: Kind::Signal,
                    status: Status::AwaitingSignal,
                    schema_ref: schema_ref.clone(),
                    payload: None,
                });
                // The deadline is a real timer step, `<step_id>:timeout`, identical to one
                // the reducer could have issued itself; `prepare_event` cancels whichever
                // of the pair loses the race.
                if let Some(timeout) = timeout_ms {
                    let timer_id =
                        self.reserve_step_id("timer", Some(&timeout_step_id(&step_id)))?;
                    self.open_timer(timer_id, self.ts_ms.saturating_add(*timeout));
                }
            }

            Command::Emit { channel, data } => {
                if channel.is_empty() {
                    return Err(err(code::INVALID_COMMAND, "emit channel is empty"));
                }
                self.emits.push(Emit {
                    channel: channel.clone(),
                    data: data.clone(),
                });
            }

            Command::Complete { output } => {
                self.completion = Some(Completion {
                    status: RunStatus::Completed,
                    output: Some(output.clone()),
                });
                self.push_lifecycle(LifecycleEvent {
                    step_id: COMPLETE_STEP_ID,
                    attempt: 0,
                    kind: Kind::Marker,
                    status: Status::Succeeded,
                    schema_ref: None,
                    payload: Some(canonical::to_string(output)?),
                });
            }

            Command::ContinueAsNew { input } => {
                self.completion = Some(Completion {
                    status: RunStatus::Continued,
                    output: None,
                });
                self.continue_as_new = Some(ContinueAsNew {
                    input: input.clone(),
                });
                self.push_lifecycle(LifecycleEvent {
                    step_id: CONTINUE_STEP_ID,
                    attempt: 0,
                    kind: Kind::Marker,
                    status: Status::Succeeded,
                    schema_ref: None,
                    payload: Some(canonical::to_string(input)?),
                });
            }
        }
        Ok(())
    }

    /// Seal the write-set. `state_hash` is stamped on every event, because a re-fold
    /// compares at transition boundaries and each event must pin the state it produced.
    pub fn finish(
        mut self,
        state: String,
        state_hash: String,
        state_inline: bool,
        run_status: RunStatus,
    ) -> Transition {
        for event in &mut self.events {
            event.state_hash = state_hash.clone();
        }
        Transition {
            run: vlo_types::RunPatch {
                status: run_status,
                last_seq: self.seq,
            },
            kernel_state: self.kernel_state,
            state,
            state_hash,
            state_inline,
            events: self.events,
            tasks: self.tasks,
            task_updates: self.task_updates,
            timers: self.timers,
            spawns: self.spawns,
            signal_waits: self.signal_waits,
            emits: self.emits,
            completion: self.completion,
            continue_as_new: self.continue_as_new,
        }
    }
}
