//! State hashing (see `docs/kernel-protocol.md`). The hash covers the kernel's own bookkeeping and the
//! user state together, so a re-fold that diverges in either is caught.

use sha2::{Digest, Sha256};
use vlo_types::KernelState;

use crate::canonical;
use crate::error::KResult;

/// Domain separator, so a state hash can never collide with any other sha256 we take.
pub const STATE_HASH_PREFIX: &str = "vlo1";

/// Lowercase hex sha256 of `bytes`.
pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

/// `sha256("vlo1\0" + canon(kernel_state) + "\0" + canon(state))`, lowercase hex.
///
/// `state` must be valid JSON (`malformed_json` otherwise); both parts are canonicalized
/// (sorted keys, no whitespace) before hashing.
pub fn state_hash(kernel_state: &KernelState, state: &str) -> KResult<String> {
    let kernel = canonical::canonical_of(kernel_state)?;
    let user = canonical::canonicalize(state)?;

    let mut hasher = Sha256::new();
    hasher.update(STATE_HASH_PREFIX.as_bytes());
    hasher.update([0u8]);
    hasher.update(kernel.as_bytes());
    hasher.update([0u8]);
    hasher.update(user.as_bytes());
    Ok(hex::encode(hasher.finalize()))
}
