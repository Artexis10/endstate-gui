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
    let sanitized = sanitized
        .trim_matches(|ch: char| ch == '.' || ch.is_whitespace())
        .to_string();

    let mut safe_name = if sanitized.is_empty() || matches!(sanitized.as_str(), "." | "..") {
        fallback.to_string()
    } else {
        sanitized
    };
    if windows_reserved_basename(&safe_name) {
        safe_name.insert(0, '_');
    }
    safe_name
}

fn windows_reserved_basename(component: &str) -> bool {
    let basename = component
        .split('.')
        .next()
        .unwrap_or("")
        .trim_end_matches(['.', ' '])
        .to_ascii_uppercase();

    if matches!(basename.as_str(), "CON" | "PRN" | "AUX" | "NUL") {
        return true;
    }

    matches!(
        basename
            .strip_prefix("COM")
            .or_else(|| basename.strip_prefix("LPT")),
        Some("1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³")
    )
}

fn windows_component_is_unsafe(component: &str) -> bool {
    component.contains(':')
        || component.ends_with('.')
        || component.ends_with(' ')
        || windows_reserved_basename(component)
}

fn suffixed_file_name(file_name: &str, suffix: u32) -> String {
    if suffix == 0 {
        return file_name.to_string();
    }
    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("profile");
    let extension = path.extension().and_then(|value| value.to_str());

    match extension {
        Some(extension) if !extension.is_empty() => {
            format!("{}_{}.{}", stem, suffix, extension)
        }
        _ => format!("{}_{}", stem, suffix),
    }
}

fn suffixed_directory_name(name: &str, suffix: u32) -> String {
    if suffix == 0 {
        name.to_string()
    } else {
        format!("{}_{}", name, suffix)
    }
}

struct FinalDirectoryReservation {
    path: PathBuf,
    committed: bool,
}

impl FinalDirectoryReservation {
    fn create(profiles_dir: &Path, name: &str) -> Result<Self, String> {
        for suffix in 0..=u32::MAX {
            let candidate = profiles_dir.join(suffixed_directory_name(name, suffix));
            match fs::create_dir(&candidate) {
                Ok(()) => {
                    return Ok(Self {
                        path: candidate,
                        committed: false,
                    });
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(e) => {
                    return Err(format!(
                        "Failed to reserve imported profile destination: {}",
                        e
                    ));
                }
            }
        }

        Err(format!(
            "Failed to reserve a collision-free destination for {}",
            name
        ))
    }

    fn mark_committed(&mut self) {
        self.committed = true;
    }
}

impl Drop for FinalDirectoryReservation {
    fn drop(&mut self) {
        if !self.committed {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
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

        for suffix in 0..=u32::MAX {
            let final_path = profiles_dir.join(suffixed_file_name(&safe_file_name, suffix));
            let final_path_string = final_path
                .to_str()
                .ok_or_else(|| "Invalid destination path encoding".to_string())?
                .to_string();
            match fs::hard_link(&staging_path, &final_path) {
                Ok(()) => {
                    let _ = fs::remove_file(&staging_path);
                    return Ok(final_path_string);
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(e) => return Err(format!("Failed to commit imported profile: {}", e)),
            }
        }

        Err(format!(
            "Failed to find a collision-free destination for {}",
            safe_file_name
        ))
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

    normalized.starts_with('/')
        || normalized
            .split('/')
            .any(|component| component == ".." || windows_component_is_unsafe(component))
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
    let staging = StagingDirectory::create(profiles_dir)?;

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

    let mut reservation = FinalDirectoryReservation::create(profiles_dir, &profile_name)?;
    let committed_manifest = reservation.path.join("manifest.jsonc");
    let committed_manifest_string = committed_manifest
        .to_str()
        .ok_or_else(|| "Invalid committed manifest path encoding".to_string())?
        .to_string();

    let staged_entries = fs::read_dir(&staging.path)
        .map_err(|e| format!("Failed to read staged profile: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read staged profile entry: {}", e))?;
    for entry in staged_entries {
        if entry.file_name() == "manifest.jsonc" {
            continue;
        }
        let destination = reservation.path.join(entry.file_name());
        fs::rename(entry.path(), destination)
            .map_err(|e| format!("Failed to move staged profile payload: {}", e))?;
    }

    fs::hard_link(&staged_manifest, &committed_manifest)
        .map_err(|e| format!("Failed to publish imported profile manifest: {}", e))?;
    reservation.mark_committed();
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

fn required_object<'a>(
    object: &'a serde_json::Map<String, serde_json::Value>,
    field: &str,
) -> Result<&'a serde_json::Map<String, serde_json::Value>, String> {
    object
        .get(field)
        .and_then(serde_json::Value::as_object)
        .ok_or_else(|| format!("required field {field:?} must be an object"))
}

fn required_array<'a>(
    object: &'a serde_json::Map<String, serde_json::Value>,
    field: &str,
) -> Result<&'a Vec<serde_json::Value>, String> {
    object
        .get(field)
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| format!("required field {field:?} must be an array"))
}

fn required_string<'a>(
    object: &'a serde_json::Map<String, serde_json::Value>,
    field: &str,
) -> Result<&'a str, String> {
    object
        .get(field)
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| format!("required field {field:?} must be a string"))
}

fn stable_manifest_id(value: &str) -> bool {
    let mut characters = value.chars();
    if !matches!(characters.next(), Some('a'..='z')) {
        return false;
    }

    let mut separator = false;
    for character in characters {
        if character.is_ascii_lowercase() || character.is_ascii_digit() {
            separator = false;
        } else if matches!(character, '-' | '.' | '_') && !separator {
            separator = true;
        } else {
            return false;
        }
    }
    !separator
}

fn lowercase_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}

fn normalize_numeric_manifest_version(value: &str) -> Option<String> {
    let mut components = Vec::new();
    for component in value.trim().split('.') {
        if component.is_empty() || !component.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
        let normalized = component.trim_start_matches('0');
        components.push(if normalized.is_empty() {
            "0".to_string()
        } else {
            normalized.to_string()
        });
    }
    while components.len() > 1 && components.last().map(String::as_str) == Some("0") {
        components.pop();
    }
    Some(components.join("."))
}

fn portable_manifest_path(value: &str) -> bool {
    value == value.trim()
        && !value.is_empty()
        && value != "."
        && !value.starts_with('/')
        && !value.starts_with('~')
        && !value.contains(['\\', ':', '$', '%'])
        && value
            .split('/')
            .all(|component| !component.is_empty() && !matches!(component, "." | ".."))
}

/// Mirror of the engine's `validateConfigPayloadRoot`
/// (go-engine/internal/manifest/manifest_v2.go).
///
/// The on-disk payload directory is deliberately NOT the capture identity.
/// Engine v2.27.5 (Artexis10/endstate#188) renamed payload folders to a readable
/// module label plus a short hash — `configs/powertoys-135f78ef/` instead of an
/// opaque `configs/legacy-<64hex>/` — so a bundle zip can be hand-edited, and
/// relaxed its own validations to require only a single safe directory under
/// `configs/`. Identity still travels in `captureId` / `legacyCaptureId`.
///
/// Pinning `payloadRoot` to `configs/<captureId>` here rejected every bundle
/// captured by engine >= 2.27.5, so importing a freshly captured profile failed.
fn validate_config_payload_root(payload_root: &str) -> Result<(), String> {
    if !portable_manifest_path(payload_root) {
        return Err("must be a portable path".to_string());
    }
    let Some(segment) = payload_root.strip_prefix("configs/") else {
        return Err("must be a directory under configs/".to_string());
    };
    if segment.is_empty() || segment.contains('/') {
        return Err("must be a single directory under configs/".to_string());
    }
    Ok(())
}

fn validate_v2_config_captures(
    manifest: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let captures = required_array(manifest, "configCaptures")?;
    if captures.is_empty() {
        return Err("manifest version 2 requires at least one configCapture".to_string());
    }

    let mut capture_ids = std::collections::HashSet::new();
    let mut payload_roots = std::collections::HashSet::new();
    for (capture_index, capture_value) in captures.iter().enumerate() {
        let capture = capture_value
            .as_object()
            .ok_or_else(|| format!("configCaptures[{capture_index}] must be an object"))?;
        let capture_id = required_string(capture, "captureId")?;
        let module_id = required_string(capture, "moduleId")?;
        let config_set_id = required_string(capture, "configSetId")?;
        let source = required_object(capture, "sourceInstance")?;
        let source_id = required_string(source, "id")?;
        let detector_id = required_string(source, "detectorId")?;
        let raw_version = required_string(source, "rawVersion")?;
        let normalized_version = required_string(source, "normalizedVersion")?;
        let source_generation = required_string(capture, "sourceGeneration")?;

        for (field, value) in [
            ("captureId", capture_id),
            ("moduleId", module_id),
            ("configSetId", config_set_id),
            ("sourceInstance.id", source_id),
            ("sourceInstance.detectorId", detector_id),
            ("sourceGeneration", source_generation),
        ] {
            if !stable_manifest_id(value) {
                return Err(format!(
                    "configCaptures[{capture_index}].{field} {value:?} is not stable lowercase identifier syntax"
                ));
            }
        }
        if !capture_ids.insert(capture_id) {
            return Err(format!("duplicate captureId {capture_id:?}"));
        }

        match normalize_numeric_manifest_version(raw_version) {
            Some(expected) if normalized_version != expected => {
                return Err(format!(
                    "configCaptures[{capture_index}].sourceInstance.normalizedVersion must be canonical {expected:?}"
                ));
            }
            None if !normalized_version.is_empty() => {
                return Err(format!(
                    "configCaptures[{capture_index}].sourceInstance.normalizedVersion must be empty for a nonnumeric rawVersion"
                ));
            }
            _ => {}
        }

        let evidence = required_object(source, "evidence")?;
        for field in ["appId", "backend", "platform", "ref", "driver"] {
            if evidence.get(field).is_some_and(|value| !value.is_string()) {
                return Err(format!(
                    "configCaptures[{capture_index}].sourceInstance.evidence.{field} must be a string"
                ));
            }
        }
        match required_string(evidence, "type")? {
            "package" => {
                for field in ["backend", "ref"] {
                    if required_string(evidence, field)?.trim().is_empty() {
                        return Err(format!(
                            "configCaptures[{capture_index}].sourceInstance.evidence package {field} must not be empty"
                        ));
                    }
                }
            }
            "path" => {}
            unsupported => {
                return Err(format!(
                    "configCaptures[{capture_index}].sourceInstance.evidence.type {unsupported:?} is unsupported"
                ));
            }
        }

        let fingerprint = required_string(capture, "sourceGenerationFingerprint")?;
        if !lowercase_sha256(fingerprint) {
            return Err(format!(
                "configCaptures[{capture_index}].sourceGenerationFingerprint must be lowercase 64-hex SHA-256"
            ));
        }

        let capture_module = required_object(capture, "captureModule")?;
        if capture_module
            .get("schemaVersion")
            .and_then(serde_json::Value::as_i64)
            != Some(2)
        {
            return Err(format!(
                "configCaptures[{capture_index}].captureModule.schemaVersion must be the integer 2"
            ));
        }
        let content_hash = required_string(capture_module, "contentHash")?;
        if !lowercase_sha256(content_hash) {
            return Err(format!(
                "configCaptures[{capture_index}].captureModule.contentHash must be lowercase 64-hex SHA-256"
            ));
        }
        let snapshot_path = required_string(capture_module, "snapshotPath")?;
        if !portable_manifest_path(snapshot_path)
            || !snapshot_path.starts_with("provenance/modules/")
        {
            return Err(format!(
                "configCaptures[{capture_index}].captureModule.snapshotPath must be a portable path under provenance/modules/"
            ));
        }

        let payload_root = required_string(capture, "payloadRoot")?;
        if let Err(reason) = validate_config_payload_root(payload_root) {
            return Err(format!(
                "configCaptures[{capture_index}].payloadRoot {payload_root:?} {reason}"
            ));
        }
        // Identity no longer implies the directory, so uniqueness has to be
        // asserted directly (the engine grew the same guard in #188).
        if !payload_roots.insert(payload_root) {
            return Err(format!("duplicate payloadRoot {payload_root:?}"));
        }

        let payload_manifest = required_array(capture, "payloadManifest")?;
        let mut previous_path: Option<&str> = None;
        for (entry_index, entry_value) in payload_manifest.iter().enumerate() {
            let entry = entry_value.as_object().ok_or_else(|| {
                format!(
                    "configCaptures[{capture_index}].payloadManifest[{entry_index}] must be an object"
                )
            })?;
            let relative_path = required_string(entry, "relativePath")?;
            if !portable_manifest_path(relative_path) {
                return Err(format!(
                    "configCaptures[{capture_index}].payloadManifest[{entry_index}].relativePath must be portable"
                ));
            }
            if previous_path.is_some_and(|previous| relative_path <= previous) {
                return Err(format!(
                    "configCaptures[{capture_index}].payloadManifest entries must be unique and sorted by relativePath"
                ));
            }
            previous_path = Some(relative_path);

            if !matches!(
                entry.get("size").and_then(serde_json::Value::as_i64),
                Some(0..)
            ) {
                return Err(format!(
                    "configCaptures[{capture_index}].payloadManifest[{entry_index}].size must be a nonnegative integer"
                ));
            }
            let sha256 = required_string(entry, "sha256")?;
            if !lowercase_sha256(sha256) {
                return Err(format!(
                    "configCaptures[{capture_index}].payloadManifest[{entry_index}].sha256 must be lowercase 64-hex SHA-256"
                ));
            }
        }
    }
    Ok(())
}

fn v1_optional_array<'a>(
    manifest: &'a serde_json::Map<String, serde_json::Value>,
    field: &str,
) -> Result<&'a [serde_json::Value], String> {
    match manifest.get(field) {
        None | Some(serde_json::Value::Null) => Ok(&[]),
        Some(value) => value
            .as_array()
            .map(Vec::as_slice)
            .ok_or_else(|| format!("field {field:?} must be an array")),
    }
}

fn validate_v1_config_boundaries(
    manifest: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), (&'static str, String)> {
    let captures = v1_optional_array(manifest, "configCaptures")
        .map_err(|message| ("INVALID_CONFIG_CAPTURE", message))?;
    if !captures.is_empty() {
        return Err((
            "CONFIG_CAPTURES_REQUIRE_V2",
            "nonempty configCaptures requires manifest version 2".to_string(),
        ));
    }

    let lanes = v1_optional_array(manifest, "legacyConfigLanes")
        .map_err(|message| ("INVALID_CONFIG_CAPTURE", message))?;
    if !lanes.is_empty() {
        return Err((
            "INVALID_CONFIG_CAPTURE",
            "nonempty legacyConfigLanes requires manifest version 2".to_string(),
        ));
    }

    let restores = v1_optional_array(manifest, "restore")
        .map_err(|message| ("INVALID_CONFIG_CAPTURE", message))?;
    for (index, restore_value) in restores.iter().enumerate() {
        let restore = restore_value.as_object().ok_or_else(|| {
            (
                "INVALID_CONFIG_CAPTURE",
                format!("restore[{index}] must be an object"),
            )
        })?;
        if let Some(value) = restore.get("fromModule") {
            if !value.is_null() && !value.is_string() {
                return Err((
                    "INVALID_CONFIG_CAPTURE",
                    format!("restore[{index}].fromModule must be a string"),
                ));
            }
        }
        match restore.get("legacyCaptureId") {
            None | Some(serde_json::Value::Null) => {}
            Some(value) => {
                let attribution = value.as_str().ok_or_else(|| {
                    (
                        "INVALID_CONFIG_CAPTURE",
                        format!("restore[{index}].legacyCaptureId must be a string"),
                    )
                })?;
                if !attribution.trim().is_empty() {
                    return Err((
                        "INVALID_CONFIG_CAPTURE",
                        format!("restore[{index}].legacyCaptureId requires manifest version 2"),
                    ));
                }
            }
        }
    }
    Ok(())
}

fn v2_optional_array<'a>(
    manifest: &'a serde_json::Map<String, serde_json::Value>,
    field: &str,
) -> Result<&'a [serde_json::Value], String> {
    match manifest.get(field) {
        None => Ok(&[]),
        Some(value) => value
            .as_array()
            .map(Vec::as_slice)
            .ok_or_else(|| format!("field {field:?} must be a non-null array")),
    }
}

fn optional_restore_string<'a>(
    restore: &'a serde_json::Map<String, serde_json::Value>,
    field: &str,
    index: usize,
) -> Result<&'a str, String> {
    match restore.get(field) {
        None | Some(serde_json::Value::Null) => Ok(""),
        Some(value) => value
            .as_str()
            .ok_or_else(|| format!("restore[{index}].{field} must be a string")),
    }
}

fn validate_restore_field_types(
    restore: &serde_json::Map<String, serde_json::Value>,
    index: usize,
) -> Result<(), String> {
    for field in [
        "type",
        "source",
        "target",
        "pattern",
        "reason",
        "fromModule",
        "legacyCaptureId",
        "key",
        "valueName",
        "valueType",
        "data",
    ] {
        optional_restore_string(restore, field, index)?;
    }
    for field in ["backup", "optional"] {
        if let Some(value) = restore.get(field) {
            if !value.is_null() && !value.is_boolean() {
                return Err(format!("restore[{index}].{field} must be a boolean"));
            }
        }
    }
    if let Some(exclude) = restore.get("exclude") {
        if !exclude.is_null()
            && !exclude
                .as_array()
                .is_some_and(|values| values.iter().all(serde_json::Value::is_string))
        {
            return Err(format!(
                "restore[{index}].exclude must be an array of strings"
            ));
        }
    }
    Ok(())
}

fn portable_roots_overlap(left: &str, right: &str) -> bool {
    let left = left.to_lowercase();
    let right = right.to_lowercase();
    left == right || left.starts_with(&(right.clone() + "/")) || right.starts_with(&(left + "/"))
}

fn normalize_legacy_restore_source(source: &str) -> Result<String, String> {
    let portable = source.trim().replace('\\', "/");
    let portable = portable.strip_prefix("./").unwrap_or(&portable);
    if !portable_manifest_path(portable) {
        return Err("source is not a portable ordinary restore path".to_string());
    }
    Ok(portable.to_string())
}

fn validate_v2_legacy_isolation(
    manifest: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), String> {
    let captures = required_array(manifest, "configCaptures")?;
    let mut all_capture_ids = std::collections::HashSet::new();
    let mut generation_modules = std::collections::HashSet::new();
    let mut protected_roots = Vec::new();
    for capture_value in captures {
        let capture = capture_value
            .as_object()
            .ok_or_else(|| "configCapture must be an object".to_string())?;
        let capture_id = required_string(capture, "captureId")?;
        let module_id = required_string(capture, "moduleId")?;
        let payload_root = required_string(capture, "payloadRoot")?;
        all_capture_ids.insert(capture_id);
        generation_modules.insert(module_id);
        protected_roots.push(payload_root);
    }

    let lanes = v2_optional_array(manifest, "legacyConfigLanes")?;
    let mut lane_by_id = std::collections::HashMap::new();
    let mut legacy_modules = std::collections::HashSet::new();
    for (index, lane_value) in lanes.iter().enumerate() {
        let lane = lane_value
            .as_object()
            .ok_or_else(|| format!("legacyConfigLanes[{index}] must be an object"))?;
        let capture_id = required_string(lane, "captureId")?;
        let module_id = required_string(lane, "moduleId")?;
        let payload_root = required_string(lane, "payloadRoot")?;
        if !stable_manifest_id(capture_id) || !stable_manifest_id(module_id) {
            return Err(format!(
                "legacyConfigLanes[{index}] has an invalid captureId or moduleId"
            ));
        }
        if lane
            .get("moduleSchemaVersion")
            .and_then(serde_json::Value::as_i64)
            != Some(1)
        {
            return Err(format!(
                "legacyConfigLanes[{index}].moduleSchemaVersion must be the integer 1"
            ));
        }
        if let Err(reason) = validate_config_payload_root(payload_root) {
            return Err(format!(
                "legacyConfigLanes[{index}].payloadRoot {payload_root:?} {reason}"
            ));
        }
        if !all_capture_ids.insert(capture_id) {
            return Err(format!(
                "duplicate captureId {capture_id:?} across config captures and legacy lanes"
            ));
        }
        if !legacy_modules.insert(module_id) {
            return Err(format!("duplicate legacy lane moduleId {module_id:?}"));
        }
        if generation_modules.contains(module_id) {
            return Err(format!(
                "module {module_id:?} cannot have both generation and legacy lanes"
            ));
        }
        if protected_roots
            .iter()
            .any(|existing| portable_roots_overlap(existing, payload_root))
        {
            return Err(format!(
                "legacy payload root {payload_root:?} overlaps a protected config root"
            ));
        }

        lane_by_id.insert(capture_id, (module_id, payload_root));
        protected_roots.push(payload_root);
    }

    let config_modules = v2_optional_array(manifest, "configModules")?;
    let mut listed_modules = std::collections::HashSet::new();
    for (index, module_value) in config_modules.iter().enumerate() {
        let module_id = module_value
            .as_str()
            .ok_or_else(|| format!("configModules[{index}] must be a string"))?;
        if !stable_manifest_id(module_id) {
            return Err(format!("configModules[{index}] is not a stable module ID"));
        }
        if !listed_modules.insert(module_id) {
            return Err(format!(
                "configModules contains duplicate module {module_id:?}"
            ));
        }
    }
    if listed_modules != legacy_modules {
        return Err("configModules must exactly equal the legacy lane module set".to_string());
    }

    let restores = v2_optional_array(manifest, "restore")?;
    let mut used_lanes = std::collections::HashSet::new();
    for (index, restore_value) in restores.iter().enumerate() {
        let restore = restore_value
            .as_object()
            .ok_or_else(|| format!("restore[{index}] must be an object"))?;
        validate_restore_field_types(restore, index)?;
        let legacy_capture_id = optional_restore_string(restore, "legacyCaptureId", index)?;
        let from_module = optional_restore_string(restore, "fromModule", index)?;
        let source = optional_restore_string(restore, "source", index)?;

        if legacy_capture_id.is_empty() && from_module.is_empty() {
            if !source.trim().is_empty() {
                let source = normalize_legacy_restore_source(source)?;
                if protected_roots
                    .iter()
                    .any(|root| portable_roots_overlap(&source, root))
                {
                    return Err(format!(
                        "restore[{index}].source must not overlap a protected config payload root"
                    ));
                }
            }
            continue;
        }

        if !stable_manifest_id(legacy_capture_id) {
            return Err(format!(
                "restore[{index}].legacyCaptureId must identify one legacy lane"
            ));
        }
        let (lane_module, lane_root) = lane_by_id.get(legacy_capture_id).ok_or_else(|| {
            format!(
                "restore[{index}].legacyCaptureId {legacy_capture_id:?} does not resolve to a legacy lane"
            )
        })?;
        if from_module != *lane_module {
            return Err(format!(
                "restore[{index}].fromModule {from_module:?} does not match legacy lane module {lane_module:?}"
            ));
        }
        if !source.trim().is_empty() {
            let source = normalize_legacy_restore_source(source)?;
            if source != *lane_root && !source.starts_with(&format!("{lane_root}/")) {
                return Err(format!(
                    "restore[{index}].source must remain under legacy payload root {lane_root:?}"
                ));
            }
        }
        used_lanes.insert(legacy_capture_id);
    }
    for capture_id in lane_by_id.keys() {
        if !used_lanes.contains(capture_id) {
            return Err(format!(
                "legacy lane {capture_id:?} is not used by any flat restore entry"
            ));
        }
    }
    Ok(())
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
        None if version.is_number() => {
            return ValidationResult {
                valid: false,
                errors: vec![ValidationError {
                    code: "UNSUPPORTED_VERSION".to_string(),
                    message: format!("Unsupported profile version: {} (supported: 1, 2)", version),
                }],
                summary: None,
            };
        }
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
    let config_validation = if version_num == 1 {
        validate_v1_config_boundaries(obj)
    } else {
        validate_v2_config_captures(obj)
            .and_then(|_| validate_v2_legacy_isolation(obj))
            .map_err(|message| ("INVALID_CONFIG_CAPTURE", message))
    };
    if let Err((code, message)) = config_validation {
        return ValidationResult {
            valid: false,
            errors: vec![ValidationError {
                code: code.to_string(),
                message,
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
        list_manifest_files, validate_config_payload_root, validate_profile_object,
    };
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use serde_json::json;
    use std::collections::HashSet;
    use std::fs;
    use std::io::Write;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::sync::{Arc, Barrier};
    use zip::write::SimpleFileOptions;

    const VALID_V1: &str = r#"{"version":1,"name":"legacy","apps":[]}"#;
    const VALID_V2: &str = r#"{
        "version": 2,
        "name": "capture",
        "apps": [],
        "configCaptures": [{
            "captureId": "fixture-stable-preferences-installed",
            "moduleId": "apps.fixture-stable",
            "configSetId": "preferences",
            "sourceInstance": {
                "id": "installed",
                "detectorId": "installed-package",
                "rawVersion": "1.4.0",
                "normalizedVersion": "1.4",
                "evidence": {
                    "type": "package",
                    "backend": "winget",
                    "platform": "windows",
                    "ref": "Fixture.Stable"
                }
            },
            "sourceGeneration": "g1",
            "sourceGenerationFingerprint": "da190fe4fcbe22d2d49e60062fdd0b35bde8a3488390a2d8384dbf28792a2458",
            "captureModule": {
                "schemaVersion": 2,
                "contentHash": "0c2c1430dcf9dd86c9bbd15945e342c40c28ea2117a8aee853dc7b5fcd485ed3",
                "snapshotPath": "provenance/modules/apps.fixture-stable.json"
            },
            "payloadRoot": "configs/fixture-stable-preferences-installed",
            "payloadManifest": [{
                "relativePath": "settings.json",
                "size": 22,
                "sha256": "27dafb2742d0da69a49cc8d206fc9cc429feff09cc3738addcf590d9c4358f97"
            }]
        }]
    }"#;
    const INCOMPLETE_V2: &str = r#"{"version":2,"name":"incomplete","apps":[]}"#;

    fn valid_v2_value() -> serde_json::Value {
        serde_json::from_str(VALID_V2).expect("parse valid v2 fixture")
    }

    fn valid_v2_with_name(name: &str) -> String {
        let mut value = valid_v2_value();
        value
            .as_object_mut()
            .expect("v2 object")
            .insert("name".to_string(), json!(name));
        serde_json::to_string(&value).expect("serialize valid v2 fixture")
    }

    fn valid_v2_with_legacy_lane() -> serde_json::Value {
        let mut value = valid_v2_value();
        value["legacyConfigLanes"] = json!([{
            "captureId": "legacy-capture",
            "moduleId": "legacy.example",
            "moduleSchemaVersion": 1,
            "payloadRoot": "configs/legacy-capture"
        }]);
        value["configModules"] = json!(["legacy.example"]);
        value["restore"] = json!([{
            "type": "copy",
            "source": "configs/legacy-capture/settings.json",
            "target": "~/.example/settings.json",
            "fromModule": "legacy.example",
            "legacyCaptureId": "legacy-capture"
        }]);
        value
    }

    fn invalid_generation_fallback_v2() -> String {
        let mut value = valid_v2_value();
        value["restore"] = json!([{
            "type": "copy",
            "source": "./configs/fixture-stable-preferences-installed/settings.json",
            "target": "~/.fixture/settings.json"
        }]);
        serde_json::to_string(&value).expect("serialize invalid fallback fixture")
    }

    fn first_config_capture_mut(
        value: &mut serde_json::Value,
    ) -> &mut serde_json::Map<String, serde_json::Value> {
        value
            .get_mut("configCaptures")
            .and_then(serde_json::Value::as_array_mut)
            .and_then(|captures| captures.first_mut())
            .and_then(serde_json::Value::as_object_mut)
            .expect("first config capture")
    }

    fn first_legacy_lane_mut(
        value: &mut serde_json::Value,
    ) -> &mut serde_json::Map<String, serde_json::Value> {
        value
            .get_mut("legacyConfigLanes")
            .and_then(serde_json::Value::as_array_mut)
            .and_then(|lanes| lanes.first_mut())
            .and_then(serde_json::Value::as_object_mut)
            .expect("first legacy lane")
    }

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
        for (version, value) in [
            (1, json!({"version": 1, "apps": []})),
            (2, valid_v2_value()),
        ] {
            let result = validate_profile_object(&value);

            assert!(result.valid, "version {version}: {:?}", result.errors);
            assert_eq!(result.summary.expect("summary").version, version);
        }
    }

    #[test]
    fn rejects_structurally_invalid_v2_config_captures() {
        type Mutation = fn(&mut serde_json::Value);
        let cases: Vec<(&str, Mutation)> = vec![
            ("missing config captures", |value| {
                value
                    .as_object_mut()
                    .expect("manifest object")
                    .remove("configCaptures");
            }),
            ("empty config captures", |value| {
                value["configCaptures"] = json!([]);
            }),
            ("capture id wrong type", |value| {
                first_config_capture_mut(value).insert("captureId".to_string(), json!(7));
            }),
            ("unstable capture id", |value| {
                first_config_capture_mut(value).insert("captureId".to_string(), json!("Capture-A"));
            }),
            ("unstable module id", |value| {
                first_config_capture_mut(value)
                    .insert("moduleId".to_string(), json!("Apps.Example"));
            }),
            ("unstable config set id", |value| {
                first_config_capture_mut(value)
                    .insert("configSetId".to_string(), json!("Preferences"));
            }),
            ("unstable source instance id", |value| {
                first_config_capture_mut(value)["sourceInstance"]["id"] =
                    json!("Installed Instance");
            }),
            ("unstable detector id", |value| {
                first_config_capture_mut(value)["sourceInstance"]["detectorId"] =
                    json!("Installed Package");
            }),
            ("missing source evidence", |value| {
                first_config_capture_mut(value)["sourceInstance"]
                    .as_object_mut()
                    .expect("source object")
                    .remove("evidence");
            }),
            ("raw version wrong type", |value| {
                first_config_capture_mut(value)["sourceInstance"]["rawVersion"] = json!(1.4);
            }),
            ("normalized version mismatch", |value| {
                first_config_capture_mut(value)["sourceInstance"]["normalizedVersion"] =
                    json!("1.4.0");
            }),
            ("irregular raw version has normalized value", |value| {
                let source = first_config_capture_mut(value)["sourceInstance"]
                    .as_object_mut()
                    .expect("source object");
                source.insert("rawVersion".to_string(), json!("release-1.4"));
                source.insert("normalizedVersion".to_string(), json!("1.4"));
            }),
            ("unsupported evidence", |value| {
                first_config_capture_mut(value)["sourceInstance"]["evidence"]["type"] =
                    json!("registry");
            }),
            ("package evidence missing backend", |value| {
                first_config_capture_mut(value)["sourceInstance"]["evidence"]
                    .as_object_mut()
                    .expect("evidence object")
                    .remove("backend");
            }),
            ("unstable generation id", |value| {
                first_config_capture_mut(value).insert("sourceGeneration".to_string(), json!("G1"));
            }),
            ("uppercase generation fingerprint", |value| {
                first_config_capture_mut(value).insert(
                    "sourceGenerationFingerprint".to_string(),
                    json!("A".repeat(64)),
                );
            }),
            ("wrong capture module schema", |value| {
                first_config_capture_mut(value)["captureModule"]["schemaVersion"] = json!(1);
            }),
            ("short capture module hash", |value| {
                first_config_capture_mut(value)["captureModule"]["contentHash"] = json!("abc");
            }),
            ("snapshot outside provenance modules", |value| {
                first_config_capture_mut(value)["captureModule"]["snapshotPath"] =
                    json!("provenance/apps.fixture-stable.json");
            }),
            ("snapshot path is not portable", |value| {
                first_config_capture_mut(value)["captureModule"]["snapshotPath"] =
                    json!(r"provenance\modules\apps.fixture-stable.json");
            }),
            // NOT "any root other than configs/<captureId>" — the directory name
            // is decoupled from the identity since engine #188. What stays
            // enforced is the shape: exactly one directory under configs/.
            ("payload root outside configs", |value| {
                first_config_capture_mut(value)["payloadRoot"] = json!("payloads/fixture-stable");
            }),
            ("nested payload root", |value| {
                first_config_capture_mut(value)["payloadRoot"] =
                    json!("configs/fixture-stable/nested");
            }),
            ("traversing payload root", |value| {
                first_config_capture_mut(value)["payloadRoot"] =
                    json!("configs/fixture-stable-preferences-installed/../other");
            }),
            ("payload manifest wrong type", |value| {
                first_config_capture_mut(value)["payloadManifest"] = json!({});
            }),
            ("absolute payload entry", |value| {
                first_config_capture_mut(value)["payloadManifest"][0]["relativePath"] =
                    json!("/settings.json");
            }),
            ("negative payload size", |value| {
                first_config_capture_mut(value)["payloadManifest"][0]["size"] = json!(-1);
            }),
            ("fractional payload size", |value| {
                first_config_capture_mut(value)["payloadManifest"][0]["size"] = json!(1.5);
            }),
            ("uppercase payload hash", |value| {
                first_config_capture_mut(value)["payloadManifest"][0]["sha256"] =
                    json!("C".repeat(64));
            }),
            ("unsorted payload entries", |value| {
                let entries = first_config_capture_mut(value)["payloadManifest"]
                    .as_array_mut()
                    .expect("payload manifest");
                let mut second = entries[0].clone();
                second["relativePath"] = json!("a.json");
                entries.push(second);
            }),
            ("duplicate payload entries", |value| {
                let entries = first_config_capture_mut(value)["payloadManifest"]
                    .as_array_mut()
                    .expect("payload manifest");
                entries.push(entries[0].clone());
            }),
            ("duplicate capture ids", |value| {
                let captures = value["configCaptures"]
                    .as_array_mut()
                    .expect("config captures");
                captures.push(captures[0].clone());
            }),
        ];

        for (label, mutate) in cases {
            let mut value = valid_v2_value();
            mutate(&mut value);

            let result = validate_profile_object(&value);

            assert!(!result.valid, "{label} was accepted");
            assert_eq!(result.errors.len(), 1, "{label}: {:?}", result.errors);
            assert_eq!(result.errors[0].code, "INVALID_CONFIG_CAPTURE", "{label}");
        }
    }

    #[test]
    fn dispatches_v1_away_from_v2_only_config_fields() {
        type Mutation = fn(&mut serde_json::Value);
        let cases: Vec<(&str, &str, Mutation)> = vec![
            (
                "nonempty config captures",
                "CONFIG_CAPTURES_REQUIRE_V2",
                |value| {
                    value["configCaptures"] = valid_v2_value()["configCaptures"].clone();
                },
            ),
            (
                "nonempty legacy config lanes",
                "INVALID_CONFIG_CAPTURE",
                |value| {
                    value["legacyConfigLanes"] = json!([{
                        "captureId": "legacy-capture",
                        "moduleId": "legacy.example",
                        "moduleSchemaVersion": 1,
                        "payloadRoot": "configs/legacy-capture"
                    }]);
                },
            ),
            (
                "restore legacy capture attribution",
                "INVALID_CONFIG_CAPTURE",
                |value| {
                    value["restore"] = json!([{
                        "type": "copy",
                        "source": "configs/legacy-capture/settings.json",
                        "target": "~/.example/settings.json",
                        "legacyCaptureId": "legacy-capture"
                    }]);
                },
            ),
            (
                "restore module attribution wrong type",
                "INVALID_CONFIG_CAPTURE",
                |value| {
                    value["restore"] = json!([{
                        "type": "copy",
                        "source": "configs/legacy-capture/settings.json",
                        "target": "~/.example/settings.json",
                        "fromModule": 7
                    }]);
                },
            ),
        ];

        for (label, expected_code, mutate) in cases {
            let mut value = serde_json::from_str(VALID_V1).expect("parse valid v1");
            mutate(&mut value);

            let result = validate_profile_object(&value);

            assert!(!result.valid, "{label} was accepted");
            assert_eq!(result.errors.len(), 1, "{label}: {:?}", result.errors);
            assert_eq!(result.errors[0].code, expected_code, "{label}");
        }
    }

    #[test]
    fn accepts_v1_restore_module_attribution() {
        let mut value: serde_json::Value = serde_json::from_str(VALID_V1).expect("parse valid v1");
        value["restore"] = json!([{
            "type": "copy",
            "source": "configs/legacy-capture/settings.json",
            "target": "~/.example/settings.json",
            "fromModule": "legacy.example"
        }]);

        let result = validate_profile_object(&value);

        assert!(
            result.valid,
            "valid v1 restore was rejected: {:?}",
            result.errors
        );
    }

    #[test]
    fn rejects_invalid_v2_legacy_isolation_and_attribution() {
        type Mutation = fn(&mut serde_json::Value);
        let cases: Vec<(&str, Mutation)> = vec![
            ("null legacy lanes", |value| {
                value["legacyConfigLanes"] = serde_json::Value::Null;
            }),
            ("malformed legacy lanes", |value| {
                value["legacyConfigLanes"] = json!({});
            }),
            ("malformed legacy lane entry", |value| {
                value["legacyConfigLanes"] = json!(["legacy-capture"]);
            }),
            ("missing legacy lane field", |value| {
                first_legacy_lane_mut(value).remove("payloadRoot");
            }),
            ("legacy capture id wrong type", |value| {
                first_legacy_lane_mut(value).insert("captureId".to_string(), json!(7));
            }),
            ("unstable legacy capture id", |value| {
                first_legacy_lane_mut(value)
                    .insert("captureId".to_string(), json!("Legacy Capture"));
            }),
            ("unstable legacy module id", |value| {
                first_legacy_lane_mut(value)
                    .insert("moduleId".to_string(), json!("Legacy Example"));
            }),
            ("wrong legacy module schema", |value| {
                first_legacy_lane_mut(value).insert("moduleSchemaVersion".to_string(), json!(2));
            }),
            ("nested legacy payload root", |value| {
                first_legacy_lane_mut(value).insert(
                    "payloadRoot".to_string(),
                    json!("configs/legacy-capture/nested"),
                );
            }),
            ("legacy payload root outside configs", |value| {
                first_legacy_lane_mut(value)
                    .insert("payloadRoot".to_string(), json!("payloads/legacy-capture"));
            }),
            ("nonportable legacy payload root", |value| {
                first_legacy_lane_mut(value).insert(
                    "payloadRoot".to_string(),
                    json!("configs/legacy-capture/../other"),
                );
            }),
            ("duplicate capture id across lane types", |value| {
                let capture_id = value["configCaptures"][0]["captureId"].clone();
                let lane = first_legacy_lane_mut(value);
                lane.insert("captureId".to_string(), capture_id.clone());
                lane.insert(
                    "payloadRoot".to_string(),
                    json!(format!(
                        "configs/{}",
                        capture_id.as_str().expect("capture id")
                    )),
                );
            }),
            ("duplicate legacy module id", |value| {
                let lanes = value["legacyConfigLanes"]
                    .as_array_mut()
                    .expect("legacy lanes");
                let mut second = lanes[0].clone();
                second["captureId"] = json!("legacy-other");
                second["payloadRoot"] = json!("configs/legacy-other");
                lanes.push(second);
            }),
            ("module has generation and legacy lanes", |value| {
                first_legacy_lane_mut(value)
                    .insert("moduleId".to_string(), json!("apps.fixture-stable"));
                value["configModules"] = json!(["apps.fixture-stable"]);
            }),
            ("null config modules", |value| {
                value["configModules"] = serde_json::Value::Null;
            }),
            ("malformed config modules", |value| {
                value["configModules"] = json!({});
            }),
            ("malformed listed module", |value| {
                value["configModules"] = json!([7]);
            }),
            ("unstable listed module", |value| {
                value["configModules"] = json!(["Legacy Example"]);
            }),
            ("duplicate listed module", |value| {
                value["configModules"] = json!(["legacy.example", "legacy.example"]);
            }),
            ("missing listed legacy module", |value| {
                value["configModules"] = json!([]);
            }),
            ("extraneous listed module", |value| {
                value["configModules"] = json!(["legacy.example", "legacy.other"]);
            }),
            ("null restore", |value| {
                value["restore"] = serde_json::Value::Null;
            }),
            ("malformed restore", |value| {
                value["restore"] = json!({});
            }),
            ("malformed restore entry", |value| {
                value["restore"] = json!(["copy"]);
            }),
            ("malformed restore attribution", |value| {
                value["restore"][0]["legacyCaptureId"] = json!(7);
            }),
            ("ordinary restore overlaps generation payload", |value| {
                value["restore"] = json!([{
                    "type": "copy",
                    "source": "./CONFIGS/FIXTURE-STABLE-PREFERENCES-INSTALLED/settings.json",
                    "target": "~/.fixture/settings.json"
                }]);
            }),
            ("attributed restore missing capture id", |value| {
                value["restore"][0]
                    .as_object_mut()
                    .expect("restore object")
                    .remove("legacyCaptureId");
            }),
            ("attributed restore unknown capture id", |value| {
                value["restore"][0]["legacyCaptureId"] = json!("legacy-other");
            }),
            ("attributed restore module mismatch", |value| {
                value["restore"][0]["fromModule"] = json!("legacy.other");
            }),
            ("attributed restore escapes lane root", |value| {
                value["restore"][0]["source"] = json!("configs/other/settings.json");
            }),
            ("legacy lane is unused", |value| {
                value["restore"] = json!([]);
            }),
        ];

        for (label, mutate) in cases {
            let mut value = valid_v2_with_legacy_lane();
            mutate(&mut value);

            let result = validate_profile_object(&value);

            assert!(!result.valid, "{label} was accepted");
            assert_eq!(result.errors.len(), 1, "{label}: {:?}", result.errors);
            assert_eq!(result.errors[0].code, "INVALID_CONFIG_CAPTURE", "{label}");
        }
    }

    #[test]
    fn accepts_v2_with_an_attributed_legacy_lane() {
        let result = validate_profile_object(&valid_v2_with_legacy_lane());

        assert!(result.valid, "{:?}", result.errors);
    }

    #[test]
    fn v2_gui_import_boundary_requires_top_level_capture_provenance() {
        let value = json!({
            "version": 2,
            "apps": [],
            "includes": ["capture-provenance.jsonc"]
        });

        let result = validate_profile_object(&value);

        assert!(!result.valid);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].code, "INVALID_CONFIG_CAPTURE");
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
    fn rejects_fractional_profile_version_as_unsupported() {
        let result = validate_profile_object(&json!({
            "version": 2.5,
            "name": "invalid",
            "apps": []
        }));

        assert!(!result.valid);
        assert_eq!(result.errors[0].code, "UNSUPPORTED_VERSION");
    }

    #[test]
    fn rejects_non_numeric_profile_version_as_invalid_type() {
        let result = validate_profile_object(&json!({
            "version": "2",
            "name": "invalid",
            "apps": []
        }));

        assert!(!result.valid);
        assert_eq!(result.errors[0].code, "INVALID_VERSION_TYPE");
    }

    #[test]
    fn rejects_null_apps_as_invalid_type() {
        let result = validate_profile_object(&json!({
            "version": 1,
            "name": "invalid",
            "apps": null
        }));

        assert!(!result.valid);
        assert_eq!(result.errors[0].code, "INVALID_APPS_TYPE");
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
            ("windows-ads", "payload:stream"),
            ("windows-device", "NUL.txt"),
            ("windows-nested-device", "payload/COM1.cfg"),
            ("windows-nested-com-superscript-1", "payload/COM¹.cfg"),
            ("windows-nested-com-superscript-2", "payload/COM².cfg"),
            ("windows-nested-com-superscript-3", "payload/COM³.cfg"),
            ("windows-nested-lpt-superscript-1", "payload/LPT¹.cfg"),
            ("windows-nested-lpt-superscript-2", "payload/LPT².cfg"),
            ("windows-nested-lpt-superscript-3", "payload/LPT³.cfg"),
            ("windows-trailing-dot", "payload/file."),
            ("windows-trailing-space", "payload/file "),
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
    fn incomplete_v2_zip_is_not_committed_or_discoverable() {
        let temp = TestDir::new("incomplete-v2-zip");
        let profiles = temp.path().join("profiles");
        let zip_path = temp.path().join("incomplete.zip");
        fs::create_dir(&profiles).expect("create profiles");
        write_zip(&zip_path, &[("manifest.jsonc", INCOMPLETE_V2)]);

        let error = extract_zip_profile(
            zip_path.to_str().expect("zip path"),
            profiles.to_str().expect("profiles path"),
        )
        .expect_err("incomplete v2 zip must fail");

        assert!(error.contains("INVALID_CONFIG_CAPTURE"), "{error}");
        assert!(directory_names(&profiles).is_empty());
        assert!(
            list_manifest_files(profiles.to_str().expect("profiles path"))
                .expect("discover manifests")
                .is_empty()
        );
    }

    #[test]
    fn generation_payload_fallback_zip_is_not_committed_or_discoverable() {
        let temp = TestDir::new("generation-fallback-zip");
        let profiles = temp.path().join("profiles");
        let zip_path = temp.path().join("fallback.zip");
        let manifest = invalid_generation_fallback_v2();
        fs::create_dir(&profiles).expect("create profiles");
        write_zip(&zip_path, &[("manifest.jsonc", &manifest)]);

        let error = extract_zip_profile(
            zip_path.to_str().expect("zip path"),
            profiles.to_str().expect("profiles path"),
        )
        .expect_err("generation payload fallback zip must fail");

        assert!(error.contains("INVALID_CONFIG_CAPTURE"), "{error}");
        assert!(directory_names(&profiles).is_empty());
        assert!(
            list_manifest_files(profiles.to_str().expect("profiles path"))
                .expect("discover manifests")
                .is_empty()
        );
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
    fn incomplete_v2_bare_import_is_not_committed_or_discoverable() {
        let temp = TestDir::new("incomplete-v2-bare");
        let profiles = temp.path().join("profiles");
        fs::create_dir(&profiles).expect("create profiles");

        let error = import_profile_text(
            INCOMPLETE_V2,
            "incomplete.jsonc",
            profiles.to_str().expect("profiles path"),
        )
        .expect_err("incomplete v2 bare import must fail");

        assert!(error.contains("INVALID_CONFIG_CAPTURE"), "{error}");
        assert!(directory_names(&profiles).is_empty());
        assert!(
            list_manifest_files(profiles.to_str().expect("profiles path"))
                .expect("discover manifests")
                .is_empty()
        );
    }

    #[test]
    fn generation_payload_fallback_bare_is_not_committed_or_discoverable() {
        let temp = TestDir::new("generation-fallback-bare");
        let profiles = temp.path().join("profiles");
        let manifest = invalid_generation_fallback_v2();
        fs::create_dir(&profiles).expect("create profiles");

        let error = import_profile_text(
            &manifest,
            "fallback.jsonc",
            profiles.to_str().expect("profiles path"),
        )
        .expect_err("generation payload fallback bare import must fail");

        assert!(error.contains("INVALID_CONFIG_CAPTURE"), "{error}");
        assert!(directory_names(&profiles).is_empty());
        assert!(
            list_manifest_files(profiles.to_str().expect("profiles path"))
                .expect("discover manifests")
                .is_empty()
        );
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
    fn concurrent_bare_imports_commit_without_clobbering() {
        const IMPORTS: usize = 24;
        let temp = TestDir::new("concurrent-bare");
        let profiles = Arc::new(temp.path().join("profiles"));
        let barrier = Arc::new(Barrier::new(IMPORTS));
        let mut handles = Vec::new();

        for index in 0..IMPORTS {
            let profiles = Arc::clone(&profiles);
            let barrier = Arc::clone(&barrier);
            handles.push(std::thread::spawn(move || {
                let content = valid_v2_with_name(&format!("concurrent-{index}"));
                barrier.wait();
                import_profile_text(
                    &content,
                    "profile.jsonc",
                    profiles.to_str().expect("profiles path"),
                )
            }));
        }

        let committed = handles
            .into_iter()
            .map(|handle| {
                handle
                    .join()
                    .expect("join importer")
                    .expect("commit import")
            })
            .collect::<HashSet<_>>();

        assert_eq!(committed.len(), IMPORTS);
        assert_eq!(directory_names(&profiles).len(), IMPORTS);
        assert!(committed.iter().all(|path| Path::new(path).is_file()));

        let surviving_names = committed
            .iter()
            .map(|path| {
                let content = fs::read_to_string(path).expect("read committed manifest");
                serde_json::from_str::<serde_json::Value>(&content)
                    .expect("parse committed manifest")
                    .get("name")
                    .and_then(serde_json::Value::as_str)
                    .expect("manifest name")
                    .to_string()
            })
            .collect::<HashSet<_>>();
        let expected_names = (0..IMPORTS)
            .map(|index| format!("concurrent-{index}"))
            .collect::<HashSet<_>>();
        assert_eq!(surviving_names, expected_names);
    }

    #[cfg(unix)]
    #[test]
    fn dangling_bare_target_is_preserved_and_import_uses_next_suffix() {
        use std::os::unix::fs::symlink;

        let temp = TestDir::new("dangling-bare");
        let profiles = temp.path().join("profiles");
        fs::create_dir(&profiles).expect("create profiles");
        let dangling = profiles.join("profile.jsonc");
        symlink(temp.path().join("missing-manifest"), &dangling).expect("create dangling symlink");

        let committed = import_profile_text(
            VALID_V2,
            "profile.jsonc",
            profiles.to_str().expect("profiles path"),
        )
        .expect("import beside dangling target");

        assert_eq!(PathBuf::from(committed), profiles.join("profile_1.jsonc"));
        assert!(fs::symlink_metadata(&dangling)
            .expect("dangling target metadata")
            .file_type()
            .is_symlink());
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

    #[test]
    fn user_provided_final_names_sanitize_windows_devices() {
        let temp = TestDir::new("device-name");
        let profiles = temp.path().join("profiles");

        for (unsafe_name, safe_name) in [
            ("NUL.jsonc", "_NUL.jsonc"),
            ("COM¹.jsonc", "_COM¹.jsonc"),
            ("COM².jsonc", "_COM².jsonc"),
            ("COM³.jsonc", "_COM³.jsonc"),
            ("LPT¹.jsonc", "_LPT¹.jsonc"),
            ("LPT².jsonc", "_LPT².jsonc"),
            ("LPT³.jsonc", "_LPT³.jsonc"),
        ] {
            let committed = import_profile_text(
                VALID_V2,
                unsafe_name,
                profiles.to_str().expect("profiles path"),
            )
            .expect("import device-named manifest");

            assert_eq!(PathBuf::from(committed), profiles.join(safe_name));
        }
    }

    #[test]
    fn concurrent_zip_imports_reserve_distinct_profile_directories() {
        const IMPORTS: usize = 16;
        let temp = TestDir::new("concurrent-zip");
        let profiles = Arc::new(temp.path().join("profiles"));
        let zip_path = Arc::new(temp.path().join("capture.zip"));
        fs::create_dir(&*profiles).expect("create profiles");
        write_zip(
            &zip_path,
            &[
                ("manifest.jsonc", VALID_V2),
                ("payload/settings.txt", "payload-complete"),
            ],
        );
        let barrier = Arc::new(Barrier::new(IMPORTS));
        let imports_finished = Arc::new(AtomicBool::new(false));
        let observer = {
            let profiles = Arc::clone(&profiles);
            let imports_finished = Arc::clone(&imports_finished);
            std::thread::spawn(move || {
                let assert_discovered_payloads = || {
                    let manifests = list_manifest_files(profiles.to_str().expect("profiles path"))
                        .expect("discover manifests");
                    for manifest in manifests {
                        let payload = Path::new(&manifest)
                            .parent()
                            .expect("manifest parent")
                            .join("payload/settings.txt");
                        assert_eq!(
                            fs::read_to_string(payload).expect("read discovered payload"),
                            "payload-complete"
                        );
                    }
                };

                while !imports_finished.load(Ordering::Acquire) {
                    assert_discovered_payloads();
                    std::thread::yield_now();
                }
                assert_discovered_payloads();
            })
        };
        let mut handles = Vec::new();

        for _ in 0..IMPORTS {
            let profiles = Arc::clone(&profiles);
            let zip_path = Arc::clone(&zip_path);
            let barrier = Arc::clone(&barrier);
            handles.push(std::thread::spawn(move || {
                barrier.wait();
                extract_zip_profile(
                    zip_path.to_str().expect("zip path"),
                    profiles.to_str().expect("profiles path"),
                )
            }));
        }

        let joined = handles
            .into_iter()
            .map(std::thread::JoinHandle::join)
            .collect::<Vec<_>>();
        imports_finished.store(true, Ordering::Release);
        observer.join().expect("join discovery observer");

        let committed = joined
            .into_iter()
            .map(|result| result.expect("join importer").expect("commit import"))
            .collect::<HashSet<_>>();

        assert_eq!(committed.len(), IMPORTS);
        assert_eq!(directory_names(&profiles).len(), IMPORTS);
        assert!(committed.iter().all(|path| Path::new(path).is_file()));
        assert!(committed.iter().all(|manifest| {
            Path::new(manifest)
                .parent()
                .expect("manifest parent")
                .join("payload/settings.txt")
                .is_file()
        }));
    }

    #[cfg(unix)]
    #[test]
    fn dangling_zip_target_is_preserved_and_import_uses_next_suffix() {
        use std::os::unix::fs::symlink;

        let temp = TestDir::new("dangling-zip");
        let profiles = temp.path().join("profiles");
        let zip_path = temp.path().join("capture.zip");
        fs::create_dir(&profiles).expect("create profiles");
        write_zip(&zip_path, &[("manifest.jsonc", VALID_V2)]);
        let dangling = profiles.join("capture");
        symlink(temp.path().join("missing-profile"), &dangling).expect("create dangling symlink");

        let committed = extract_zip_profile(
            zip_path.to_str().expect("zip path"),
            profiles.to_str().expect("profiles path"),
        )
        .expect("import beside dangling target");

        assert_eq!(
            PathBuf::from(committed),
            profiles.join("capture_1").join("manifest.jsonc")
        );
        assert!(fs::symlink_metadata(&dangling)
            .expect("dangling target metadata")
            .file_type()
            .is_symlink());
    }

    #[test]
    fn payload_root_shape_is_enforced_without_pinning_it_to_the_capture_id() {
        for readable in [
            "configs/powertoys-135f78ef",
            "configs/windows-terminal-11bb6551",
            "configs/a",
        ] {
            assert!(
                validate_config_payload_root(readable).is_ok(),
                "readable payload root {readable:?} must be accepted"
            );
        }
        for rejected in [
            "payloads/powertoys",         // not under configs/
            "configs",                    // no directory at all
            "configs/",                   // empty segment
            "configs/powertoys/settings", // more than one directory deep
            "configs/powertoys/../other", // traversal
            r"configs\powertoys",         // not portable
        ] {
            assert!(
                validate_config_payload_root(rejected).is_err(),
                "payload root {rejected:?} must be rejected"
            );
        }
    }

    /// Regression: engine v2.27.5 (Artexis10/endstate#188) renamed bundle payload
    /// folders to a readable label plus a short hash, decoupling `payloadRoot`
    /// from `captureId`. This validator still demanded `configs/<captureId>`, so
    /// importing any freshly captured profile failed — the GUI surfaced only
    /// "We couldn't import <file>. Please try again."
    #[test]
    fn generation_capture_accepts_a_readable_payload_root() {
        let mut value = valid_v2_value();
        first_config_capture_mut(&mut value)["payloadRoot"] =
            json!("configs/fixture-stable-135f78ef");

        let result = validate_profile_object(&value);
        assert!(
            result.valid,
            "readable generation payload root rejected: {:?}",
            result.errors
        );
    }

    #[test]
    fn legacy_lane_accepts_a_readable_payload_root() {
        let mut value = valid_v2_with_legacy_lane();
        value["legacyConfigLanes"][0]["payloadRoot"] = json!("configs/example-0d7a3cc2");
        value["restore"][0]["source"] = json!("configs/example-0d7a3cc2/settings.json");

        let result = validate_profile_object(&value);
        assert!(
            result.valid,
            "readable legacy payload root rejected: {:?}",
            result.errors
        );
    }

    /// Identity no longer implies the directory, so uniqueness needs its own guard.
    #[test]
    fn generation_captures_may_not_share_a_payload_root() {
        let mut value = valid_v2_value();
        let mut duplicate = value["configCaptures"][0].clone();
        duplicate["captureId"] = json!("fixture-stable-preferences-second");
        value["configCaptures"]
            .as_array_mut()
            .expect("configCaptures array")
            .push(duplicate);

        let result = validate_profile_object(&value);
        assert!(
            !result.valid,
            "two captures sharing one payloadRoot must be rejected"
        );
    }
}
