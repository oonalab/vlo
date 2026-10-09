//! Wire types for the Vlo kernel protocol (see `docs/kernel-protocol.md`).
//!
//! Everything that crosses the wasm boundary or lands in a journal is defined here,
//! once, with `serde` for the wire and `schemars` for the generated JSON Schema that
//! the TypeScript SDK types are derived from.
//!
//! Rules:
//! - No floats in anything that is hashed (`KernelState`, `Usage`). Money is micro-USD.
//! - Time is milliseconds since the Unix epoch (`*_ms`), never a date type.
//! - JSON that must survive byte-exact (user state, payloads) is carried as `String`
//!   at the storage edge and as `serde_json::Value` inside the kernel.

#![deny(missing_docs)]

pub mod command;
pub mod envelope;
pub mod kernel_state;
pub mod protocol;
pub mod retry;
pub mod transition;

pub use command::*;
pub use envelope::*;
pub use kernel_state::*;
pub use protocol::*;
pub use retry::*;
pub use transition::*;

/// Kernel protocol version. The host refuses a kernel whose protocol differs.
pub const PROTOCOL_VERSION: u32 = 1;

/// Inline payload / state limit in bytes before the host offloads to the blob store
/// (see `docs/limits.md`).
pub const INLINE_LIMIT_BYTES: usize = 256 * 1024;
