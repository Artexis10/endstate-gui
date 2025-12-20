//! Autosuite GUI - Tauri Backend
//!
//! This module provides the Rust backend for Autosuite GUI, handling CLI execution
//! via std::process::Command and exposing results to the frontend via Tauri commands.

use serde::{Deserialize, Serialize};
use std::process::Command;

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
pub fn autosuite_exec(args: Vec<String>) -> Result<ExecResult, ExecError> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![autosuite_exec])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
