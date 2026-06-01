//! Re-export of the shared, Tauri-free event broadcaster.
//!
//! Moved to `endstate_engine_core::broadcast` so the standalone dev bridge and
//! the app share one `EventBroadcaster`. The app keeps the
//! `crate::event_broadcast::EventBroadcaster` path via this re-export.

pub use endstate_engine_core::broadcast::*;
