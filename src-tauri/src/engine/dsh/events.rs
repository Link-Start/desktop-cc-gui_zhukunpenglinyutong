//! Mux WebSocket → EngineEvent projection.

use super::host::DshHostClient;
use super::session::thread_id_for_session;
use crate::engine::events::{
    engine_event_to_app_server_event_with_turn_context, EngineEvent,
};
use crate::engine::EngineType;
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::{oneshot, Mutex};
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone)]
pub struct DshSessionBinding {
    pub workspace_id: String,
    pub thread_id: String,
    pub turn_id: Option<String>,
    pub item_id: Option<String>,
}

struct MuxHub {
    bindings: HashMap<String, DshSessionBinding>,
    turn_waiters: HashMap<String, Vec<oneshot::Sender<String>>>,
    app: Option<AppHandle>,
    stop: Option<oneshot::Sender<()>>,
    url: Option<String>,
}

static MUX: OnceLock<Mutex<MuxHub>> = OnceLock::new();

fn mux() -> &'static Mutex<MuxHub> {
    MUX.get_or_init(|| {
        Mutex::new(MuxHub {
            bindings: HashMap::new(),
            turn_waiters: HashMap::new(),
            app: None,
            stop: None,
            url: None,
        })
    })
}

pub async fn bind_session(session_id: &str, binding: DshSessionBinding) {
    let mut hub = mux().lock().await;
    hub.bindings.insert(session_id.to_string(), binding);
}

pub async fn unbind_session(session_id: &str) {
    mux().lock().await.bindings.remove(session_id);
}

pub async fn session_ids_for_workspace(workspace_id: &str) -> Vec<String> {
    mux()
        .lock()
        .await
        .bindings
        .iter()
        .filter(|(_, binding)| binding.workspace_id == workspace_id)
        .map(|(session_id, _)| session_id.clone())
        .collect()
}

pub async fn session_id_for_turn(turn_id: &str) -> Option<String> {
    mux()
        .lock()
        .await
        .bindings
        .iter()
        .find(|(_, binding)| binding.turn_id.as_deref() == Some(turn_id))
        .map(|(session_id, _)| session_id.clone())
}

pub struct DshTurnWaiter {
    session_id: String,
    rx: oneshot::Receiver<String>,
}

pub async fn subscribe_turn_end(session_id: &str) -> DshTurnWaiter {
    let (tx, rx) = oneshot::channel();
    {
        let mut hub = mux().lock().await;
        hub.turn_waiters
            .entry(session_id.to_string())
            .or_default()
            .push(tx);
    }
    DshTurnWaiter {
        session_id: session_id.to_string(),
        rx,
    }
}

impl DshTurnWaiter {
    pub async fn await_end(self, timeout: Duration) -> Result<String, String> {
        let session_id = self.session_id;
        match tokio::time::timeout(timeout, self.rx).await {
            Ok(Ok(kind)) => Ok(kind),
            Ok(Err(_)) => Err("DSH turn waiter closed".to_string()),
            Err(_) => {
                let mut hub = mux().lock().await;
                if let Some(waiters) = hub.turn_waiters.get_mut(&session_id) {
                    waiters.retain(|waiter| !waiter.is_closed());
                    if waiters.is_empty() {
                        hub.turn_waiters.remove(&session_id);
                    }
                }
                Err("DSH turn timed out".to_string())
            }
        }
    }
}

fn notify_turn_end(session_id: &str, kind: &str, hub: &mut MuxHub) {
    if let Some(waiters) = hub.turn_waiters.remove(session_id) {
        for waiter in waiters {
            let _ = waiter.send(kind.to_string());
        }
    }
}

pub async fn set_app_handle(app: AppHandle) {
    mux().lock().await.app = Some(app);
}

pub async fn ensure_mux(client: &DshHostClient) {
    let url = client.mux_url();
    let mut hub = mux().lock().await;
    if hub.stop.is_some() && hub.url.as_deref() == Some(url.as_str()) {
        return;
    }
    if let Some(stop) = hub.stop.take() {
        let _ = stop.send(());
    }
    let (tx, rx) = tokio::sync::oneshot::channel();
    hub.stop = Some(tx);
    hub.url = Some(url.clone());
    tokio::spawn(async move {
        run_mux_loop(url, rx).await;
        let mut hub = mux().lock().await;
        hub.stop = None;
        hub.url = None;
    });
}

async fn run_mux_loop(url: String, mut stop: tokio::sync::oneshot::Receiver<()>) {
    loop {
        if stop.try_recv().is_ok() {
            return;
        }
        match tokio_tungstenite::connect_async(&url).await {
            Ok((stream, _)) => {
                log::info!("[dsh] mux connected {url}");
                let (mut sink, mut stream) = stream.split();
                loop {
                    tokio::select! {
                        _ = &mut stop => {
                            let _ = sink.close().await;
                            return;
                        }
                        next = stream.next() => {
                            match next {
                                Some(Ok(Message::Text(text))) => {
                                    dispatch_mux_text(&text).await;
                                }
                                Some(Ok(Message::Binary(bytes))) => {
                                    if let Ok(text) = String::from_utf8(bytes) {
                                        dispatch_mux_text(&text).await;
                                    }
                                }
                                Some(Ok(Message::Ping(_) | Message::Pong(_) | Message::Frame(_))) => {}
                                Some(Ok(Message::Close(_))) | None => break,
                                Some(Err(error)) => {
                                    log::warn!("[dsh] mux read error: {error}");
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            Err(error) => {
                log::warn!("[dsh] mux connect failed: {error}");
            }
        }
        tokio::select! {
            _ = &mut stop => return,
            _ = tokio::time::sleep(std::time::Duration::from_secs(1)) => {}
        }
    }
}

fn peek_mux_session_id(raw: &Value) -> Option<String> {
    raw.get("sessionId")
        .or_else(|| raw.get("payload").and_then(|payload| payload.get("sessionId")))
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn turn_end_kind(event: &EngineEvent) -> Option<&str> {
    match event {
        EngineEvent::TurnCompleted { .. } => Some("completed"),
        EngineEvent::TurnError { error, .. } => Some(error.as_str()),
        _ => None,
    }
}

async fn dispatch_mux_text(text: &str) {
    let Ok(raw) = serde_json::from_str::<Value>(text) else {
        return;
    };
    let session_id = peek_mux_session_id(&raw).unwrap_or_default();
    let (frame, rpc_id) = unwrap_mux_envelope(&raw);
    let frame_type = frame.get("type").and_then(Value::as_str).unwrap_or("");
    let (binding, app, events) = {
        let mut hub = mux().lock().await;
        if session_id.is_empty() || !hub.bindings.contains_key(&session_id) {
            return;
        }
        let Some(app) = hub.app.clone() else {
            return;
        };
        let Some(binding) = hub.bindings.get(&session_id).cloned() else {
            return;
        };
        let events = project_mux_frame(
            frame_type,
            &frame,
            &binding,
            &session_id,
            rpc_id.as_deref(),
        );
        if let Some(kind) = events.iter().find_map(turn_end_kind) {
            notify_turn_end(&session_id, kind, &mut hub);
            hub.bindings.remove(&session_id);
        }
        (binding, app, events)
    };

    for event in events {
        let item_id = item_id_for_event(&event, &binding, &session_id);
        if let Some(payload) = engine_event_to_app_server_event_with_turn_context(
            &event,
            &binding.thread_id,
            &item_id,
            binding.turn_id.as_deref(),
        ) {
            let _ = app.emit("app-server-event", payload);
        }
    }
}

fn item_id_for_event(
    event: &EngineEvent,
    binding: &DshSessionBinding,
    session_id: &str,
) -> String {
    match event {
        EngineEvent::ReasoningDelta { .. } => format!(
            "dsh-reasoning-{}",
            binding.turn_id.as_deref().unwrap_or(session_id)
        ),
        EngineEvent::ToolStarted { tool_id, .. }
        | EngineEvent::ToolCompleted { tool_id, .. }
        | EngineEvent::ToolInputUpdated { tool_id, .. }
        | EngineEvent::ToolOutputDelta { tool_id, .. } => tool_id.clone(),
        _ => binding
            .item_id
            .clone()
            .unwrap_or_else(|| format!("dsh-item-{session_id}")),
    }
}

fn unwrap_mux_envelope(raw: &Value) -> (Value, Option<String>) {
    if raw.get("type").and_then(Value::as_str) != Some("server-request") {
        let rpc_id = raw
            .get("rpcId")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        return (raw.clone(), rpc_id);
    }
    let payload = raw.get("payload").cloned().unwrap_or(Value::Null);
    let rpc_id = raw
        .get("rpcId")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    (payload, rpc_id)
}

pub fn project_mux_frame(
    frame_type: &str,
    frame: &Value,
    binding: &DshSessionBinding,
    session_id: &str,
    rpc_id: Option<&str>,
) -> Vec<EngineEvent> {
    match frame_type {
        "session/event" => {
            let event = frame.get("event").unwrap_or(frame);
            project_session_event(event, binding, session_id)
        }
        "approval/requested" => {
            let Some(rpc_id) = rpc_id.filter(|value| !value.is_empty()) else {
                return Vec::new();
            };
            let approval_id = frame
                .get("approvalId")
                .or_else(|| frame.pointer("/payload/approvalId"))
                .and_then(Value::as_str)
                .unwrap_or("");
            if approval_id.is_empty() {
                return Vec::new();
            }
            vec![EngineEvent::ApprovalRequest {
                workspace_id: binding.workspace_id.clone(),
                request_id: super::encode_approval_request_id(rpc_id, session_id, approval_id),
                tool_name: frame
                    .get("toolName")
                    .or_else(|| frame.get("tool"))
                    .or_else(|| frame.pointer("/payload/toolName"))
                    .or_else(|| frame.pointer("/payload/tool"))
                    .and_then(Value::as_str)
                    .unwrap_or("dsh-tool")
                    .to_string(),
                input: Some(frame.clone()),
                message: frame
                    .get("reason")
                    .or_else(|| frame.pointer("/payload/reason"))
                    .or_else(|| frame.pointer("/payload/message"))
                    .and_then(Value::as_str)
                    .map(str::to_string),
            }]
        }
        "question/requested" => {
            let Some(rpc_id) = rpc_id.filter(|value| !value.is_empty()) else {
                return Vec::new();
            };
            let questions = frame
                .get("questions")
                .or_else(|| frame.get("payload"))
                .cloned()
                .unwrap_or(Value::Array(vec![]));
            vec![EngineEvent::RequestUserInput {
                workspace_id: binding.workspace_id.clone(),
                request_id: super::encode_question_request_id(rpc_id, session_id),
                questions,
                completed: false,
            }]
        }
        "session/subscribed" | "approval/resolved" | "question/resolved" | "session/queue"
        | "session/jobs" | "session/projection" | "stream/error" => Vec::new(),
        _ => Vec::new(),
    }
}

pub fn project_session_event(
    event: &Value,
    binding: &DshSessionBinding,
    session_id: &str,
) -> Vec<EngineEvent> {
    let event_type = event.get("type").and_then(Value::as_str).unwrap_or("");
    let data = event.get("data").cloned().unwrap_or(Value::Null);
    let workspace_id = binding.workspace_id.clone();
    match event_type {
        "turn/start" => vec![
            EngineEvent::SessionStarted {
                workspace_id: workspace_id.clone(),
                session_id: session_id.to_string(),
                engine: EngineType::Dsh,
                turn_id: binding.turn_id.clone(),
            },
            EngineEvent::TurnStarted {
                workspace_id,
                turn_id: binding
                    .turn_id
                    .clone()
                    .unwrap_or_else(|| format!("dsh-turn-{session_id}")),
            },
        ],
        "turn/end" => {
            let kind = data
                .pointer("/reason/kind")
                .and_then(Value::as_str)
                .unwrap_or("completed");
            if matches!(kind, "cancelled" | "aborted" | "error" | "failed") {
                let (error, code) = turn_end_failure(&data, kind);
                vec![EngineEvent::TurnError {
                    workspace_id,
                    error,
                    code,
                }]
            } else {
                vec![EngineEvent::TurnCompleted {
                    workspace_id,
                    result: Some(data),
                }]
            }
        }
        "assistant/chunk" => project_stream_chunk(&workspace_id, &data),
        // `assistant/message` is the complete snapshot. Live text already
        // arrived as `assistant/chunk` deltas; re-emitting it as TextDelta
        // duplicates the bubble.
        "assistant/message" => Vec::new(),
        "tool/call" => {
            let tool_id = data
                .get("id")
                .or_else(|| data.get("callId"))
                .and_then(Value::as_str)
                .unwrap_or("tool")
                .to_string();
            let tool_name = data
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("tool")
                .to_string();
            // DSH stores `arguments` as the raw model JSON string (unparsed).
            // Pass through as-is; FE normalizes string vs object for path display.
            vec![EngineEvent::ToolStarted {
                workspace_id,
                tool_id,
                tool_name,
                input: data.get("arguments").cloned().or_else(|| data.get("args").cloned()),
            }]
        }
        "tool/result" => {
            // DSH pairs results via `data.message.source.callId`, not top-level id.
            let tool_id = data
                .get("id")
                .or_else(|| data.get("callId"))
                .or_else(|| data.get("toolCallId"))
                .or_else(|| data.pointer("/message/source/callId"))
                .or_else(|| data.pointer("/message/content/0/toolCallId"))
                .and_then(Value::as_str)
                .unwrap_or("tool")
                .to_string();
            let output = data
                .get("result")
                .cloned()
                .or_else(|| data.get("output").cloned())
                .or_else(|| extract_dsh_tool_result_output(&data));
            let error = data
                .get("error")
                .and_then(|value| {
                    value
                        .as_str()
                        .map(str::to_string)
                        .or_else(|| {
                            value
                                .get("message")
                                .and_then(Value::as_str)
                                .map(str::to_string)
                        })
                        .or_else(|| {
                            value
                                .get("code")
                                .and_then(Value::as_str)
                                .map(str::to_string)
                        })
                })
                .or_else(|| {
                    data.pointer("/message/content/0")
                        .and_then(|block| {
                            if block.get("isError").and_then(Value::as_bool) == Some(true) {
                                extract_dsh_content_text(block)
                            } else {
                                None
                            }
                        })
                });
            vec![EngineEvent::ToolCompleted {
                workspace_id,
                tool_id,
                tool_name: data
                    .get("name")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                output,
                error,
            }]
        }
        "user/message" | "step/start" | "step/end" | "goal/change" | "llm/retry"
        | "command/run" | "command/done" | "permission/preset" | "sandbox/mode"
        | "approval/policy" => Vec::new(),
        _ => Vec::new(),
    }
}

fn project_stream_chunk(workspace_id: &str, data: &Value) -> Vec<EngineEvent> {
    let chunk = data.get("chunk").unwrap_or(data);
    let chunk_type = chunk.get("type").and_then(Value::as_str).unwrap_or("");
    match chunk_type {
        "text-delta" => chunk
            .get("text")
            .and_then(Value::as_str)
            .filter(|text| !text.is_empty())
            .map(|text| {
                vec![EngineEvent::TextDelta {
                    workspace_id: workspace_id.to_string(),
                    text: text.to_string(),
                }]
            })
            .unwrap_or_default(),
        "reasoning-delta" => chunk
            .get("text")
            .and_then(Value::as_str)
            .filter(|text| !text.is_empty())
            .map(|text| {
                vec![EngineEvent::ReasoningDelta {
                    workspace_id: workspace_id.to_string(),
                    text: text.to_string(),
                }]
            })
            .unwrap_or_default(),
        "tool-call-delta" => {
            // Streaming tool *arguments* (not tool output). DSH emits raw JSON
            // fragments; the durable `tool/call` event already carries the full
            // `arguments` string, so we only project a complete JSON object here
            // (rare single-chunk case). Misrouting to ToolOutputDelta previously
            // polluted tool output and left Read rows as "读取 · ...".
            let tool_id = chunk
                .get("id")
                .or_else(|| chunk.get("callId"))
                .and_then(Value::as_str)
                .unwrap_or("tool")
                .to_string();
            let delta = chunk
                .get("argumentsDelta")
                .and_then(Value::as_str)
                .unwrap_or("");
            let tool_name = chunk
                .get("name")
                .and_then(Value::as_str)
                .map(str::to_string);
            let input = parse_complete_json_object(delta);
            if input.is_none() && tool_name.is_none() {
                return Vec::new();
            }
            vec![EngineEvent::ToolInputUpdated {
                workspace_id: workspace_id.to_string(),
                tool_id,
                tool_name,
                input,
            }]
        }
        "usage" => {
            let usage = chunk.get("usage").unwrap_or(chunk);
            vec![EngineEvent::UsageUpdate {
                workspace_id: workspace_id.to_string(),
                input_tokens: int_field(usage, &["uncachedInputTokens", "inputTokens", "input"]),
                output_tokens: int_field(usage, &["outputTokens", "output"]),
                cached_tokens: int_field(usage, &["cacheReadTokens", "cachedTokens"]),
                model_context_window: None,
                context_used_tokens: None,
                context_usage_source: Some("live".to_string()),
                context_usage_freshness: None,
                context_used_percent: None,
                context_remaining_percent: None,
                context_tool_usages: None,
                context_tool_usages_truncated: None,
                context_category_usages: None,
            }]
        }
        _ => Vec::new(),
    }
}

fn turn_end_failure(data: &Value, kind: &str) -> (String, Option<String>) {
    let failure = data.pointer("/reason/error");
    let code = failure
        .and_then(|value| value.get("code"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let message = failure
        .and_then(|value| value.get("message"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let error = message.or(code).unwrap_or(kind).to_string();
    let code = code
        .map(str::to_string)
        .or_else(|| Some(kind.to_string()).filter(|value| !value.is_empty()));
    (error, code)
}

fn int_field(value: &Value, keys: &[&str]) -> Option<i64> {
    keys.iter().find_map(|key| value.get(*key).and_then(Value::as_i64))
}

/// Pull model-facing text out of DSH `tool/result` message content blocks.
fn extract_dsh_content_text(block: &Value) -> Option<String> {
    if let Some(text) = block.get("text").and_then(Value::as_str) {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    let content = block.get("content")?;
    if let Some(text) = content.as_str() {
        let trimmed = text.trim();
        return (!trimmed.is_empty()).then(|| trimmed.to_string());
    }
    let arr = content.as_array()?;
    let mut parts = Vec::new();
    for entry in arr {
        if let Some(text) = entry.get("text").and_then(Value::as_str) {
            if !text.is_empty() {
                parts.push(text.to_string());
            }
        } else if let Some(text) = entry.as_str() {
            if !text.is_empty() {
                parts.push(text.to_string());
            }
        }
    }
    let joined = parts.join("\n");
    let trimmed = joined.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn extract_dsh_tool_result_output(data: &Value) -> Option<Value> {
    if let Some(block) = data.pointer("/message/content/0") {
        if let Some(text) = extract_dsh_content_text(block) {
            return Some(Value::String(text));
        }
        // Fall back to the whole block so structured meta is not lost.
        return Some(block.clone());
    }
    data.get("message").cloned()
}

fn parse_complete_json_object(raw: &str) -> Option<Value> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    match serde_json::from_str::<Value>(trimmed) {
        Ok(value) if value.is_object() || value.is_array() => Some(value),
        _ => None,
    }
}

pub fn default_binding(workspace_id: &str, session_id: &str) -> DshSessionBinding {
    DshSessionBinding {
        workspace_id: workspace_id.to_string(),
        thread_id: thread_id_for_session(session_id),
        turn_id: None,
        item_id: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn binding() -> DshSessionBinding {
        DshSessionBinding {
            workspace_id: "ws-1".to_string(),
            thread_id: "dsh:session-1".to_string(),
            turn_id: Some("turn-1".to_string()),
            item_id: Some("item-1".to_string()),
        }
    }

    #[test]
    fn projects_text_delta_chunk() {
        let event = json!({
            "type": "assistant/chunk",
            "data": { "chunk": { "type": "text-delta", "index": 0, "text": "hi" } }
        });
        let events = project_session_event(&event, &binding(), "session-1");
        assert!(matches!(
            events.first(),
            Some(EngineEvent::TextDelta { text, .. }) if text == "hi"
        ));
    }

    #[test]
    fn projects_turn_end_completed() {
        let event = json!({
            "type": "turn/end",
            "data": { "reason": { "kind": "completed" } }
        });
        let events = project_session_event(&event, &binding(), "session-1");
        assert!(matches!(events.first(), Some(EngineEvent::TurnCompleted { .. })));
    }

    #[test]
    fn projects_turn_end_error_with_llm_failure() {
        let event = json!({
            "type": "turn/end",
            "data": {
                "reason": {
                    "kind": "error",
                    "error": {
                        "message": "unable to get local issuer certificate",
                        "code": "TLS_ERROR",
                        "status": 0
                    }
                }
            }
        });
        let events = project_session_event(&event, &binding(), "session-1");
        match events.first() {
            Some(EngineEvent::TurnError { error, code, .. }) => {
                assert_eq!(error, "unable to get local issuer certificate");
                assert_eq!(code.as_deref(), Some("TLS_ERROR"));
            }
            other => panic!("expected TurnError with LlmFailure, got {other:?}"),
        }
    }

    #[test]
    fn projects_turn_end_error_falls_back_to_kind() {
        let event = json!({
            "type": "turn/end",
            "data": { "reason": { "kind": "error" } }
        });
        let events = project_session_event(&event, &binding(), "session-1");
        match events.first() {
            Some(EngineEvent::TurnError { error, code, .. }) => {
                assert_eq!(error, "error");
                assert_eq!(code.as_deref(), Some("error"));
            }
            other => panic!("expected TurnError fallback, got {other:?}"),
        }
    }

    #[test]
    fn projects_turn_end_error_uses_code_when_message_missing() {
        let event = json!({
            "type": "turn/end",
            "data": {
                "reason": {
                    "kind": "error",
                    "error": { "code": "EMPTY_RESPONSE" }
                }
            }
        });
        let events = project_session_event(&event, &binding(), "session-1");
        match events.first() {
            Some(EngineEvent::TurnError { error, code, .. }) => {
                assert_eq!(error, "EMPTY_RESPONSE");
                assert_eq!(code.as_deref(), Some("EMPTY_RESPONSE"));
            }
            other => panic!("expected TurnError from code, got {other:?}"),
        }
    }

    #[test]
    fn unwraps_server_request_envelope_and_encodes_approval_request() {
        let raw = json!({
            "type": "server-request",
            "rpcId": "rpc-approval-1",
            "method": "events.mux",
            "payload": {
                "type": "approval/requested",
                "sessionId": "session-1",
                "approvalId": "approval-1",
                "toolName": "bash"
            }
        });
        let (frame, rpc_id) = unwrap_mux_envelope(&raw);
        let events = project_mux_frame(
            "approval/requested",
            &frame,
            &binding(),
            "session-1",
            rpc_id.as_deref(),
        );
        match events.first() {
            Some(EngineEvent::ApprovalRequest {
                request_id,
                tool_name,
                ..
            }) => {
                assert_eq!(tool_name, "bash");
                match super::super::parse_control_request(request_id) {
                    Some(super::super::DshControlKind::Approval {
                        rpc_id,
                        session_id,
                        approval_id,
                    }) => {
                        assert_eq!(rpc_id, "rpc-approval-1");
                        assert_eq!(session_id, "session-1");
                        assert_eq!(approval_id, "approval-1");
                    }
                    other => panic!("unexpected control request: {other:?}"),
                }
            }
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[test]
    fn skips_unknown_event() {
        let event = json!({ "type": "web/deepseek-search-llm-request", "data": {} });
        assert!(project_session_event(&event, &binding(), "session-1").is_empty());
    }

    #[test]
    fn assistant_message_snapshot_is_not_a_text_delta() {
        let event = json!({
            "type": "assistant/message",
            "data": { "text": "hello already streamed" }
        });
        assert!(project_session_event(&event, &binding(), "session-1").is_empty());
    }

    #[test]
    fn projects_tool_call_with_raw_json_string_arguments() {
        let event = json!({
            "type": "tool/call",
            "data": {
                "callId": "call-read-1",
                "name": "read",
                "arguments": "{\"file_path\":\"src/main.ts\"}"
            }
        });
        let events = project_session_event(&event, &binding(), "session-1");
        match events.first() {
            Some(EngineEvent::ToolStarted {
                tool_id,
                tool_name,
                input,
                ..
            }) => {
                assert_eq!(tool_id, "call-read-1");
                assert_eq!(tool_name, "read");
                assert_eq!(
                    input.as_ref().and_then(Value::as_str),
                    Some(r#"{"file_path":"src/main.ts"}"#)
                );
            }
            other => panic!("expected ToolStarted, got {other:?}"),
        }
    }

    #[test]
    fn projects_tool_result_using_message_source_call_id() {
        let event = json!({
            "type": "tool/result",
            "data": {
                "message": {
                    "source": { "callId": "call-read-1" },
                    "content": [{
                        "type": "tool-result",
                        "toolCallId": "call-read-1",
                        "content": [{ "type": "text", "text": "1\tline" }]
                    }]
                }
            }
        });
        let events = project_session_event(&event, &binding(), "session-1");
        match events.first() {
            Some(EngineEvent::ToolCompleted {
                tool_id,
                output,
                error,
                ..
            }) => {
                assert_eq!(tool_id, "call-read-1");
                assert!(error.is_none());
                assert_eq!(
                    output.as_ref().and_then(Value::as_str),
                    Some("1\tline")
                );
            }
            other => panic!("expected ToolCompleted, got {other:?}"),
        }
    }

    #[test]
    fn tool_call_delta_projects_complete_json_as_input_not_output() {
        let event = json!({
            "type": "assistant/chunk",
            "data": {
                "chunk": {
                    "type": "tool-call-delta",
                    "id": "call-read-2",
                    "name": "read",
                    "argumentsDelta": "{\"file_path\":\"a.ts\"}"
                }
            }
        });
        let events = project_session_event(&event, &binding(), "session-1");
        match events.first() {
            Some(EngineEvent::ToolInputUpdated {
                tool_id,
                tool_name,
                input,
                ..
            }) => {
                assert_eq!(tool_id, "call-read-2");
                assert_eq!(tool_name.as_deref(), Some("read"));
                assert_eq!(
                    input.as_ref().and_then(|value| value.get("file_path")).and_then(Value::as_str),
                    Some("a.ts")
                );
            }
            other => panic!("expected ToolInputUpdated, got {other:?}"),
        }
    }

    #[test]
    fn tool_call_delta_partial_json_is_not_forced_as_output() {
        let event = json!({
            "type": "assistant/chunk",
            "data": {
                "chunk": {
                    "type": "tool-call-delta",
                    "id": "call-read-3",
                    "argumentsDelta": "{\"file_path\":"
                }
            }
        });
        let events = project_session_event(&event, &binding(), "session-1");
        assert!(
            events
                .iter()
                .all(|event| !matches!(event, EngineEvent::ToolOutputDelta { .. })),
            "partial args must not become tool output"
        );
    }
}
