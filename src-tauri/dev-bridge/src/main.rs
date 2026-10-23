//! endstate-dev-bridge — standalone HTTP bridge for livewire / browser dev.
//!
//! This binary links ZERO of the native GUI stack (no tauri/tao/wry/
//! webview2-com/windows). It exposes the same HTTP surface the in-process Tauri
//! bridge did — `POST /api/invoke` + `GET /events` (SSE) on 127.0.0.1:9876 — so
//! clients authenticate using a launcher-owned session received through private stdin.
//!
//! Why it exists: the in-process bridge intermittently heap-corrupted
//! `endstate-gui.exe` (0xc0000374) inside the native GUI dependency layer. Our
//! Rust is 100% safe (zero `unsafe`), so the corruption could only come from
//! tao/wry/webview2-com. Moving the bridge here removes that native surface from
//! the dev path entirely — a heap bug in a crate that isn't linked cannot fire.
//! Verify structurally: `cargo tree -p endstate-dev-bridge` shows no tao/wry/
//! webview2-com.
//!
//! Engine resolution (Tauri-free): `endstate_engine_core::engine::resolve_engine_path`
//! finds the sidecar next to this exe (same `target/<profile>/` the dev sidecar
//! `endstate.exe` is copied to) and `ENDSTATE_ROOT` at `<exe_dir>/engine`.
//! Overridable via `ENDSTATE_ENGINE_PATH` / `ENDSTATE_ROOT`.

use endstate_engine_core::bridge::{self, AppState};
use endstate_engine_core::broadcast::EventBroadcaster;
use endstate_engine_core::engine::{create_run_state, resolve_engine_path};

fn main() {
    let session = {
        let input = std::io::stdin();
        let mut input = input.lock();
        match bridge::BridgeSession::read_frame(&mut input) {
            Ok(session) => session,
            Err(_) => {
                eprintln!("[dev-bridge] invalid private session frame; use npm run dev:bridge");
                std::process::exit(1);
            }
        }
    };
    // Release stdin's lock before the lifetime reader uses the same pipe.
    // Surface the resolved engine path early so a misconfigured dev environment
    // fails loudly here rather than per-invoke. Non-fatal: the bridge still
    // serves non-engine file ops, and an explicit `exe` arg can override.
    match resolve_engine_path() {
        Ok((sidecar, root)) => {
            eprintln!("[dev-bridge] engine: {}", sidecar.display());
            eprintln!("[dev-bridge] ENDSTATE_ROOT: {}", root.display());
        }
        Err(e) => {
            eprintln!(
                "[dev-bridge] WARNING: engine not resolved ({}: {}). \
                 Set ENDSTATE_ENGINE_PATH or run via npm so the sidecar is in place.",
                e.code, e.message
            );
        }
    }

    let state = AppState::new(create_run_state(), EventBroadcaster::new());

    let runtime = match tokio::runtime::Runtime::new() {
        Ok(runtime) => runtime,
        Err(e) => {
            eprintln!("[dev-bridge] runtime failed: {}", e);
            std::process::exit(1);
        }
    };
    if let Err(e) = runtime.block_on(bridge::start(state, session)) {
        eprintln!("[dev-bridge] fatal: {}", e);
        std::process::exit(1);
    }
}
