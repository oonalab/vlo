//! Property tests over two scripted reducers — a sequence pipeline and a fan-out —
//! driven by random but legal event interleavings.
//!
//! What is asserted for every generated script: folding it twice produces identical
//! per-transition hashes and an identical journal; seqs are contiguous from 1; the step
//! map stays bounded and empties on completion; and every illegal event (a duplicate
//! result, a stale attempt, an unknown step, an event after the run closed) is refused.

mod common;

use common::*;
use proptest::prelude::*;
use serde_json::{json, Value};
use vlo_types::*;

// ------------------------------------------------------------------- reducers

fn leaf_task(activity: &str, input: Value, id: Option<String>) -> Command {
    Command::Task {
        activity: activity.to_string(),
        schema_ref: None,
        input,
        queue: None,
        retry: None,
        lease_ttl_ms: None,
        timeout_ms: None,
        id,
    }
}

fn parse_state(state: &str) -> Value {
    serde_json::from_str(state).unwrap_or(Value::Null)
}

/// `sequence([a, b, c, …])`: one task at a time, derived step ids, complete at the end.
fn sequence_reducer(steps: u64) -> impl Fn(&ReducerEvent, &str) -> Reduction {
    move |event, state| match event {
        ReducerEvent::Started { input, .. } => Reduction {
            state: json!({ "at": 0, "input": input, "results": [] }).to_string(),
            commands: vec![leaf_task("stage", json!({ "at": 0 }), None)],
        },
        ReducerEvent::TaskDone { output, .. } => {
            let mut next = parse_state(state);
            let at = next["at"].as_u64().unwrap_or(0) + 1;
            next["at"] = json!(at);
            if let Some(results) = next["results"].as_array_mut() {
                results.push(output.clone().unwrap_or(Value::Null));
            }
            let commands = if at < steps {
                vec![leaf_task("stage", json!({ "at": at }), None)]
            } else {
                vec![Command::Complete {
                    output: next["results"].clone(),
                }]
            };
            Reduction {
                state: next.to_string(),
                commands,
            }
        }
        _ => Reduction {
            state: state.to_string(),
            commands: vec![],
        },
    }
}

/// `fanOut(leaf, N)`: all branches at once under explicit ids, complete when all land.
fn fan_out_reducer(event: &ReducerEvent, state: &str) -> Reduction {
    match event {
        ReducerEvent::Started { input, .. } => {
            let n = input["n"].as_u64().unwrap_or(0);
            Reduction {
                state: json!({ "n": n, "done": 0, "results": {} }).to_string(),
                commands: (0..n)
                    .map(|i| leaf_task("leaf", json!({ "i": i }), Some(format!("fan/{i}"))))
                    .collect(),
            }
        }
        ReducerEvent::TaskDone {
            step_id, output, ..
        } => {
            let mut next = parse_state(state);
            next["results"][step_id] = output.clone().unwrap_or(Value::Null);
            let done = next["done"].as_u64().unwrap_or(0) + 1;
            next["done"] = json!(done);
            let commands = if done >= next["n"].as_u64().unwrap_or(0) {
                vec![Command::Complete {
                    output: next["results"].clone(),
                }]
            } else {
                vec![]
            };
            Reduction {
                state: next.to_string(),
                commands,
            }
        }
        _ => Reduction {
            state: state.to_string(),
            commands: vec![],
        },
    }
}

// --------------------------------------------------------------------- scripts

fn random_for(seed: u64) -> String {
    format!("{seed:032x}")
}

fn result_event(step_id: &str, attempt: u32, seed: u64, output: Value) -> EventInput {
    EventInput {
        random: random_for(seed),
        ..with_payload(task_event(step_id, attempt, Status::Succeeded), &output)
    }
}

fn running_event(step_id: &str, attempt: u32) -> EventInput {
    task_event(step_id, attempt, Status::Running)
}

fn retry_event(step_id: &str, next_attempt: u32) -> EventInput {
    let mut event = with_payload(
        task_event(step_id, next_attempt, Status::Retrying),
        &json!({ "delay_ms": 250 }),
    );
    event.cause = Some(Cause::Timeout);
    event
}

/// One branch's legal event sequence. `retried` inserts a dispatch + reschedule before
/// the result, so the result lands on attempt 2.
fn branch_events(step_id: &str, seed: u64, retried: bool) -> Vec<EventInput> {
    if retried {
        vec![
            running_event(step_id, 1),
            retry_event(step_id, 2),
            result_event(step_id, 2, seed, json!({ "step": step_id })),
        ]
    } else {
        vec![result_event(step_id, 1, seed, json!({ "step": step_id }))]
    }
}

// ----------------------------------------------------------------- invariants

fn assert_journal_invariants(engine: &Engine) {
    for (index, envelope) in engine.journal.iter().enumerate() {
        assert_eq!(
            envelope.seq,
            index as u64 + 1,
            "journal seqs must be contiguous from 1"
        );
        assert_eq!(envelope.input.run_id, engine.run.run_id);
        assert!(!envelope.state_hash.is_empty());
    }
    assert_eq!(
        engine.journal.last().map(|e| e.seq),
        Some(engine.run.last_seq)
    );
}

fn assert_same_fold(first: &Engine, second: &Engine) {
    assert_eq!(
        first.checkpoints, second.checkpoints,
        "a second fold produced different per-transition hashes"
    );
    assert_eq!(first.journal, second.journal, "journals diverged");
    assert_eq!(first.state, second.state, "final state diverged");
    assert_eq!(first.kernel_state, second.kernel_state);
}

/// Fold a script, asserting that every step is accepted and that the step map never
/// exceeds `max_open`. Returns the engine so the caller can fold again and compare.
fn fold(script: &[EventInput], reducer: Reducer<'_>, max_open: usize) -> Engine {
    let mut engine = Engine::new(RUN_ID);
    for event in script {
        engine.submit(event, reducer).expect("legal event refused");
        assert!(
            engine.open_steps() <= max_open,
            "step map grew past {max_open}"
        );
    }
    assert_journal_invariants(&engine);
    engine
}

// --------------------------------------------------------------------- tests

proptest! {
    #![proptest_config(ProptestConfig::with_cases(96))]

    /// Fan-out branches may land in any order, with retries mixed in. The run must
    /// complete once, with the same hashes on a second fold.
    #[test]
    fn fan_out_folds_identically_under_any_completion_order(
        n in 1usize..7,
        seed in any::<u64>(),
        retry_mask in any::<u8>(),
    ) {
        let mut order: Vec<usize> = (0..n).collect();
        // A seed-driven rotation + swap is enough to cover every interleaving shape.
        order.rotate_left(seed as usize % n);
        if n > 1 {
            order.swap(0, (seed as usize >> 8) % n);
        }

        let mut script = vec![started_event(&json!({ "n": n }))];
        for index in &order {
            let retried = retry_mask >> (index % 8) & 1 == 1;
            script.extend(branch_events(&format!("fan/{index}"), seed ^ *index as u64, retried));
        }

        let first = fold(&script, &fan_out_reducer, n);
        let second = fold(&script, &fan_out_reducer, n);
        assert_same_fold(&first, &second);

        prop_assert_eq!(first.run.status, RunStatus::Completed);
        prop_assert_eq!(first.open_steps(), 0);
        prop_assert_eq!(first.tasks.len(), n);
        prop_assert_eq!(
            first.kernel_state.as_ref().map(|k| k.closed_steps),
            Some(n as u64)
        );
    }

    /// A sequence pipeline is strictly serial: at most one open step at any time.
    #[test]
    fn sequence_folds_identically(steps in 1u64..8, seed in any::<u64>(), retry_mask in any::<u8>()) {
        let mut script = vec![started_event(&json!({ "seed": seed }))];
        for index in 0..steps {
            let retried = retry_mask >> (index % 8) & 1 == 1;
            script.extend(branch_events(&format!("task#{}", index + 1), seed ^ index, retried));
        }

        let reducer = sequence_reducer(steps);
        let first = fold(&script, &reducer, 1);
        let second = fold(&script, &reducer, 1);
        assert_same_fold(&first, &second);

        prop_assert_eq!(first.run.status, RunStatus::Completed);
        prop_assert_eq!(first.open_steps(), 0);
        prop_assert_eq!(first.tasks.len(), steps as usize);
    }

    /// Every illegal variant of a fan-out branch must be refused, and refusing must not
    /// move the run: the checkpoint after the rejections equals the one before.
    #[test]
    fn illegal_events_are_always_refused(n in 2usize..6, seed in any::<u64>()) {
        let mut engine = Engine::new(RUN_ID);
        engine
            .submit(&started_event(&json!({ "n": n })), &fan_out_reducer)
            .expect("started");

        let step_id = format!("fan/{}", seed as usize % n);
        let result = result_event(&step_id, 1, seed, json!({ "step": &step_id }));
        engine.submit(&result, &fan_out_reducer).expect("first result");

        let before = engine.checkpoints.clone();
        let journal_len = engine.journal.len();

        // A late duplicate of a result whose step is already closed.
        prop_assert_eq!(
            engine.submit(&result, &fan_out_reducer).unwrap_err().code,
            "unknown_step"
        );
        // A result for a step that never existed.
        prop_assert_eq!(
            engine
                .submit(&result_event("fan/999", 1, seed, json!(null)), &fan_out_reducer)
                .unwrap_err()
                .code,
            "unknown_step"
        );
        // A result on the wrong attempt for a live step.
        let live = format!("fan/{}", (seed as usize + 1) % n);
        if live != step_id {
            prop_assert_eq!(
                engine
                    .submit(&result_event(&live, 7, seed, json!(null)), &fan_out_reducer)
                    .unwrap_err()
                    .code,
                "illegal_transition"
            );
        }
        // A second `started` on a running run.
        prop_assert_eq!(
            engine
                .submit(&started_event(&json!({ "n": n })), &fan_out_reducer)
                .unwrap_err()
                .code,
            "bad_seq"
        );
        // A signal for a task step.
        let mut wrong_kind = event(&live, Kind::Signal, Status::Succeeded);
        wrong_kind.payload = Some("null".to_string());
        prop_assert_eq!(
            engine.submit(&wrong_kind, &fan_out_reducer).unwrap_err().code,
            "illegal_transition"
        );

        prop_assert_eq!(engine.checkpoints, before);
        prop_assert_eq!(engine.journal.len(), journal_len);
    }
}

#[test]
fn a_closed_run_refuses_everything() {
    let mut engine = Engine::new(RUN_ID);
    engine
        .submit(&started_event(&json!({ "n": 1 })), &fan_out_reducer)
        .expect("started");
    engine
        .submit(&result_event("fan/0", 1, 1, json!("out")), &fan_out_reducer)
        .expect("result");
    assert_eq!(engine.run.status, RunStatus::Completed);

    let error = engine
        .submit(
            &result_event("fan/0", 1, 2, json!("again")),
            &fan_out_reducer,
        )
        .expect_err("expected rejection");
    assert_eq!(error.code, "run_closed");
}
