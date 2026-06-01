//! Re-export of the shared, Tauri-free command + file-op implementations.
//!
//! The implementations moved to `endstate_engine_core::cmd` so the standalone
//! `endstate-dev-bridge` binary can share them without linking Tauri. The app
//! crate keeps the `crate::cmd_impl::*` path via this re-export, so existing
//! `#[tauri::command]` wrappers in `lib.rs` are unchanged.

pub use endstate_engine_core::cmd::*;
