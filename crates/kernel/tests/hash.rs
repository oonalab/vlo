//! State-hash vectors. A change here is a protocol break: every journaled event pins
//! one of these values.

use vlo_kernel::code;
use vlo_kernel::hash::{sha256_hex, state_hash};
use vlo_types::{KernelState, RunStatus};

#[test]
fn sha256_matches_the_published_vectors() {
    assert_eq!(
        sha256_hex(b""),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert_eq!(
        sha256_hex(b"abc"),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
}

#[test]
fn state_hash_is_pinned() {
    let state = KernelState::new();
    assert_eq!(
        state_hash(&state, "null").expect("hash"),
        "5acd358af54557f60c14c0bf5998efd00f66c6ddcef5c5d987c4b06c2c6ff46f"
    );
}

#[test]
fn state_hash_ignores_key_order_and_whitespace() {
    let state = KernelState::new();
    let a = state_hash(&state, r#"{"a":1,"b":2}"#).expect("hash");
    let b = state_hash(&state, "{ \"b\" : 2 , \"a\" : 1 }").expect("hash");
    assert_eq!(a, b);
}

#[test]
fn state_hash_covers_the_kernel_state_too() {
    let base = KernelState::new();
    let mut moved = KernelState::new();
    moved.status = RunStatus::Running;
    assert_ne!(
        state_hash(&base, "null").expect("hash"),
        state_hash(&moved, "null").expect("hash")
    );
}

#[test]
fn state_hash_rejects_malformed_state() {
    let error = state_hash(&KernelState::new(), "{oops").expect_err("expected rejection");
    assert_eq!(error.code, code::MALFORMED_JSON);
}
