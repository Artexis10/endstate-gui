//! Autosuite GUI - Tauri Backend
//!
//! This module provides the Rust backend for Autosuite GUI, handling CLI execution
//! via std::process::Command and exposing results to the frontend via Tauri commands.

mod engine_adapter;

use engine_adapter::{SharedRunState, create_run_state};
use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

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
    let autosuite_path = std::env::var("AUTOSUITE_PATH")
        .unwrap_or_else(|_| {
            if cfg!(windows) {
                "C:\\Users\\win-laptop\\Desktop\\projects\\autosuite\\autosuite.ps1".to_string()
            } else {
                "autosuite".to_string()
            }
        });

    let output = if cfg!(windows) && autosuite_path.ends_with(".ps1") {
        Command::new("pwsh")
            .arg("-NoProfile")
            .arg("-File")
            .arg(&autosuite_path)
            .args(&args)
            .output()?
    } else {
        Command::new(&autosuite_path)
            .args(&args)
            .output()?
    };

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

/// Check if a file exists at the given path.
///
/// # Arguments
/// * `path` - Path to check
///
/// # Returns
/// * `Ok(true)` if file exists and is a file (not directory)
/// * `Ok(false)` if file does not exist or is a directory
#[tauri::command]
fn check_file_exists(path: String) -> Result<bool, String> {
    use std::path::Path;
    
    let file_path = Path::new(&path);
    Ok(file_path.exists() && file_path.is_file())
}

/// Get the default profiles directory path.
///
/// Returns %USERPROFILE%\Documents\Autosuite\Setups on Windows.
/// Creates the directory if it doesn't exist.
///
/// # Returns
/// * `Ok(String)` - Absolute path to the setups directory
/// * `Err(String)` - Failed to determine or create directory
#[tauri::command]
fn get_default_profiles_directory() -> Result<String, String> {
    let home_dir = dirs::document_dir()
        .ok_or_else(|| "Failed to determine Documents directory".to_string())?;
    
    let profiles_dir = home_dir.join("Autosuite").join("Setups");
    
    fs::create_dir_all(&profiles_dir)
        .map_err(|e| format!("Failed to create setups directory: {}", e))?;
    
    profiles_dir
        .to_str()
        .ok_or_else(|| "Invalid path encoding".to_string())
        .map(|s| s.to_string())
}

/// Ensure a directory exists by creating it if necessary.
///
/// # Arguments
/// * `path` - Directory path to ensure exists
///
/// # Returns
/// * `Ok(())` - Directory exists or was created
/// * `Err(String)` - Failed to create directory
#[tauri::command]
fn ensure_dir(path: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("Directory path cannot be empty".to_string());
    }
    
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    Ok(())
}

/// Copy a file to the profiles directory.
///
/// # Arguments
/// * `source_path` - Path to the source file
/// * `profiles_dir` - Destination profiles directory
///
/// # Returns
/// * `Ok(String)` - Name of the copied file (basename)
/// * `Err(String)` - Failed to copy file
#[tauri::command]
fn import_profile(source_path: String, profiles_dir: String) -> Result<String, String> {
    use std::path::Path;
    
    let source = Path::new(&source_path);
    let dest_dir = Path::new(&profiles_dir);
    
    if !source.exists() || !source.is_file() {
        return Err("Source file does not exist".to_string());
    }
    
    let file_name = source
        .file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?;
    
    let dest_path = dest_dir.join(file_name);
    
    fs::copy(source, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;
    
    file_name
        .to_str()
        .ok_or_else(|| "Invalid file name encoding".to_string())
        .map(|s| s.to_string())
}

/// Show a file picker dialog for selecting a profile file.
///
/// # Returns
/// * `Ok(Some(String))` - Selected file path
/// * `Ok(None)` - User cancelled
#[tauri::command]
fn show_file_dialog() -> Result<Option<String>, String> {
    use std::process::Command;
    
    let output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.OpenFileDialog; $dialog.Filter = 'Profile Files|*.json;*.jsonc;*.json5'; $dialog.Title = 'Select Profile File'; if ($dialog.ShowDialog() -eq 'OK') { $dialog.FileName } else { '' }"
        ])
        .output()
        .map_err(|e| format!("Failed to show file dialog: {}", e))?;
    
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    
    if path.is_empty() {
        Ok(None)
    } else {
        Ok(Some(path))
    }
}

/// List manifest files in a directory.
///
/// Searches for *.json, *.jsonc, *.json5 files in the specified directory.
///
/// # Arguments
/// * `directory` - Path to the directory to search
///
/// # Returns
/// * `Ok(Vec<String>)` - List of absolute file paths
/// * `Err(String)` - Failed to read directory
#[tauri::command]
fn list_manifest_files(directory: String) -> Result<Vec<String>, String> {
    use std::fs;
    use std::path::Path;

    let dir_path = Path::new(&directory);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory does not exist: {}", directory));
    }

    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut manifest_files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if ext_str == "json" || ext_str == "jsonc" || ext_str == "json5" {
                        if let Some(path_str) = path.to_str() {
                            manifest_files.push(path_str.to_string());
                        }
                    }
                }
            }
        }
    }

    manifest_files.sort();
    Ok(manifest_files)
}

/// Run autosuite with streaming output.
///
/// Spawns the process and emits events to the specified channel:
/// - {"type": "stdout", "data": "..."}
/// - {"type": "stderr", "data": "..."}
/// - {"type": "exit", "exitCode": 0}
///
/// # Arguments
/// * `app` - Tauri app handle for emitting events
/// * `exe` - Executable path
/// * `args` - Command line arguments
/// * `event_channel` - Event channel name to emit to
///
/// # Returns
/// * `Ok(())` - Process completed
/// * `Err(String)` - Failed to start process
#[tauri::command]
async fn run_autosuite_streaming(
    app: AppHandle,
    exe: String,
    args: Vec<String>,
    event_channel: String,
) -> Result<(), String> {
    use std::process::{Command, Stdio};
    use std::io::{BufRead, BufReader};
    use serde_json::json;

    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut child = Command::new(&exe)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn process: {}", e))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        let app_clone = app.clone();
        let channel_clone = event_channel.clone();
        let stdout_thread = std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_clone.emit(&channel_clone, json!({
                        "type": "stdout",
                        "data": line + "\n"
                    }));
                }
            }
        });

        let app_clone = app.clone();
        let channel_clone = event_channel.clone();
        let stderr_thread = std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_clone.emit(&channel_clone, json!({
                        "type": "stderr",
                        "data": line + "\n"
                    }));
                }
            }
        });

        let status = child.wait().map_err(|e| format!("Failed to wait for process: {}", e))?;
        let exit_code = status.code().unwrap_or(-1);

        stdout_thread.join().ok();
        stderr_thread.join().ok();

        let _ = app.emit(&event_channel, json!({
            "type": "exit",
            "exitCode": exit_code
        }));

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(result)
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
            engine_get_run_id,
            list_manifest_files,
            run_autosuite_streaming,
            check_file_exists,
            get_default_profiles_directory,
            ensure_dir,
            import_profile,
            show_file_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
