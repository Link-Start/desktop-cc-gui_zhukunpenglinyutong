//! Grok engine implementation
//!
//! Handles Grok CLI execution via:
//! - text-only:
//!   `grok -p "<prompt>" --output-format streaming-json --always-approve [-m <model>] (-s|-r)`
//! - multimodal (images):
//!   `grok --prompt-json '<ACP content blocks>' --output-format streaming-json ...`
//!
//! `--prompt-json` accepts ACP content blocks. Image blocks are:
//! `{ "type": "image", "mimeType": "image/png", "data": "<base64>" }`
//! (verified against grok 0.2.114 schema; text-only keeps the legacy `-p` path).
//!
//! Grok's `streaming-json` output is NDJSON on stdout with four event shapes:
//! - `{"type":"text","data":"..."}` — assistant text delta (true deltas, append)
//! - `{"type":"thought","data":"..."}` — reasoning delta
//! - `{"type":"end","stopReason":"...","sessionId":"...","usage":{...},...}` — always last
//! - `{"type":"error","message":"..."}` — error
//!
//! In headless mode Grok runs with `--always-approve`, so no approval events exist.
//! The protocol exposes no tool-call events. Session identity is decided by the
//! backend up front: new sessions get a caller-generated UUID via `-s`, existing
//! sessions resume via `-r`.

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{broadcast, Mutex, RwLock};

use super::cli_image_input::{collect_non_empty_image_paths, normalize_local_image_path};
use super::events::EngineEvent;
use super::{EngineConfig, EngineType, SendMessageParams};

/// Soft per-image cap. CLI still needs the whole `--prompt-json` on argv, so the
/// practical limit is far below xAI's theoretical 20MiB vision cap.
const GROK_MAX_IMAGE_BYTES: u64 = 2 * 1024 * 1024;
/// Leave headroom under macOS/Linux `ARG_MAX` for other process args/env.
const GROK_MAX_PROMPT_JSON_BYTES: usize = 700_000;

/// Build ACP content blocks for `grok --prompt-json`.
///
/// Returns `None` when there are no non-empty image attachments so callers can
/// keep the lighter `-p` text path. Returns `Err` when the user attached images
/// but none could be materialised (bad path / oversized / unreadable).
pub(crate) fn build_grok_prompt_json(
    text: &str,
    images: Option<&[String]>,
    workspace_path: &Path,
) -> Result<Option<String>, String> {
    let image_paths = collect_non_empty_image_paths(images);
    if image_paths.is_empty() {
        return Ok(None);
    }

    let mut blocks: Vec<Value> = Vec::new();
    if !text.trim().is_empty() {
        blocks.push(json!({
            "type": "text",
            "text": text,
        }));
    }

    let mut loaded = 0usize;
    let mut errors: Vec<String> = Vec::new();
    for raw in image_paths {
        match load_image_as_grok_block(&raw, workspace_path) {
            Ok(block) => {
                blocks.push(block);
                loaded += 1;
            }
            Err(error) => errors.push(format!("{raw}: {error}")),
        }
    }

    if loaded == 0 {
        return Err(format!(
            "Grok image input failed: none of the attached images could be loaded ({})",
            errors.join("; ")
        ));
    }
    if !errors.is_empty() {
        log::warn!(
            "[grok] partial image load: {} ok, {} failed ({})",
            loaded,
            errors.len(),
            errors.join("; ")
        );
    }

    // Grok requires at least one content block; if the user only attached images
    // with empty text, keep a minimal text block so the payload stays valid.
    if blocks
        .iter()
        .all(|block| block.get("type").and_then(Value::as_str) != Some("text"))
    {
        blocks.insert(
            0,
            json!({
                "type": "text",
                "text": "Please analyze the attached image(s).",
            }),
        );
    }

    let encoded = serde_json::to_string(&blocks)
        .map_err(|error| format!("Failed to serialize Grok prompt-json: {error}"))?;
    if encoded.len() > GROK_MAX_PROMPT_JSON_BYTES {
        return Err(format!(
            "Grok image payload is too large for CLI argv ({} bytes > {} limit). Use fewer or smaller images.",
            encoded.len(),
            GROK_MAX_PROMPT_JSON_BYTES
        ));
    }
    Ok(Some(encoded))
}

fn load_image_as_grok_block(raw: &str, workspace_path: &Path) -> Result<Value, String> {
    if let Some(block) = try_load_data_url_image(raw) {
        return block;
    }
    let path = normalize_local_image_path(raw)?;
    let path = if path.is_absolute() {
        path
    } else {
        workspace_path.join(path)
    };
    let metadata = std::fs::metadata(&path).map_err(|error| format!("stat failed: {error}"))?;
    if !metadata.is_file() {
        return Err("not a regular file".to_string());
    }
    if metadata.len() > GROK_MAX_IMAGE_BYTES {
        return Err(format!(
            "exceeds {} byte limit ({})",
            GROK_MAX_IMAGE_BYTES,
            metadata.len()
        ));
    }
    let bytes = std::fs::read(&path).map_err(|error| format!("read failed: {error}"))?;
    let mime = mime_type_for_image_path(&path).unwrap_or("image/png");
    Ok(json!({
        "type": "image",
        "mimeType": mime,
        "data": BASE64_STANDARD.encode(bytes),
    }))
}

fn try_load_data_url_image(raw: &str) -> Option<Result<Value, String>> {
    let lower = raw.get(..5)?.to_ascii_lowercase();
    if lower != "data:" {
        return None;
    }
    let rest = &raw[5..];
    let (meta, payload) = rest.split_once(",")?;
    if !meta.to_ascii_lowercase().contains(";base64") {
        return Some(Err("data URL must be base64".to_string()));
    }
    let mime = meta
        .split(';')
        .next()
        .map(str::trim)
        .filter(|value| value.starts_with("image/"))
        .unwrap_or("image/png");
    let encoded_payload = payload.trim();
    let max_encoded_bytes = GROK_MAX_IMAGE_BYTES
        .saturating_add(2)
        .saturating_div(3)
        .saturating_mul(4) as usize;
    if encoded_payload.len() > max_encoded_bytes {
        return Some(Err(format!(
            "data URL exceeds {} byte decoded-image limit",
            GROK_MAX_IMAGE_BYTES
        )));
    }
    let decoded = BASE64_STANDARD
        .decode(encoded_payload)
        .map_err(|error| format!("invalid base64 data URL: {error}"));
    Some(decoded.and_then(|bytes| {
        if bytes.len() as u64 > GROK_MAX_IMAGE_BYTES {
            return Err(format!(
                "data URL exceeds {} byte decoded-image limit",
                GROK_MAX_IMAGE_BYTES
            ));
        }
        Ok(json!({
            "type": "image",
            "mimeType": mime,
            "data": BASE64_STANDARD.encode(bytes),
        }))
    }))
}

fn mime_type_for_image_path(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    match ext.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "bmp" => Some("image/bmp"),
        _ => None,
    }
}

pub fn resolve_grok_session_id_for_engine_send(
    continue_session: bool,
    explicit_session_id: Option<String>,
    tracked_session_id: Option<String>,
) -> Option<String> {
    continue_session
        .then(|| explicit_session_id.or(tracked_session_id))
        .flatten()
}

#[derive(Debug, Clone)]
pub struct GrokTurnEvent {
    pub turn_id: String,
    pub event: EngineEvent,
}

/// Grok session for a workspace
pub struct GrokSession {
    pub workspace_id: String,
    pub workspace_path: PathBuf,
    session_id: RwLock<Option<String>>,
    event_sender: broadcast::Sender<GrokTurnEvent>,
    bin_path: Option<String>,
    home_dir: Option<String>,
    custom_args: Option<String>,
    active_processes: Mutex<HashMap<String, ActiveGrokChildProcess>>,
    interrupted_turns: Mutex<HashSet<String>>,
}

#[allow(dead_code)]
pub struct GrokActiveProcessSnapshot {
    pub pid: u32,
    pub registered_age_ms: u64,
}

struct ActiveGrokChildProcess {
    child: Child,
    #[allow(dead_code)]
    started_at_ms: u64,
}

impl ActiveGrokChildProcess {
    fn new(child: Child) -> Self {
        Self {
            child,
            started_at_ms: unix_timestamp_ms_for_process_diagnostics(),
        }
    }

    fn into_child(self) -> Child {
        self.child
    }

    #[allow(dead_code)]
    fn snapshot(&self, sampled_at_ms: u64) -> Option<GrokActiveProcessSnapshot> {
        Some(GrokActiveProcessSnapshot {
            pid: self.child.id()?,
            registered_age_ms: sampled_at_ms.saturating_sub(self.started_at_ms),
        })
    }
}

fn apply_interrupt_result(
    active_processes: &mut HashMap<String, ActiveGrokChildProcess>,
    interrupted_turns: &mut HashSet<String>,
    turn_id: &str,
    kill_result: Result<(), String>,
) -> Result<(), String> {
    kill_result?;
    interrupted_turns.insert(turn_id.to_string());
    active_processes.remove(turn_id);
    Ok(())
}

fn unix_timestamp_ms_for_process_diagnostics() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// Parsed representation of one Grok streaming-json stdout line.
enum GrokStreamLine {
    TextDelta(String),
    ReasoningDelta(String),
    End {
        session_id: Option<String>,
        usage: Option<Value>,
    },
    StreamError(String),
    Other,
}

/// Parse a single NDJSON line from `grok -p --output-format streaming-json`.
fn parse_grok_stream_line(value: &Value) -> GrokStreamLine {
    let event_type = value.get("type").and_then(|v| v.as_str()).unwrap_or("");
    match event_type {
        "text" => value
            .get("data")
            .and_then(|v| v.as_str())
            .filter(|text| !text.is_empty())
            .map(|text| GrokStreamLine::TextDelta(text.to_string()))
            .unwrap_or(GrokStreamLine::Other),
        "thought" => value
            .get("data")
            .and_then(|v| v.as_str())
            .filter(|text| !text.is_empty())
            .map(|text| GrokStreamLine::ReasoningDelta(text.to_string()))
            .unwrap_or(GrokStreamLine::Other),
        "end" => {
            let session_id = value
                .get("sessionId")
                .and_then(|v| v.as_str())
                .map(|id| id.trim().to_string())
                .filter(|id| !id.is_empty());
            let usage = value.get("usage").cloned();
            GrokStreamLine::End { session_id, usage }
        }
        "error" => value
            .get("message")
            .and_then(|v| v.as_str())
            .map(|message| message.trim().to_string())
            .filter(|message| !message.is_empty())
            .map(GrokStreamLine::StreamError)
            .unwrap_or(GrokStreamLine::Other),
        _ => GrokStreamLine::Other,
    }
}

impl GrokSession {
    pub fn new(
        workspace_id: String,
        workspace_path: PathBuf,
        config: Option<EngineConfig>,
    ) -> Self {
        let (event_sender, _) = broadcast::channel(1024);
        let config = config.unwrap_or_default();
        Self {
            workspace_id,
            workspace_path,
            session_id: RwLock::new(None),
            event_sender,
            bin_path: config.bin_path,
            home_dir: config.home_dir,
            custom_args: config.custom_args,
            active_processes: Mutex::new(HashMap::new()),
            interrupted_turns: Mutex::new(HashSet::new()),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<GrokTurnEvent> {
        self.event_sender.subscribe()
    }

    pub async fn get_session_id(&self) -> Option<String> {
        self.session_id.read().await.clone()
    }

    async fn set_session_id(&self, id: Option<String>) {
        *self.session_id.write().await = id;
    }

    fn emit_turn_event(&self, turn_id: &str, event: EngineEvent) {
        let _ = self.event_sender.send(GrokTurnEvent {
            turn_id: turn_id.to_string(),
            event,
        });
    }

    pub fn emit_error(&self, turn_id: &str, error: String) {
        self.emit_turn_event(
            turn_id,
            EngineEvent::TurnError {
                workspace_id: self.workspace_id.clone(),
                error,
                code: None,
            },
        );
    }

    fn build_command(
        &self,
        params: &SendMessageParams,
        canonical_session_id: &str,
        resume_session: bool,
    ) -> Result<Command, String> {
        let bin = if let Some(ref custom) = self.bin_path {
            custom.clone()
        } else {
            crate::backend::app_server::find_cli_binary("grok", None)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| "grok".to_string())
        };

        let mut cmd = crate::backend::app_server::build_command_for_binary(&bin);
        cmd.current_dir(&self.workspace_path);
        cmd.arg("--output-format");
        cmd.arg("streaming-json");
        cmd.arg("--always-approve");

        if let Some(model) = params
            .model
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            cmd.arg("-m");
            cmd.arg(model);
        }

        // `-s` creates a NEW session with a caller-chosen UUID and errors if the
        // id already exists; `-r` resumes an existing session. Never pass both,
        // and never pass `-s` when continuing.
        if resume_session {
            cmd.arg("-r");
            cmd.arg(canonical_session_id);
        } else {
            cmd.arg("-s");
            cmd.arg(canonical_session_id);
        }

        if let Some(args) = self.custom_args.as_ref() {
            for arg in args.split_whitespace() {
                cmd.arg(arg);
            }
        }

        // Multimodal: ACP content blocks via --prompt-json.
        // Text-only keeps legacy -p for smaller argv and identical behaviour.
        match build_grok_prompt_json(&params.text, params.images.as_deref(), &self.workspace_path)?
        {
            Some(prompt_json) => {
                cmd.arg("--prompt-json");
                cmd.arg(prompt_json);
            }
            None => {
                let safe_text = if params.text.starts_with('-') {
                    format!(" {}", params.text)
                } else {
                    params.text.clone()
                };
                cmd.arg("-p");
                cmd.arg(&safe_text);
            }
        }

        // Grok 0.2.111 has no `--no-auto-update` flag; disable via env.
        cmd.env("GROK_DISABLE_AUTOUPDATER", "1");
        if let Some(home) = self.home_dir.as_ref() {
            cmd.env("GROK_HOME", home);
        }

        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        Ok(cmd)
    }

    pub async fn send_message(
        &self,
        params: SendMessageParams,
        turn_id: &str,
    ) -> Result<String, String> {
        let turn_started_at = std::time::Instant::now();
        let requested_model = params
            .model
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or("<auto>");
        let resume_session_id = if params.continue_session {
            params
                .session_id
                .as_ref()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
        } else {
            None
        };
        // Canonical session identity is known up front: resume uses the existing
        // id, new sessions get a backend-generated UUID passed via `-s`.
        let (canonical_session_id, resume_session) = match resume_session_id {
            Some(session_id) => (session_id.to_string(), true),
            None => (uuid::Uuid::new_v4().to_string(), false),
        };
        log::info!(
            "[grok/send] turn={} workspace={} model={} continue_session={} resume_session_id_len={}",
            turn_id,
            self.workspace_id,
            requested_model,
            params.continue_session,
            resume_session_id.map(|value| value.len()).unwrap_or(0),
        );

        let mut command = match self.build_command(&params, &canonical_session_id, resume_session) {
            Ok(command) => command,
            Err(error) => {
                let error_msg = format!("Failed to build grok command: {}", error);
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        };
        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(error) => {
                let error_msg = format!("Failed to spawn grok: {}", error);
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        };
        let spawn_ms = turn_started_at.elapsed().as_millis();

        let stdout = match child.stdout.take() {
            Some(stdout) => stdout,
            None => {
                let error_msg = "Failed to capture stdout".to_string();
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        };
        let stderr = match child.stderr.take() {
            Some(stderr) => stderr,
            None => {
                let error_msg = "Failed to capture stderr".to_string();
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        };

        {
            let mut active = self.active_processes.lock().await;
            active.insert(turn_id.to_string(), ActiveGrokChildProcess::new(child));
        }

        self.set_session_id(Some(canonical_session_id.clone()))
            .await;
        self.emit_turn_event(
            turn_id,
            EngineEvent::SessionStarted {
                workspace_id: self.workspace_id.clone(),
                session_id: canonical_session_id.clone(),
                engine: EngineType::Grok,
                turn_id: Some(turn_id.to_string()),
            },
        );
        self.emit_turn_event(
            turn_id,
            EngineEvent::TurnStarted {
                workspace_id: self.workspace_id.clone(),
                turn_id: turn_id.to_string(),
            },
        );

        let stderr_reader = BufReader::new(stderr);
        let stderr_task = tokio::spawn(async move {
            let mut lines = stderr_reader.lines();
            let mut text = String::new();
            while let Ok(Some(line)) = lines.next_line().await {
                text.push_str(&line);
                text.push('\n');
            }
            text
        });

        let mut response_text = String::new();
        let mut error_output = String::new();
        let mut stream_error: Option<String> = None;
        let mut end_usage: Option<Value> = None;
        let mut first_stdout_line_ms: Option<u128> = None;
        let mut stdout_line_count: usize = 0;

        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let line = line.trim().to_string();
            if line.is_empty() {
                continue;
            }
            stdout_line_count += 1;
            if first_stdout_line_ms.is_none() {
                first_stdout_line_ms = Some(turn_started_at.elapsed().as_millis());
            }
            match serde_json::from_str::<Value>(&line) {
                Ok(event) => match parse_grok_stream_line(&event) {
                    GrokStreamLine::TextDelta(text) => {
                        response_text.push_str(&text);
                        self.emit_turn_event(
                            turn_id,
                            EngineEvent::TextDelta {
                                workspace_id: self.workspace_id.clone(),
                                text,
                            },
                        );
                    }
                    GrokStreamLine::ReasoningDelta(text) => {
                        self.emit_turn_event(
                            turn_id,
                            EngineEvent::ReasoningDelta {
                                workspace_id: self.workspace_id.clone(),
                                text,
                            },
                        );
                    }
                    GrokStreamLine::End { session_id, usage } => {
                        if let Some(session_id) = session_id {
                            if session_id != canonical_session_id {
                                log::warn!(
                                    "[grok/send] turn={} end.sessionId mismatch: canonical={} end={}; keeping canonical",
                                    turn_id,
                                    canonical_session_id,
                                    session_id,
                                );
                            }
                        }
                        if usage.is_some() {
                            end_usage = usage;
                        }
                    }
                    GrokStreamLine::StreamError(message) => {
                        if stream_error.is_none() {
                            stream_error = Some(message);
                        }
                    }
                    GrokStreamLine::Other => {}
                },
                Err(_) => {
                    error_output.push_str(&line);
                    error_output.push('\n');
                }
            }
        }
        let stdout_eof_ms = turn_started_at.elapsed().as_millis();

        let mut child = {
            let mut active = self.active_processes.lock().await;
            active
                .remove(turn_id)
                .map(ActiveGrokChildProcess::into_child)
        };
        let status = if let Some(mut process) = child.take() {
            process.wait().await.ok()
        } else {
            None
        };
        let stderr_text = stderr_task.await.unwrap_or_default();
        if !stderr_text.trim().is_empty() {
            error_output.push_str(&stderr_text);
        }
        let completed_ms = turn_started_at.elapsed().as_millis();
        let status_success = status.as_ref().is_some_and(|value| value.success());
        log::info!(
            "[grok/send][timing] turn={} spawn_ms={} first_stdout_line_ms={:?} stdout_eof_ms={} completed_ms={} stdout_lines={} status_success={} response_chars={} stderr_chars={}",
            turn_id,
            spawn_ms,
            first_stdout_line_ms,
            stdout_eof_ms,
            completed_ms,
            stdout_line_count,
            status_success,
            response_text.chars().count(),
            error_output.chars().count(),
        );

        let was_interrupted = self.interrupted_turns.lock().await.remove(turn_id);
        if let Some(status) = status {
            if !status.success() {
                let error_msg = if was_interrupted || matches!(status.code(), Some(130) | Some(143))
                {
                    "Session stopped.".to_string()
                } else if let Some(stream_error) = stream_error.clone() {
                    stream_error
                } else if !error_output.trim().is_empty() {
                    error_output.trim().to_string()
                } else {
                    format!("Grok exited with status: {}", status)
                };
                self.emit_error(turn_id, error_msg.clone());
                return Err(error_msg);
            }
        } else if was_interrupted {
            let error_msg = "Session stopped.".to_string();
            self.emit_error(turn_id, error_msg.clone());
            return Err(error_msg);
        }

        if let Some(stream_error) = stream_error {
            self.emit_error(turn_id, stream_error.clone());
            return Err(stream_error);
        }

        if response_text.trim().is_empty() && !error_output.trim().is_empty() {
            let error_msg = error_output.trim().to_string();
            self.emit_error(turn_id, error_msg.clone());
            return Err(error_msg);
        }

        if response_text.trim().is_empty() {
            let diagnostic = "Grok exited without assistant output.".to_string();
            self.emit_error(turn_id, diagnostic.clone());
            return Err(diagnostic);
        }

        let mut result = json!({
            "text": response_text,
        });
        if let Some(usage) = end_usage {
            result["usage"] = usage;
        }
        self.emit_turn_event(
            turn_id,
            EngineEvent::TurnCompleted {
                workspace_id: self.workspace_id.clone(),
                result: Some(result),
            },
        );

        Ok(response_text)
    }

    pub async fn interrupt(&self) -> Result<(), String> {
        let mut active = self.active_processes.lock().await;
        for (turn_id, process) in active.iter_mut() {
            let child = &mut process.child;
            child
                .kill()
                .await
                .map_err(|e| format!("Failed to kill process: {}", e))?;
            self.interrupted_turns.lock().await.insert(turn_id.clone());
        }
        active.clear();
        Ok(())
    }

    pub async fn interrupt_turn(&self, turn_id: &str) -> Result<(), String> {
        let mut active = self.active_processes.lock().await;
        let Some(process) = active.get_mut(turn_id) else {
            return Ok(());
        };
        let kill_result = process
            .child
            .kill()
            .await
            .map_err(|e| format!("Failed to kill process: {}", e));
        let mut interrupted_turns = self.interrupted_turns.lock().await;
        apply_interrupt_result(&mut active, &mut interrupted_turns, turn_id, kill_result)
    }

    #[cfg(test)]
    pub async fn active_process_ids(&self) -> Vec<u32> {
        let active = self.active_processes.lock().await;
        active
            .values()
            .filter_map(|process| process.child.id())
            .collect()
    }

    #[allow(dead_code)]
    pub async fn active_process_snapshots(
        &self,
        sampled_at_ms: u64,
    ) -> Vec<GrokActiveProcessSnapshot> {
        let active = self.active_processes.lock().await;
        active
            .values()
            .filter_map(|process| process.snapshot(sampled_at_ms))
            .collect()
    }
}

impl Drop for GrokSession {
    fn drop(&mut self) {
        let Ok(mut active) = self.active_processes.try_lock() else {
            log::warn!(
                "[grok] dropping session workspace={} while active_processes is locked; child cleanup fallback skipped",
                self.workspace_id
            );
            return;
        };
        if active.is_empty() {
            return;
        }
        for (turn_id, process) in active.drain() {
            let mut child = process.into_child();
            let pid = child.id();
            match child.start_kill() {
                Ok(()) => {
                    log::info!(
                        "[grok] drop fallback started child kill workspace={} turn={} pid={:?}",
                        self.workspace_id,
                        turn_id,
                        pid
                    );
                }
                Err(error) => {
                    log::warn!(
                        "[grok] drop fallback failed to kill child workspace={} turn={} pid={:?}: {}",
                        self.workspace_id,
                        turn_id,
                        pid,
                        error
                    );
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn interrupt_unknown_turn_does_not_mark_another_runtime_interrupted() {
        let session = GrokSession::new("workspace-1".to_string(), std::env::temp_dir(), None);

        session
            .interrupt_turn("turn-owned-by-another-provider")
            .await
            .expect("unknown turn interrupt is idempotent");

        assert!(session.interrupted_turns.lock().await.is_empty());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn failed_interrupt_result_keeps_turn_owner_registered() {
        let session = GrokSession::new("workspace-1".to_string(), std::env::temp_dir(), None);
        let child = Command::new("sh")
            .arg("-c")
            .arg("sleep 30")
            .spawn()
            .expect("spawn child");
        session
            .active_processes
            .lock()
            .await
            .insert("turn-owned".to_string(), ActiveGrokChildProcess::new(child));

        {
            let mut active = session.active_processes.lock().await;
            let mut interrupted = session.interrupted_turns.lock().await;
            apply_interrupt_result(
                &mut active,
                &mut interrupted,
                "turn-owned",
                Err("kill failed".to_string()),
            )
            .expect_err("failed kill result must propagate");
        }

        assert!(session
            .active_processes
            .lock()
            .await
            .contains_key("turn-owned"));
        assert!(session.interrupted_turns.lock().await.is_empty());
        session
            .interrupt_turn("turn-owned")
            .await
            .expect("cleanup child");
    }

    #[test]
    fn parses_text_delta_line() {
        let line = json!({"type":"text","data":"hello"});
        match parse_grok_stream_line(&line) {
            GrokStreamLine::TextDelta(text) => assert_eq!(text, "hello"),
            _ => panic!("expected TextDelta"),
        }
    }

    #[test]
    fn parses_thought_delta_line() {
        let line = json!({"type":"thought","data":"thinking..."});
        match parse_grok_stream_line(&line) {
            GrokStreamLine::ReasoningDelta(text) => assert_eq!(text, "thinking..."),
            _ => panic!("expected ReasoningDelta"),
        }
    }

    #[test]
    fn parses_end_line() {
        let line = json!({
            "type":"end",
            "stopReason":"EndTurn",
            "sessionId":"019fa245-1234-5678-9abc-def012345678",
            "requestId":"req-1",
            "usage":{"input_tokens":10,"output_tokens":5},
            "num_turns":2,
            "total_cost_usd":0.001
        });
        match parse_grok_stream_line(&line) {
            GrokStreamLine::End { session_id, usage } => {
                assert_eq!(
                    session_id.as_deref(),
                    Some("019fa245-1234-5678-9abc-def012345678")
                );
                assert_eq!(usage, Some(json!({"input_tokens":10,"output_tokens":5})));
            }
            _ => panic!("expected End"),
        }
    }

    #[test]
    fn parses_error_line() {
        let line = json!({"type":"error","message":"boom"});
        match parse_grok_stream_line(&line) {
            GrokStreamLine::StreamError(message) => assert_eq!(message, "boom"),
            _ => panic!("expected StreamError"),
        }
    }

    #[test]
    fn ignores_unknown_event_types() {
        let max_turns = json!({"type":"max_turns_reached"});
        assert!(matches!(
            parse_grok_stream_line(&max_turns),
            GrokStreamLine::Other
        ));
        let auto_compact = json!({"type":"auto_compact_started"});
        assert!(matches!(
            parse_grok_stream_line(&auto_compact),
            GrokStreamLine::Other
        ));
        let missing_type = json!({"data":"hello"});
        assert!(matches!(
            parse_grok_stream_line(&missing_type),
            GrokStreamLine::Other
        ));
        let empty_text = json!({"type":"text","data":""});
        assert!(matches!(
            parse_grok_stream_line(&empty_text),
            GrokStreamLine::Other
        ));
    }

    #[test]
    fn resolves_session_id_only_when_continuing() {
        assert_eq!(
            resolve_grok_session_id_for_engine_send(
                true,
                Some("session-a".to_string()),
                Some("session-b".to_string())
            ),
            Some("session-a".to_string())
        );
        assert_eq!(
            resolve_grok_session_id_for_engine_send(true, None, Some("session-b".to_string())),
            Some("session-b".to_string())
        );
        assert_eq!(
            resolve_grok_session_id_for_engine_send(
                false,
                Some("session-a".to_string()),
                Some("session-b".to_string())
            ),
            None
        );
    }

    #[test]
    fn prompt_json_omitted_for_text_only() {
        assert_eq!(
            build_grok_prompt_json("hello", None, Path::new(".")).unwrap(),
            None
        );
        assert_eq!(
            build_grok_prompt_json(
                "hello",
                Some(&["  ".to_string(), "".to_string()]),
                Path::new("."),
            )
            .unwrap(),
            None
        );
    }

    #[test]
    fn prompt_json_embeds_local_png_as_acp_image_block() {
        let dir = std::env::temp_dir().join(format!("grok-image-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("pixel.png");
        // 1x1 transparent PNG
        let png = BASE64_STANDARD
            .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
            .unwrap();
        std::fs::write(&path, &png).unwrap();

        let encoded = build_grok_prompt_json(
            "what color?",
            Some(&[path.to_string_lossy().to_string()]),
            &dir,
        )
        .unwrap()
        .expect("expected prompt-json payload");
        let blocks: Vec<Value> = serde_json::from_str(&encoded).unwrap();
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0]["type"], "text");
        assert_eq!(blocks[0]["text"], "what color?");
        assert_eq!(blocks[1]["type"], "image");
        assert_eq!(blocks[1]["mimeType"], "image/png");
        assert_eq!(
            blocks[1]["data"].as_str().unwrap(),
            BASE64_STANDARD.encode(&png)
        );

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn prompt_json_accepts_data_url_images() {
        let data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        let encoded = build_grok_prompt_json("", Some(&[data_url.to_string()]), Path::new("."))
            .unwrap()
            .expect("expected prompt-json");
        let blocks: Vec<Value> = serde_json::from_str(&encoded).unwrap();
        assert_eq!(blocks[0]["type"], "text");
        assert_eq!(blocks[1]["type"], "image");
        assert_eq!(blocks[1]["mimeType"], "image/png");
    }

    #[test]
    fn prompt_json_preserves_non_empty_user_text_verbatim() {
        let data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        let encoded = build_grok_prompt_json(
            "  preserve surrounding whitespace  \n",
            Some(&[data_url.to_string()]),
            Path::new("."),
        )
        .unwrap()
        .expect("expected prompt-json");
        let blocks: Vec<Value> = serde_json::from_str(&encoded).unwrap();
        assert_eq!(blocks[0]["text"], "  preserve surrounding whitespace  \n");
    }

    #[test]
    fn prompt_json_errors_when_all_images_unreadable() {
        let err = build_grok_prompt_json(
            "hi",
            Some(&["/tmp/definitely-missing-mossx-image-xyz.png".to_string()]),
            Path::new("."),
        )
        .unwrap_err();
        assert!(err.contains("none of the attached images could be loaded"));
    }

    #[test]
    fn prompt_json_resolves_relative_images_from_workspace() {
        let dir = std::env::temp_dir().join(format!("grok-relative-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let png = BASE64_STANDARD
            .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
            .unwrap();
        std::fs::write(dir.join("relative.png"), png).unwrap();

        let encoded =
            build_grok_prompt_json("inspect", Some(&["relative.png".to_string()]), &dir).unwrap();
        assert!(encoded.is_some());

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn prompt_json_rejects_oversized_data_url_before_decode() {
        let max_encoded_bytes = GROK_MAX_IMAGE_BYTES
            .saturating_add(2)
            .saturating_div(3)
            .saturating_mul(4) as usize;
        let data_url = format!(
            "data:image/png;base64,{}",
            "A".repeat(max_encoded_bytes + 1)
        );
        let error =
            build_grok_prompt_json("inspect", Some(&[data_url]), Path::new(".")).unwrap_err();
        assert!(error.contains("decoded-image limit"));
    }
}
