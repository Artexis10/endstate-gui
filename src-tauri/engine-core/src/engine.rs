//! Tauri-free engine adapter primitives.
//!
//! The NDJSON parse/run-id/result helpers, the shared run-state, and a
//! Tauri-free engine-path resolver. These were lifted out of the app crate's
//! `engine_adapter.rs` so both the Tauri app and the standalone dev bridge
//! share one implementation with no `tauri`/`tao`/`wry` linkage.
//!
//! The Tauri-coupled streaming path (`run_engine`/`cancel_engine`, which take an
//! `&AppHandle` and emit via Tauri events) stays in the app crate.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Candidate sidecar filenames in priority order.
/// Tauri's externalBin installs with target-triple suffix in production; the
/// predev rebuild script copies as plain endstate.exe for dev.
pub const SIDECAR_CANDIDATES: &[&str] = &[
    "endstate-x86_64-pc-windows-msvc.exe",
    "endstate.exe",
];

/// Event channel name for all engine events
pub const EVENT_CHANNEL: &str = "endstate://event";

/// Error type for engine adapter operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineError {
    pub code: String,
    pub message: String,
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

impl From<std::io::Error> for EngineError {
    fn from(err: std::io::Error) -> Self {
        let code = match err.kind() {
            std::io::ErrorKind::NotFound => "CLI_NOT_FOUND",
            std::io::ErrorKind::PermissionDenied => "PERMISSION_DENIED",
            _ => "EXEC_FAILED",
        };
        EngineError {
            code: code.to_string(),
            message: format!("Failed to execute endstate: {}", err),
        }
    }
}

/// Resolve the bundled sidecar binary path and its `ENDSTATE_ROOT`, Tauri-free.
///
/// Mirrors the app crate's `build_bundled_command` resolution exactly, but
/// without an `AppHandle`:
/// - **sidecar**: `ENDSTATE_ENGINE_PATH` env override if set, else the first of
///   `SIDECAR_CANDIDATES` that exists next to the current executable. The
///   standalone dev bridge builds into the same `target/<profile>/` directory as
///   the dev sidecar (`endstate.exe`), so `current_exe()`-relative resolution
///   lands on the same binary the Tauri app uses.
/// - **ENDSTATE_ROOT**: `ENDSTATE_ROOT` env override if set, else `<exe_dir>/engine`
///   (the dev layout the rebuild script + tauri.conf resources populate:
///   `engine/modules`, `engine/payload`, `engine/VERSION`, `engine/SCHEMA_VERSION`).
///
/// Returns `(sidecar_path, endstate_root)`.
pub fn resolve_engine_path() -> Result<(std::path::PathBuf, std::path::PathBuf), EngineError> {
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

    let sidecar_path = if let Ok(p) = std::env::var("ENDSTATE_ENGINE_PATH") {
        let pb = std::path::PathBuf::from(p);
        if !pb.exists() {
            return Err(EngineError {
                code: "BUNDLED_ENGINE_NOT_FOUND".to_string(),
                message: format!("ENDSTATE_ENGINE_PATH does not exist: {}", pb.display()),
            });
        }
        pb
    } else {
        SIDECAR_CANDIDATES
            .iter()
            .map(|name| exe_dir.join(name))
            .find(|p| p.exists())
            .ok_or_else(|| {
                let searched: Vec<String> = SIDECAR_CANDIDATES
                    .iter()
                    .map(|name| exe_dir.join(name).display().to_string())
                    .collect();
                EngineError {
                    code: "BUNDLED_ENGINE_NOT_FOUND".to_string(),
                    message: format!("Bundled engine not found. Searched: {}", searched.join(", ")),
                }
            })?
    };

    let endstate_root = std::env::var("ENDSTATE_ROOT")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| exe_dir.join("engine"));

    Ok((sidecar_path, endstate_root))
}

/// Build a `Command` for the bundled sidecar binary (Tauri-free).
///
/// Uses [`resolve_engine_path`] for the binary + `ENDSTATE_ROOT`. Sets
/// `CREATE_NO_WINDOW` on Windows. The streaming/exec callers add stdio pipes.
pub fn build_bundled_command(args: &[String]) -> Result<std::process::Command, EngineError> {
    let (sidecar_path, endstate_root) = resolve_engine_path()?;

    let mut cmd = std::process::Command::new(&sidecar_path);
    cmd.args(args);
    cmd.env("ENDSTATE_ROOT", endstate_root);

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    Ok(cmd)
}

/// Shared state for the currently running engine process
pub struct RunState {
    /// The running child process (if any)
    pub child: Option<Child>,
    /// The current run ID (if a run is active)
    pub run_id: Option<String>,
    /// The command being run (for cancellation result)
    pub command: Option<String>,
    /// Flag to indicate cancellation was requested
    pub cancel_requested: AtomicBool,
}

impl Default for RunState {
    fn default() -> Self {
        Self {
            child: None,
            run_id: None,
            command: None,
            cancel_requested: AtomicBool::new(false),
        }
    }
}

/// Global run state protected by a mutex
pub type SharedRunState = Arc<Mutex<RunState>>;

/// Create a new shared run state
pub fn create_run_state() -> SharedRunState {
    Arc::new(Mutex::new(RunState::default()))
}

/// Generate a unique run ID (timestamp + derived suffix)
pub fn generate_run_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let random_suffix: u16 = (timestamp as u16).wrapping_mul(31337);
    format!("{}-{:04x}", timestamp, random_suffix)
}

/// Inject runId into a JSON value (modifies in place if it's an object)
pub fn inject_run_id(value: &mut Value, run_id: &str) {
    if let Value::Object(map) = value {
        map.insert("runId".to_string(), Value::String(run_id.to_string()));
    }
}

/// Parse a line of output and determine if it's valid JSON or plain text.
/// Returns the appropriate event to emit (without runId - caller should inject it).
pub fn parse_line(line: &str, is_stderr: bool) -> Value {
    if is_stderr {
        return serde_json::json!({
            "type": "log",
            "level": "error",
            "message": line
        });
    }

    match serde_json::from_str::<Value>(line) {
        Ok(json) => json,
        Err(_) => serde_json::json!({
            "type": "log",
            "level": "info",
            "message": line
        }),
    }
}

/// Parse a line and inject runId into the result.
pub fn parse_line_with_run_id(line: &str, is_stderr: bool, run_id: &str) -> Value {
    let mut event = parse_line(line, is_stderr);
    inject_run_id(&mut event, run_id);
    event
}

/// Check if a JSON value represents a terminal "result" event.
pub fn is_result_event(value: &Value) -> bool {
    if value.get("success").is_some() && value.get("command").is_some() {
        return true;
    }
    if let Some(event_type) = value.get("type").and_then(|v| v.as_str()) {
        return event_type == "result";
    }
    false
}

/// Create a fallback result event when the CLI exits without emitting a result.
pub fn create_fallback_result(exit_code: i32, run_id: &str, command: &str) -> Value {
    serde_json::json!({
        "type": "result",
        "ok": exit_code == 0,
        "command": command,
        "summary": { "exitCode": exit_code },
        "raw": null,
        "runId": run_id
    })
}

/// Create a cancelled result event.
pub fn create_cancelled_result(run_id: &str, command: &str, exit_code: Option<i32>) -> Value {
    let mut summary = serde_json::json!({ "cancelled": true });
    if let Some(code) = exit_code {
        summary["exitCode"] = serde_json::json!(code);
    }
    serde_json::json!({
        "type": "result",
        "ok": false,
        "command": command,
        "summary": summary,
        "raw": null,
        "runId": run_id
    })
}

/// Extract command name from args (first arg that doesn't start with -)
pub fn extract_command_name(args: &[String]) -> String {
    args.iter()
        .find(|arg| !arg.starts_with('-'))
        .cloned()
        .unwrap_or_else(|| "unknown".to_string())
}

/// Alias kept for the dev-bridge call sites that used the `_pub` name.
pub fn extract_command_name_pub(args: &[String]) -> String {
    extract_command_name(args)
}

/// Check if a run is currently active.
pub fn is_run_active(run_state: &SharedRunState) -> bool {
    run_state.lock().run_id.is_some()
}

/// Get the current run ID if a run is active.
pub fn get_current_run_id(run_state: &SharedRunState) -> Option<String> {
    run_state.lock().run_id.clone()
}

/// Set cancellation + kill the active child, returning whether a run was active.
/// Tauri-free (the app crate's `cancel_engine` adds Tauri event emission on top).
pub fn request_cancel(run_state: &SharedRunState) -> Result<Option<String>, EngineError> {
    let mut state = run_state.lock();
    if state.run_id.is_none() {
        return Err(EngineError {
            code: "NO_RUN_ACTIVE".to_string(),
            message: "No run is currently active to cancel.".to_string(),
        });
    }
    state.cancel_requested.store(true, Ordering::SeqCst);
    let run_id = state.run_id.clone();
    if let Some(ref mut child) = state.child {
        let _ = child.kill();
    }
    Ok(run_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_line_valid_json() {
        let line = r#"{"type":"log","level":"info","message":"test"}"#;
        let result = parse_line(line, false);
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "log");
        assert_eq!(result.get("message").unwrap().as_str().unwrap(), "test");
    }

    #[test]
    fn test_parse_line_plain_text_becomes_log() {
        let result = parse_line("plain text", false);
        assert_eq!(result.get("level").unwrap().as_str().unwrap(), "info");
        assert_eq!(result.get("message").unwrap().as_str().unwrap(), "plain text");
    }

    #[test]
    fn test_parse_line_stderr_becomes_error_log() {
        let result = parse_line("boom", true);
        assert_eq!(result.get("level").unwrap().as_str().unwrap(), "error");
    }

    #[test]
    fn test_is_result_event_envelope_and_type() {
        assert!(is_result_event(&serde_json::json!({"success": true, "command": "apply"})));
        assert!(is_result_event(&serde_json::json!({"type": "result", "ok": true})));
        assert!(!is_result_event(&serde_json::json!({"type": "log"})));
    }

    #[test]
    fn test_inject_run_id() {
        let mut e = serde_json::json!({"type": "log"});
        inject_run_id(&mut e, "run-1");
        assert_eq!(e.get("runId").unwrap().as_str().unwrap(), "run-1");
    }

    #[test]
    fn test_create_results() {
        let f = create_fallback_result(0, "r", "apply");
        assert_eq!(f.get("ok").unwrap().as_bool().unwrap(), true);
        let c = create_cancelled_result("r", "apply", Some(-1));
        assert_eq!(c.get("summary").unwrap().get("cancelled").unwrap().as_bool().unwrap(), true);
    }

    #[test]
    fn test_extract_command_name() {
        assert_eq!(extract_command_name(&["apply".into(), "-Json".into()]), "apply");
        assert_eq!(extract_command_name(&["-Json".into()]), "unknown");
        assert_eq!(extract_command_name(&[]), "unknown");
    }

    #[test]
    fn test_generate_run_id_format() {
        let id = generate_run_id();
        assert!(id.contains('-'));
        assert!(id.len() > 10);
    }

    #[test]
    fn concurrent_run_state_lock_does_not_panic() {
        let rs = create_run_state();
        let c = rs.clone();
        let h = std::thread::spawn(move || {
            for _ in 0..50 {
                let _ = is_run_active(&c);
                let _ = get_current_run_id(&c);
            }
        });
        for _ in 0..50 {
            let _ = is_run_active(&rs);
        }
        h.join().unwrap();
    }
}
