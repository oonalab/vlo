//! Canonical JSON vectors. These are the contract every state hash rests on.

use vlo_kernel::canonical::{canonical_of, canonicalize};
use vlo_kernel::code;

fn canon(raw: &str) -> String {
    canonicalize(raw).expect("canonicalize")
}

#[test]
fn sorts_object_keys_and_strips_whitespace() {
    assert_eq!(canon(r#"{ "b": 1,  "a" : 2 }"#), r#"{"a":2,"b":1}"#);
    assert_eq!(canon("[ 1 , 2 ,\n3 ]"), "[1,2,3]");
    assert_eq!(canon("\n\t null \n"), "null");
}

#[test]
fn sorts_nested_objects_and_preserves_array_order() {
    assert_eq!(
        canon(r#"{"z":{"y":1,"x":[{"b":2,"a":1},{"d":4,"c":3}]},"a":0}"#),
        r#"{"a":0,"z":{"x":[{"a":1,"b":2},{"c":3,"d":4}],"y":1}}"#
    );
}

#[test]
fn key_order_does_not_change_the_canonical_form() {
    assert_eq!(canon(r#"{"a":1,"b":2}"#), canon(r#"{"b":2,"a":1}"#));
}

#[test]
fn unicode_and_escapes_round_trip() {
    assert_eq!(canon(r#"{"k":"héllo ✓ 日本"}"#), r#"{"k":"héllo ✓ 日本"}"#);
    assert_eq!(
        canon(r#""line\nbreak\t\"quote\"""#),
        r#""line\nbreak\t\"quote\"""#
    );
    // An escaped ASCII letter collapses to the shortest encoding.
    assert_eq!(canon("\"\\u0041\""), r#""A""#);
    // A NUL survives as its escape, never as a raw control byte.
    let nul = "\"\\u0000\"";
    assert_eq!(canon(nul), nul);
}

#[test]
fn integers_stay_exact_across_the_i64_and_u64_range() {
    for raw in [
        "0",
        "-1",
        "9007199254740993",
        "18446744073709551615",
        "-9223372036854775808",
    ] {
        assert_eq!(canon(raw), raw, "integer {raw} lost precision");
    }
}

#[test]
fn floats_round_trip_identically_twice() {
    for raw in ["1.0", "1e21", "-0.5", "1.5e-7", "3.141592653589793"] {
        let once = canon(raw);
        let twice = canon(&once);
        assert_eq!(once, twice, "canonicalization is not idempotent for {raw}");
    }
    assert_eq!(canon("1.0"), "1.0");
    assert_eq!(canon("1e21"), "1e+21");
}

#[test]
fn canonicalization_is_idempotent_for_documents() {
    let raw = r#"{ "b": [1, {"z": null, "a": true}], "a": "x" }"#;
    let once = canon(raw);
    assert_eq!(canon(&once), once);
}

#[test]
fn rejects_non_finite_and_malformed_input() {
    for raw in [
        "NaN",
        "Infinity",
        "-Infinity",
        r#"{"a":NaN}"#,
        "{",
        "",
        "'x'",
    ] {
        let error = canonicalize(raw).expect_err("expected rejection");
        assert_eq!(error.code, code::MALFORMED_JSON, "accepted {raw}");
    }
}

#[test]
fn struct_serialization_goes_through_sorted_maps() {
    let state = vlo_types::KernelState::new();
    let canonical = canonical_of(&state).expect("canonical_of");
    assert_eq!(
        canonical,
        r#"{"closed_steps":0,"status":"created","step_no":0,"steps":{},"usage_total":{"cost_micro_usd":0,"cpu_ms":0,"tokens":0},"v":1}"#
    );
}
