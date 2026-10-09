//! `reduce_step`: the non-task commands — timers, spawns, signal waits, emits, and
//! the two ways a run closes.

mod common;

use common::*;
use serde_json::json;
use vlo_kernel::{code, reduce_step};
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

// ------------------------------------------------------------ timers, spawns, signals

#[test]
fn a_relative_timer_resolves_against_the_event_clock() {
    let transition = start(vec![Command::Timer {
        fire_in_ms: Some(60_000),
        fire_at_ms: None,
        id: None,
    }]);
    assert_eq!(
        transition.timers,
        vec![NewTimer {
            step_id: "timer#1".to_string(),
            fire_at_ms: TS + 60_000,
        }]
    );
    assert_eq!(
        transition.kernel_state.steps["timer#1"].fire_at_ms,
        Some(TS + 60_000)
    );
}

#[test]
fn an_absolute_timer_wins_over_a_relative_one() {
    let transition = start(vec![Command::Timer {
        fire_in_ms: Some(1),
        fire_at_ms: Some(42),
        id: None,
    }]);
    assert_eq!(transition.timers[0].fire_at_ms, 42);
}

#[test]
fn a_timer_with_neither_deadline_is_an_invalid_command() {
    expect_err(
        vec![Command::Timer {
            fire_in_ms: None,
            fire_at_ms: None,
            id: None,
        }],
        code::INVALID_COMMAND,
    );
}

#[test]
fn a_spawn_derives_the_child_run_id_from_the_step() {
    let transition = start(vec![Command::Spawn {
        workflow: "child-flow".to_string(),
        input: json!({"k": 1}),
        id: None,
    }]);
    let expected = vlo_kernel::ids::child_run_id(RUN_ID, "child#1");
    assert_eq!(
        transition.spawns,
        vec![NewSpawn {
            step_id: "child#1".to_string(),
            child_run_id: expected.clone(),
            workflow: "child-flow".to_string(),
            input: json!({"k": 1}),
        }]
    );
    assert_eq!(
        transition.kernel_state.steps["child#1"]
            .child_run_id
            .as_deref(),
        Some(expected.as_str())
    );
}

fn await_signal(timeout_ms: Option<u64>, id: Option<&str>) -> Command {
    Command::AwaitSignal {
        name: "approve".to_string(),
        schema_ref: None,
        timeout_ms,
        id: id.map(str::to_string),
    }
}

#[test]
fn await_signal_parks_the_run() {
    let transition = start(vec![await_signal(None, None)]);
    assert_eq!(transition.run.status, RunStatus::AwaitingSignal);
    assert_eq!(
        transition.signal_waits,
        vec![SignalWait {
            step_id: "signal#1".to_string(),
            name: "approve".to_string(),
            schema_ref: None,
            expires_at_ms: None,
        }]
    );
    assert_eq!(
        transition.kernel_state.steps["signal#1"].status,
        Status::AwaitingSignal
    );
    // No deadline: one step, one lifecycle event, no timer.
    assert_eq!(transition.kernel_state.steps.len(), 1);
    assert_eq!(transition.kernel_state.step_no, 1);
    assert_eq!(transition.events.len(), 2);
    assert!(transition.timers.is_empty());
}

#[test]
fn await_signal_with_a_timeout_opens_a_paired_deadline_timer() {
    let transition = start(vec![await_signal(Some(3_600_000), Some("ask"))]);

    // Still parked: the deadline belongs to the wait, it is not work of its own.
    assert_eq!(transition.run.status, RunStatus::AwaitingSignal);
    assert_eq!(
        transition.signal_waits[0].expires_at_ms,
        Some(TS + 3_600_000)
    );
    assert_eq!(
        transition.timers,
        vec![NewTimer {
            step_id: "ask:timeout".to_string(),
            fire_at_ms: TS + 3_600_000,
        }]
    );

    let timer = &transition.kernel_state.steps["ask:timeout"];
    assert_eq!(timer.kind, Kind::Timer);
    assert_eq!(timer.status, Status::Scheduled);
    assert_eq!(timer.fire_at_ms, Some(TS + 3_600_000));
    assert_eq!(
        transition.kernel_state.steps["ask"].status,
        Status::AwaitingSignal
    );
    // Both ids are reserved, so `step_no` advances by two, as it did when the reducer
    // issued the timer itself.
    assert_eq!(transition.kernel_state.step_no, 2);

    let lifecycle: Vec<(&str, Kind, Status)> = transition.events[1..]
        .iter()
        .map(|e| (e.input.step_id.as_str(), e.input.kind, e.input.status))
        .collect();
    assert_eq!(
        lifecycle,
        vec![
            ("ask", Kind::Signal, Status::AwaitingSignal),
            ("ask:timeout", Kind::Timer, Status::Scheduled),
        ]
    );
}

#[test]
fn the_derived_deadline_id_collides_like_any_other() {
    expect_err(
        vec![
            Command::Timer {
                fire_in_ms: Some(1),
                fire_at_ms: None,
                id: Some("ask:timeout".to_string()),
            },
            await_signal(Some(1), Some("ask")),
        ],
        code::DUPLICATE_STEP_ID,
    );
}

#[test]
fn a_signal_wait_alongside_open_work_leaves_the_run_running() {
    let transition = start(vec![
        Command::AwaitSignal {
            name: "approve".to_string(),
            schema_ref: None,
            timeout_ms: None,
            id: None,
        },
        task_cmd("plan", None),
    ]);
    assert_eq!(transition.run.status, RunStatus::Running);
}

#[test]
fn an_emit_never_becomes_an_event_or_a_step() {
    let transition = start(vec![Command::Emit {
        channel: "progress".to_string(),
        data: json!({"pct": 10}),
    }]);
    assert_eq!(transition.events.len(), 1);
    assert!(transition.kernel_state.steps.is_empty());
    assert_eq!(transition.kernel_state.step_no, 0);
    assert_eq!(
        transition.emits,
        vec![Emit {
            channel: "progress".to_string(),
            data: json!({"pct": 10}),
        }]
    );
}

// --------------------------------------------------------------------- completion

#[test]
fn complete_closes_the_run_and_cancels_whatever_is_still_open() {
    let kernel_state = kernel_state_with(
        vec![
            ("task#1", task_step("plan", Status::Running, 1)),
            ("task#2", task_step("write", Status::Scheduled, 2)),
        ],
        2,
    );
    let transition = reduce(
        run(RunStatus::Running, 5),
        kernel_state,
        with_payload(task_event("task#1", 1, Status::Succeeded), &json!("done")),
        reduction(
            json!({"phase": "done"}),
            vec![Command::Complete {
                output: json!({"total": 2}),
            }],
        ),
    )
    .expect("reduce_step");

    assert_eq!(transition.run.status, RunStatus::Completed);
    assert_eq!(
        transition.completion,
        Some(Completion {
            status: RunStatus::Completed,
            output: Some(json!({"total": 2})),
        })
    );
    assert!(transition.kernel_state.steps.is_empty());
    assert_eq!(transition.kernel_state.closed_steps, 2);
    assert_eq!(
        transition.task_updates,
        vec![
            // The trigger's own task row is settled first ...
            TaskUpdate {
                task_id: "run_test:task#1".to_string(),
                attempt: 1,
                status: Status::Succeeded,
                not_before_ms: None,
            },
            // ... then completion cancels whatever is still open.
            TaskUpdate {
                task_id: "run_test:task#2".to_string(),
                attempt: 2,
                status: Status::Cancelled,
                not_before_ms: None,
            },
        ]
    );
    let marker = transition.events.last().expect("marker");
    assert_eq!(marker.input.kind, Kind::Marker);
    assert_eq!(marker.input.step_id, "complete");
    assert_eq!(marker.input.payload.as_deref(), Some(r#"{"total":2}"#));
}

#[test]
fn continue_as_new_marks_the_run_continued() {
    let transition = start(vec![Command::ContinueAsNew {
        input: json!({"cursor": 10}),
    }]);
    assert_eq!(transition.run.status, RunStatus::Continued);
    assert_eq!(
        transition.continue_as_new,
        Some(ContinueAsNew {
            input: json!({"cursor": 10}),
        })
    );
    assert_eq!(
        transition.completion.map(|c| c.status),
        Some(RunStatus::Continued)
    );
    assert_eq!(
        transition.events.last().expect("marker").input.step_id,
        "continue"
    );
}

#[test]
fn two_completions_are_rejected() {
    expect_err(
        vec![
            Command::Complete { output: json!(1) },
            Command::Complete { output: json!(2) },
        ],
        code::MULTIPLE_COMPLETIONS,
    );
    expect_err(
        vec![
            Command::Complete { output: json!(1) },
            Command::ContinueAsNew { input: json!(2) },
        ],
        code::MULTIPLE_COMPLETIONS,
    );
}

#[test]
fn a_command_after_a_completion_is_rejected() {
    expect_err(
        vec![
            Command::Complete { output: json!(1) },
            task_cmd("late", None),
        ],
        code::COMMANDS_AFTER_COMPLETION,
    );
}
