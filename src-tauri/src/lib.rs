//! Autosuite GUI - Tauri Backend
//!
//! This module provides the Rust backend for Autosuite GUI, handling CLI execution
//! via std::process::Command and exposing results to the frontend via Tauri commands.

mod engine_adapter;

use engine_adapter::{SharedRunState, create_run_state};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, State};

/// Result of CLI execution returned to the frontend.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// Error type for CLI execution failures.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecError {
    pub code: String,
    pub message: String,
}

impl From<std::io::Error> for ExecError {
    fn from(err: std::io::Error) -> Self {
        let code = match err.kind() {
            std::io::ErrorKind::NotFound => "CLI_NOT_FOUND",
            std::io::ErrorKind::PermissionDenied => "PERMISSION_DENIED",
            _ => "EXEC_FAILED",
        };
        ExecError {
            code: code.to_string(),
            message: err.to_string(),
        }
    }
}

/// Execute the Autosuite CLI with the given arguments.
///
/// This command invokes `autosuite` from PATH with the provided arguments,
/// captures stdout, stderr, and exit code, and returns them to the frontend.
///
/// # Arguments
/// * `args` - Command line arguments to pass to autosuite CLI
///
/// # Returns
/// * `Ok(ExecResult)` - Execution completed (check exit_code for success)
/// * `Err(ExecError)` - Execution failed to start (e.g., CLI not found)
#[tauri::command]
fn autosuite_exec(args: Vec<String>) -> Result<ExecResult, ExecError> {
    let output = Command::new("autosuite")
        .args(&args)
        .output()?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    Ok(ExecResult {
        stdout,
        stderr,
        exit_code,
    })
}

/// Run the Autosuite CLI with streaming NDJSON output.
///
/// This command spawns the CLI process and streams events to the frontend
/// via the "autosuite://event" channel. Each line of output is parsed:
/// - Valid JSON is emitted with runId injected
/// - Plain text from stdout becomes {"type":"log","level":"info","message":"...","runId":"..."}
/// - Plain text from stderr becomes {"type":"log","level":"error","message":"...","runId":"..."}
///
/// When the process exits, if no terminal "result" event was received,
/// a fallback result is emitted.
///
/// Only one run can be active at a time. If another run is in progress,
/// this command returns an error.
///
/// # Arguments
/// * `app` - Tauri app handle for emitting events
/// * `exe` - Path to the executable (typically "autosuite")
/// * `args` - Command line arguments to pass to the CLI
/// * `run_state` - Shared state for tracking the running process
///
/// # Returns
/// * `Ok(String)` - The runId of the completed run
/// * `Err(String)` - Failed to start the process or another run is active
#[tauri::command]
async fn engine_run(
    app: AppHandle,
    exe: String,
    args: Vec<String>,
    run_state: State<'_, SharedRunState>,
) -> Result<String, String> {
    let run_state = Arc::clone(&run_state);
    
    // Run in a blocking task to avoid blocking the async runtime
    let result = tauri::async_runtime::spawn_blocking(move || {
        engine_adapter::run_engine(&app, &exe, &args, &run_state)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    result.map_err(|e| e.to_string())
}

/// Cancel the currently running engine process.
///
/// This command terminates the running CLI process and emits a cancellation
/// result event. If no run is active, returns an error.
///
/// # Arguments
/// * `app` - Tauri app handle for emitting events
/// * `run_state` - Shared state for tracking the running process
///
/// # Returns
/// * `Ok(())` - Cancellation was initiated
/// * `Err(String)` - No run is active or failed to cancel
#[tauri::command]
async fn engine_cancel(
    app: AppHandle,
    run_state: State<'_, SharedRunState>,
) -> Result<(), String> {
    engine_adapter::cancel_engine(&app, &run_state).map_err(|e| e.to_string())
}

/// Check if an engine run is currently active.
///
/// # Returns
/// * `true` if a run is in progress, `false` otherwise
#[tauri::command]
fn engine_is_running(run_state: State<'_, SharedRunState>) -> bool {
    engine_adapter::is_run_active(&run_state)
}

/// Get the current run ID if a run is active.
///
/// # Returns
/// * `Some(runId)` if a run is active, `None` otherwise
#[tauri::command]
fn engine_get_run_id(run_state: State<'_, SharedRunState>) -> Option<String> {
    engine_adapter::get_current_run_id(&run_state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(create_run_state())
        .invoke_handler(tauri::generate_handler![
            autosuite_exec,
            engine_run,
            engine_cancel,
            engine_is_running,
            engine_get_run_id
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
