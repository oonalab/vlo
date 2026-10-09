//! Id derivation must be a pure function of its inputs: dispatch idempotency and child
//! run recovery both depend on it.

use vlo_kernel::derive_ids;
use vlo_kernel::ids::{child_run_id, idempotency_key, task_id};
use vlo_types::DeriveIdsInput;

fn ids(run_id: &str, step_id: &str, attempt: u32) -> vlo_types::DeriveIdsOutput {
    derive_ids(&DeriveIdsInput {
        run_id: run_id.to_string(),
        step_id: step_id.to_string(),
        attempt,
    })
}

#[test]
fn task_and_idempotency_keys_are_colon_joined() {
    let derived = ids("run_1", "task#2", 3);
    assert_eq!(derived.task_id, "run_1:task#2");
    assert_eq!(derived.idempotency_key, "run_1:task#2:3");
    assert_eq!(task_id("run_1", "task#2"), derived.task_id);
    assert_eq!(
        idempotency_key("run_1", "task#2", 3),
        derived.idempotency_key
    );
}

#[test]
fn idempotency_key_changes_per_attempt_but_task_id_does_not() {
    let first = ids("run_1", "task#1", 1);
    let second = ids("run_1", "task#1", 2);
    assert_eq!(first.task_id, second.task_id);
    assert_ne!(first.idempotency_key, second.idempotency_key);
}

#[test]
fn child_run_id_is_deterministic_and_fixed_width() {
    let derived = ids("run_1", "child#1", 1);
    assert_eq!(derived.child_run_id, child_run_id("run_1", "child#1"));
    assert_eq!(derived.child_run_id.len(), "run_".len() + 26);
    assert!(derived.child_run_id.starts_with("run_"));
    assert!(derived.child_run_id[4..]
        .bytes()
        .all(|b| b.is_ascii_hexdigit()));
    // Pinned: a child run must be recoverable by re-deriving its id.
    assert_eq!(derived.child_run_id, "run_571891efc28339b6b3b614cb04");
}

#[test]
fn child_run_id_is_unique_per_step_and_per_run() {
    assert_ne!(
        child_run_id("run_1", "child#1"),
        child_run_id("run_1", "child#2")
    );
    assert_ne!(
        child_run_id("run_1", "child#1"),
        child_run_id("run_2", "child#1")
    );
}

#[test]
fn attempt_does_not_affect_the_child_run_id() {
    assert_eq!(
        ids("run_1", "child#1", 1).child_run_id,
        ids("run_1", "child#1", 9).child_run_id
    );
}
