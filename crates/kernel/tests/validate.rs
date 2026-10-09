//! Envelope validation and event classification.

mod common;

use common::*;
use serde_json::json;
use vlo_kernel::classify::{classify, Class, CANCEL_STEP_ID, FAIL_STEP_ID, NONDETERMINISM_STEP_ID};
use vlo_kernel::{code, validate_event};
use vlo_types::{Cause, Kind, Status, INLINE_LIMIT_BYTES, START_STEP_ID};

fn reject(event: vlo_types::EventInput) -> String {
    validate_event(&event).expect_err("expected rejection").code
}

#[test]
fn accepts_a_well_formed_event() {
    let event = with_payload(
        task_event("task#1", 1, Status::Succeeded),
        &json!({"ok": true}),
    );
    assert_eq!(validate_event(&event).expect("valid"), event);
}

#[test]
fn rejects_empty_ids() {
    let mut event = task_event("task#1", 1, Status::Succeeded);
    event.step_id = String::new();
    assert_eq!(reject(event.clone()), code::INVALID_EVENT);
    event.step_id = "task#1".to_string();
    event.run_id = String::new();
    assert_eq!(reject(event), code::INVALID_EVENT);
}

#[test]
fn rejects_random_that_is_not_thirty_two_lowercase_hex() {
    for random in ["", "abc", &"A".repeat(32), &"z".repeat(32), &"a".repeat(31)] {
        let mut event = task_event("task#1", 1, Status::Succeeded);
        event.random = random.to_string();
        assert_eq!(reject(event), code::INVALID_EVENT, "accepted {random:?}");
    }
}

#[test]
fn rejects_both_payload_and_payload_ref() {
    let mut event = with_payload(task_event("task#1", 1, Status::Succeeded), &json!(1));
    event.payload_ref = Some("blob://sha256/abc".to_string());
    assert_eq!(reject(event), code::INVALID_EVENT);
}

#[test]
fn accepts_neither_payload_nor_payload_ref() {
    let event = task_event("task#1", 1, Status::Failed);
    assert!(validate_event(&event).is_ok());
}

#[test]
fn rejects_a_payload_ref_with_the_wrong_scheme() {
    let mut event = task_event("task#1", 1, Status::Succeeded);
    event.payload_ref = Some("https://example.com/blob".to_string());
    assert_eq!(reject(event), code::INVALID_EVENT);
}

#[test]
fn rejects_a_payload_over_the_inline_limit() {
    let mut event = task_event("task#1", 1, Status::Succeeded);
    event.payload = Some(format!("\"{}\"", "x".repeat(INLINE_LIMIT_BYTES)));
    assert_eq!(reject(event), code::PAYLOAD_TOO_LARGE);
}

#[test]
fn accepts_a_payload_exactly_at_the_inline_limit() {
    let mut event = task_event("task#1", 1, Status::Succeeded);
    event.payload = Some(format!("\"{}\"", "x".repeat(INLINE_LIMIT_BYTES - 2)));
    assert!(validate_event(&event).is_ok());
}

#[test]
fn rejects_a_payload_that_is_not_json() {
    let mut event = task_event("task#1", 1, Status::Succeeded);
    event.payload = Some("{not json".to_string());
    assert_eq!(reject(event), code::MALFORMED_JSON);
}

#[test]
fn classifies_every_routable_header() {
    let cases: &[(&str, Kind, Status, Class)] = &[
        (
            START_STEP_ID,
            Kind::Marker,
            Status::Succeeded,
            Class::Started,
        ),
        ("task#1", Kind::Task, Status::Succeeded, Class::TaskResult),
        ("task#1", Kind::Task, Status::Failed, Class::TaskResult),
        ("task#1", Kind::Task, Status::Running, Class::TaskRunning),
        ("task#1", Kind::Task, Status::Retrying, Class::TaskRetrying),
        (
            "task#1",
            Kind::Task,
            Status::Cancelled,
            Class::TaskCancelled,
        ),
        ("timer#1", Kind::Timer, Status::Succeeded, Class::TimerFired),
        (
            "signal#1",
            Kind::Signal,
            Status::Succeeded,
            Class::SignalDelivered,
        ),
        ("child#1", Kind::Child, Status::Succeeded, Class::ChildDone),
        ("child#1", Kind::Child, Status::Failed, Class::ChildDone),
        ("child#1", Kind::Child, Status::Cancelled, Class::ChildDone),
        (
            CANCEL_STEP_ID,
            Kind::Marker,
            Status::Cancelled,
            Class::UserCancel,
        ),
    ];
    for (step_id, kind, status, expected) in cases {
        let got = classify(&event(step_id, *kind, *status)).expect("classify");
        assert_eq!(got, *expected, "{step_id} {kind:?} {status:?}");
    }
}

#[test]
fn classifies_the_nondeterminism_marker_only_with_its_cause() {
    let mut event = event(NONDETERMINISM_STEP_ID, Kind::Marker, Status::Failed);
    assert_eq!(
        classify(&event).expect_err("expected rejection").code,
        code::INVALID_EVENT
    );
    event.cause = Some(Cause::NondeterminismDetected);
    assert_eq!(
        classify(&event).expect("classify"),
        Class::NondeterminismDetected
    );
}

#[test]
fn rejects_unroutable_headers() {
    let cases: &[(&str, Kind, Status)] = &[
        ("mystery", Kind::Marker, Status::Succeeded),
        (FAIL_STEP_ID, Kind::Marker, Status::Succeeded),
        (START_STEP_ID, Kind::Marker, Status::Failed),
        ("task#1", Kind::Task, Status::Scheduled),
        ("task#1", Kind::Task, Status::AwaitingSignal),
        ("timer#1", Kind::Timer, Status::Failed),
        ("signal#1", Kind::Signal, Status::AwaitingSignal),
        ("child#1", Kind::Child, Status::Running),
    ];
    for (step_id, kind, status) in cases {
        let error = classify(&event(step_id, *kind, *status)).expect_err("expected rejection");
        assert_eq!(
            error.code,
            code::INVALID_EVENT,
            "{step_id} {kind:?} {status:?}"
        );
    }
}

#[test]
fn only_reduce_classes_call_the_reducer() {
    for class in [
        Class::Started,
        Class::TaskResult,
        Class::TimerFired,
        Class::SignalDelivered,
        Class::ChildDone,
    ] {
        assert!(class.is_reduce(), "{class:?}");
    }
    for class in [
        Class::TaskRunning,
        Class::TaskRetrying,
        Class::TaskCancelled,
        Class::UserCancel,
        Class::RunFailed,
        Class::NondeterminismDetected,
    ] {
        assert!(!class.is_reduce(), "{class:?}");
    }
}
