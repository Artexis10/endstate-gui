//! Shared command implementations for both Tauri commands and the dev HTTP server.
//!
//! These are pure business-logic functions with no Tauri dependencies.
//! The #[tauri::command] wrappers in lib.rs and the HTTP handlers in
//! dev_server.rs both delegate to these functions.

use std::fs;
use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

/// Result of CLI execution.
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

/// Profile validation result.
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

/// Build a Command for the engine binary.
///
/// With the Go engine, this is simple — just spawn the exe with args.
/// Passes through ENDSTATE_ROOT if set in the environment so the binary
/// can find modules/ and payload/.
///
/// All engine process spawn sites MUST use this helper instead of Command::new(exe)
/// directly. See PROJECT_SHADOW.md Section 6 (Landmines).
pub fn build_engine_command(exe: &str, args: &[String]) -> Command {
    let mut cmd = Command::new(exe);
    cmd.args(args);

    // Pass through ENDSTATE_ROOT so the Go binary can find modules/, payload/, etc.
    if let Ok(root) = std::env::var("ENDSTATE_ROOT") {
        cmd.env("ENDSTATE_ROOT", &root);
    }

    cmd
}

pub fn endstate_exec(exe: String, args: Vec<String>) -> Result<ExecResult, ExecError> {
    let output = build_engine_command(&exe, &args).output()?;
    Ok(ExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

pub fn check_file_exists(path: &str) -> Result<bool, String> {
    let p = Path::new(path);
    Ok(p.exists() && p.is_file())
}

pub fn get_default_profiles_directory() -> Result<String, String> {
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

pub fn get_capture_cache_directory() -> Result<String, String> {
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

pub fn copy_file(source_path: &str, dest_path: &str) -> Result<(), String> {
    let source = Path::new(source_path);
    let dest = Path::new(dest_path);
    if !source.exists() || !source.is_file() {
        return Err(format!("Source file does not exist: {}", source_path));
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    }
    fs::copy(source, dest).map_err(|e| format!("Failed to copy file: {}", e))?;
    Ok(())
}

pub fn delete_file_silent(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() || !p.is_file() {
        return Ok(());
    }
    fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))
}

pub fn cleanup_capture_cache() -> Result<(), String> {
    let local_data = match dirs::data_local_dir() {
        Some(d) => d,
        None => return Ok(()),
    };
    let cache_dir = local_data.join("Endstate").join("cache").join("captures");
    if !cache_dir.exists() {
        return Ok(());
    }
    if let Ok(entries) = fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let _ = fs::remove_file(&path);
            }
        }
    }
    Ok(())
}

pub fn ensure_dir(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Err("Directory path cannot be empty".to_string());
    }
    fs::create_dir_all(path).map_err(|e| format!("Failed to create directory: {}", e))
}

pub fn import_profile(source_path: &str, profiles_dir: &str) -> Result<String, String> {
    let source = Path::new(source_path);
    let dest_dir = Path::new(profiles_dir);
    if !source.exists() || !source.is_file() {
        return Err("Source file does not exist".to_string());
    }
    let file_name = source
        .file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?;
    let dest_path = dest_dir.join(file_name);
    fs::copy(source, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;
    file_name
        .to_str()
        .ok_or_else(|| "Invalid file name encoding".to_string())
        .map(|s| s.to_string())
}

pub fn show_file_dialog() -> Result<Option<String>, String> {
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

pub fn list_manifest_files(directory: &str) -> Result<Vec<String>, String> {
    let dir_path = Path::new(directory);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Directory does not exist: {}", directory));
    }

    fn is_manifest(path: &Path) -> bool {
        path.is_file()
            && path
                .extension()
                .map(|ext| {
                    let e = ext.to_string_lossy().to_lowercase();
                    e == "json" || e == "jsonc" || e == "json5"
                })
                .unwrap_or(false)
    }

    let entries =
        fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;
    let mut manifest_files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if is_manifest(&path) {
                if let Some(path_str) = path.to_str() {
                    manifest_files.push(path_str.to_string());
                }
            } else if path.is_dir() {
                // Look one level into subdirectories for extracted zip bundles
                // (e.g. Setups/my-capture/manifest.jsonc)
                // Skip known non-profile directories
                let dir_name = entry.file_name().to_string_lossy().to_lowercase();
                if dir_name == "runs" {
                    continue;
                }
                if let Ok(sub_entries) = fs::read_dir(&path) {
                    for sub_entry in sub_entries {
                        if let Ok(sub_entry) = sub_entry {
                            let sub_path = sub_entry.path();
                            if is_manifest(&sub_path) {
                                if let Some(path_str) = sub_path.to_str() {
                                    manifest_files.push(path_str.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    manifest_files.sort();
    Ok(manifest_files)
}

pub fn read_text_file(path: &str) -> Result<String, String> {
    let p = Path::new(path);
    if !p.exists() || !p.is_file() {
        return Err("File does not exist".to_string());
    }
    fs::read_to_string(p).map_err(|e| format!("Failed to read file: {}", e))
}

pub fn write_text_file(path: &str, content: &str) -> Result<(), String> {
    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}

pub fn delete_file(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err("File does not exist".to_string());
    }
    if !p.is_file() {
        return Err("Path is not a file".to_string());
    }
    fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))
}

pub fn rename_file(old_path: &str, new_path: &str) -> Result<(), String> {
    let old_file = Path::new(old_path);
    let new_file = Path::new(new_path);
    if !old_file.exists() {
        return Err("Source file does not exist".to_string());
    }
    if !old_file.is_file() {
        return Err("Source path is not a file".to_string());
    }
    if new_file.exists() {
        return Err("Target file already exists".to_string());
    }
    fs::rename(old_file, new_file).map_err(|e| format!("Failed to rename file: {}", e))
}

pub fn open_folder(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    Ok(())
}

pub fn write_text_file_debug(filename: &str, content: &str) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".to_string());
        let debug_dir = std::path::PathBuf::from(&local_app_data)
            .join("Endstate")
            .join("debug");
        std::fs::create_dir_all(&debug_dir)
            .map_err(|e| format!("Failed to create debug dir: {}", e))?;
        let path = debug_dir.join(filename);
        std::fs::write(&path, content)
            .map_err(|e| format!("Failed to write debug file: {}", e))?;
        Ok(path.display().to_string())
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = (filename, content);
        Ok("debug writing disabled in release".to_string())
    }
}

/// Strip JSONC comments (// and /* */) from content.
pub fn strip_jsonc_comments(content: &str) -> String {
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
                    chars.next();
                    while let Some(&ch) = chars.peek() {
                        if ch == '\n' {
                            break;
                        }
                        chars.next();
                    }
                    continue;
                } else if next == '*' {
                    chars.next();
                    while let Some(ch) = chars.next() {
                        if ch == '*' {
                            if let Some(&'/') = chars.peek() {
                                chars.next();
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
pub fn validate_profile_object(json: &serde_json::Value) -> ValidationResult {
    let mut errors = Vec::new();
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
    let apps_array = match apps.as_array() {
        Some(a) => a,
        None if apps.is_null() => &vec![],
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
    for (idx, app) in apps_array.iter().enumerate() {
        if let Some(app_obj) = app.as_object() {
            if !app_obj.contains_key("id")
                || app_obj
                    .get("id")
                    .map(|v| v.as_str().unwrap_or("").is_empty())
                    .unwrap_or(true)
            {
                errors.push(ValidationError {
                    code: "INVALID_APP_ENTRY".to_string(),
                    message: format!("App entry at index {} is missing 'id' field", idx + 1),
                });
            }
        }
    }
    let name = obj
        .get("name")
        .and_then(|n| n.as_str())
        .unwrap_or("")
        .to_string();
    let captured = obj
        .get("captured")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string());
    ValidationResult {
        valid: true,
        errors,
        summary: Some(ProfileSummary {
            name,
            version: version_num as i32,
            app_count: apps_array.len() as i32,
            captured,
        }),
    }
}

/// Validate a profile manifest file.
pub fn validate_profile(path: &str) -> Result<ValidationResult, String> {
    let file_path = Path::new(path);
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
    let json_content = strip_jsonc_comments(&content);
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
    Ok(validate_profile_object(&json))
}
