//! endstate-engine-core
//!
//! Tauri-free engine logic shared by the Endstate GUI app crate and the
//! standalone `endstate-dev-bridge` binary.
//!
//! This crate links NONE of the native GUI stack (no `tauri` / `tao` / `wry` /
//! `webview2-com` / `windows`). It holds: the engine command builder (`cmd`),
//! the NDJSON parse/run-state machinery and a Tauri-free engine-path resolver
//! (`engine`), the SSE broadcast channel (`broadcast`), and the axum HTTP bridge
//! (`bridge`). The app crate re-exports `cmd`/`engine`/`broadcast` so its
//! existing call sites keep compiling; the standalone binary uses `bridge`.

pub mod broadcast;
pub mod cmd;
pub mod engine;

#[cfg(feature = "bridge")]
pub mod bridge;
