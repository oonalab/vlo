//! `prepare_event`: the signal / deadline race opened by `await_signal { timeout_ms }`.

mod common;

use common::*;
use serde_json::json;
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

fn signal_step(name: &str) -> StepState {
    StepState {
        kind: Kind::Signal,
        status: Status::AwaitingSignal,
        attempt: 0,
        activity: None,
        queue: None,
        retry: None,
        child_run_id: None,
        signal: Some(name.to_string()),
        fire_at_ms: None,
    }
}

fn timer_step(fire_at_ms: u64) -> StepState {
    StepState {
        kind: Kind::Timer,
        status: Status::Scheduled,
        attempt: 0,
        activity: None,
        queue: None,
        retry: None,
        child_run_id: None,
        signal: None,
        fire_at_ms: Some(fire_at_ms),
    }
}

/// `ask` awaiting `approve`, raced by its kernel-derived deadline `ask:timeout`.
fn racing_state() -> KernelState {
    kernel_state_with(
        vec![
            ("ask", signal_step("approve")),
            ("ask:timeout", timer_step(TS + 60_000)),
        ],
        2,
    )
}

fn signal_event(step_id: &str) -> EventInput {
    with_payload(
        event(step_id, Kind::Signal, Status::Succeeded),
        &json!({"approved": true}),
    )
}

fn timer_event(step_id: &str) -> EventInput {
    event(step_id, Kind::Timer, Status::Succeeded)
}

fn reduce_state(prepared: Prepared) -> KernelState {
    match prepared {
        Prepared::Reduce { kernel_state, .. } => kernel_state,
        other => panic!("expected reduce, got {other:?}"),
    }
}

#[test]
fn a_signal_that_lands_first_cancels_its_deadline_timer() {
    let prepared = prepare(
        run(RunStatus::AwaitingSignal, 3),
        Some(racing_state()),
        signal_event("ask"),
    )
    .expect("prepare");
    let kernel_state = reduce_state(prepared);

    // The trigger stays open for `reduce_step` to retire; the loser is already gone.
    assert!(kernel_state.steps.contains_key("ask"));
    assert!(!kernel_state.steps.contains_key("ask:timeout"));
    assert_eq!(kernel_state.closed_steps, 1);
}

#[test]
fn a_deadline_that_fires_first_cancels_its_signal_step() {
    let prepared = prepare(
        run(RunStatus::AwaitingSignal, 3),
        Some(racing_state()),
        timer_event("ask:timeout"),
    )
    .expect("prepare");
    let kernel_state = reduce_state(prepared);

    assert!(kernel_state.steps.contains_key("ask:timeout"));
    assert!(!kernel_state.steps.contains_key("ask"));
    assert_eq!(kernel_state.closed_steps, 1);
}

#[test]
fn the_loser_of_the_race_is_gone_so_its_late_event_is_unknown() {
    let awaiting = run(RunStatus::AwaitingSignal, 3);
    let ignore = |_: &ReducerEvent| reduction(json!({"phase": "x"}), vec![]);

    // Signal won: the timer fires late.
    let after_signal = fold(
        &awaiting,
        Some(racing_state()),
        &signal_event("ask"),
        ignore,
    );
    assert!(after_signal.kernel_state.steps.is_empty());
    assert_eq!(after_signal.kernel_state.closed_steps, 2);
    expect_err(
        run(after_signal.run.status, after_signal.run.last_seq),
        Some(after_signal.kernel_state),
        timer_event("ask:timeout"),
        code::UNKNOWN_STEP,
    );

    // Timer won: the signal arrives late.
    let after_timer = fold(
        &awaiting,
        Some(racing_state()),
        &timer_event("ask:timeout"),
        ignore,
    );
    assert!(after_timer.kernel_state.steps.is_empty());
    assert_eq!(after_timer.kernel_state.closed_steps, 2);
    expect_err(
        run(after_timer.run.status, after_timer.run.last_seq),
        Some(after_timer.kernel_state),
        signal_event("ask"),
        code::UNKNOWN_STEP,
    );
}

#[test]
fn a_timer_named_like_a_deadline_leaves_a_non_signal_step_alone() {
    let state = kernel_state_with(
        vec![
            ("job", task_step("plan", Status::Running, 1)),
            ("job:timeout", timer_step(TS + 60_000)),
        ],
        2,
    );
    let kernel_state = reduce_state(
        prepare(
            run(RunStatus::Running, 3),
            Some(state),
            timer_event("job:timeout"),
        )
        .expect("prepare"),
    );
    assert!(kernel_state.steps.contains_key("job"));
    assert_eq!(kernel_state.closed_steps, 0);
}
