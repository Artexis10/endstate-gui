//! Shared engine command + file-op implementations.
//!
//! Pure business-logic functions with no Tauri dependencies. The app crate's
//! command wrappers and the standalone dev bridge both delegate here.
//! `build_engine_command` carries the Windows `cmd /C` PATH-shim landmine —
//! all engine spawn sites must use it.

use std::fs;
use std::io::{Read, Seek, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

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

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
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

const IMPORT_STAGING_PREFIX: &str = ".endstate-import-staging-";

struct StagingDirectory {
    path: PathBuf,
    active: bool,
}

impl StagingDirectory {
    fn create(profiles_dir: &Path) -> Result<Self, String> {
        fs::create_dir_all(profiles_dir)
            .map_err(|e| format!("Failed to create profiles directory: {}", e))?;

        for _ in 0..1000 {
            let candidate = profiles_dir.join(unique_staging_name());
            match fs::create_dir(&candidate) {
                Ok(()) => {
                    return Ok(Self {
                        path: candidate,
                        active: true,
                    });
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(e) => return Err(format!("Failed to create import staging directory: {}", e)),
            }
        }

        Err("Failed to allocate a unique import staging directory".to_string())
    }

    fn commit_to(&mut self, final_dir: &Path) -> Result<(), String> {
        fs::rename(&self.path, final_dir)
            .map_err(|e| format!("Failed to commit imported profile: {}", e))?;
        self.active = false;
        Ok(())
    }
}

impl Drop for StagingDirectory {
    fn drop(&mut self) {
        if self.active {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

fn unique_staging_name() -> String {
    static NEXT_ID: AtomicU64 = AtomicU64::new(0);
    format!(
        "{}{}-{}",
        IMPORT_STAGING_PREFIX,
        std::process::id(),
        NEXT_ID.fetch_add(1, Ordering::Relaxed)
    )
}

fn sanitize_file_name(file_name: &str, fallback: &str) -> String {
    let normalized = file_name.replace('\\', "/");
    let basename = normalized.rsplit('/').next().unwrap_or("");
    let sanitized = basename
        .chars()
        .map(|ch| {
            if ch.is_control() || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
            {
                '_'
            } else {
                ch
            }
        })
        .collect::<String>();
    let sanitized = sanitized.trim_matches(|ch: char| ch == '.' || ch.is_whitespace());

    if sanitized.is_empty() || matches!(sanitized, "." | "..") {
        fallback.to_string()
    } else {
        sanitized.to_string()
    }
}

fn collision_free_file_path(directory: &Path, file_name: &str) -> Result<PathBuf, String> {
    let direct = directory.join(file_name);
    if !direct.exists() {
        return Ok(direct);
    }

    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("profile");
    let extension = path.extension().and_then(|value| value.to_str());

    for suffix in 1..=u32::MAX {
        let candidate_name = match extension {
            Some(extension) if !extension.is_empty() => {
                format!("{}_{}.{}", stem, suffix, extension)
            }
            _ => format!("{}_{}", stem, suffix),
        };
        let candidate = directory.join(candidate_name);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Failed to find a collision-free destination for {}",
        file_name
    ))
}

fn collision_free_directory_path(directory: &Path, name: &str) -> Result<PathBuf, String> {
    let direct = directory.join(name);
    if !direct.exists() {
        return Ok(direct);
    }

    for suffix in 1..=u32::MAX {
        let candidate = directory.join(format!("{}_{}", name, suffix));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Failed to find a collision-free destination for {}",
        name
    ))
}

fn validation_error(result: &ValidationResult) -> String {
    let reasons = result
        .errors
        .iter()
        .map(|error| format!("{}: {}", error.code, error.message))
        .collect::<Vec<_>>()
        .join("; ");
    if reasons.is_empty() {
        "Profile validation failed for an unknown reason".to_string()
    } else {
        format!("Profile validation failed: {}", reasons)
    }
}

fn require_valid_profile(path: &Path) -> Result<(), String> {
    let path_string = path
        .to_str()
        .ok_or_else(|| "Invalid profile path encoding".to_string())?;
    let result = validate_profile(path_string)?;
    if result.valid {
        Ok(())
    } else {
        Err(validation_error(&result))
    }
}

fn create_staged_manifest(profiles_dir: &Path, content: &[u8]) -> Result<PathBuf, String> {
    fs::create_dir_all(profiles_dir)
        .map_err(|e| format!("Failed to create profiles directory: {}", e))?;

    for _ in 0..1000 {
        let candidate = profiles_dir.join(format!("{}.jsonc", unique_staging_name()));
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(mut file) => {
                if let Err(e) = file.write_all(content) {
                    drop(file);
                    let _ = fs::remove_file(&candidate);
                    return Err(format!("Failed to write staged profile: {}", e));
                }
                return Ok(candidate);
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("Failed to create staged profile: {}", e)),
        }
    }

    Err("Failed to allocate a unique staged profile".to_string())
}

fn commit_manifest_bytes(
    content: &[u8],
    file_name: &str,
    profiles_dir: &Path,
) -> Result<String, String> {
    let safe_file_name = sanitize_file_name(file_name, "profile.jsonc");
    let staging_path = create_staged_manifest(profiles_dir, content)?;

    let result = (|| {
        require_valid_profile(&staging_path)?;
        let final_path = collision_free_file_path(profiles_dir, &safe_file_name)?;
        let final_path_string = final_path
            .to_str()
            .ok_or_else(|| "Invalid destination path encoding".to_string())?
            .to_string();
        fs::rename(&staging_path, &final_path)
            .map_err(|e| format!("Failed to commit imported profile: {}", e))?;
        Ok(final_path_string)
    })();

    if result.is_err() {
        let _ = fs::remove_file(&staging_path);
    }
    result
}

pub fn import_profile(source_path: &str, profiles_dir: &str) -> Result<String, String> {
    let source = Path::new(source_path);
    if !source.exists() || !source.is_file() {
        return Err("Source file does not exist".to_string());
    }
    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid source file name".to_string())?;
    let content = fs::read(source).map_err(|e| format!("Failed to read source profile: {}", e))?;
    commit_manifest_bytes(&content, file_name, Path::new(profiles_dir))
}

pub fn import_profile_text(
    content: &str,
    file_name: &str,
    profiles_dir: &str,
) -> Result<String, String> {
    commit_manifest_bytes(content.as_bytes(), file_name, Path::new(profiles_dir))
}

fn zip_entry_is_unsafe(name: &str) -> bool {
    let normalized = name.replace('\\', "/");
    let mut components = normalized.split('/');
    let first = components.next().unwrap_or("");
    let drive_prefixed = first.as_bytes().get(1) == Some(&b':');

    normalized.starts_with('/')
        || drive_prefixed
        || normalized.split('/').any(|component| component == "..")
        || Path::new(name).components().any(|component| {
            matches!(
                component,
                Component::Prefix(_) | Component::RootDir | Component::ParentDir
            )
        })
}

fn import_zip_archive<R: Read + Seek>(
    mut archive: zip::ZipArchive<R>,
    file_name: &str,
    profiles_dir: &Path,
) -> Result<String, String> {
    let safe_file_name = sanitize_file_name(file_name, "profile.zip");
    let raw_stem = Path::new(&safe_file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("profile");
    let profile_name = sanitize_file_name(raw_stem, "profile");
    let mut staging = StagingDirectory::create(profiles_dir)?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| format!("Failed to read zip entry {}: {}", index, e))?;
        let entry_name = entry.name().to_string();
        if zip_entry_is_unsafe(&entry_name) {
            return Err(format!("Unsafe zip entry path rejected: {}", entry_name));
        }
        let enclosed_name = entry
            .enclosed_name()
            .ok_or_else(|| format!("Unsafe zip entry path rejected: {}", entry_name))?;
        let output_path = staging.path.join(enclosed_name);

        if entry.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|e| format!("Failed to create zip directory {}: {}", entry_name, e))?;
        } else {
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent).map_err(|e| {
                    format!(
                        "Failed to create parent for zip entry {}: {}",
                        entry_name, e
                    )
                })?;
            }
            let mut output = fs::File::create(&output_path)
                .map_err(|e| format!("Failed to create zip entry {}: {}", entry_name, e))?;
            std::io::copy(&mut entry, &mut output)
                .map_err(|e| format!("Failed to extract zip entry {}: {}", entry_name, e))?;
        }
    }

    let staged_manifest = staging.path.join("manifest.jsonc");
    if !staged_manifest.is_file() {
        return Err("Zip archive must contain manifest.jsonc at the archive root".to_string());
    }
    require_valid_profile(&staged_manifest)?;

    let final_dir = collision_free_directory_path(profiles_dir, &profile_name)?;
    let committed_manifest = final_dir.join("manifest.jsonc");
    let committed_manifest_string = committed_manifest
        .to_str()
        .ok_or_else(|| "Invalid committed manifest path encoding".to_string())?
        .to_string();
    staging.commit_to(&final_dir)?;
    Ok(committed_manifest_string)
}

pub fn extract_zip_profile(zip_path: &str, profiles_dir: &str) -> Result<String, String> {
    let source = Path::new(zip_path);
    if !source.exists() || !source.is_file() {
        return Err("Zip file does not exist".to_string());
    }
    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid zip file name".to_string())?;
    let file = fs::File::open(source).map_err(|e| format!("Failed to open zip file: {}", e))?;
    let archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;
    import_zip_archive(archive, file_name, Path::new(profiles_dir))
}

pub fn import_zip_from_base64(
    data: &str,
    file_name: &str,
    profiles_dir: &str,
) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let bytes = STANDARD
        .decode(data)
        .map_err(|e| format!("Failed to decode base64 zip: {}", e))?;
    let archive = zip::ZipArchive::new(std::io::Cursor::new(bytes))
        .map_err(|e| format!("Failed to read zip archive: {}", e))?;
    import_zip_archive(archive, file_name, Path::new(profiles_dir))
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
            && !path
                .file_name()
                .map(|name| name.to_string_lossy().starts_with(IMPORT_STAGING_PREFIX))
                .unwrap_or(false)
            && path
                .extension()
                .map(|ext| {
                    let e = ext.to_string_lossy().to_lowercase();
                    e == "json" || e == "jsonc" || e == "json5"
                })
                .unwrap_or(false)
    }

    let entries = fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;
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
                if dir_name == "runs" || dir_name.starts_with(IMPORT_STAGING_PREFIX) {
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
        std::fs::write(&path, content).map_err(|e| format!("Failed to write debug file: {}", e))?;
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
    let version_num = match version.as_i64() {
        Some(v) => v,
        None => {
            return ValidationResult {
                valid: false,
                errors: vec![ValidationError {
                    code: "INVALID_VERSION_TYPE".to_string(),
                    message: format!(
                        "Field 'version' must be the exact JSON integer 1 or 2, got: {}",
                        version
                    ),
                }],
                summary: None,
            };
        }
    };
    if !matches!(version_num, 1 | 2) {
        return ValidationResult {
            valid: false,
            errors: vec![ValidationError {
                code: "UNSUPPORTED_VERSION".to_string(),
                message: format!(
                    "Unsupported profile version: {} (supported: 1, 2)",
                    version_num
                ),
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

#[cfg(test)]
mod profile_validation_tests {
    use super::{
        extract_zip_profile, import_profile, import_profile_text, import_zip_from_base64,
        validate_profile_object,
    };
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use serde_json::json;
    use std::fs;
    use std::io::Write;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};
    use zip::write::SimpleFileOptions;

    const VALID_V1: &str = r#"{"version":1,"name":"legacy","apps":[]}"#;
    const VALID_V2: &str = r#"{"version":2,"name":"capture","apps":[],"restore":[]}"#;

    struct TestDir(PathBuf);

    impl TestDir {
        fn new(label: &str) -> Self {
            static NEXT_ID: AtomicU64 = AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "endstate-core-{}-{}-{}",
                label,
                std::process::id(),
                NEXT_ID.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).expect("create test directory");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn write_zip(path: &Path, entries: &[(&str, &str)]) {
        let file = fs::File::create(path).expect("create zip");
        let mut writer = zip::ZipWriter::new(file);
        for (name, content) in entries {
            writer
                .start_file(*name, SimpleFileOptions::default())
                .expect("start zip entry");
            writer
                .write_all(content.as_bytes())
                .expect("write zip entry");
        }
        writer.finish().expect("finish zip");
    }

    fn directory_names(path: &Path) -> Vec<String> {
        let mut names = fs::read_dir(path)
            .expect("read directory")
            .map(|entry| {
                entry
                    .expect("read entry")
                    .file_name()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect::<Vec<_>>();
        names.sort();
        names
    }

    #[test]
    fn accepts_exact_integer_profile_versions_v1_and_v2() {
        for version in [1, 2] {
        let result = validate_profile_object(&json!({
                "version": version,
                "name": "profile",
                "apps": []
        }));

            assert!(result.valid, "version {version}: {:?}", result.errors);
            assert_eq!(result.summary.expect("summary").version, version);
        }
    }

    #[test]
    fn rejects_unknown_future_profile_version() {
        let result = validate_profile_object(&json!({
            "version": 3,
            "name": "future",
            "apps": []
        }));

        assert!(!result.valid);
        assert_eq!(result.errors[0].code, "UNSUPPORTED_VERSION");
    }

    #[test]
    fn rejects_fractional_and_string_profile_versions() {
        for version in [json!(2.5), json!("2")] {
            let result = validate_profile_object(&json!({
                "version": version,
                "name": "invalid",
                "apps": []
            }));

            assert!(!result.valid, "accepted version {version}");
            assert_eq!(result.errors[0].code, "INVALID_VERSION_TYPE");
        }
    }

    #[test]
    fn valid_v2_zip_commits_and_returns_root_manifest_path() {
        let temp = TestDir::new("valid-zip");
        let profiles = temp.path().join("profiles");
        let zip_path = temp.path().join("capture.zip");
        fs::create_dir(&profiles).expect("create profiles");
        write_zip(
            &zip_path,
            &[("manifest.jsonc", VALID_V2), ("payload/settings.txt", "ok")],
        );

        let committed = extract_zip_profile(
            zip_path.to_str().expect("zip path"),
            profiles.to_str().expect("profiles path"),
        )
        .expect("import valid zip");
        let manifest = PathBuf::from(committed);

        assert_eq!(manifest.file_name().unwrap(), "manifest.jsonc");
        assert_eq!(manifest.parent().unwrap().file_name().unwrap(), "capture");
        assert!(manifest.is_file());
        assert!(manifest
            .parent()
            .unwrap()
            .join("payload/settings.txt")
            .is_file());
        assert_eq!(directory_names(&profiles), vec!["capture"]);
    }

    #[test]
    fn unsafe_zip_entries_reject_the_whole_import_and_cleanup() {
        for (label, unsafe_name) in [
            ("parent", "../escape.txt"),
            ("rooted", "/absolute.txt"),
            ("windows-rooted", "C:/absolute.txt"),
        ] {
            let temp = TestDir::new(label);
            let profiles = temp.path().join("profiles");
            let zip_path = temp.path().join("unsafe.zip");
            fs::create_dir(&profiles).expect("create profiles");
            write_zip(
                &zip_path,
                &[("manifest.jsonc", VALID_V2), (unsafe_name, "unsafe")],
            );

            let error = extract_zip_profile(
                zip_path.to_str().expect("zip path"),
                profiles.to_str().expect("profiles path"),
            )
            .expect_err("unsafe zip must fail");

            assert!(error.contains("Unsafe zip entry"), "{error}");
            assert!(directory_names(&profiles).is_empty(), "{label}");
        }
    }

    #[test]
    fn invalid_zip_manifest_rejects_and_cleans_up_staging() {
        let temp = TestDir::new("invalid-zip");
        let profiles = temp.path().join("profiles");
        let zip_path = temp.path().join("invalid.zip");
        fs::create_dir(&profiles).expect("create profiles");
        write_zip(
            &zip_path,
            &[("manifest.jsonc", r#"{"version":2.5,"apps":[]}"#)],
        );

        let error = extract_zip_profile(
            zip_path.to_str().expect("zip path"),
            profiles.to_str().expect("profiles path"),
        )
        .expect_err("invalid manifest must fail");

        assert!(error.contains("validation"), "{error}");
        assert!(directory_names(&profiles).is_empty());
    }

    #[test]
    fn invalid_bare_manifest_does_not_overwrite_existing_profile() {
        let temp = TestDir::new("invalid-bare");
        let profiles = temp.path().join("profiles");
        let sources = temp.path().join("sources");
        fs::create_dir(&profiles).expect("create profiles");
        fs::create_dir(&sources).expect("create sources");
        fs::write(profiles.join("profile.jsonc"), VALID_V1).expect("write existing");
        let source = sources.join("profile.jsonc");
        fs::write(&source, r#"{"version":2.5,"apps":[]}"#).expect("write source");

        import_profile(
            source.to_str().expect("source path"),
            profiles.to_str().expect("profiles path"),
        )
        .expect_err("invalid import must fail");

        assert_eq!(
            fs::read_to_string(profiles.join("profile.jsonc")).unwrap(),
            VALID_V1
        );
        assert_eq!(directory_names(&profiles), vec!["profile.jsonc"]);
    }

    #[test]
    fn valid_bare_import_uses_collision_free_manifest_path() {
        let temp = TestDir::new("valid-bare");
        let profiles = temp.path().join("profiles");
        let sources = temp.path().join("sources");
        fs::create_dir(&profiles).expect("create profiles");
        fs::create_dir(&sources).expect("create sources");
        fs::write(profiles.join("profile.jsonc"), VALID_V1).expect("write existing");
        let source = sources.join("profile.jsonc");
        fs::write(&source, VALID_V2).expect("write source");

        let committed = import_profile(
            source.to_str().expect("source path"),
            profiles.to_str().expect("profiles path"),
        )
        .expect("import valid manifest");

        assert_eq!(PathBuf::from(&committed), profiles.join("profile_1.jsonc"));
        assert_eq!(
            fs::read_to_string(profiles.join("profile.jsonc")).unwrap(),
            VALID_V1
        );
        assert_eq!(fs::read_to_string(&committed).unwrap(), VALID_V2);
        assert_eq!(
            directory_names(&profiles),
            vec!["profile.jsonc", "profile_1.jsonc"]
        );
    }

    #[test]
    fn text_import_sanitizes_untrusted_name_to_one_basename() {
        let temp = TestDir::new("text-name");
        let profiles = temp.path().join("profiles");

        let committed = import_profile_text(
            VALID_V2,
            "../nested\\unsafe:name.jsonc",
            profiles.to_str().expect("profiles path"),
        )
        .expect("import text manifest");

        let committed = PathBuf::from(committed);
        assert_eq!(committed.parent().unwrap(), profiles);
        assert_eq!(committed.file_name().unwrap(), "unsafe_name.jsonc");
    }

    #[test]
    fn base64_zip_import_cannot_escape_through_untrusted_file_name() {
        let temp = TestDir::new("base64-name");
        let profiles = temp.path().join("profiles");
        let zip_path = temp.path().join("source.zip");
        write_zip(&zip_path, &[("manifest.jsonc", VALID_V2)]);
        let data = STANDARD.encode(fs::read(&zip_path).expect("read zip"));

        let committed = import_zip_from_base64(
            &data,
            "../../nested\\escaped.zip",
            profiles.to_str().expect("profiles path"),
        )
        .expect("import base64 zip");

        let committed = PathBuf::from(committed);
        assert_eq!(committed, profiles.join("escaped").join("manifest.jsonc"));
        assert!(committed.is_file());
        assert_eq!(directory_names(&profiles), vec!["escaped"]);
    }
}
