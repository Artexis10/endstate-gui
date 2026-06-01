//! Engine Adapter Module (Tauri-coupled glue)
//!
//! The Tauri-FREE primitives (parse/run-id/result helpers, run-state, the
//! engine-path resolver, errors) now live in `endstate_engine_core::engine` and
//! are re-exported below so existing `crate::engine_adapter::*` call sites keep
//! working. What remains here is only the code that genuinely needs Tauri: the
//! streaming `run_engine`/`cancel_engine` (which emit via `AppHandle`) and the
//! production `build_bundled_command` (which resolves `ENDSTATE_ROOT` from the
//! Tauri resource directory).
//!
//! The dev HTTP bridge that used to live in-process was extracted to the
//! standalone `endstate-dev-bridge` binary (no tao/wry/webview2-com), removing
//! the native GUI layer responsible for the intermittent 0xc0000374 crash.

use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::process::Stdio;
use std::sync::atomic::Ordering;
use std::sync::mpsc::{self, Receiver, Sender};
use tauri::{AppHandle, Emitter};

// Re-export the shared, Tauri-free primitives so the app crate's existing
// `crate::engine_adapter::*` paths resolve unchanged.
pub use endstate_engine_core::engine::{
    create_cancelled_result, create_fallback_result, create_run_state, extract_command_name_pub,
    generate_run_id, get_current_run_id, inject_run_id, is_result_event, is_run_active, parse_line,
    parse_line_with_run_id, EngineError, SharedRunState, EVENT_CHANNEL, SIDECAR_CANDIDATES,
};

/// Build a `Command` for the bundled sidecar binary (production / Tauri path).
///
/// Resolves the sidecar from the directory containing the main executable
/// (triple-suffixed name first, then plain `endstate.exe`), and sets
/// `ENDSTATE_ROOT` to the Tauri resource directory's `engine/` subdir so the Go
/// binary finds modules/, payload/, VERSION, SCHEMA_VERSION. This is the
/// production behavior the GUI window's IPC commands rely on, so it stays
/// AppHandle-based here (the standalone dev bridge uses the Tauri-free
/// `endstate_engine_core::engine::build_bundled_command`, which derives
/// `ENDSTATE_ROOT` from the exe-adjacent `engine/` dir instead).
pub fn build_bundled_command(
    app: &AppHandle,
    args: &[String],
) -> Result<std::process::Command, EngineError> {
    use tauri::Manager;

    let exe_dir = std::env::current_exe()
        .map_err(|e| EngineError {
            code: "EXE_DIR_ERROR".to_string(),
            message: format!("Failed to resolve executable directory: {}", e),
        })?
        .parent()
        .ok_or_else(|| EngineError {
            code: "EXE_DIR_ERROR".to_string(),
            message: "Failed to get parent directory of executable".to_string(),
        })?
        .to_path_buf();

    let sidecar_path = SIDECAR_CANDIDATES
        .iter()
        .map(|name| exe_dir.join(name))
        .find(|p| p.exists());

    let sidecar_path = match sidecar_path {
        Some(p) => p,
        None => {
            let searched: Vec<String> = SIDECAR_CANDIDATES
                .iter()
                .map(|name| exe_dir.join(name).display().to_string())
                .collect();
            return Err(EngineError {
                code: "BUNDLED_ENGINE_NOT_FOUND".to_string(),
                message: format!("Bundled engine not found. Searched: {}", searched.join(", ")),
            });
        }
    };

    let mut cmd = std::process::Command::new(&sidecar_path);
    cmd.args(args);

    let resource_dir = app.path().resource_dir().map_err(|e| EngineError {
        code: "RESOURCE_DIR_ERROR".to_string(),
        message: format!("Failed to resolve resource directory: {}", e),
    })?;
    cmd.env("ENDSTATE_ROOT", resource_dir.join("engine"));

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    Ok(cmd)
}

/// Emit an event to both Tauri and the (in-process) broadcaster.
fn emit_event(app: &AppHandle, broadcaster: &EventBroadcaster, event: &Value) {
    let _ = app.emit(EVENT_CHANNEL, event);
    if let Ok(json) = serde_json::to_string(event) {
        broadcaster.send(&json);
    }
}

use endstate_engine_core::broadcast::EventBroadcaster;

/// Internal message type for channel communication
enum StreamMessage {
    Stdout(String),
    Stderr(String),
}

/// Spawn the endstate CLI and stream events to the frontend via Tauri events.
///
/// See module docs. One run at a time; injects runId on every event; emits a
/// fallback/cancelled terminal result if the CLI exits without one.
pub fn run_engine(
    app: &AppHandle,
    exe: &str,
    args: &[String],
    run_state: &SharedRunState,
    broadcaster: &EventBroadcaster,
    stdin_input: Option<String>,
) -> Result<String, EngineError> {
    let run_id = generate_run_id();
    let command_name = extract_command_name_pub(args);

    {
        let mut state = run_state.lock();
        if state.run_id.is_some() {
            return Err(EngineError {
                code: "RUN_IN_PROGRESS".to_string(),
                message: "Another run is already in progress. Please wait or cancel it.".to_string(),
            });
        }
        state.run_id = Some(run_id.clone());
        state.command = Some(command_name.clone());
        state.cancel_requested.store(false, Ordering::SeqCst);
    }

    let mut cmd = if exe == "__bundled__" {
        match build_bundled_command(app, args) {
            Ok(c) => c,
            Err(e) => {
                let mut state = run_state.lock();
                state.run_id = None;
                state.command = None;
                state.child = None;
                return Err(e);
            }
        }
    } else {
        crate::cmd_impl::build_engine_command(exe, args)
    };
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    if stdin_input.is_some() {
        cmd.stdin(Stdio::piped());
    }

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            let mut state = run_state.lock();
            state.run_id = None;
            state.command = None;
            state.child = None;
            return Err(e.into());
        }
    };

    if let Some(input) = stdin_input.as_ref() {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(input.as_bytes());
        }
    }

    let stdout = child.stdout.take().expect("stdout was piped");
    let stderr = child.stderr.take().expect("stderr was piped");

    {
        let mut state = run_state.lock();
        state.child = Some(child);
    }

    let (tx, rx): (Sender<StreamMessage>, Receiver<StreamMessage>) = mpsc::channel();

    let tx_stdout = tx.clone();
    let stdout_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if !line.is_empty() && tx_stdout.send(StreamMessage::Stdout(line)).is_err() {
                break;
            }
        }
    });

    let tx_stderr = tx.clone();
    let stderr_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            if !line.is_empty() && tx_stderr.send(StreamMessage::Stderr(line)).is_err() {
                break;
            }
        }
    });

    drop(tx);

    let mut received_result = false;
    for msg in rx {
        match msg {
            StreamMessage::Stdout(line) => {
                let mut event = parse_line(&line, false);
                if is_result_event(&event) {
                    received_result = true;
                }
                inject_run_id(&mut event, &run_id);
                emit_event(app, broadcaster, &event);
            }
            StreamMessage::Stderr(line) => {
                let event = parse_line_with_run_id(&line, true, &run_id);
                emit_event(app, broadcaster, &event);
            }
        }
    }

    let _ = stdout_handle.join();
    let _ = stderr_handle.join();

    let (exit_code, was_cancelled) = {
        let mut state = run_state.lock();
        let was_cancelled = state.cancel_requested.load(Ordering::SeqCst);
        let exit_code = if let Some(ref mut child) = state.child {
            child.wait().ok().and_then(|s| s.code()).unwrap_or(-1)
        } else {
            -1
        };
        state.child = None;
        state.run_id = None;
        state.command = None;
        state.cancel_requested.store(false, Ordering::SeqCst);
        (exit_code, was_cancelled)
    };

    if !received_result {
        if was_cancelled {
            let cancelled = create_cancelled_result(&run_id, &command_name, Some(exit_code));
            emit_event(app, broadcaster, &cancelled);
        } else {
            let fallback = create_fallback_result(exit_code, &run_id, &command_name);
            emit_event(app, broadcaster, &fallback);
        }
    }

    Ok(run_id)
}

/// Cancel the currently running engine process, emitting any warning via Tauri.
pub fn cancel_engine(
    app: &AppHandle,
    run_state: &SharedRunState,
    broadcaster: &EventBroadcaster,
) -> Result<(), EngineError> {
    let mut state = run_state.lock();

    if state.run_id.is_none() {
        return Err(EngineError {
            code: "NO_RUN_ACTIVE".to_string(),
            message: "No run is currently active to cancel.".to_string(),
        });
    }

    state.cancel_requested.store(true, Ordering::SeqCst);

    if let Some(ref mut child) = state.child {
        if let Err(e) = child.kill() {
            if e.kind() != std::io::ErrorKind::InvalidInput {
                let run_id = state.run_id.clone().unwrap_or_default();
                let log_event = serde_json::json!({
                    "type": "log",
                    "level": "warn",
                    "message": format!("Failed to kill process: {}", e),
                    "runId": run_id
                });
                emit_event(app, broadcaster, &log_event);
            }
        }
    }

    Ok(())
}
