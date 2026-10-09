//! The Vlo kernel: a pure, event-sourced state machine (see `docs/workflows.md` for the
//! reducer contract and `docs/kernel-protocol.md` for the wire protocol).
//!
//! Zero I/O, zero clock, zero randomness of its own. Everything it needs arrives on the
//! event (`ts_ms`, `random`) or in the run's persisted state, and everything it decides
//! leaves as a declarative write-set the host applies atomically. That is what lets the
//! same logic run on wasm in Node today and natively in a Durable Object later.
//!
//! Errors are values: no input can make the kernel panic, which matters because the
//! wasm profile builds with `panic = "abort"`.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod api;
pub mod canonical;
pub mod classify;
pub mod error;
pub mod guards;
pub mod hash;
pub mod ids;
pub mod prepare;
pub mod reduce;
pub mod refold;
pub mod retry;
pub mod step_machine;
pub mod steps;
pub mod validate;

mod commands;
mod events;
mod lifecycle;

pub use api::{version, FEATURES};
pub use commands::{DEFAULT_LEASE_TTL_MS, DEFAULT_QUEUE};
pub use error::{code, KResult};
pub use hash::state_hash;
pub use ids::derive_ids;
pub use prepare::prepare_event;
pub use reduce::reduce_step;
pub use refold::refold_check;
pub use retry::plan_retry;
pub use validate::validate_event;
