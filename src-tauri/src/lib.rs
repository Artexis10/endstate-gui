//! Endstate GUI - Tauri Backend
//!
//! This module provides the Rust backend for Endstate GUI, handling CLI execution
//! via std::process::Command and exposing results to the frontend via Tauri commands.

#[allow(dead_code)] // Only called from dev_server (feature-gated)
pub(crate) mod cmd_impl;
mod engine_adapter;
mod event_broadcast;
mod license;
#[cfg(all(debug_assertions, feature = "dev-server"))]
mod dev_server;

use engine_adapter::{SharedRunState, create_run_state};
use event_broadcast::EventBroadcaster;
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
#[cfg(all(debug_assertions, feature = "dev-server"))]
use tauri::Manager;

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
/// * `exe` - Executable to run (e.g., "endstate" or "pwsh")
/// * `args` - Command line arguments to pass to the executable
///
/// # Returns
/// * `Ok(ExecResult)` - Execution completed (check exit_code for success)
/// * `Err(ExecError)` - Execution failed to start (e.g., CLI not found)
#[tauri::command]
fn endstate_exec(exe: String, args: Vec<String>) -> Result<ExecResult, ExecError> {
    let output = cmd_impl::build_engine_command(&exe, &args).output()?;

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
    broadcaster: State<'_, EventBroadcaster>,
) -> Result<String, String> {
    let run_state = Arc::clone(&run_state);
    let broadcaster = broadcaster.inner().clone();
    
    // Run in a blocking task to avoid blocking the async runtime
    let result = tauri::async_runtime::spawn_blocking(move || {
        engine_adapter::run_engine(&app, &exe, &args, &run_state, &broadcaster)
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

/// Extract a zip file into the profiles directory.
///
/// Creates a subfolder named after the zip file (without extension),
/// extracts all contents into it, and returns the folder path.
///
/// # Arguments
/// * `zip_path` - Path to the zip file to extract
/// * `profiles_dir` - Destination profiles directory
///
/// # Returns
/// * `Ok(String)` - Path to the extracted folder
/// * `Err(String)` - Failed to extract
#[tauri::command]
fn extract_zip_profile(zip_path: String, profiles_dir: String) -> Result<String, String> {
    use std::path::Path;
    use std::io::Read;

    let source = Path::new(&zip_path);
    let dest_dir = Path::new(&profiles_dir);

    if !source.exists() || !source.is_file() {
        return Err("Zip file does not exist".to_string());
    }

    // Derive folder name from zip filename (without extension)
    let stem = source
        .file_stem()
        .ok_or_else(|| "Invalid zip file name".to_string())?
        .to_str()
        .ok_or_else(|| "Invalid file name encoding".to_string())?;

    let extract_dir = dest_dir.join(stem);

    // Collision avoidance: if folder exists, add suffix
    let mut final_dir = extract_dir.clone();
    let mut suffix = 1u32;
    while final_dir.exists() {
        final_dir = dest_dir.join(format!("{}_{}", stem, suffix));
        suffix += 1;
        if suffix > 100 {
            return Err("Too many collisions for folder name".to_string());
        }
    }

    fs::create_dir_all(&final_dir)
        .map_err(|e| format!("Failed to create extraction directory: {}", e))?;

    // Open and extract the zip
    let file = fs::File::open(source)
        .map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        let entry_name = entry.name().to_string();

        // Security: reject entries with path traversal
        if entry_name.contains("..") {
            continue;
        }

        let out_path = final_dir.join(&entry_name);

        if entry.is_dir() {
            fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create directory {}: {}", entry_name, e))?;
        } else {
            // Ensure parent directory exists
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {}", e))?;
            }
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read zip entry {}: {}", entry_name, e))?;
            fs::write(&out_path, &buf)
                .map_err(|e| format!("Failed to write {}: {}", entry_name, e))?;
        }
    }

    final_dir
        .to_str()
        .ok_or_else(|| "Invalid path encoding".to_string())
        .map(|s| s.to_string())
}

/// Import a zip file from base64-encoded data.
///
/// Decodes base64 data, writes to a temp file, extracts to the profiles
/// directory, and cleans up the temp file.
///
/// # Arguments
/// * `data` - Base64-encoded zip file content
/// * `file_name` - Original file name (used for folder naming)
/// * `profiles_dir` - Destination profiles directory
///
/// # Returns
/// * `Ok(String)` - Path to the extracted folder
/// * `Err(String)` - Failed to import
#[tauri::command]
fn import_zip_from_base64(data: String, file_name: String, profiles_dir: String) -> Result<String, String> {
    use base64::Engine;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Write to temp file
    let local_data = dirs::data_local_dir()
        .ok_or_else(|| "Cannot determine local data directory".to_string())?;
    let temp_dir = local_data.join("Endstate").join("cache").join("imports");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let temp_path = temp_dir.join(&file_name);
    fs::write(&temp_path, &bytes)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    // Extract using existing function
    let result = extract_zip_profile(
        temp_path.to_str().unwrap_or_default().to_string(),
        profiles_dir,
    );

    // Clean up temp file
    let _ = fs::remove_file(&temp_path);

    result
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

/// Profile validation result returned from validate_profile command.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub summary: Option<ProfileSummary>,
}

/// Validation error with code and message.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationError {
    pub code: String,
    pub message: String,
}

/// Profile summary for valid profiles.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub name: String,
    pub version: i32,
    pub app_count: i32,
    pub captured: Option<String>,
}

/// Strip JSONC comments (// and /* */) from content.
/// This is a simple implementation that handles most common cases.
fn strip_jsonc_comments(content: &str) -> String {
    let mut result = String::with_capacity(content.len());
    let mut chars = content.chars().peekable();
    let mut in_string = false;
    let mut escape_next = false;
    
    while let Some(c) = chars.next() {
        if escape_next {
            result.push(c);
            escape_next = false;
            continue;
        }
        
        if c == '\\' && in_string {
            result.push(c);
            escape_next = true;
            continue;
        }
        
        if c == '"' && !escape_next {
            in_string = !in_string;
            result.push(c);
            continue;
        }
        
        if !in_string && c == '/' {
            if let Some(&next) = chars.peek() {
                if next == '/' {
                    // Single-line comment - skip to end of line
                    chars.next(); // consume second /
                    while let Some(&ch) = chars.peek() {
                        if ch == '\n' {
                            break;
                        }
                        chars.next();
                    }
                    continue;
                } else if next == '*' {
                    // Multi-line comment - skip to */
                    chars.next(); // consume *
                    while let Some(ch) = chars.next() {
                        if ch == '*' {
                            if let Some(&'/') = chars.peek() {
                                chars.next(); // consume /
                                break;
                            }
                        }
                    }
                    continue;
                }
            }
        }
        
        result.push(c);
    }
    
    result
}

/// Pure validation of a profile manifest object.
/// No IO, no process spawning - just validates the structure.
fn validate_profile_object(json: &serde_json::Value) -> ValidationResult {
    let mut errors = Vec::new();
    
    // Check 1: Must be an object
    let obj = match json.as_object() {
        Some(o) => o,
        None => {
            return ValidationResult {
                valid: false,
                errors: vec![ValidationError {
                    code: "NOT_AN_OBJECT".to_string(),
                    message: "Profile must be a JSON object".to_string(),
                }],
                summary: None,
            };
        }
    };
    
    // Check 2: Version field exists
    let version = match obj.get("version") {
        Some(v) => v,
        None => {
            return ValidationResult {
                valid: false,
                errors: vec![ValidationError {
                    code: "MISSING_VERSION".to_string(),
                    message: "No 'version' field present".to_string(),
                }],
                summary: None,
            };
        }
    };
    
    // Check 3: Version is a number
    let version_num = match version.as_i64().or_else(|| version.as_f64().map(|f| f as i64)) {
        Some(v) => v,
        None => {
            return ValidationResult {
                valid: false,
                errors: vec![ValidationError {
                    code: "INVALID_VERSION_TYPE".to_string(),
                    message: format!("Field 'version' must be a number, got: {}", version),
                }],
                summary: None,
            };
        }
    };
    
    // Check 4: Version is supported (currently only v1)
    if version_num != 1 {
        return ValidationResult {
            valid: false,
            errors: vec![ValidationError {
                code: "UNSUPPORTED_VERSION".to_string(),
                message: format!("Unsupported profile version: {} (supported: 1)", version_num),
            }],
            summary: None,
        };
    }
    
    // Check 5: Apps field exists
    let apps = match obj.get("apps") {
        Some(a) => a,
        None => {
            return ValidationResult {
                valid: false,
                errors: vec![ValidationError {
                    code: "MISSING_APPS".to_string(),
                    message: "No 'apps' field present".to_string(),
                }],
                summary: None,
            };
        }
    };
    
    // Check 6: Apps is an array
    let apps_array = match apps.as_array() {
        Some(a) => a,
        None if apps.is_null() => &vec![], // null is acceptable, treat as empty
        None => {
            return ValidationResult {
                valid: false,
                errors: vec![ValidationError {
                    code: "INVALID_APPS_TYPE".to_string(),
                    message: "Field 'apps' must be an array".to_string(),
                }],
                summary: None,
            };
        }
    };
    
    // Optional: Warn about app entries missing 'id' (not a hard failure for backward compat)
    for (idx, app) in apps_array.iter().enumerate() {
        if let Some(app_obj) = app.as_object() {
            if !app_obj.contains_key("id") || app_obj.get("id").map(|v| v.as_str().unwrap_or("").is_empty()).unwrap_or(true) {
                errors.push(ValidationError {
                    code: "INVALID_APP_ENTRY".to_string(),
                    message: format!("App entry at index {} is missing 'id' field", idx + 1),
                });
            }
        }
    }
    
    // Profile is valid - build summary
    let name = obj.get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("")
        .to_string();
    
    let captured = obj.get("captured")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());
    
    ValidationResult {
        valid: true,
        errors, // May contain warnings about missing app IDs
        summary: Some(ProfileSummary {
            name,
            version: version_num as i32,
            app_count: apps_array.len() as i32,
            captured,
        }),
    }
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
fn validate_profile(path: String) -> Result<ValidationResult, String> {
    use std::path::Path;
    
    let file_path = Path::new(&path);
    
    // Check 1: File must exist
    if !file_path.exists() {
        return Ok(ValidationResult {
            valid: false,
            errors: vec![ValidationError {
                code: "FILE_NOT_FOUND".to_string(),
                message: format!("File does not exist: {}", path),
            }],
            summary: None,
        });
    }
    
    // Check 2: Must be a file
    if !file_path.is_file() {
        return Ok(ValidationResult {
            valid: false,
            errors: vec![ValidationError {
                code: "NOT_A_FILE".to_string(),
                message: format!("Path is not a file: {}", path),
            }],
            summary: None,
        });
    }
    
    // Read file content
    let content = match fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(e) => {
            return Ok(ValidationResult {
                valid: false,
                errors: vec![ValidationError {
                    code: "READ_ERROR".to_string(),
                    message: format!("Failed to read file: {}", e),
                }],
                summary: None,
            });
        }
    };
    
    // Strip JSONC comments for .jsonc and .json5 files
    let ext = file_path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    
    let json_content = if ext == "jsonc" || ext == "json5" {
        strip_jsonc_comments(&content)
    } else {
        // Also strip comments from .json files since they might have them
        strip_jsonc_comments(&content)
    };
    
    // Parse JSON
    let json: serde_json::Value = match serde_json::from_str(&json_content) {
        Ok(j) => j,
        Err(e) => {
            return Ok(ValidationResult {
                valid: false,
                errors: vec![ValidationError {
                    code: "PARSE_ERROR".to_string(),
                    message: format!("Invalid JSON/JSONC syntax: {}", e),
                }],
                summary: None,
            });
        }
    };
    
    // Validate the parsed object
    Ok(validate_profile_object(&json))
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
        let _mode = if exe == "endstate" { "bundled/path" } else if exe == "pwsh" || exe == "powershell" { "script" } else { "unknown" };
        
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
        
        let mut cmd = crate::cmd_impl::build_engine_command(&exe, &args);
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

// ---------------------------------------------------------------------------
// License commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn activate_license(key: String) -> Result<license::LicenseStatus, String> {
    license::activate(key).await
}

#[tauri::command]
async fn check_license() -> Result<license::LicenseStatus, String> {
    license::check().await
}

#[tauri::command]
async fn deactivate_license() -> Result<(), String> {
    license::deactivate().await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(create_run_state())
        .manage(EventBroadcaster::new())
        .setup(|_app| {
            #[cfg(all(debug_assertions, feature = "dev-server"))]
            {
                if std::env::var("TIDEWAVE_ENABLED").unwrap_or_default() == "1" {
                    let broadcaster = _app.state::<EventBroadcaster>().inner().clone();
                    let run_state = _app.state::<SharedRunState>().inner().clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = dev_server::start(run_state, broadcaster).await {
                            eprintln!("Dev server failed: {}", e);
                        }
                    });
                }
            }
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
            extract_zip_profile,
            import_zip_from_base64,
            show_file_dialog,
            open_folder,
            read_text_file,
            read_file_base64,
            write_text_file,
            write_text_file_debug,
            delete_file,
            delete_file_silent,
            rename_file,
            copy_file,
            cleanup_capture_cache,
            validate_profile,
            activate_license,
            check_license,
            deactivate_license
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
