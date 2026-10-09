//! Builders shared by the kernel test suite.

#![allow(dead_code)]

pub mod golden;

use serde_json::{json, Value};
use vlo_types::*;

pub const RUN_ID: &str = "run_test";
pub const RANDOM: &str = "0123456789abcdef0123456789abcdef";
pub const TS: u64 = 1_700_000_000_000;

pub fn run(status: RunStatus, last_seq: u64) -> RunRef {
    RunRef {
        run_id: RUN_ID.to_string(),
        workflow: "example".to_string(),
        bundle_digest: "sha256:bundle".to_string(),
        status,
        last_seq,
        parent_run_id: None,
        parent_step_id: None,
    }
}

pub fn event(step_id: &str, kind: Kind, status: Status) -> EventInput {
    EventInput {
        run_id: RUN_ID.to_string(),
        step_id: step_id.to_string(),
        attempt: 0,
        kind,
        status,
        cause: None,
        usage: None,
        ts_ms: TS,
        random: RANDOM.to_string(),
        schema_ref: None,
        payload: None,
        payload_ref: None,
        error: None,
    }
}

pub fn with_payload(mut event: EventInput, payload: &Value) -> EventInput {
    event.payload = Some(payload.to_string());
    event
}

pub fn started_event(input: &Value) -> EventInput {
    with_payload(event(START_STEP_ID, Kind::Marker, Status::Succeeded), input)
}

pub fn task_event(step_id: &str, attempt: u32, status: Status) -> EventInput {
    EventInput {
        attempt,
        ..event(step_id, Kind::Task, status)
    }
}

pub fn task_step(activity: &str, status: Status, attempt: u32) -> StepState {
    StepState {
        kind: Kind::Task,
        status,
        attempt,
        activity: Some(activity.to_string()),
        queue: Some("default".to_string()),
        retry: Some(RetryPolicy::default()),
        child_run_id: None,
        signal: None,
        fire_at_ms: None,
    }
}

pub fn kernel_state_with(steps: Vec<(&str, StepState)>, step_no: u64) -> KernelState {
    let mut state = KernelState::new();
    state.status = RunStatus::Running;
    state.step_no = step_no;
    for (id, step) in steps {
        state.steps.insert(id.to_string(), step);
    }
    state
}

pub fn reduction(state: Value, commands: Vec<Command>) -> Reduction {
    Reduction {
        state: state.to_string(),
        commands,
    }
}

pub fn task_cmd(activity: &str, id: Option<&str>) -> Command {
    Command::Task {
        activity: activity.to_string(),
        schema_ref: None,
        input: json!({ "a": 1 }),
        queue: None,
        retry: None,
        lease_ttl_ms: None,
        timeout_ms: None,
        id: id.map(str::to_string),
    }
}

/// Run one full transition: `prepare_event` must yield a reduce, then `reduce_step`
/// applies the reduction the caller supplies.
pub fn fold(
    run: &RunRef,
    kernel_state: Option<KernelState>,
    event: &EventInput,
    reduce: impl FnOnce(&ReducerEvent) -> Reduction,
) -> Transition {
    let prepared = vlo_kernel::prepare_event(&PrepareEventInput {
        run: run.clone(),
        kernel_state: kernel_state.clone(),
        state: Some("null".to_string()),
        event: event.clone(),
    })
    .expect("prepare_event");

    let Prepared::Reduce {
        reducer_event,
        kernel_state,
        ..
    } = prepared
    else {
        panic!("expected a reduce outcome");
    };

    vlo_kernel::reduce_step(&ReduceStepInput {
        run: run.clone(),
        kernel_state,
        event: event.clone(),
        reduction: reduce(&reducer_event),
    })
    .expect("reduce_step")
}

/// A minimal in-memory host: applies whatever `prepare_event` / `reduce_step` return and
/// keeps the journal, so tests can fold a script and compare two folds.
pub struct Engine {
    pub run: RunRef,
    pub kernel_state: Option<KernelState>,
    pub state: String,
    pub journal: Vec<Envelope>,
    pub checkpoints: Vec<HashAtSeq>,
    pub tasks: Vec<NewTask>,
    pub completion: Option<Completion>,
}

pub type Reducer<'a> = &'a dyn Fn(&ReducerEvent, &str) -> Reduction;

impl Engine {
    pub fn new(run_id: &str) -> Self {
        Engine {
            run: RunRef {
                run_id: run_id.to_string(),
                ..run(RunStatus::Created, 0)
            },
            kernel_state: None,
            state: "null".to_string(),
            journal: Vec::new(),
            checkpoints: Vec::new(),
            tasks: Vec::new(),
            completion: None,
        }
    }

    pub fn submit(&mut self, event: &EventInput, reducer: Reducer<'_>) -> Result<(), KernelError> {
        let prepared = vlo_kernel::prepare_event(&PrepareEventInput {
            run: self.run.clone(),
            kernel_state: self.kernel_state.clone(),
            state: Some(self.state.clone()),
            event: event.clone(),
        })?;

        let transition = match prepared {
            Prepared::Lifecycle { transition } => transition,
            Prepared::Reduce {
                reducer_event,
                kernel_state,
                ..
            } => {
                let reduction = reducer(&reducer_event, &self.state);
                vlo_kernel::reduce_step(&ReduceStepInput {
                    run: self.run.clone(),
                    kernel_state,
                    event: event.clone(),
                    reduction,
                })?
            }
        };
        self.apply(transition);
        Ok(())
    }

    fn apply(&mut self, transition: Transition) {
        self.run.status = transition.run.status;
        self.run.last_seq = transition.run.last_seq;
        self.kernel_state = Some(transition.kernel_state);
        self.state = transition.state;
        self.journal.extend(transition.events);
        self.checkpoints.push(HashAtSeq {
            seq: transition.run.last_seq,
            hash: transition.state_hash,
        });
        self.tasks.extend(transition.tasks);
        if let Some(completion) = transition.completion {
            self.completion = Some(completion);
        }
    }

    pub fn open_steps(&self) -> usize {
        self.kernel_state
            .as_ref()
            .map(|state| state.steps.len())
            .unwrap_or(0)
    }
}
