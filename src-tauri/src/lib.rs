//! Endstate GUI - Tauri Backend
//!
//! This module provides the Rust backend for Endstate GUI, handling CLI execution
//! via std::process::Command and exposing results to the frontend via Tauri commands.

// Thin re-export shims over endstate-engine-core (shared with the standalone
// endstate-dev-bridge binary). The in-process dev_server was removed — the
// bridge now runs as a separate non-Tauri process.
pub(crate) mod cmd_impl;
mod engine_adapter;
mod event_broadcast;

use engine_adapter::{create_run_state, SharedRunState};
use event_broadcast::EventBroadcaster;
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

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

/// Execute the Endstate CLI with the given arguments.
///
/// This command invokes the specified executable with the provided arguments,
/// captures stdout, stderr, and exit code, and returns them to the frontend.
///
/// # Arguments
/// * `exe` - Executable to run (e.g., "endstate" or "__bundled__")
/// * `args` - Command line arguments to pass to the executable
///
/// # Returns
/// * `Ok(ExecResult)` - Execution completed (check exit_code for success)
/// * `Err(ExecError)` - Execution failed to start (e.g., CLI not found)
#[tauri::command]
fn endstate_exec(
    app: AppHandle,
    exe: String,
    args: Vec<String>,
    stdin_input: Option<String>,
) -> Result<ExecResult, ExecError> {
    use std::io::Write as _;
    use std::process::Stdio;

    let mut cmd = if exe == "__bundled__" {
        engine_adapter::build_bundled_command(&app, &args)
            .map_err(|e| ExecError {
                code: e.code,
                message: e.message,
            })?
    } else {
        cmd_impl::build_engine_command(&exe, &args)
    };

    let output = if let Some(input) = stdin_input {
        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = cmd.spawn()?;
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input.as_bytes())?;
            // Drop closes stdin so the child sees EOF.
        }
        child.wait_with_output()?
    } else {
        cmd.output()?
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

/// Run the Endstate CLI with streaming NDJSON output.
///
/// This command spawns the CLI process and streams events to the frontend
/// via the "endstate://event" channel. Each line of output is parsed:
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
/// * `exe` - Path to the executable (typically "endstate")
/// * `args` - Command line arguments to pass to the CLI
/// * `stdin_input` - Optional payload written to child stdin and then closed.
///                   Used by hosted-backup auth commands (signup, login, recover)
///                   that accept secrets via stdin instead of flags.
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
    stdin_input: Option<String>,
    run_state: State<'_, SharedRunState>,
    broadcaster: State<'_, EventBroadcaster>,
) -> Result<String, String> {
    let run_state = Arc::clone(&run_state);
    let broadcaster = broadcaster.inner().clone();

    // Run in a blocking task to avoid blocking the async runtime
    let result = tauri::async_runtime::spawn_blocking(move || {
        engine_adapter::run_engine(&app, &exe, &args, &run_state, &broadcaster, stdin_input)
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
    broadcaster: State<'_, EventBroadcaster>,
) -> Result<(), String> {
    engine_adapter::cancel_engine(&app, &run_state, &broadcaster.inner()).map_err(|e| e.to_string())
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
/// Returns %USERPROFILE%\Documents\Endstate\Setups on Windows.
/// Creates the directory if it doesn't exist.
///
/// # Returns
/// * `Ok(String)` - Absolute path to the setups directory
/// * `Err(String)` - Failed to determine or create directory
#[tauri::command]
fn get_default_profiles_directory() -> Result<String, String> {
    let home_dir = dirs::document_dir()
        .ok_or_else(|| "Failed to determine Documents directory".to_string())?;
    
    let profiles_dir = home_dir.join("Endstate").join("Setups");
    
    fs::create_dir_all(&profiles_dir)
        .map_err(|e| format!("Failed to create setups directory: {}", e))?;
    
    profiles_dir
        .to_str()
        .ok_or_else(|| "Invalid path encoding".to_string())
        .map(|s| s.to_string())
}

/// Get the capture cache directory path for transient capture output.
///
/// Returns %LOCALAPPDATA%\Endstate\cache\captures on Windows.
/// Creates the directory if it doesn't exist.
/// This directory is for temporary capture output that hasn't been saved as a profile yet.
///
/// # Returns
/// * `Ok(String)` - Absolute path to the capture cache directory
/// * `Err(String)` - Failed to determine or create directory
#[tauri::command]
fn get_capture_cache_directory() -> Result<String, String> {
    let local_data = dirs::data_local_dir()
        .ok_or_else(|| "Failed to determine LocalAppData directory".to_string())?;
    
    let cache_dir = local_data.join("Endstate").join("cache").join("captures");
    
    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create capture cache directory: {}", e))?;
    
    cache_dir
        .to_str()
        .ok_or_else(|| "Invalid path encoding".to_string())
        .map(|s| s.to_string())
}

/// Copy a file from source to destination.
///
/// # Arguments
/// * `source_path` - Path to the source file
/// * `dest_path` - Path to the destination file
///
/// # Returns
/// * `Ok(())` - File copied successfully
/// * `Err(String)` - Failed to copy file
#[tauri::command]
fn copy_file(source_path: String, dest_path: String) -> Result<(), String> {
    use std::path::Path;
    
    let source = Path::new(&source_path);
    let dest = Path::new(&dest_path);
    
    if !source.exists() || !source.is_file() {
        return Err(format!("Source file does not exist: {}", source_path));
    }
    
    // Ensure destination directory exists
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }
    
    fs::copy(source, dest)
        .map_err(|e| format!("Failed to copy file: {}", e))?;
    
    Ok(())
}

/// Delete a file silently (ignore if not found).
///
/// # Arguments
/// * `path` - Path to the file to delete
///
/// # Returns
/// * `Ok(())` - File deleted or didn't exist
/// * `Err(String)` - Failed to delete file (other than not found)
#[tauri::command]
fn delete_file_silent(path: String) -> Result<(), String> {
    use std::path::Path;
    
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Ok(()); // Already gone, success
    }
    if !file_path.is_file() {
        return Ok(()); // Not a file, ignore
    }
    
    fs::remove_file(file_path)
        .map_err(|e| format!("Failed to delete file: {}", e))
}

/// Clean up all files in the capture cache directory.
/// Called on app startup to remove any leftover transient capture files.
///
/// # Returns
/// * `Ok(())` - Cleanup completed (errors are logged but not fatal)
#[tauri::command]
fn cleanup_capture_cache() -> Result<(), String> {
    let local_data = match dirs::data_local_dir() {
        Some(d) => d,
        None => return Ok(()), // Can't determine dir, skip cleanup
    };
    
    let cache_dir = local_data.join("Endstate").join("cache").join("captures");
    
    if !cache_dir.exists() {
        return Ok(()); // Nothing to clean
    }
    
    // Delete all files in the cache directory
    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let _ = fs::remove_file(&path); // Ignore individual errors
            }
        }
    }
    
    Ok(())
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

/// Validate, stage, and commit a ZIP profile through the shared core importer.
#[tauri::command]
fn extract_zip_profile(zip_path: String, profiles_dir: String) -> Result<String, String> {
    endstate_engine_core::cmd::extract_zip_profile(&zip_path, &profiles_dir)
}

/// Decode and import a browser-provided ZIP through the shared core importer.
#[tauri::command]
fn import_zip_from_base64(data: String, file_name: String, profiles_dir: String) -> Result<String, String> {
    endstate_engine_core::cmd::import_zip_from_base64(&data, &file_name, &profiles_dir)
}

/// Validate, stage, and commit a bare manifest through the shared core importer.
#[tauri::command]
fn import_profile(source_path: String, profiles_dir: String) -> Result<String, String> {
    endstate_engine_core::cmd::import_profile(&source_path, &profiles_dir)
}

/// Validate, stage, and commit a browser/drop manifest through shared core.
#[tauri::command]
fn import_profile_text(
    content: String,
    file_name: String,
    profiles_dir: String,
) -> Result<String, String> {
    endstate_engine_core::cmd::import_profile_text(&content, &file_name, &profiles_dir)
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
    cmd_impl::list_manifest_files(&directory)
}

/// Read a text file from disk.
///
/// # Arguments
/// * `path` - Path to the file to read
///
/// # Returns
/// * `Ok(String)` - File contents
/// * `Err(String)` - Failed to read file
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    use std::path::Path;
    
    let file_path = Path::new(&path);
    if !file_path.exists() || !file_path.is_file() {
        return Err("File does not exist".to_string());
    }
    
    fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Write base64-encoded bytes to a file (binary).
///
/// Used by the recovery-key dialog to write a generated PDF without bundling
/// `@tauri-apps/plugin-fs`. Decodes base64 in Rust and writes the raw bytes.
#[tauri::command]
fn write_file_base64(path: String, data_base64: String) -> Result<(), String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let bytes = STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    if let Some(parent) = std::path::Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }
    fs::write(&path, &bytes).map_err(|e| format!("Failed to write file: {}", e))
}

/// Read a binary file and return its contents as base64.
#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let file_path = std::path::Path::new(&path);
    if !file_path.exists() || !file_path.is_file() {
        return Err("File does not exist".to_string());
    }
    let bytes = fs::read(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(STANDARD.encode(&bytes))
}

/// Write a text file to disk.
///
/// # Arguments
/// * `path` - Path to the file to write
/// * `content` - Content to write
///
/// # Returns
/// * `Ok(())` - File written successfully
/// * `Err(String)` - Failed to write file
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

/// Delete a file from disk.
///
/// # Arguments
/// * `path` - Path to the file to delete
///
/// # Returns
/// * `Ok(())` - File deleted successfully
/// * `Err(String)` - Failed to delete file
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    use std::path::Path;
    
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("File does not exist".to_string());
    }
    if !file_path.is_file() {
        return Err("Path is not a file".to_string());
    }
    
    fs::remove_file(file_path)
        .map_err(|e| format!("Failed to delete file: {}", e))
}

/// Rename a file on disk.
///
/// # Arguments
/// * `old_path` - Current path to the file
/// * `new_path` - New path for the file
///
/// # Returns
/// * `Ok(())` - File renamed successfully
/// * `Err(String)` - Failed to rename file
#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    use std::path::Path;
    
    let old_file = Path::new(&old_path);
    let new_file = Path::new(&new_path);
    
    if !old_file.exists() {
        return Err("Source file does not exist".to_string());
    }
    if !old_file.is_file() {
        return Err("Source path is not a file".to_string());
    }
    if new_file.exists() {
        return Err("Target file already exists".to_string());
    }
    
    fs::rename(old_file, new_file)
        .map_err(|e| format!("Failed to rename file: {}", e))
}

/// Validate a profile manifest against the Endstate profile contract.
///
/// This is a pure file-based validation - reads the file, parses JSON/JSONC,
/// and validates the structure. NO process spawning.
///
/// # Arguments
/// * `path` - Path to the profile file to validate
///
/// # Returns
/// * `Ok(ValidationResult)` - Validation completed (check valid field)
/// * `Err(String)` - Failed to read/parse file
#[tauri::command]
fn validate_profile(
    path: String,
) -> Result<endstate_engine_core::cmd::ValidationResult, String> {
    endstate_engine_core::cmd::validate_profile(&path)
}

/// Write text to a debug file (DEV-only).
/// Used by TS layer to persist JSON candidates for debugging.
///
/// # Arguments
/// * `filename` - Filename (will be placed in debug directory)
/// * `content` - Text content to write
///
/// # Returns
/// * `Ok(String)` - Full path to written file
/// * `Err(String)` - Failed to write file
#[tauri::command]
fn write_text_file_debug(filename: String, content: String) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
        let debug_dir = std::path::PathBuf::from(&local_app_data)
            .join("Endstate")
            .join("debug");
        std::fs::create_dir_all(&debug_dir)
            .map_err(|e| format!("Failed to create debug dir: {}", e))?;
        
        let path = debug_dir.join(&filename);
        std::fs::write(&path, &content)
            .map_err(|e| format!("Failed to write debug file: {}", e))?;
        
        Ok(path.display().to_string())
    }
    
    #[cfg(not(debug_assertions))]
    {
        // In release builds, do nothing
        let _ = (filename, content);
        Ok("debug writing disabled in release".to_string())
    }
}

/// Open a folder in the OS file explorer.
///
/// # Arguments
/// * `path` - Path to the folder to open
///
/// # Returns
/// * `Ok(())` - Folder opened successfully
/// * `Err(String)` - Failed to open folder
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    use std::process::Command;
    
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    Ok(())
}

/// Run endstate with streaming output.
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
async fn run_endstate_streaming(
    app: AppHandle,
    exe: String,
    args: Vec<String>,
    event_channel: String,
) -> Result<(), String> {
    use std::process::Stdio;
    use std::io::{BufRead, BufReader};
    #[cfg(debug_assertions)]
    use std::io::Write;
    use serde_json::json;

    let result = tauri::async_runtime::spawn_blocking(move || {
        // Generate run_id for debug artifacts
        let _run_id = format!("{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0));
        
        // DEV-ONLY: Setup debug artifact files
        #[cfg(debug_assertions)]
        let debug_dir = {
            let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
            let dir = std::path::PathBuf::from(&local_app_data)
                .join("Endstate")
                .join("debug")
                .join(&_run_id);
            std::fs::create_dir_all(&dir).ok();
            dir
        };
        
        #[cfg(debug_assertions)]
        let stdout_log_path = debug_dir.join("stdout.log");
        #[cfg(debug_assertions)]
        let stderr_log_path = debug_dir.join("stderr.log");
        #[cfg(debug_assertions)]
        let meta_path = debug_dir.join("meta.json");
        
        let _cwd = std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_else(|_| "unknown".to_string());
        let _mode = if exe == "endstate" || exe == "__bundled__" { "bundled/path" } else { "unknown" };
        
        // Resolve absolute path of executable for bundled/path mode
        let _resolved_exe = if exe == "endstate" {
            which::which("endstate")
                .map(|p| p.display().to_string())
                .unwrap_or_else(|_| format!("{} (NOT FOUND IN PATH)", exe))
        } else {
            exe.clone()
        };
        
        // DEV-ONLY: Log engine invocation details for debugging
        #[cfg(debug_assertions)]
        {
            eprintln!("=== ENGINE INVOCATION (DEV) ===");
            eprintln!("  run_id: {}", &_run_id);
            eprintln!("  exe (raw): {}", &exe);
            eprintln!("  exe (resolved): {}", &_resolved_exe);
            eprintln!("  args: {:?}", &args);
            eprintln!("  cwd: {}", &_cwd);
            eprintln!("  mode: {}", _mode);
            eprintln!("  debug_dir: {}", debug_dir.display());
            eprintln!("================================");
        }
        
        let start_time = std::time::Instant::now();
        
        let mut cmd = if exe == "__bundled__" {
            match crate::engine_adapter::build_bundled_command(&app, &args) {
                Ok(c) => c,
                Err(e) => {
                    return Err(format!("Bundled engine error: {}", e.message));
                }
            }
        } else {
            crate::cmd_impl::build_engine_command(&exe, &args)
        };
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn process: {}", e))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        // DEV-ONLY: Create debug log files
        #[cfg(debug_assertions)]
        let stdout_log_file = std::sync::Arc::new(std::sync::Mutex::new(
            std::fs::File::create(&stdout_log_path).ok()
        ));
        #[cfg(debug_assertions)]
        let stderr_log_file = std::sync::Arc::new(std::sync::Mutex::new(
            std::fs::File::create(&stderr_log_path).ok()
        ));
        
        #[cfg(debug_assertions)]
        let stdout_bytes = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        #[cfg(debug_assertions)]
        let stderr_bytes = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        #[cfg(debug_assertions)]
        let stdout_lines = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        #[cfg(debug_assertions)]
        let stderr_lines = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

        let app_clone = app.clone();
        let channel_clone = event_channel.clone();
        #[cfg(debug_assertions)]
        let stdout_log_clone = stdout_log_file.clone();
        #[cfg(debug_assertions)]
        let stdout_bytes_clone = stdout_bytes.clone();
        #[cfg(debug_assertions)]
        let stdout_lines_clone = stdout_lines.clone();
        
        let stdout_thread = std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    // DEV-ONLY: Write to debug log with length prefix
                    #[cfg(debug_assertions)]
                    {
                        if let Ok(mut guard) = stdout_log_clone.lock() {
                            if let Some(ref mut file) = *guard {
                                let _ = writeln!(file, "LEN={} | {}", line.len(), &line);
                            }
                        }
                        stdout_bytes_clone.fetch_add(line.len(), std::sync::atomic::Ordering::Relaxed);
                        stdout_lines_clone.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    }
                    
                    let _ = app_clone.emit(&channel_clone, json!({
                        "type": "stdout",
                        "data": line + "\n"
                    }));
                }
            }
        });

        let app_clone = app.clone();
        let channel_clone = event_channel.clone();
        #[cfg(debug_assertions)]
        let stderr_log_clone = stderr_log_file.clone();
        #[cfg(debug_assertions)]
        let stderr_bytes_clone = stderr_bytes.clone();
        #[cfg(debug_assertions)]
        let stderr_lines_clone = stderr_lines.clone();
        
        let stderr_thread = std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    // DEV-ONLY: Write to debug log with length prefix
                    #[cfg(debug_assertions)]
                    {
                        if let Ok(mut guard) = stderr_log_clone.lock() {
                            if let Some(ref mut file) = *guard {
                                let _ = writeln!(file, "LEN={} | {}", line.len(), &line);
                            }
                        }
                        stderr_bytes_clone.fetch_add(line.len(), std::sync::atomic::Ordering::Relaxed);
                        stderr_lines_clone.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    }
                    
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
        
        let _elapsed = start_time.elapsed();

        // DEV-ONLY: Write meta.json with run details
        #[cfg(debug_assertions)]
        {
            let meta = json!({
                "run_id": _run_id,
                "exe_raw": exe,
                "exe_resolved": _resolved_exe,
                "args": args,
                "cwd": _cwd,
                "mode": _mode,
                "exit_code": exit_code,
                "elapsed_ms": _elapsed.as_millis() as u64,
                "stdout_bytes": stdout_bytes.load(std::sync::atomic::Ordering::Relaxed),
                "stdout_lines": stdout_lines.load(std::sync::atomic::Ordering::Relaxed),
                "stderr_bytes": stderr_bytes.load(std::sync::atomic::Ordering::Relaxed),
                "stderr_lines": stderr_lines.load(std::sync::atomic::Ordering::Relaxed),
                "stdout_log": stdout_log_path.display().to_string(),
                "stderr_log": stderr_log_path.display().to_string(),
            });
            if let Ok(meta_str) = serde_json::to_string_pretty(&meta) {
                let _ = std::fs::write(&meta_path, meta_str);
            }
            
            eprintln!("=== ENGINE COMPLETE (DEV) ===");
            eprintln!("  run_id: {}", &_run_id);
            eprintln!("  exit_code: {}", exit_code);
            eprintln!("  stdout_lines: {}", stdout_lines.load(std::sync::atomic::Ordering::Relaxed));
            eprintln!("  stderr_lines: {}", stderr_lines.load(std::sync::atomic::Ordering::Relaxed));
            eprintln!("  debug files:");
            eprintln!("    stdout: {}", stdout_log_path.display());
            eprintln!("    stderr: {}", stderr_log_path.display());
            eprintln!("    meta: {}", meta_path.display());
            eprintln!("=============================");
        }

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

/// Event carrying the file arguments of a *warm* launch to the frontend.
///
/// Emitted from the single-instance callback when the user opens a bundle while
/// Endstate is already running. Cold starts cannot use an event — the webview
/// does not exist yet — so they go through [`PendingOpenArgs`] instead.
const OPENED_FILES_EVENT: &str = "endstate://opened-files";

/// Command-line arguments captured at process start, waiting for the frontend.
///
/// When Windows opens a `.endstate` bundle via the file association it launches
/// us with the path as `argv[1]` (see `windows/installer.nsi`, which registers
/// `endstate.exe "%1"`). At that moment there is nothing listening, so the
/// arguments are parked here and the frontend drains them once on mount via
/// [`take_opened_file_args`].
///
/// Raw argv is handed over verbatim: which arguments actually name an importable
/// profile is decided by the single shared predicate in
/// `src/lib/profile-extensions.ts`, so that rule is never duplicated here.
#[derive(Default)]
struct PendingOpenArgs(std::sync::Mutex<Vec<String>>);

/// Drain the launch arguments captured before the webview existed.
///
/// Returns them at most once: a reload of the webview must not re-import a
/// bundle the user already opened.
#[tauri::command]
fn take_opened_file_args(pending: State<'_, PendingOpenArgs>) -> Vec<String> {
    match pending.0.lock() {
        Ok(mut args) => std::mem::take(&mut *args),
        // A poisoned mutex only means a previous holder panicked; there is
        // nothing to import in that case and failing the launch would be worse.
        Err(_) => Vec::new(),
    }
}

/// Strip `argv[0]` (our own executable path) from a launch argument vector.
fn launch_file_args<I: IntoIterator<Item = String>>(arguments: I) -> Vec<String> {
    arguments.into_iter().skip(1).collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(
            |app, arguments, _working_directory| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }

                // Warm start: the running instance already has a listener, so
                // hand the arguments straight to it. Emitting unconditionally
                // is safe — the frontend ignores argv that names no profile.
                let opened = launch_file_args(arguments);
                if !opened.is_empty() {
                    let _ = app.emit(OPENED_FILES_EVENT, opened);
                }
            },
        ));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(create_run_state())
        .manage(EventBroadcaster::new())
        // Cold start: park argv now, before the window exists, so a bundle
        // double-clicked from Explorer survives until the frontend can drain it.
        .manage(PendingOpenArgs(std::sync::Mutex::new(launch_file_args(
            std::env::args(),
        ))))
        .setup(|app| {
            #[cfg(all(not(debug_assertions), any(windows, target_os = "linux")))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                // Repair missing installer/AppImage protocol registration in
                // packaged builds without allowing dev builds to replace the
                // installed handler with a temporary debug executable.
                // Register the known scheme explicitly. This keeps runtime repair
                // independent of whether the generated plugin config is present.
                let _ = app.deep_link().register("endstate");
            }

            // The host window is created programmatically (tauri.conf.json's
            // `app.windows` is empty). This restores the simple always-create
            // bootstrap after the headless dev-bridge experiment (#81) was
            // retired: the dev bridge now runs as the standalone
            // `endstate-dev-bridge` binary, so the Tauri process no longer needs
            // a windowless mode. Livewire drives the standalone bridge directly.
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                .title("Endstate")
                .inner_size(800.0, 600.0)
                .resizable(true)
                .fullscreen(false)
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            endstate_exec,
            engine_run,
            engine_cancel,
            engine_is_running,
            engine_get_run_id,
            list_manifest_files,
            run_endstate_streaming,
            check_file_exists,
            get_default_profiles_directory,
            get_capture_cache_directory,
            ensure_dir,
            import_profile,
            import_profile_text,
            extract_zip_profile,
            import_zip_from_base64,
            show_file_dialog,
            open_folder,
            read_text_file,
            read_file_base64,
            write_file_base64,
            write_text_file,
            write_text_file_debug,
            delete_file,
            delete_file_silent,
            rename_file,
            copy_file,
            cleanup_capture_cache,
            validate_profile,
            take_opened_file_args
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

