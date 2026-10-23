//! Dev-only HTTP server for browser-based engine access.
//!
//! Mirrors the app's IPC commands as REST endpoints so a browser tab pointed at
//! the Vite dev server can call engine functions without Tauri IPC. Runs in the
//! standalone `endstate-dev-bridge` binary — which links NONE of the native GUI
//! stack (no tauri/tao/wry/webview2-com), so the intermittent WebView2-layer
//! heap corruption that plagued the in-process bridge cannot occur here.
//!
//! Routes + port (127.0.0.1:9876) + response shapes are byte-compatible with the
//! old in-process bridge; callers now authenticate with the private launch session.

use axum::{
    extract::{DefaultBodyLimit, Request, State},
    http::{header, HeaderMap, Method, StatusCode},
    middleware::{self, Next},
    response::sse::{self, Sse},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::future::IntoFuture;
use std::io::{BufRead, BufReader, Write};
use std::process::Stdio;
use std::sync::atomic::Ordering;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use tower_http::cors::CorsLayer;

use crate::broadcast::EventBroadcaster;
use crate::engine::{
    create_cancelled_result, create_fallback_result, extract_command_name_pub, generate_run_id,
    inject_run_id, is_result_event, parse_line, parse_line_with_run_id, SharedRunState,
};

/// Shared state for the HTTP server (Tauri-free; no AppHandle).
#[derive(Clone)]
pub struct AppState {
    pub run_state: SharedRunState,
    pub broadcaster: EventBroadcaster,
}

impl AppState {
    pub fn new(run_state: SharedRunState, broadcaster: EventBroadcaster) -> Self {
        Self {
            run_state,
            broadcaster,
        }
    }
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
        match crate::engine::build_bundled_command(args) {
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
        crate::cmd::build_engine_command(exe, args)
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
    exe: &str,
    args: &[String],
    event_channel: &str,
    broadcaster: &EventBroadcaster,
) -> Result<(), String> {
    let mut cmd = if exe == "__bundled__" {
        crate::engine::build_bundled_command(args)
            .map_err(|e| format!("{}: {}", e.code, e.message))?
    } else {
        crate::cmd::build_engine_command(exe, args)
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
            match tokio::task::spawn_blocking(move || crate::engine::is_run_active(&run_state))
                .await
            {
                Ok(result) => ok_response(serde_json::json!(result)),
                Err(e) => err_response(format!("Task error: {}", e)),
            }
        }
        "engine_get_run_id" => {
            let run_state = state.run_state.clone();
            match tokio::task::spawn_blocking(move || crate::engine::get_current_run_id(&run_state))
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

            match tokio::task::spawn_blocking(move || {
                run_engine_http(&exe, &args, &run_state, &broadcaster)
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
            match tokio::task::spawn_blocking(move || cancel_engine_http(&run_state, &broadcaster))
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

            match tokio::task::spawn_blocking(move || {
                run_streaming_http(&exe, &args, &event_channel, &broadcaster)
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

            match tokio::task::spawn_blocking(move || {
                use std::io::Write as _;
                use std::process::Stdio;

                let mut cmd = if exe == "__bundled__" {
                    match crate::engine::build_bundled_command(&args) {
                        Ok(c) => c,
                        Err(e) => {
                            return Err(crate::cmd::ExecError {
                                code: e.code,
                                message: e.message,
                            });
                        }
                    }
                } else {
                    crate::cmd::build_engine_command(&exe, &args)
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
                Ok(crate::cmd::ExecResult {
                    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    exit_code: output.status.code().unwrap_or(-1),
                })
            })
            .await
            {
                Ok(Ok(result)) => ok_response(serde_json::to_value(result).unwrap_or_default()),
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
            match crate::cmd::validate_profile(&path) {
                Ok(result) => ok_response(serde_json::to_value(result).unwrap_or_default()),
                Err(e) => err_response(e),
            }
        }
        "discover_sync_folders" => {
            ok_response(serde_json::json!(crate::storage::discover_sync_folders()))
        }
        "save_profile" => {
            let Some(path) = req.args.get("path").and_then(|v| v.as_str()) else {
                return err_response("Missing path");
            };
            let Some(content) = req.args.get("content").and_then(|v| v.as_str()) else {
                return err_response("Missing content");
            };
            let Some(create_new) = req.args.get("createNew").and_then(|v| v.as_bool()) else {
                return err_response("Missing createNew");
            };
            match crate::storage::save_profile(
                path,
                content,
                req.args.get("metadata").and_then(|v| v.as_str()),
                create_new,
            ) {
                Ok(()) => ok_response(serde_json::json!(null)),
                Err(e) => err_response(e),
            }
        }
        "list_manifest_files" => {
            let directory = req
                .args
                .get("directory")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let include_availability = req
                .args
                .get("includeAvailability")
                .and_then(|v| v.as_bool())
                == Some(true);
            match crate::storage::list_manifest_files_value(directory, include_availability) {
                Ok(entries) => ok_response(entries),
                Err(e) => err_response(e),
            }
        }
        "get_default_profiles_directory" => match crate::cmd::get_default_profiles_directory() {
            Ok(dir) => ok_response(serde_json::json!(dir)),
            Err(e) => err_response(e),
        },
        "get_capture_cache_directory" => match crate::cmd::get_capture_cache_directory() {
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
            match crate::cmd::check_file_exists(&path) {
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
            match crate::cmd::read_text_file(&path) {
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
            match crate::cmd::write_text_file(&path, &content) {
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
            match crate::cmd::delete_file(&path) {
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
            match crate::cmd::delete_file_silent(&path) {
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
            match crate::cmd::rename_file(&old_path, &new_path) {
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
            match crate::cmd::copy_file(&source_path, &dest_path) {
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
            match crate::cmd::ensure_dir(&path) {
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
            match crate::cmd::import_profile(&source_path, &profiles_dir) {
                Ok(path) => ok_response(serde_json::json!(path)),
                Err(e) => err_response(e),
            }
        }
        "import_profile_text" => {
            let content = req
                .args
                .get("content")
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
            match crate::cmd::import_profile_text(&content, &file_name, &profiles_dir) {
                Ok(path) => ok_response(serde_json::json!(path)),
                Err(e) => err_response(e),
            }
        }
        "show_file_dialog" => match crate::cmd::show_file_dialog() {
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
            match crate::cmd::open_folder(&path) {
                Ok(()) => ok_response(serde_json::json!(null)),
                Err(e) => err_response(e),
            }
        }
        "cleanup_capture_cache" => match crate::cmd::cleanup_capture_cache() {
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
            match crate::cmd::extract_zip_profile(&zip_path, &profiles_dir) {
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
            match crate::cmd::import_zip_from_base64(&data, &file_name, &profiles_dir) {
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
                        use base64::{engine::general_purpose::STANDARD, Engine as _};
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
            match crate::cmd::write_text_file_debug(&filename, &content) {
                Ok(path) => ok_response(serde_json::json!(path)),
                Err(e) => err_response(e),
            }
        }
        _ => err_response(format!("Unknown command: {}", req.cmd)),
    }
}

async fn handle_events(
    State(state): State<AppState>,
) -> Sse<impl tokio_stream::Stream<Item = Result<sse::Event, Infallible>>> {
    let rx = state.broadcaster.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|result: Result<String, _>| {
        result
            .ok()
            .map(|data| Ok::<_, Infallible>(sse::Event::default().data(data)))
    });
    Sse::new(stream)
}

/// Maximum accepted request-body size for the bridge, in bytes.
///
/// Profile imports arrive as base64-encoded zip bytes inside the JSON body
/// (`import_zip_from_base64`). A ~2.7 MB capture bundle base64-encodes to
/// ~3.6 MB, which blows past axum's 2 MB `DefaultBodyLimit` and gets rejected
/// with a 413 *before* `handle_invoke` runs — the frontend then surfaces a raw
/// "Payload Too Large" (or, in the pure-web fallback, silently no-ops), so a
/// real bundle import fails while a tiny one succeeds. 64 MB comfortably covers
/// realistic bundles. (Dev/automation bridge only; loopback-bound.)
const MAX_BODY_BYTES: usize = 64 * 1024 * 1024;

/// Private launch descriptor. Endpoints and token format are a versioned protocol.
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BridgeSession {
    version: u8,
    frontend_origin: String,
    bridge_url: String,
    bearer: String,
}

impl BridgeSession {
    pub fn load(path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error>> {
        let metadata = std::fs::symlink_metadata(path)?;
        if !metadata.is_file() || metadata.len() > 4096 {
            return Err("Invalid private session descriptor".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            let parent =
                std::fs::symlink_metadata(path.parent().ok_or("Missing session directory")?)?;
            if !parent.is_dir()
                || parent.mode() & 0o777 != 0o700
                || metadata.mode() & 0o777 != 0o600
                || parent.uid() != metadata.uid()
            {
                return Err("Unsafe private session descriptor permissions".into());
            }
        }
        let session: Self = serde_json::from_slice(&std::fs::read(path)?)?;
        let protocol: serde_json::Value =
            serde_json::from_str(include_str!("../../../src/lib/bridge-protocol.json"))?;
        if Some(u64::from(session.version)) != protocol["version"].as_u64()
            || Some(session.frontend_origin.as_str()) != protocol["frontendOrigin"].as_str()
            || Some(session.bridge_url.as_str()) != protocol["bridgeUrl"].as_str()
            || session.bearer.len() != 64
            || !session
                .bearer
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err("Invalid private session descriptor".into());
        }
        Ok(session)
    }
}

fn single_header<'a>(headers: &'a HeaderMap, name: &str) -> Result<Option<&'a str>, StatusCode> {
    let mut values = headers.get_all(name).iter();
    let first = values.next();
    if values.next().is_some() {
        return Err(StatusCode::FORBIDDEN);
    }
    first
        .map(|v| v.to_str().map_err(|_| StatusCode::FORBIDDEN))
        .transpose()
}

async fn validate_request_identity(
    State(session): State<BridgeSession>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let host = single_header(request.headers(), "host")?;
    single_header(request.headers(), "authorization")?;
    let expected_authority = session
        .bridge_url
        .strip_prefix("http://")
        .expect("validated URL");
    let authority = request.uri().authority().map(|a| a.as_str());
    if host.is_none() && authority.is_none()
        || host.is_some_and(|h| h != expected_authority)
        || authority.is_some_and(|a| a != expected_authority)
    {
        return Err(StatusCode::FORBIDDEN);
    }
    if single_header(request.headers(), "origin")?.is_some_and(|o| o != session.frontend_origin) {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(next.run(request).await)
}

async fn authenticate(
    State(session): State<BridgeSession>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let authorization =
        single_header(request.headers(), "authorization")?.ok_or(StatusCode::UNAUTHORIZED)?;
    let expected = format!("Bearer {}", session.bearer);
    use subtle::ConstantTimeEq;
    if !bool::from(authorization.as_bytes().ct_eq(expected.as_bytes())) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(next.run(request).await)
}

fn build_router(state: AppState, session: BridgeSession) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(
            session
                .frontend_origin
                .parse::<axum::http::HeaderValue>()
                .expect("validated origin"),
        )
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);
    Router::new()
        .route("/api/invoke", post(handle_invoke))
        .route("/events", get(handle_events))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(middleware::from_fn_with_state(
            session.clone(),
            authenticate,
        ))
        .layer(cors)
        .layer(middleware::from_fn_with_state(
            session,
            validate_request_identity,
        ))
        .with_state(state)
}

/// Binding and readiness use a private pipe; EOF revokes the listener immediately.
pub async fn start(
    state: AppState,
    session: BridgeSession,
) -> Result<(), Box<dyn std::error::Error>> {
    let authority = session
        .bridge_url
        .strip_prefix("http://")
        .ok_or("Invalid bridge URL")?;
    let listener = tokio::net::TcpListener::bind(authority).await?;
    println!("ENDSTATE_BRIDGE_BOUND_V1");
    std::io::stdout().flush()?;
    let (lost_parent, parent_lost) = tokio::sync::oneshot::channel();
    std::thread::spawn(move || {
        let mut byte = [0u8];
        let _ = std::io::Read::read(&mut std::io::stdin(), &mut byte);
        let _ = lost_parent.send(());
    });
    tokio::select! {
        result = axum::serve(listener, build_router(state, session)).into_future() => { result?; }
        _ = parent_lost => {}
    }
    // No graceful drain: existing SSE streams must also lose launch authority.
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use tower::ServiceExt; // for `oneshot`

    fn test_state() -> AppState {
        AppState::new(
            crate::engine::create_run_state(),
            crate::broadcast::EventBroadcaster::new(),
        )
    }

    fn test_session() -> BridgeSession {
        BridgeSession {
            version: 1,
            frontend_origin: "http://127.0.0.1:1420".into(),
            bridge_url: "http://127.0.0.1:9876".into(),
            bearer: "ab".repeat(32),
        }
    }

    #[tokio::test]
    async fn authentication_precedes_body_parsing_and_wraps_cors_errors() {
        for credential in [None, Some("Bearer wrong")] {
            let mut request = Request::builder()
                .method("POST")
                .uri("/api/invoke")
                .header("host", "127.0.0.1:9876")
                .header("origin", "http://127.0.0.1:1420")
                .header("content-type", "application/json");
            if let Some(value) = credential {
                request = request.header("authorization", value);
            }
            let response = build_router(test_state(), test_session())
                .oneshot(request.body(Body::from("invalid json")).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
            assert_eq!(
                response.headers()["access-control-allow-origin"],
                "http://127.0.0.1:1420"
            );
        }
    }

    #[tokio::test]
    async fn rejects_untrusted_and_duplicate_request_identity() {
        for (header, value) in [
            ("host", "other.local:9876"),
            ("host", "127.0.0.1:9876"),
            ("origin", "null"),
            ("origin", "http://other.local"),
            ("origin", "http://127.0.0.1:1420"),
            ("authorization", "Bearer wrong"),
            ("authorization", "Bearer ab"),
        ] {
            let request = Request::builder()
                .uri("/events")
                .header("host", "127.0.0.1:9876")
                .header("origin", "http://127.0.0.1:1420")
                .header("authorization", format!("Bearer {}", test_session().bearer))
                .header(header, value)
                .body(Body::empty())
                .unwrap();
            let response = build_router(test_state(), test_session())
                .oneshot(request)
                .await
                .unwrap();
            assert!(
                response.status().is_client_error(),
                "{header} must be refused"
            );
        }
        let request = Request::builder()
            .uri("http://other.local:9876/events")
            .header("forwarded", "host=127.0.0.1:9876")
            .header("x-forwarded-host", "127.0.0.1:9876")
            .header("host", "127.0.0.1:9876")
            .header("authorization", format!("Bearer {}", test_session().bearer))
            .body(Body::empty())
            .unwrap();
        assert_eq!(
            build_router(test_state(), test_session())
                .oneshot(request)
                .await
                .unwrap()
                .status(),
            StatusCode::FORBIDDEN
        );
    }

    #[tokio::test]
    async fn accepts_script_events_and_browser_preflight_without_granting_invoke() {
        let request = Request::builder()
            .uri("/events")
            .header("host", "127.0.0.1:9876")
            .header("authorization", format!("Bearer {}", test_session().bearer))
            .body(Body::empty())
            .unwrap();
        assert_eq!(
            build_router(test_state(), test_session())
                .oneshot(request)
                .await
                .unwrap()
                .status(),
            StatusCode::OK
        );
        for origin in ["http://127.0.0.1:1420", "null"] {
            let request = Request::builder()
                .method("OPTIONS")
                .uri("/api/invoke")
                .header("host", "127.0.0.1:9876")
                .header("origin", origin)
                .header("access-control-request-method", "POST")
                .header(
                    "access-control-request-headers",
                    "authorization,content-type",
                )
                .body(Body::empty())
                .unwrap();
            let response = build_router(test_state(), test_session())
                .oneshot(request)
                .await
                .unwrap();
            assert_eq!(
                response.status(),
                if origin == "null" {
                    StatusCode::FORBIDDEN
                } else {
                    StatusCode::OK
                }
            );
        }
    }

    /// Regression: a JSON body larger than axum's 2 MB `DefaultBodyLimit` must
    /// be accepted (not rejected with 413). This is the mechanism behind the
    /// silent large-bundle import failure — a ~2.7 MB capture zip base64-encodes
    /// past 2 MB and was dropped before the handler ran.
    #[tokio::test]
    async fn accepts_body_larger_than_axum_default_limit() {
        let app = build_router(test_state(), test_session());

        // 3 MB of padding — over the 2 MB default, well under our 64 MB cap.
        let padding = "a".repeat(3 * 1024 * 1024);
        let body = format!(
            r#"{{"cmd":"engine_is_running","args":{{"pad":"{}"}}}}"#,
            padding
        );

        let req = Request::builder()
            .method("POST")
            .uri("/api/invoke")
            .header("host", "127.0.0.1:9876")
            .header("authorization", format!("Bearer {}", test_session().bearer))
            .header("content-type", "application/json")
            .body(Body::from(body))
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();

        // Before the fix this returned 413 PAYLOAD_TOO_LARGE.
        assert_ne!(
            resp.status(),
            StatusCode::PAYLOAD_TOO_LARGE,
            "large body should not be rejected by the body limit"
        );
        assert_eq!(resp.status(), StatusCode::OK);

        let bytes = resp.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["ok"], serde_json::json!(true));
    }
}
