//! Exhaustive legality table for the step state machine (see `docs/kernel-protocol.md`).

use vlo_kernel::step_machine::{is_legal, ALL_STATUSES};
use vlo_types::Status::*;

/// The whole table, written out. Anything not listed here must be rejected.
const LEGAL: &[(vlo_types::Status, vlo_types::Status)] = &[
    (Scheduled, Running),
    (Scheduled, Succeeded),
    (Scheduled, Failed),
    (Scheduled, Retrying),
    (Scheduled, Cancelled),
    (Running, Succeeded),
    (Running, Failed),
    (Running, Retrying),
    (Running, Cancelled),
    (Running, AwaitingSignal),
    (Retrying, Scheduled),
    (Retrying, Succeeded),
    (Retrying, Failed),
    (Retrying, Cancelled),
    (AwaitingSignal, Running),
    (AwaitingSignal, Succeeded),
    (AwaitingSignal, Cancelled),
];

#[test]
fn every_status_pair_matches_the_table() {
    for from in ALL_STATUSES {
        for to in ALL_STATUSES {
            let expected = LEGAL.contains(&(from, to));
            assert_eq!(
                is_legal(from, to),
                expected,
                "({from:?} → {to:?}) should be {}",
                if expected { "legal" } else { "illegal" }
            );
        }
    }
}

#[test]
fn table_covers_all_forty_nine_combinations() {
    assert_eq!(ALL_STATUSES.len() * ALL_STATUSES.len(), 49);
}

#[test]
fn terminal_statuses_have_no_outgoing_edges() {
    for from in [Succeeded, Failed, Cancelled] {
        assert!(from.is_terminal());
        for to in ALL_STATUSES {
            assert!(!is_legal(from, to), "({from:?} → {to:?}) must be illegal");
        }
    }
}

#[test]
fn no_status_transitions_to_itself() {
    for status in ALL_STATUSES {
        assert!(!is_legal(status, status));
    }
}
