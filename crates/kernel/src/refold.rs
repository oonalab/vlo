//! Re-fold comparison (see `docs/kernel-protocol.md`). The host re-folds the last N events over the
//! previous checkpoint and hands both hash sequences here; the first divergent seq is
//! what it records as `nondeterminism_detected`.

use vlo_types::{HashAtSeq, RefoldCheckInput, RefoldCheckOutput};

fn diverged(
    seq: u64,
    expected: Option<&HashAtSeq>,
    actual: Option<&HashAtSeq>,
) -> RefoldCheckOutput {
    RefoldCheckOutput {
        matches: false,
        seq: Some(seq),
        expected: Some(expected.map(|h| h.hash.clone()).unwrap_or_default()),
        actual: Some(actual.map(|h| h.hash.clone()).unwrap_or_default()),
    }
}

/// Compare journaled hashes with re-folded ones and report the first divergence.
///
/// Both lists are read in order; a length mismatch counts as a divergence at the first
/// seq only one side has. Never fails.
pub fn refold_check(input: &RefoldCheckInput) -> RefoldCheckOutput {
    let common = input.expected.len().min(input.actual.len());
    for index in 0..common {
        let expected = &input.expected[index];
        let actual = &input.actual[index];
        if expected.seq != actual.seq || expected.hash != actual.hash {
            return diverged(expected.seq.min(actual.seq), Some(expected), Some(actual));
        }
    }
    if input.expected.len() != input.actual.len() {
        let missing_in_actual = input.expected.len() > common;
        let present = if missing_in_actual {
            &input.expected[common]
        } else {
            &input.actual[common]
        };
        return if missing_in_actual {
            diverged(present.seq, Some(present), None)
        } else {
            diverged(present.seq, None, Some(present))
        };
    }
    RefoldCheckOutput {
        matches: true,
        seq: None,
        expected: None,
        actual: None,
    }
}
