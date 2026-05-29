//! Dev-only HTTP server for browser-based engine access.
//!
//! Mirrors Tauri IPC commands as REST endpoints so a browser tab pointed at
//! the Vite dev server can call engine functions without Tauri IPC. The
//! original consumer was the Tidewave inspector but the bridge itself is
//! generic — any browser process can use it during development.
//!
//! Activated only when: debug build + ENDSTATE_BROWSER_BRIDGE=1

use axum::{
    extract::State,
    response::sse::{self, Sse},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use std::sync::atomic::Ordering;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use tower_http::cors::CorsLayer;

use crate::engine_adapter::{
    create_cancelled_result, create_fallback_result, extract_command_name_pub, generate_run_id,
    inject_run_id, is_result_event, parse_line, parse_line_with_run_id, SharedRunState,
};
use crate::event_broadcast::EventBroadcaster;

/// Shared state for the HTTP server
#[derive(Clone)]
struct AppState {
    run_state: SharedRunState,
    broadcaster: EventBroadcaster,
    app: tauri::AppHandle,
}

/// Generic invoke request (mirrors Tauri's invoke model)
#[derive(Deserialize)]
struct InvokeRequest {
    cmd: String,
    #[serde(default)]
    args: serde_json::Value,
}

/// Generic invoke response
#[derive(Serialize)]
struct InvokeResponse {
    ok: bool,
    data: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn ok_response(data: serde_json::Value) -> Json<InvokeResponse> {
    Json(InvokeResponse {
        ok: true,
        data,
        error: None,
    })
}

fn err_response(msg: impl ToString) -> Json<InvokeResponse> {
    Json(InvokeResponse {
        ok: false,
        data: serde_json::Value::Null,
        error: Some(msg.to_string()),
    })
}

/// Run engine via HTTP bridge.
/// Emits events only through the broadcaster (SSE).
fn run_engine_http(
    app: &tauri::AppHandle,
    exe: &str,
    args: &[String],
    run_state: &SharedRunState,
    broadcaster: &EventBroadcaster,
) -> Result<String, String> {
    let run_id = generate_run_id();
    let command_name = extract_command_name_pub(args);

    // Acquire lock and check if another run is active
    {
        let mut state = run_state.lock();

        if state.run_id.is_some() {
            return Err(
                "Another run is already in progress. Please wait or cancel it.".to_string(),
            );
        }

        state.run_id = Some(run_id.clone());
        state.command = Some(command_name.clone());
        state.cancel_requested.store(false, Ordering::SeqCst);
    }

    // Spawn the process (resolve __bundled__ to the sidecar binary if needed)
    let mut cmd = if exe == "__bundled__" {
        match crate::engine_adapter::build_bundled_command(app, args) {
            Ok(c) => c,
            Err(e) => {
                {
                    let mut state = run_state.lock();
                    state.run_id = None;
                    state.command = None;
                    state.child = None;
                }
                return Err(format!("{}: {}", e.code, e.message));
            }
        }
    } else {
        crate::cmd_impl::build_engine_command(exe, args)
    };
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            {
                let mut state = run_state.lock();
                state.run_id = None;
                state.command = None;
                state.child = None;
            }
            return Err(format!("Failed to spawn process: {}", e));
        }
    };

    let stdout = child.stdout.take().expect("stdout was piped");
    let stderr = child.stderr.take().expect("stderr was piped");

    // Store child for cancellation
    {
        let mut state = run_state.lock();
        state.child = Some(child);
    }

    // Use mpsc channel for collecting messages
    let (tx, rx) = std::sync::mpsc::channel();

    let tx_stdout = tx.clone();
    let stdout_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            if !line.is_empty() {
                if tx_stdout.send((false, line)).is_err() {
                    break;
                }
            }
        }
    });

    let tx_stderr = tx.clone();
    let stderr_handle = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            if !line.is_empty() {
                if tx_stderr.send((true, line)).is_err() {
                    break;
                }
            }
        }
    });

    drop(tx);

    // Process messages — emit to broadcaster only (no AppHandle)
    let mut received_result = false;

    for (is_stderr, line) in rx {
        if is_stderr {
            let event = parse_line_with_run_id(&line, true, &run_id);
            if let Ok(json) = serde_json::to_string(&event) {
                broadcaster.send(&json);
            }
        } else {
            let mut event = parse_line(&line, false);
            if is_result_event(&event) {
                received_result = true;
            }
            inject_run_id(&mut event, &run_id);
            if let Ok(json) = serde_json::to_string(&event) {
                broadcaster.send(&json);
            }
        }
    }

    let _ = stdout_handle.join();
    let _ = stderr_handle.join();

    // Get exit code and check cancellation
    let (exit_code, was_cancelled) = {
        let mut state = run_state.lock();

        let was_cancelled = state.cancel_requested.load(Ordering::SeqCst);
        let exit_code = if let Some(ref mut child) = state.child {
            child.wait().ok().and_then(|s| s.code()).unwrap_or(-1)
        } else {
            -1
        };

        state.child = None;
        state.run_id = None;
        state.command = None;
        state.cancel_requested.store(false, Ordering::SeqCst);

        (exit_code, was_cancelled)
    };

    if !received_result {
        let event = if was_cancelled {
            create_cancelled_result(&run_id, &command_name, Some(exit_code))
        } else {
            create_fallback_result(exit_code, &run_id, &command_name)
        };
        if let Ok(json) = serde_json::to_string(&event) {
            broadcaster.send(&json);
        }
    }

    Ok(run_id)
}

/// Cancel engine via HTTP bridge (no AppHandle needed).
fn cancel_engine_http(
    run_state: &SharedRunState,
    broadcaster: &EventBroadcaster,
) -> Result<(), String> {
    let mut state = run_state.lock();

    if state.run_id.is_none() {
        return Err("No run is currently active to cancel.".to_string());
    }

    state.cancel_requested.store(true, Ordering::SeqCst);

    if let Some(ref mut child) = state.child {
        if let Err(e) = child.kill() {
            if e.kind() != std::io::ErrorKind::InvalidInput {
                let run_id = state.run_id.clone().unwrap_or_default();
                let log_event = serde_json::json!({
                    "type": "log",
                    "level": "warn",
                    "message": format!("Failed to kill process: {}", e),
                    "runId": run_id
                });
                if let Ok(json) = serde_json::to_string(&log_event) {
                    broadcaster.send(&json);
                }
            }
        }
    }

    Ok(())
}

/// Run endstate streaming via HTTP bridge.
/// Emits stdout/stderr/exit events through the broadcaster only.
fn run_streaming_http(
    app: &tauri::AppHandle,
    exe: &str,
    args: &[String],
    event_channel: &str,
    broadcaster: &EventBroadcaster,
) -> Result<(), String> {
    let mut cmd = if exe == "__bundled__" {
        crate::engine_adapter::build_bundled_command(app, args)
            .map_err(|e| format!("{}: {}", e.code, e.message))?
    } else {
        crate::cmd_impl::build_engine_command(exe, args)
    };
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn process: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let broadcaster_stdout = broadcaster.clone();
    let channel_stdout = event_channel.to_string();
    let stdout_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().flatten() {
            let event = serde_json::json!({
                "type": "stdout",
                "data": format!("{}\n", line),
                "channel": channel_stdout
            });
            if let Ok(json) = serde_json::to_string(&event) {
                broadcaster_stdout.send(&json);
            }
        }
    });

    let broadcaster_stderr = broadcaster.clone();
    let channel_stderr = event_channel.to_string();
    let stderr_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            let event = serde_json::json!({
                "type": "stderr",
                "data": format!("{}\n", line),
                "channel": channel_stderr
            });
            if let Ok(json) = serde_json::to_string(&event) {
                broadcaster_stderr.send(&json);
            }
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for process: {}", e))?;
    let exit_code = status.code().unwrap_or(-1);

    stdout_thread.join().ok();
    stderr_thread.join().ok();

    let exit_event = serde_json::json!({
        "type": "exit",
        "exitCode": exit_code,
        "channel": event_channel
    });
    if let Ok(json) = serde_json::to_string(&exit_event) {
        broadcaster.send(&json);
    }

    Ok(())
}

async fn handle_invoke(
    State(state): State<AppState>,
    Json(req): Json<InvokeRequest>,
) -> Json<InvokeResponse> {
    match req.cmd.as_str() {
        "engine_is_running" => {
            let run_state = state.run_state.clone();
            match tokio::task::spawn_blocking(move || {
                crate::engine_adapter::is_run_active(&run_state)
            })
            .await
            {
                Ok(result) => ok_response(serde_json::json!(result)),
                Err(e) => err_response(format!("Task error: {}", e)),
            }
        }
        "engine_get_run_id" => {
            let run_state = state.run_state.clone();
            match tokio::task::spawn_blocking(move || {
                crate::engine_adapter::get_current_run_id(&run_state)
            })
            .await
            {
                Ok(result) => ok_response(serde_json::json!(result)),
                Err(e) => err_response(format!("Task error: {}", e)),
            }
        }
        "engine_run" => {
            let exe = req
                .args
                .get("exe")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let args: Vec<String> = req
                .args
                .get("args")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default();

            let run_state = state.run_state.clone();
            let broadcaster = state.broadcaster.clone();
            let app = state.app.clone();

            match tokio::task::spawn_blocking(move || {
                run_engine_http(&app, &exe, &args, &run_state, &broadcaster)
            })
            .await
            {
                Ok(Ok(run_id)) => ok_response(serde_json::json!(run_id)),
                Ok(Err(e)) => err_response(e),
                Err(e) => err_response(format!("Task error: {}", e)),
            }
        }
        "engine_cancel" => {
            let run_state = state.run_state.clone();
            let broadcaster = state.broadcaster.clone();
            match tokio::task::spawn_blocking(move || {
                cancel_engine_http(&run_state, &broadcaster)
            })
            .await
            {
                Ok(Ok(())) => ok_response(serde_json::json!(null)),
                Ok(Err(e)) => err_response(e),
                Err(e) => err_response(format!("Task error: {}", e)),
            }
        }
        "run_endstate_streaming" => {
            let exe = req
                .args
                .get("exe")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let args: Vec<String> = req
                .args
                .get("args")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default();
            let event_channel = req
                .args
                .get("eventChannel")
                .or_else(|| req.args.get("event_channel"))
                .and_then(|v| v.as_str())
                .unwrap_or("endstate://streaming")
                .to_string();

            let broadcaster = state.broadcaster.clone();
            let app = state.app.clone();

            match tokio::task::spawn_blocking(move || {
                run_streaming_http(&app, &exe, &args, &event_channel, &broadcaster)
            })
            .await
            {
                Ok(Ok(())) => ok_response(serde_json::json!(null)),
                Ok(Err(e)) => err_response(e),
                Err(e) => err_response(format!("Task error: {}", e)),
            }
        }
        "endstate_exec" => {
            let exe = req
                .args
                .get("exe")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let args: Vec<String> = req
                .args
                .get("args")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default();

            let stdin_input = req
                .args
                .get("stdinInput")
                .or_else(|| req.args.get("stdin_input"))
                .and_then(|v| v.as_str())
                .map(String::from);

            let app = state.app.clone();
            match tokio::task::spawn_blocking(move || {
                use std::io::Write as _;
                use std::process::Stdio;

                let mut cmd = if exe == "__bundled__" {
                    match crate::engine_adapter::build_bundled_command(&app, &args) {
                        Ok(c) => c,
                        Err(e) => {
                            return Err(crate::cmd_impl::ExecError {
                                code: e.code,
                                message: e.message,
                            });
                        }
                    }
                } else {
                    crate::cmd_impl::build_engine_command(&exe, &args)
                };
                let output = if let Some(input) = stdin_input {
                    cmd.stdin(Stdio::piped())
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped());
                    let mut child = cmd.spawn()?;
                    if let Some(mut stdin) = child.stdin.take() {
                        stdin.write_all(input.as_bytes())?;
                    }
                    child.wait_with_output()?
                } else {
                    cmd.output()?
                };
                Ok(crate::cmd_impl::ExecResult {
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    exit_code: output.status.code().unwrap_or(-1),
                })
            })
            .await
            {
                Ok(Ok(result)) => {
                    ok_response(serde_json::to_value(result).unwrap_or_default())
                }
                Ok(Err(e)) => err_response(format!("{}: {}", e.code, e.message)),
                Err(e) => err_response(format!("Task error: {}", e)),
            }
        }
        "validate_profile" => {
            let path = req
                .args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::validate_profile(&path) {
                Ok(result) => ok_response(serde_json::to_value(result).unwrap_or_default()),
                Err(e) => err_response(e),
            }
        }
        "list_manifest_files" => {
            let directory = req
                .args
                .get("directory")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::list_manifest_files(&directory) {
                Ok(files) => ok_response(serde_json::json!(files)),
                Err(e) => err_response(e),
            }
        }
        "get_default_profiles_directory" => match crate::cmd_impl::get_default_profiles_directory() {
            Ok(dir) => ok_response(serde_json::json!(dir)),
            Err(e) => err_response(e),
        },
        "get_capture_cache_directory" => match crate::cmd_impl::get_capture_cache_directory() {
            Ok(dir) => ok_response(serde_json::json!(dir)),
            Err(e) => err_response(e),
        },
        "check_file_exists" => {
            let path = req
                .args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::check_file_exists(&path) {
                Ok(exists) => ok_response(serde_json::json!(exists)),
                Err(e) => err_response(e),
            }
        }
        "read_text_file" => {
            let path = req
                .args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::read_text_file(&path) {
                Ok(content) => ok_response(serde_json::json!(content)),
                Err(e) => err_response(e),
            }
        }
        "write_text_file" => {
            let path = req
                .args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let content = req
                .args
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::write_text_file(&path, &content) {
                Ok(()) => ok_response(serde_json::json!(null)),
                Err(e) => err_response(e),
            }
        }
        "delete_file" => {
            let path = req
                .args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::delete_file(&path) {
                Ok(()) => ok_response(serde_json::json!(null)),
                Err(e) => err_response(e),
            }
        }
        "delete_file_silent" => {
            let path = req
                .args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::delete_file_silent(&path) {
                Ok(()) => ok_response(serde_json::json!(null)),
                Err(e) => err_response(e),
            }
        }
        "rename_file" => {
            let old_path = req
                .args
                .get("oldPath")
                .or_else(|| req.args.get("old_path"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let new_path = req
                .args
                .get("newPath")
                .or_else(|| req.args.get("new_path"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::rename_file(&old_path, &new_path) {
                Ok(()) => ok_response(serde_json::json!(null)),
                Err(e) => err_response(e),
            }
        }
        "copy_file" => {
            let source_path = req
                .args
                .get("sourcePath")
                .or_else(|| req.args.get("source_path"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let dest_path = req
                .args
                .get("destPath")
                .or_else(|| req.args.get("dest_path"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::copy_file(&source_path, &dest_path) {
                Ok(()) => ok_response(serde_json::json!(null)),
                Err(e) => err_response(e),
            }
        }
        "ensure_dir" => {
            let path = req
                .args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::ensure_dir(&path) {
                Ok(()) => ok_response(serde_json::json!(null)),
                Err(e) => err_response(e),
            }
        }
        "import_profile" => {
            let source_path = req
                .args
                .get("sourcePath")
                .or_else(|| req.args.get("source_path"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let profiles_dir = req
                .args
                .get("profilesDir")
                .or_else(|| req.args.get("profiles_dir"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::import_profile(&source_path, &profiles_dir) {
                Ok(name) => ok_response(serde_json::json!(name)),
                Err(e) => err_response(e),
            }
        }
        "show_file_dialog" => match crate::cmd_impl::show_file_dialog() {
            Ok(path) => ok_response(serde_json::json!(path)),
            Err(e) => err_response(e),
        },
        "open_folder" => {
            let path = req
                .args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::open_folder(&path) {
                Ok(()) => ok_response(serde_json::json!(null)),
                Err(e) => err_response(e),
            }
        }
        "cleanup_capture_cache" => match crate::cmd_impl::cleanup_capture_cache() {
            Ok(()) => ok_response(serde_json::json!(null)),
            Err(e) => err_response(e),
        },
        "extract_zip_profile" => {
            let zip_path = req
                .args
                .get("zipPath")
                .or_else(|| req.args.get("zip_path"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let profiles_dir = req
                .args
                .get("profilesDir")
                .or_else(|| req.args.get("profiles_dir"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match extract_zip_to_profiles(&zip_path, &profiles_dir) {
                Ok(path) => ok_response(serde_json::json!(path)),
                Err(e) => err_response(e),
            }
        }
        "import_zip_from_base64" => {
            let data = req
                .args
                .get("data")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let file_name = req
                .args
                .get("fileName")
                .or_else(|| req.args.get("file_name"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let profiles_dir = req
                .args
                .get("profilesDir")
                .or_else(|| req.args.get("profiles_dir"))
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match import_zip_base64(&data, &file_name, &profiles_dir) {
                Ok(path) => ok_response(serde_json::json!(path)),
                Err(e) => err_response(e),
            }
        }
        "read_file_base64" => {
            let path = req
                .args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let file_path = std::path::Path::new(&path);
            if !file_path.exists() || !file_path.is_file() {
                err_response("File does not exist")
            } else {
                match std::fs::read(file_path) {
                    Ok(bytes) => {
                        use base64::{Engine as _, engine::general_purpose::STANDARD};
                        ok_response(serde_json::json!(STANDARD.encode(&bytes)))
                    }
                    Err(e) => err_response(format!("Failed to read file: {}", e)),
                }
            }
        }
        "write_text_file_debug" => {
            let filename = req
                .args
                .get("filename")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let content = req
                .args
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match crate::cmd_impl::write_text_file_debug(&filename, &content) {
                Ok(path) => ok_response(serde_json::json!(path)),
                Err(e) => err_response(e),
            }
        }
        _ => err_response(format!("Unknown command: {}", req.cmd)),
    }
}

/// Extract a zip file into the profiles directory.
fn extract_zip_to_profiles(zip_path: &str, profiles_dir: &str) -> Result<String, String> {
    use std::io::Read;

    let source = std::path::Path::new(zip_path);
    let dest_dir = std::path::Path::new(profiles_dir);

    if !source.exists() || !source.is_file() {
        return Err("Zip file does not exist".to_string());
    }

    let stem = source
        .file_stem()
        .ok_or_else(|| "Invalid zip file name".to_string())?
        .to_str()
        .ok_or_else(|| "Invalid file name encoding".to_string())?;

    let extract_dir = dest_dir.join(stem);
    let mut final_dir = extract_dir.clone();
    let mut suffix = 1u32;
    while final_dir.exists() {
        final_dir = dest_dir.join(format!("{}_{}", stem, suffix));
        suffix += 1;
        if suffix > 100 {
            return Err("Too many collisions for folder name".to_string());
        }
    }

    std::fs::create_dir_all(&final_dir)
        .map_err(|e| format!("Failed to create extraction directory: {}", e))?;

    let file = std::fs::File::open(source)
        .map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;
        let entry_name = entry.name().to_string();
        if entry_name.contains("..") {
            continue;
        }
        let out_path = final_dir.join(&entry_name);
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create directory {}: {}", entry_name, e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {}", e))?;
            }
            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read zip entry {}: {}", entry_name, e))?;
            std::fs::write(&out_path, &buf)
                .map_err(|e| format!("Failed to write {}: {}", entry_name, e))?;
        }
    }

    final_dir
        .to_str()
        .ok_or_else(|| "Invalid path encoding".to_string())
        .map(|s| s.to_string())
}

/// Import a zip from base64-encoded data into the profiles directory.
fn import_zip_base64(data: &str, file_name: &str, profiles_dir: &str) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let bytes = STANDARD
        .decode(data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let local_data =
        dirs::data_local_dir().ok_or_else(|| "Cannot determine local data directory".to_string())?;
    let temp_dir = local_data
        .join("Endstate")
        .join("cache")
        .join("imports");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let temp_path = temp_dir.join(file_name);
    std::fs::write(&temp_path, &bytes)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    let result = extract_zip_to_profiles(
        temp_path.to_str().unwrap_or_default(),
        profiles_dir,
    );

    let _ = std::fs::remove_file(&temp_path);
    result
}

async fn handle_events(
    State(state): State<AppState>,
) -> Sse<impl tokio_stream::Stream<Item = Result<sse::Event, Infallible>>> {
    let rx = state.broadcaster.subscribe();
    let stream =
        BroadcastStream::new(rx).filter_map(|result: Result<String, _>| result.ok().map(|data| Ok::<_, Infallible>(sse::Event::default().data(data))));
    Sse::new(stream)
}

pub async fn start(
    app: tauri::AppHandle,
    run_state: SharedRunState,
    broadcaster: EventBroadcaster,
) -> Result<(), Box<dyn std::error::Error>> {
    let state = AppState {
        run_state,
        broadcaster,
        app,
    };

    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        .route("/api/invoke", post(handle_invoke))
        .route("/events", get(handle_events))
        .layer(cors)
        .with_state(state);

    let listener = match tokio::net::TcpListener::bind("127.0.0.1:9876").await {
        Ok(l) => l,
        Err(e) => {
            eprintln!(
                "Browser bridge failed to bind port 9876: {}. Continuing without bridge.",
                e
            );
            return Ok(());
        }
    };
    eprintln!("Browser bridge listening on http://127.0.0.1:9876");
    axum::serve(listener, app).await?;
    Ok(())
}
