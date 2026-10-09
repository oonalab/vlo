//! `reduce_step`: command validation and write-set construction.

mod common;

use common::*;
use serde_json::json;
use vlo_kernel::{code, reduce_step, DEFAULT_LEASE_TTL_MS, DEFAULT_QUEUE};
use vlo_types::*;

fn reduce(
    run: RunRef,
    kernel_state: KernelState,
    event: EventInput,
    reduction: Reduction,
) -> Result<Transition, KernelError> {
    reduce_step(&ReduceStepInput {
        run,
        kernel_state,
        event,
        reduction,
    })
}

fn start(commands: Vec<Command>) -> Transition {
    let mut kernel_state = KernelState::new();
    kernel_state.status = RunStatus::Running;
    reduce(
        run(RunStatus::Created, 0),
        kernel_state,
        started_event(&json!({"n": 2})),
        reduction(json!({"phase": "run"}), commands),
    )
    .expect("reduce_step")
}

fn expect_err(commands: Vec<Command>, expected: &str) {
    let mut kernel_state = KernelState::new();
    kernel_state.status = RunStatus::Running;
    let error = reduce(
        run(RunStatus::Created, 0),
        kernel_state,
        started_event(&json!(null)),
        reduction(json!({}), commands),
    )
    .expect_err("expected rejection");
    assert_eq!(error.code, expected, "{}", error.message);
}

// -------------------------------------------------------------------------- tasks

#[test]
fn a_task_command_opens_a_step_a_row_and_a_scheduled_event() {
    let transition = start(vec![task_cmd("plan", None)]);

    assert_eq!(transition.run.status, RunStatus::Running);
    assert_eq!(transition.run.last_seq, 2);
    assert_eq!(transition.events.len(), 2);
    assert_eq!(transition.events[0].input.step_id, START_STEP_ID);
    assert_eq!(transition.events[0].seq, 1);
    assert_eq!(transition.events[1].seq, 2);
    assert_eq!(transition.events[1].input.step_id, "task#1");
    assert_eq!(transition.events[1].input.status, Status::Scheduled);
    assert_eq!(
        transition.events[1].input.payload.as_deref(),
        Some(r#"{"a":1}"#)
    );

    assert_eq!(
        transition.tasks,
        vec![NewTask {
            task_id: "run_test:task#1".to_string(),
            step_id: "task#1".to_string(),
            attempt: 1,
            activity: "plan".to_string(),
            queue: DEFAULT_QUEUE.to_string(),
            schema_ref: None,
            input: json!({"a": 1}),
            idempotency_key: "run_test:task#1:1".to_string(),
            retry: RetryPolicy::default(),
            lease_ttl_ms: DEFAULT_LEASE_TTL_MS,
            timeout_ms: None,
        }]
    );
    let step = &transition.kernel_state.steps["task#1"];
    assert_eq!(step.kind, Kind::Task);
    assert_eq!(step.status, Status::Scheduled);
    assert_eq!(step.attempt, 1);
    assert_eq!(transition.kernel_state.step_no, 1);
}

#[test]
fn every_event_in_one_transition_shares_the_state_hash() {
    let transition = start(vec![
        task_cmd("a", None),
        task_cmd("b", None),
        task_cmd("c", None),
    ]);
    assert_eq!(transition.events.len(), 4);
    for event in &transition.events {
        assert_eq!(event.state_hash, transition.state_hash);
    }
    let seqs: Vec<u64> = transition.events.iter().map(|e| e.seq).collect();
    assert_eq!(seqs, vec![1, 2, 3, 4]);
}

#[test]
fn explicit_step_ids_are_honoured_and_still_advance_the_counter() {
    let transition = start(vec![
        task_cmd("a", Some("fan/0")),
        task_cmd("b", None),
        task_cmd("c", Some("fan/1")),
    ]);
    let ids: Vec<&str> = transition
        .kernel_state
        .steps
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(ids, vec!["fan/0", "fan/1", "task#2"]);
    assert_eq!(transition.kernel_state.step_no, 3);
}

#[test]
fn a_duplicate_step_id_is_rejected() {
    expect_err(
        vec![task_cmd("a", Some("same")), task_cmd("b", Some("same"))],
        code::DUPLICATE_STEP_ID,
    );
}

#[test]
fn an_empty_activity_or_step_id_is_an_invalid_command() {
    expect_err(vec![task_cmd("", None)], code::INVALID_COMMAND);
    expect_err(vec![task_cmd("a", Some(""))], code::INVALID_COMMAND);
}

#[test]
fn queue_retry_and_lease_overrides_reach_the_task_row() {
    let retry = RetryPolicy {
        max_attempts: 7,
        backoff: Backoff::Fixed,
        initial_ms: 250,
        max_ms: 500,
        factor: 1,
        jitter: Jitter::None,
    };
    let transition = start(vec![Command::Task {
        activity: "render".to_string(),
        schema_ref: Some("render@abc".to_string()),
        input: json!([1, 2]),
        queue: Some("gpu".to_string()),
        retry: Some(retry.clone()),
        lease_ttl_ms: Some(5_000),
        timeout_ms: Some(30_000),
        id: None,
    }]);
    let task = &transition.tasks[0];
    assert_eq!(task.queue, "gpu");
    assert_eq!(task.retry, retry);
    assert_eq!(task.lease_ttl_ms, 5_000);
    assert_eq!(task.timeout_ms, Some(30_000));
    assert_eq!(task.schema_ref.as_deref(), Some("render@abc"));
    assert_eq!(
        transition.events[1].input.schema_ref.as_deref(),
        Some("render@abc")
    );
}

// ------------------------------------------------------------------------- triggers

#[test]
fn the_trigger_step_is_closed_and_its_usage_banked() {
    let kernel_state =
        kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 1))], 1);
    let mut event = with_payload(task_event("task#1", 1, Status::Succeeded), &json!("out"));
    event.usage = Some(Usage {
        cpu_ms: 12,
        tokens: 300,
        cost_micro_usd: 45,
    });

    let transition = reduce(
        run(RunStatus::Running, 3),
        kernel_state,
        event,
        reduction(json!({}), vec![]),
    )
    .expect("reduce_step");

    assert!(transition.kernel_state.steps.is_empty());
    assert_eq!(transition.kernel_state.closed_steps, 1);
    assert_eq!(
        transition.kernel_state.usage_total,
        Usage {
            cpu_ms: 12,
            tokens: 300,
            cost_micro_usd: 45,
        }
    );
}

#[test]
fn a_trigger_for_an_unknown_step_is_rejected() {
    let error = reduce(
        run(RunStatus::Running, 3),
        kernel_state_with(vec![], 1),
        task_event("task#9", 1, Status::Succeeded),
        reduction(json!({}), vec![]),
    )
    .expect_err("expected rejection");
    assert_eq!(error.code, code::UNKNOWN_STEP);
    assert_eq!(error.step_id.as_deref(), Some("task#9"));
}

#[test]
fn a_lifecycle_event_cannot_be_reduced() {
    let error = reduce(
        run(RunStatus::Running, 3),
        kernel_state_with(vec![("task#1", task_step("plan", Status::Scheduled, 1))], 1),
        task_event("task#1", 1, Status::Running),
        reduction(json!({}), vec![]),
    )
    .expect_err("expected rejection");
    assert_eq!(error.code, code::INVALID_EVENT);
}

#[test]
fn a_reducer_state_that_is_not_json_is_rejected() {
    let error = reduce(
        run(RunStatus::Created, 0),
        KernelState::new(),
        started_event(&json!(null)),
        Reduction {
            state: "{oops".to_string(),
            commands: vec![],
        },
    )
    .expect_err("expected rejection");
    assert_eq!(error.code, code::MALFORMED_JSON);
}

#[test]
fn the_state_is_stored_byte_exact_but_hashed_canonically() {
    let unsorted = r#"{ "b": 2, "a": 1 }"#;
    let sorted = r#"{"a":1,"b":2}"#;
    let transitions: Vec<Transition> = [unsorted, sorted]
        .iter()
        .map(|state| {
            let mut kernel_state = KernelState::new();
            kernel_state.status = RunStatus::Running;
            reduce(
                run(RunStatus::Created, 0),
                kernel_state,
                started_event(&json!(null)),
                Reduction {
                    state: state.to_string(),
                    commands: vec![],
                },
            )
            .expect("reduce_step")
        })
        .collect();

    assert_eq!(transitions[0].state, unsorted);
    assert_eq!(transitions[1].state, sorted);
    assert_eq!(transitions[0].state_hash, transitions[1].state_hash);
    assert!(transitions[0].state_inline);
}

#[test]
fn a_run_with_no_open_work_stays_running() {
    let transition = start(vec![]);
    assert_eq!(transition.run.status, RunStatus::Running);
    assert_eq!(transition.events.len(), 1);
}
