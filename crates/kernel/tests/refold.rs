//! Re-fold comparison: find the first divergent seq, or prove there is none.

use vlo_kernel::refold_check;
use vlo_types::{HashAtSeq, RefoldCheckInput};

fn hashes(pairs: &[(u64, &str)]) -> Vec<HashAtSeq> {
    pairs
        .iter()
        .map(|(seq, hash)| HashAtSeq {
            seq: *seq,
            hash: hash.to_string(),
        })
        .collect()
}

fn check(expected: &[(u64, &str)], actual: &[(u64, &str)]) -> vlo_types::RefoldCheckOutput {
    refold_check(&RefoldCheckInput {
        expected: hashes(expected),
        actual: hashes(actual),
    })
}

#[test]
fn identical_sequences_match() {
    let out = check(&[(1, "a"), (2, "b")], &[(1, "a"), (2, "b")]);
    assert!(out.matches);
    assert_eq!(out.seq, None);
}

#[test]
fn empty_sequences_match() {
    assert!(check(&[], &[]).matches);
}

#[test]
fn reports_the_first_divergent_seq_not_the_last() {
    let out = check(
        &[(1, "a"), (2, "b"), (3, "c")],
        &[(1, "a"), (2, "X"), (3, "Y")],
    );
    assert!(!out.matches);
    assert_eq!(out.seq, Some(2));
    assert_eq!(out.expected.as_deref(), Some("b"));
    assert_eq!(out.actual.as_deref(), Some("X"));
}

#[test]
fn a_shorter_actual_diverges_at_the_first_missing_seq() {
    let out = check(&[(1, "a"), (2, "b")], &[(1, "a")]);
    assert!(!out.matches);
    assert_eq!(out.seq, Some(2));
    assert_eq!(out.expected.as_deref(), Some("b"));
    assert_eq!(out.actual.as_deref(), Some(""));
}

#[test]
fn a_longer_actual_diverges_at_the_first_extra_seq() {
    let out = check(&[(1, "a")], &[(1, "a"), (2, "b")]);
    assert!(!out.matches);
    assert_eq!(out.seq, Some(2));
    assert_eq!(out.expected.as_deref(), Some(""));
    assert_eq!(out.actual.as_deref(), Some("b"));
}

#[test]
fn a_seq_gap_is_itself_a_divergence() {
    let out = check(&[(1, "a"), (2, "b")], &[(1, "a"), (3, "b")]);
    assert!(!out.matches);
    assert_eq!(out.seq, Some(2));
}
