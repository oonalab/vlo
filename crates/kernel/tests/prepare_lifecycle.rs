//! `prepare_event` outcomes that need no reducer: dispatch, reschedule, cancel, and
//! the two markers that close a run.

mod common;

use common::*;
use serde_json::json;
use vlo_kernel::classify::{CANCEL_STEP_ID, FAIL_STEP_ID, NONDETERMINISM_STEP_ID};
use vlo_kernel::{code, prepare_event};
use vlo_types::*;

fn prepare(
    run: RunRef,
    kernel_state: Option<KernelState>,
    event: EventInput,
) -> Result<Prepared, KernelError> {
    prepare_event(&PrepareEventInput {
        run,
        kernel_state,
        state: Some(json!({"phase": "x"}).to_string()),
        event,
    })
}

fn expect_err(
    run: RunRef,
    kernel_state: Option<KernelState>,
    event: EventInput,
    expected: &str,
) -> KernelError {
    let error = prepare(run, kernel_state, event).expect_err("expected rejection");
    assert_eq!(error.code, expected, "{}", error.message);
    error
}

fn lifecycle(run: RunRef, kernel_state: Option<KernelState>, event: EventInput) -> Transition {
    match prepare(run, kernel_state, event).expect("prepare") {
        Prepared::Lifecycle { transition } => transition,
        other => panic!("expected lifecycle, got {other:?}"),
    }
}

// ---------------------------------------------------------------------- lifecycle

#[test]
fn dispatch_moves_the_step_to_running_without_touching_the_state() {
    let state = kernel_state_with(vec![("task#1", task_step("plan", Status::Scheduled, 1))], 1);
    let transition = lifecycle(
        run(RunStatus::Running, 5),
        Some(state),
        task_event("task#1", 1, Status::Running),
    );

    assert_eq!(transition.run.status, RunStatus::Running);
    assert_eq!(transition.run.last_seq, 6);
    assert_eq!(transition.events.len(), 1);
    assert_eq!(transition.events[0].seq, 6);
    assert_eq!(transition.state, json!({"phase": "x"}).to_string());
    assert_eq!(
        transition.kernel_state.steps["task#1"].status,
        Status::Running
    );
    assert_eq!(
        transition.task_updates,
        vec![TaskUpdate {
            task_id: "run_test:task#1".to_string(),
            attempt: 1,
            status: Status::Running,
            not_before_ms: None,
        }]
    );
    assert_eq!(transition.events[0].state_hash, transition.state_hash);
}

#[test]
fn a_reschedule_bumps_the_attempt_and_sets_not_before() {
    let state = kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 1))], 1);
    let mut event = with_payload(
        task_event("task#1", 2, Status::Retrying),
        &json!({"delay_ms": 1_500}),
    );
    event.cause = Some(Cause::Timeout);

    let transition = lifecycle(run(RunStatus::Running, 5), Some(state), event);
    let step = &transition.kernel_state.steps["task#1"];
    assert_eq!(step.status, Status::Scheduled);
    assert_eq!(step.attempt, 2);
    assert_eq!(
        transition.task_updates,
        vec![TaskUpdate {
            task_id: "run_test:task#1".to_string(),
            attempt: 2,
            status: Status::Scheduled,
            not_before_ms: Some(TS + 1_500),
        }]
    );
}

/// A lifecycle event never reaches `reduce_step`, so `prepare_event` is the only place that
/// can bank what the lost attempt spent before it lost.
#[test]
fn a_reschedule_banks_the_usage_the_failed_attempt_spent() {
    let mut state = kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 1))], 1);
    state.usage_total = Usage {
        cpu_ms: 0,
        tokens: 100,
        cost_micro_usd: 0,
    };
    let mut event = with_payload(
        task_event("task#1", 2, Status::Retrying),
        &json!({"delay_ms": 0}),
    );
    event.cause = Some(Cause::Timeout);
    event.usage = Some(Usage {
        cpu_ms: 3,
        tokens: 50,
        cost_micro_usd: 9,
    });

    let transition = lifecycle(run(RunStatus::Running, 5), Some(state), event);
    assert_eq!(
        transition.kernel_state.usage_total,
        Usage {
            cpu_ms: 3,
            tokens: 150,
            cost_micro_usd: 9,
        }
    );
}

#[test]
fn a_reschedule_that_repeats_or_skips_an_attempt_is_rejected() {
    let state = kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 2))], 1);
    expect_err(
        run(RunStatus::Running, 5),
        Some(state.clone()),
        task_event("task#1", 2, Status::Retrying),
        code::ALREADY_TERMINAL,
    );
    expect_err(
        run(RunStatus::Running, 5),
        Some(state),
        task_event("task#1", 4, Status::Retrying),
        code::ILLEGAL_TRANSITION,
    );
}

#[test]
fn a_reschedule_with_a_non_numeric_delay_is_rejected() {
    let state = kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 1))], 1);
    expect_err(
        run(RunStatus::Running, 5),
        Some(state),
        with_payload(
            task_event("task#1", 2, Status::Retrying),
            &json!({"delay_ms": "soon"}),
        ),
        code::INVALID_EVENT,
    );
}

#[test]
fn cancelling_a_task_closes_its_step() {
    let state = kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 1))], 1);
    let transition = lifecycle(
        run(RunStatus::Running, 5),
        Some(state),
        task_event("task#1", 1, Status::Cancelled),
    );
    assert!(transition.kernel_state.steps.is_empty());
    assert_eq!(transition.kernel_state.closed_steps, 1);
    assert_eq!(transition.task_updates[0].status, Status::Cancelled);
}

#[test]
fn a_user_cancel_closes_the_run_and_every_open_task() {
    let state = kernel_state_with(
        vec![
            ("task#1", task_step("plan", Status::Running, 1)),
            ("task#2", task_step("write", Status::Scheduled, 1)),
        ],
        2,
    );
    let mut event = event(CANCEL_STEP_ID, Kind::Marker, Status::Cancelled);
    event.cause = Some(Cause::UserCancel);

    let transition = lifecycle(run(RunStatus::Running, 7), Some(state), event);
    assert_eq!(transition.run.status, RunStatus::Cancelled);
    assert_eq!(transition.kernel_state.status, RunStatus::Cancelled);
    assert!(transition.kernel_state.steps.is_empty());
    assert_eq!(transition.kernel_state.closed_steps, 2);
    assert_eq!(transition.task_updates.len(), 2);
    assert!(transition
        .task_updates
        .iter()
        .all(|u| u.status == Status::Cancelled));
}

#[test]
fn a_fail_marker_fails_the_run_and_cancels_open_work() {
    let state = kernel_state_with(
        vec![
            ("task#1", task_step("plan", Status::Running, 1)),
            ("task#2", task_step("write", Status::Scheduled, 1)),
        ],
        2,
    );
    let mut event = event(FAIL_STEP_ID, Kind::Marker, Status::Failed);
    event.cause = Some(Cause::AppError);
    event.error = Some("reducer threw".to_string());

    let transition = lifecycle(run(RunStatus::Running, 4), Some(state), event);
    assert_eq!(transition.run.status, RunStatus::Failed);
    assert_eq!(transition.kernel_state.status, RunStatus::Failed);
    assert!(transition.kernel_state.steps.is_empty());
    assert_eq!(transition.task_updates.len(), 2);
    assert!(transition
        .task_updates
        .iter()
        .all(|u| u.status == Status::Cancelled));
    assert_eq!(
        transition.events[0].input.error.as_deref(),
        Some("reducer threw")
    );
}

#[test]
fn a_nondeterminism_marker_fails_the_run() {
    let state = kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 1))], 1);
    let mut event = event(NONDETERMINISM_STEP_ID, Kind::Marker, Status::Failed);
    event.cause = Some(Cause::NondeterminismDetected);

    let transition = lifecycle(run(RunStatus::Running, 3), Some(state), event);
    assert_eq!(transition.run.status, RunStatus::Failed);
    assert!(transition.kernel_state.steps.is_empty());
}
