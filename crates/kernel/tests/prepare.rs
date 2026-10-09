//! `prepare_event`: legality, routing, and the lifecycle write-sets.

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

// ------------------------------------------------------------------------ started

#[test]
fn started_seeds_a_fresh_kernel_state_and_carries_the_input() {
    let input = json!({"n": 3});
    let prepared =
        prepare(run(RunStatus::Created, 0), None, started_event(&input)).expect("prepare");

    let Prepared::Reduce {
        reducer_event,
        init_input,
        kernel_state,
    } = prepared
    else {
        panic!("expected reduce");
    };
    assert_eq!(init_input, Some(input.clone()));
    assert_eq!(kernel_state.status, RunStatus::Running);
    assert_eq!(kernel_state.step_no, 0);
    assert!(kernel_state.steps.is_empty());
    assert_eq!(
        reducer_event,
        ReducerEvent::Started {
            ts_ms: TS,
            random: RANDOM.to_string(),
            input,
            usage_total: Usage::default(),
        }
    );
}

#[test]
fn started_is_rejected_after_seq_zero() {
    expect_err(
        run(RunStatus::Running, 4),
        Some(KernelState::new()),
        started_event(&json!(null)),
        code::BAD_SEQ,
    );
}

#[test]
fn started_is_rejected_on_a_run_that_is_already_running() {
    expect_err(
        run(RunStatus::Running, 0),
        Some(KernelState::new()),
        started_event(&json!(null)),
        code::ILLEGAL_TRANSITION,
    );
}

#[test]
fn started_rejects_an_offloaded_payload() {
    let mut event = started_event(&json!(1));
    event.payload = None;
    event.payload_ref = Some("blob://sha256/deadbeef".to_string());
    expect_err(run(RunStatus::Created, 0), None, event, code::INVALID_EVENT);
}

// -------------------------------------------------------------------- task result

#[test]
fn a_task_result_becomes_a_task_done_reducer_event() {
    let mut state = kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 1))], 1);
    state.usage_total = Usage {
        cpu_ms: 0,
        tokens: 100,
        cost_micro_usd: 0,
    };
    let mut event = with_payload(
        task_event("task#1", 1, Status::Succeeded),
        &json!({"ok": true}),
    );
    let spent = Usage {
        cpu_ms: 0,
        tokens: 40,
        cost_micro_usd: 7,
    };
    event.usage = Some(spent);
    let prepared = prepare(run(RunStatus::Running, 2), Some(state), event).expect("prepare");

    let Prepared::Reduce { reducer_event, .. } = prepared else {
        panic!("expected reduce");
    };
    assert_eq!(
        reducer_event,
        ReducerEvent::TaskDone {
            ts_ms: TS,
            random: RANDOM.to_string(),
            step_id: "task#1".to_string(),
            attempt: 1,
            activity: "plan".to_string(),
            status: Status::Succeeded,
            output: Some(json!({"ok": true})),
            cause: None,
            error: None,
            usage: spent,
            // The run total the reducer sees already includes this step.
            usage_total: Usage {
                cpu_ms: 0,
                tokens: 140,
                cost_micro_usd: 7,
            },
        }
    );
}

#[test]
fn a_failed_task_carries_cause_and_error_but_no_output() {
    let state = kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 1))], 1);
    let mut event = task_event("task#1", 1, Status::Failed);
    event.cause = Some(Cause::Timeout);
    event.error = Some("worker timed out".to_string());

    let Prepared::Reduce { reducer_event, .. } =
        prepare(run(RunStatus::Running, 2), Some(state), event).expect("prepare")
    else {
        panic!("expected reduce");
    };
    let ReducerEvent::TaskDone {
        output,
        cause,
        error,
        ..
    } = reducer_event
    else {
        panic!("expected task_done");
    };
    assert_eq!(output, None);
    assert_eq!(cause, Some(Cause::Timeout));
    assert_eq!(error.as_deref(), Some("worker timed out"));
}

#[test]
fn a_task_result_for_a_closed_step_is_unknown() {
    expect_err(
        run(RunStatus::Running, 2),
        Some(kernel_state_with(vec![], 1)),
        task_event("task#1", 1, Status::Succeeded),
        code::UNKNOWN_STEP,
    );
}

#[test]
fn a_stale_attempt_is_already_terminal_and_a_future_one_is_illegal() {
    let state = kernel_state_with(vec![("task#1", task_step("plan", Status::Running, 2))], 1);
    expect_err(
        run(RunStatus::Running, 2),
        Some(state.clone()),
        task_event("task#1", 1, Status::Succeeded),
        code::ALREADY_TERMINAL,
    );
    expect_err(
        run(RunStatus::Running, 2),
        Some(state),
        task_event("task#1", 3, Status::Succeeded),
        code::ILLEGAL_TRANSITION,
    );
}

#[test]
fn a_task_event_for_a_timer_step_is_illegal() {
    let mut state = kernel_state_with(vec![], 1);
    state.steps.insert(
        "timer#1".to_string(),
        StepState {
            kind: Kind::Timer,
            status: Status::Scheduled,
            attempt: 0,
            activity: None,
            queue: None,
            retry: None,
            child_run_id: None,
            signal: None,
            fire_at_ms: Some(TS),
        },
    );
    expect_err(
        run(RunStatus::Running, 2),
        Some(state),
        task_event("timer#1", 0, Status::Succeeded),
        code::ILLEGAL_TRANSITION,
    );
}

// ------------------------------------------------------------------------- guards

#[test]
fn any_event_on_a_terminal_run_is_refused() {
    for status in [
        RunStatus::Completed,
        RunStatus::Failed,
        RunStatus::Cancelled,
        RunStatus::Continued,
    ] {
        expect_err(
            run(status, 9),
            Some(KernelState::new()),
            task_event("task#1", 1, Status::Succeeded),
            code::RUN_CLOSED,
        );
    }
}

#[test]
fn an_event_for_another_run_is_refused() {
    let mut event = task_event("task#1", 1, Status::Succeeded);
    event.run_id = "run_other".to_string();
    expect_err(
        run(RunStatus::Running, 1),
        Some(KernelState::new()),
        event,
        code::INVALID_EVENT,
    );
}

#[test]
fn a_non_started_event_without_kernel_state_is_refused() {
    expect_err(
        run(RunStatus::Running, 1),
        None,
        task_event("task#1", 1, Status::Succeeded),
        code::INVALID_EVENT,
    );
}
