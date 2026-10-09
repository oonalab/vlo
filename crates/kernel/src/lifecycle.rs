//! Lifecycle transitions: the write-set for events that need no reducer call.
//!
//! They carry the trigger event, the updated kernel state, and whatever task updates
//! the bookkeeping implies. The user state is echoed unchanged from the checkpoint the
//! host passed in — but it is still hashed together with the new kernel state, because
//! the kernel state moved.

use vlo_types::INLINE_LIMIT_BYTES;
use vlo_types::{EventInput, KernelState, RunPatch, RunRef, RunStatus, TaskUpdate, Transition};

use crate::error::KResult;
use crate::events;
use crate::hash;

/// Everything `build` needs besides the trigger event.
pub struct LifecycleTransition<'a> {
    pub run: &'a RunRef,
    pub kernel_state: KernelState,
    pub state: &'a str,
    pub run_status: RunStatus,
    pub seq: u64,
    pub task_updates: Vec<TaskUpdate>,
}

/// Assemble the lifecycle write-set: one event, the new kernel state, the echoed user state.
pub fn build(event: &EventInput, spec: LifecycleTransition<'_>) -> KResult<Transition> {
    let state_hash = hash::state_hash(&spec.kernel_state, spec.state)?;
    let mut envelope = events::envelope(event.clone(), spec.seq, spec.run);
    envelope.state_hash = state_hash.clone();

    Ok(Transition {
        run: RunPatch {
            status: spec.run_status,
            last_seq: spec.seq,
        },
        kernel_state: spec.kernel_state,
        state: spec.state.to_string(),
        state_hash,
        state_inline: spec.state.len() <= INLINE_LIMIT_BYTES,
        events: vec![envelope],
        tasks: Vec::new(),
        task_updates: spec.task_updates,
        timers: Vec::new(),
        spawns: Vec::new(),
        signal_waits: Vec::new(),
        emits: Vec::new(),
        completion: None,
        continue_as_new: None,
    })
}
