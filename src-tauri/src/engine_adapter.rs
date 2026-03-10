//! Engine Adapter Module
//!
//! This module provides the streaming interface between Endstate CLI and the GUI.
//! It spawns the CLI process, reads stdout/stderr concurrently, and emits NDJSON
//! events to the frontend via Tauri events.
//!
//! Features:
//! - runId tagging for every emitted event
//! - One-run-at-a-time guard (v1)
//! - Cancellation support via process termination

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::process::{Child, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

use crate::event_broadcast::EventBroadcaster;

/// Emit an event to both Tauri and the HTTP bridge broadcaster.
fn emit_event(app: &AppHandle, broadcaster: &EventBroadcaster, event: &serde_json::Value) {
    let _ = app.emit(EVENT_CHANNEL, event);
    if let Ok(json) = serde_json::to_string(event) {
        broadcaster.send(&json);
    }
}

/// Event channel name for all engine events
pub const EVENT_CHANNEL: &str = "endstate://event";

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

/// Internal message type for channel communication
enum StreamMessage {
    Stdout(String),
    Stderr(String),
}

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

/// Generate a unique run ID (timestamp + random suffix)
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
        // Stderr is always treated as error log
        return serde_json::json!({
            "type": "log",
            "level": "error",
            "message": line
        });
    }

    // Try to parse as JSON
    match serde_json::from_str::<Value>(line) {
        Ok(json) => {
            // Valid JSON - pass through as-is
            json
        }
        Err(_) => {
            // Not valid JSON - wrap as info log
            serde_json::json!({
                "type": "log",
                "level": "info",
                "message": line
            })
        }
    }
}

/// Parse a line and inject runId into the result.
pub fn parse_line_with_run_id(line: &str, is_stderr: bool, run_id: &str) -> Value {
    let mut event = parse_line(line, is_stderr);
    inject_run_id(&mut event, run_id);
    event
}

/// Check if a JSON value represents a terminal "result" event.
/// This is used to determine if we need to emit a fallback result.
pub fn is_result_event(value: &Value) -> bool {
    // Check for CLI envelope with "success" field (final result)
    if value.get("success").is_some() && value.get("command").is_some() {
        return true;
    }
    // Check for explicit "type": "result" events
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
        "summary": {
            "exitCode": exit_code
        },
        "raw": null,
        "runId": run_id
    })
}

/// Create a cancelled result event.
pub fn create_cancelled_result(run_id: &str, command: &str, exit_code: Option<i32>) -> Value {
    let mut summary = serde_json::json!({
        "cancelled": true
    });
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
fn extract_command_name(args: &[String]) -> String {
    args.iter()
        .find(|arg| !arg.starts_with('-'))
        .cloned()
        .unwrap_or_else(|| "unknown".to_string())
}

/// Public version of extract_command_name for use by dev_server.
#[allow(dead_code)] // Called from dev_server (feature-gated)
pub fn extract_command_name_pub(args: &[String]) -> String {
    args.iter()
        .find(|arg| !arg.starts_with('-'))
        .cloned()
        .unwrap_or_else(|| "unknown".to_string())
}

/// Spawn the endstate CLI and stream events to the frontend.
///
/// This function:
/// 1. Checks if another run is active (returns error if so)
/// 2. Generates a runId and stores it in shared state
/// 3. Spawns the CLI process with the given executable and arguments
/// 4. Reads stdout and stderr concurrently in separate threads
/// 5. Parses each line, injects runId, and emits appropriate events
/// 6. Handles cancellation gracefully
/// 7. Emits a fallback result if no terminal result was received
///
/// # Arguments
/// * `app` - Tauri app handle for emitting events
/// * `exe` - Path to the executable (typically "endstate")
/// * `args` - Command line arguments
/// * `run_state` - Shared state for tracking the running process
///
/// # Returns
/// * `Ok(String)` - The runId of the completed run
/// * `Err(EngineError)` - Failed to start the process or another run is active
pub fn run_engine(
    app: &AppHandle,
    exe: &str,
    args: &[String],
    run_state: &SharedRunState,
    broadcaster: &EventBroadcaster,
) -> Result<String, EngineError> {
    // Generate runId and extract command name
    let run_id = generate_run_id();
    let command_name = extract_command_name(args);

    // Acquire lock and check if another run is active
    {
        let mut state = run_state.lock().map_err(|_| EngineError {
            code: "LOCK_ERROR".to_string(),
            message: "Failed to acquire run state lock".to_string(),
        })?;

        if state.run_id.is_some() {
            return Err(EngineError {
                code: "RUN_IN_PROGRESS".to_string(),
                message: "Another run is already in progress. Please wait or cancel it.".to_string(),
            });
        }

        // Mark run as active
        state.run_id = Some(run_id.clone());
        state.command = Some(command_name.clone());
        state.cancel_requested.store(false, Ordering::SeqCst);
    }

    // Spawn the process with piped stdout/stderr.
    // When exe is "__bundled__", resolve the bundled engine path from the
    // Tauri resource directory and invoke via PowerShell.
    let mut cmd = if exe == "__bundled__" {
        use tauri::Manager;
        let resource_dir = app.path().resource_dir().map_err(|e| EngineError {
            code: "RESOURCE_DIR_ERROR".to_string(),
            message: format!("Failed to resolve resource directory: {}", e),
        })?;
        let entrypoint = resource_dir.join("engine").join("bin").join("endstate.ps1");
        if !entrypoint.exists() {
            return {
                // Clear run state before returning error
                if let Ok(mut state) = run_state.lock() {
                    state.run_id = None;
                    state.command = None;
                    state.child = None;
                }
                Err(EngineError {
                    code: "BUNDLED_ENGINE_NOT_FOUND".to_string(),
                    message: format!(
                        "Bundled engine not found at: {}",
                        entrypoint.display()
                    ),
                })
            };
        }
        crate::cmd_impl::build_bundled_engine_command(&entrypoint, args)
    } else {
        crate::cmd_impl::build_engine_command(exe, args)
    };
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    let spawn_result = cmd.spawn();

    let mut child = match spawn_result {
        Ok(child) => child,
        Err(e) => {
            // Clear run state on spawn failure
            if let Ok(mut state) = run_state.lock() {
                state.run_id = None;
                state.command = None;
                state.child = None;
            }
            return Err(e.into());
        }
    };

    // Take ownership of stdout/stderr before storing child
    let stdout = child.stdout.take().expect("stdout was piped");
    let stderr = child.stderr.take().expect("stderr was piped");

    // Store child in shared state for cancellation
    {
        let mut state = run_state.lock().map_err(|_| EngineError {
            code: "LOCK_ERROR".to_string(),
            message: "Failed to acquire run state lock".to_string(),
        })?;
        state.child = Some(child);
    }

    // Create channel for collecting messages from reader threads
    let (tx, rx): (Sender<StreamMessage>, Receiver<StreamMessage>) = mpsc::channel();

    // Spawn stdout reader thread
    let tx_stdout = tx.clone();
    let stdout_handle = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if !line.is_empty() {
                    if tx_stdout.send(StreamMessage::Stdout(line)).is_err() {
                        break; // Channel closed, stop reading
                    }
                }
            }
        }
    });

    // Spawn stderr reader thread
    let tx_stderr = tx.clone();
    let stderr_handle = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                if !line.is_empty() {
                    if tx_stderr.send(StreamMessage::Stderr(line)).is_err() {
                        break; // Channel closed, stop reading
                    }
                }
            }
        }
    });

    // Drop the original sender so the channel closes when threads finish
    drop(tx);

    // Process messages and emit events
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

    // Wait for reader threads to finish
    let _ = stdout_handle.join();
    let _ = stderr_handle.join();

    // Get exit code and check cancellation status
    let (exit_code, was_cancelled) = {
        let mut state = run_state.lock().map_err(|_| EngineError {
            code: "LOCK_ERROR".to_string(),
            message: "Failed to acquire run state lock".to_string(),
        })?;

        let was_cancelled = state.cancel_requested.load(Ordering::SeqCst);
        let exit_code = if let Some(ref mut child) = state.child {
            child.wait().ok().and_then(|s| s.code()).unwrap_or(-1)
        } else {
            -1
        };

        // Clear run state
        state.child = None;
        state.run_id = None;
        state.command = None;
        state.cancel_requested.store(false, Ordering::SeqCst);

        (exit_code, was_cancelled)
    };

    // Emit appropriate terminal result if none was received
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

/// Cancel the currently running engine process.
///
/// # Arguments
/// * `app` - Tauri app handle for emitting events
/// * `run_state` - Shared state for tracking the running process
///
/// # Returns
/// * `Ok(())` - Cancellation was initiated
/// * `Err(EngineError)` - No run is active or failed to cancel
pub fn cancel_engine(app: &AppHandle, run_state: &SharedRunState, broadcaster: &EventBroadcaster) -> Result<(), EngineError> {
    let mut state = run_state.lock().map_err(|_| EngineError {
        code: "LOCK_ERROR".to_string(),
        message: "Failed to acquire run state lock".to_string(),
    })?;

    if state.run_id.is_none() {
        return Err(EngineError {
            code: "NO_RUN_ACTIVE".to_string(),
            message: "No run is currently active to cancel.".to_string(),
        });
    }

    // Mark cancellation requested
    state.cancel_requested.store(true, Ordering::SeqCst);

    // Kill the child process
    if let Some(ref mut child) = state.child {
        if let Err(e) = child.kill() {
            // Process might have already exited, which is fine
            if e.kind() != std::io::ErrorKind::InvalidInput {
                // Log but don't fail - the process might have just finished
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

/// Check if a run is currently active.
pub fn is_run_active(run_state: &SharedRunState) -> bool {
    run_state
        .lock()
        .map(|state| state.run_id.is_some())
        .unwrap_or(false)
}

/// Get the current run ID if a run is active.
pub fn get_current_run_id(run_state: &SharedRunState) -> Option<String> {
    run_state
        .lock()
        .ok()
        .and_then(|state| state.run_id.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_line_valid_json() {
        let line = r#"{"type":"log","level":"info","message":"test"}"#;
        let result = parse_line(line, false);
        
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "log");
        assert_eq!(result.get("level").unwrap().as_str().unwrap(), "info");
        assert_eq!(result.get("message").unwrap().as_str().unwrap(), "test");
    }

    #[test]
    fn test_parse_line_plain_text_becomes_log() {
        let line = "This is plain text output";
        let result = parse_line(line, false);
        
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "log");
        assert_eq!(result.get("level").unwrap().as_str().unwrap(), "info");
        assert_eq!(result.get("message").unwrap().as_str().unwrap(), "This is plain text output");
    }

    #[test]
    fn test_parse_line_stderr_becomes_error_log() {
        let line = "Error: something went wrong";
        let result = parse_line(line, true);
        
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "log");
        assert_eq!(result.get("level").unwrap().as_str().unwrap(), "error");
        assert_eq!(result.get("message").unwrap().as_str().unwrap(), "Error: something went wrong");
    }

    #[test]
    fn test_parse_line_invalid_json_becomes_log() {
        let line = "{invalid json";
        let result = parse_line(line, false);
        
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "log");
        assert_eq!(result.get("level").unwrap().as_str().unwrap(), "info");
        assert_eq!(result.get("message").unwrap().as_str().unwrap(), "{invalid json");
    }

    #[test]
    fn test_is_result_event_with_success_and_command() {
        let event = serde_json::json!({
            "success": true,
            "command": "apply",
            "data": {}
        });
        assert!(is_result_event(&event));
    }

    #[test]
    fn test_is_result_event_with_type_result() {
        let event = serde_json::json!({
            "type": "result",
            "ok": true
        });
        assert!(is_result_event(&event));
    }

    #[test]
    fn test_is_result_event_log_is_not_result() {
        let event = serde_json::json!({
            "type": "log",
            "level": "info",
            "message": "test"
        });
        assert!(!is_result_event(&event));
    }

    #[test]
    fn test_create_fallback_result_success() {
        let result = create_fallback_result(0, "test-run-123", "apply");
        
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "result");
        assert_eq!(result.get("ok").unwrap().as_bool().unwrap(), true);
        assert_eq!(result.get("command").unwrap().as_str().unwrap(), "apply");
        assert_eq!(result.get("summary").unwrap().get("exitCode").unwrap().as_i64().unwrap(), 0);
        assert!(result.get("raw").unwrap().is_null());
        assert_eq!(result.get("runId").unwrap().as_str().unwrap(), "test-run-123");
    }

    #[test]
    fn test_create_fallback_result_failure() {
        let result = create_fallback_result(1, "test-run-456", "verify");
        
        assert_eq!(result.get("ok").unwrap().as_bool().unwrap(), false);
        assert_eq!(result.get("summary").unwrap().get("exitCode").unwrap().as_i64().unwrap(), 1);
        assert_eq!(result.get("runId").unwrap().as_str().unwrap(), "test-run-456");
    }

    #[test]
    fn test_parse_cli_envelope_is_result() {
        // Test with a full CLI envelope like capabilities response
        let envelope = serde_json::json!({
            "schemaVersion": "1.0",
            "cliVersion": "0.1.0",
            "command": "capabilities",
            "runId": "20241220-143052",
            "timestampUtc": "2024-12-20T14:30:52Z",
            "success": true,
            "data": {},
            "error": null
        });
        assert!(is_result_event(&envelope));
    }

    // New tests for runId injection

    #[test]
    fn test_inject_run_id_into_json_object() {
        let mut event = serde_json::json!({
            "type": "log",
            "level": "info",
            "message": "test"
        });
        inject_run_id(&mut event, "run-abc-123");
        
        assert_eq!(event.get("runId").unwrap().as_str().unwrap(), "run-abc-123");
        // Original fields should be preserved
        assert_eq!(event.get("type").unwrap().as_str().unwrap(), "log");
    }

    #[test]
    fn test_inject_run_id_into_passthrough_json() {
        // Simulates CLI output that already has some fields
        let mut event = serde_json::json!({
            "schemaVersion": "1.0",
            "cliVersion": "0.1.0",
            "command": "capabilities",
            "success": true,
            "data": {"foo": "bar"}
        });
        inject_run_id(&mut event, "injected-run-id");
        
        assert_eq!(event.get("runId").unwrap().as_str().unwrap(), "injected-run-id");
        // Original fields should be preserved
        assert_eq!(event.get("command").unwrap().as_str().unwrap(), "capabilities");
        assert_eq!(event.get("success").unwrap().as_bool().unwrap(), true);
    }

    #[test]
    fn test_parse_line_with_run_id() {
        let result = parse_line_with_run_id("plain text", false, "my-run-id");
        
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "log");
        assert_eq!(result.get("level").unwrap().as_str().unwrap(), "info");
        assert_eq!(result.get("message").unwrap().as_str().unwrap(), "plain text");
        assert_eq!(result.get("runId").unwrap().as_str().unwrap(), "my-run-id");
    }

    #[test]
    fn test_generate_run_id_format() {
        let run_id = generate_run_id();
        
        // Should contain a hyphen separating timestamp and suffix
        assert!(run_id.contains('-'));
        // Should be reasonably long (timestamp + suffix)
        assert!(run_id.len() > 10);
    }

    // Tests for cancellation result

    #[test]
    fn test_create_cancelled_result_with_exit_code() {
        let result = create_cancelled_result("cancel-run-123", "apply", Some(-1));
        
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "result");
        assert_eq!(result.get("ok").unwrap().as_bool().unwrap(), false);
        assert_eq!(result.get("command").unwrap().as_str().unwrap(), "apply");
        assert_eq!(result.get("runId").unwrap().as_str().unwrap(), "cancel-run-123");
        
        let summary = result.get("summary").unwrap();
        assert_eq!(summary.get("cancelled").unwrap().as_bool().unwrap(), true);
        assert_eq!(summary.get("exitCode").unwrap().as_i64().unwrap(), -1);
    }

    #[test]
    fn test_create_cancelled_result_without_exit_code() {
        let result = create_cancelled_result("cancel-run-456", "verify", None);
        
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "result");
        assert_eq!(result.get("ok").unwrap().as_bool().unwrap(), false);
        
        let summary = result.get("summary").unwrap();
        assert_eq!(summary.get("cancelled").unwrap().as_bool().unwrap(), true);
        assert!(summary.get("exitCode").is_none());
    }

    // Tests for fallback suppression logic (unit-level state flag tests)

    #[test]
    fn test_result_event_detected_suppresses_fallback() {
        // This tests the logic: if is_result_event returns true, we should NOT emit fallback
        let cli_result = serde_json::json!({
            "success": true,
            "command": "apply",
            "data": {}
        });
        
        // Simulate the check that happens in run_engine
        let received_result = is_result_event(&cli_result);
        assert!(received_result, "CLI result should be detected as result event");
        
        // In run_engine, if received_result is true, fallback is NOT emitted
        // This test verifies the detection logic works correctly
    }

    #[test]
    fn test_log_event_does_not_suppress_fallback() {
        let log_event = serde_json::json!({
            "type": "log",
            "level": "info",
            "message": "Processing..."
        });
        
        let received_result = is_result_event(&log_event);
        assert!(!received_result, "Log event should NOT be detected as result event");
        
        // In run_engine, if received_result is false, fallback WILL be emitted
    }

    #[test]
    fn test_extract_command_name() {
        assert_eq!(extract_command_name(&["apply".to_string(), "-Json".to_string()]), "apply");
        assert_eq!(extract_command_name(&["verify".to_string(), "manifest.json".to_string()]), "verify");
        assert_eq!(extract_command_name(&["-Json".to_string()]), "unknown");
        assert_eq!(extract_command_name(&[]), "unknown");
    }
}
