//! Engine Adapter Module
//!
//! This module provides the streaming interface between Autosuite CLI and the GUI.
//! It spawns the CLI process, reads stdout/stderr concurrently, and emits NDJSON
//! events to the frontend via Tauri events.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;
use tauri::{AppHandle, Emitter};

/// Event channel name for all engine events
pub const EVENT_CHANNEL: &str = "autosuite://event";

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
            message: format!("Failed to execute autosuite: {}", err),
        }
    }
}

/// Parse a line of output and determine if it's valid JSON or plain text.
/// Returns the appropriate event to emit.
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
pub fn create_fallback_result(exit_code: i32) -> Value {
    serde_json::json!({
        "type": "result",
        "ok": exit_code == 0,
        "command": "unknown",
        "summary": {
            "exitCode": exit_code
        },
        "raw": null
    })
}

/// Spawn the autosuite CLI and stream events to the frontend.
///
/// This function:
/// 1. Spawns the CLI process with the given executable and arguments
/// 2. Reads stdout and stderr concurrently in separate threads
/// 3. Parses each line and emits appropriate events
/// 4. Emits a fallback result if no terminal result was received
///
/// # Arguments
/// * `app` - Tauri app handle for emitting events
/// * `exe` - Path to the executable (typically "autosuite")
/// * `args` - Command line arguments
///
/// # Returns
/// * `Ok(())` - Process completed (events were streamed)
/// * `Err(EngineError)` - Failed to start the process
pub fn run_engine(app: &AppHandle, exe: &str, args: &[String]) -> Result<(), EngineError> {
    // Spawn the process with piped stdout/stderr
    let mut child = Command::new(exe)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    // Take ownership of stdout/stderr
    let stdout = child.stdout.take().expect("stdout was piped");
    let stderr = child.stderr.take().expect("stderr was piped");

    // Create channel for collecting messages from reader threads
    let (tx, rx): (Sender<StreamMessage>, Receiver<StreamMessage>) = mpsc::channel();

    // Spawn stdout reader thread
    let tx_stdout = tx.clone();
    let stdout_handle = thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if !line.is_empty() {
                    let _ = tx_stdout.send(StreamMessage::Stdout(line));
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
                    let _ = tx_stderr.send(StreamMessage::Stderr(line));
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
                let event = parse_line(&line, false);
                if is_result_event(&event) {
                    received_result = true;
                }
                let _ = app.emit(EVENT_CHANNEL, &event);
            }
            StreamMessage::Stderr(line) => {
                let event = parse_line(&line, true);
                let _ = app.emit(EVENT_CHANNEL, &event);
            }
        }
    }

    // Wait for reader threads to finish
    let _ = stdout_handle.join();
    let _ = stderr_handle.join();

    // Wait for process to exit and get exit code
    let exit_code = child.wait()?.code().unwrap_or(-1);

    // Emit fallback result if no terminal result was received
    if !received_result {
        let fallback = create_fallback_result(exit_code);
        let _ = app.emit(EVENT_CHANNEL, &fallback);
    }

    Ok(())
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
        let result = create_fallback_result(0);
        
        assert_eq!(result.get("type").unwrap().as_str().unwrap(), "result");
        assert_eq!(result.get("ok").unwrap().as_bool().unwrap(), true);
        assert_eq!(result.get("command").unwrap().as_str().unwrap(), "unknown");
        assert_eq!(result.get("summary").unwrap().get("exitCode").unwrap().as_i64().unwrap(), 0);
        assert!(result.get("raw").unwrap().is_null());
    }

    #[test]
    fn test_create_fallback_result_failure() {
        let result = create_fallback_result(1);
        
        assert_eq!(result.get("ok").unwrap().as_bool().unwrap(), false);
        assert_eq!(result.get("summary").unwrap().get("exitCode").unwrap().as_i64().unwrap(), 1);
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
}
