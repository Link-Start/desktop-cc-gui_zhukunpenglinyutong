//! DSH history list / load / archive.

use super::host::DshHostClient;
use super::session::{self, session_id_from_thread};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DshSessionSummary {
    pub session_id: String,
    pub first_message: String,
    pub updated_at: i64,
    pub created_at: i64,
    pub message_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canonical_session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DshSessionMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_output: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_kind: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DshSessionUsage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_input_tokens: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DshSessionLoadResult {
    pub messages: Vec<DshSessionMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<DshSessionUsage>,
}

pub async fn list_dsh_sessions(
    client: &DshHostClient,
    workspace_path: &Path,
    limit: Option<usize>,
) -> Result<Vec<DshSessionSummary>, String> {
    let workspace = session::create_workspace(client, workspace_path).await?;
    let membership = workspace_membership(&workspace);
    let wanted = normalize_path(workspace_path);
    let items = session::list_sessions(client).await?;
    let mut sessions = items
        .into_iter()
        .filter(|item| {
            let session_id = item.get("sessionId").and_then(Value::as_str).unwrap_or("");
            if session_id.is_empty() {
                return false;
            }
            if let Some((allowed, archived)) = &membership {
                return session_visible(session_id, allowed, archived);
            }
            let cwd = item.get("cwd").and_then(Value::as_str).unwrap_or("");
            !cwd.is_empty() && paths_equal_exact(cwd, &wanted)
        })
        .filter(|item| item.get("blank").and_then(Value::as_bool) != Some(true))
        .filter_map(|item| summary_from_list_item(&item))
        .collect::<Vec<_>>();
    sessions.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    if let Some(limit) = limit {
        sessions.truncate(limit);
    }
    Ok(sessions)
}

const HISTORY_PAGE_SIZE: u32 = 200;
const HISTORY_MAX_PAGES: usize = 40;

pub async fn load_dsh_session(
    client: &DshHostClient,
    session_id: &str,
) -> Result<DshSessionLoadResult, String> {
    let session_id = session_id_from_thread(session_id);
    let (events, last_page) = load_history_pages(client, &session_id).await?;
    let messages = fold_history_events(&events);
    let usage = last_page
        .pointer("/projections/values/tokenUsage")
        .and_then(usage_from_projection);
    Ok(DshSessionLoadResult { messages, usage })
}

async fn load_history_pages(
    client: &DshHostClient,
    session_id: &str,
) -> Result<(Vec<Value>, Value), String> {
    let mut collected = Vec::new();
    let mut before_seq = None;
    let mut last_page = Value::Null;
    for page_index in 0..HISTORY_MAX_PAGES {
        let page = session::history(client, session_id, Some(HISTORY_PAGE_SIZE), before_seq).await?;
        // Projections (usage etc.) only exist on the tail page.
        if page_index == 0 {
            last_page = page.clone();
        }
        let events = page
            .get("events")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let next_before = events
            .first()
            .and_then(|entry| {
                entry
                    .get("seq")
                    .or_else(|| entry.pointer("/event/seq"))
                    .and_then(Value::as_i64)
            });
        if events.is_empty() {
            break;
        }
        collected.splice(0..0, events);
        let has_more = page
            .get("hasMore")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if !has_more {
            break;
        }
        match next_before {
            Some(seq) if before_seq != Some(seq) => before_seq = Some(seq),
            _ => break,
        }
    }
    Ok((collected, last_page))
}

pub async fn archive_dsh_session(client: &DshHostClient, session_id: &str) -> Result<(), String> {
    let session_id = session_id_from_thread(session_id);
    session::archive_session(client, &session_id).await?;
    Ok(())
}

fn summary_from_list_item(item: &Value) -> Option<DshSessionSummary> {
    let session_id = item.get("sessionId").and_then(Value::as_str)?.to_string();
    if session_id.is_empty() {
        return None;
    }
    let updated_at = item.get("updatedAt").and_then(Value::as_i64).unwrap_or(0);
    let title = item
        .pointer("/projections/values/title")
        .and_then(Value::as_str)
        .unwrap_or("");
    Some(DshSessionSummary {
        first_message: sanitize_dsh_sidebar_title(title),
        updated_at,
        created_at: updated_at,
        message_count: 0,
        engine: Some("dsh".to_string()),
        canonical_session_id: Some(session_id.clone()),
        session_id,
    })
}

pub fn fold_history_events(entries: &[Value]) -> Vec<DshSessionMessage> {
    let mut messages = Vec::new();
    let mut assistant_buf = String::new();
    let mut reasoning_buf = String::new();
    let mut index = 0usize;
    for entry in entries {
        let event = entry.get("event").unwrap_or(entry);
        let event_type = event.get("type").and_then(Value::as_str).unwrap_or("");
        let data = event.get("data").cloned().unwrap_or(Value::Null);
        match event_type {
            "user/message" => {
                flush_assistant(&mut messages, &mut assistant_buf, &mut reasoning_buf, &mut index);
                let text = data
                    .get("text")
                    .and_then(Value::as_str)
                    .or_else(|| {
                        data.get("content")
                            .and_then(Value::as_array)
                            .and_then(|blocks| {
                                blocks.iter().find_map(|block| {
                                    block.get("text").and_then(Value::as_str)
                                })
                            })
                    })
                    .unwrap_or("")
                    .to_string();
                if !text.is_empty() && !is_dsh_injected_user_message(&data, &text) {
                    index += 1;
                    messages.push(DshSessionMessage {
                        id: format!("dsh-user-{index}"),
                        role: "user".to_string(),
                        text,
                        timestamp: None,
                        kind: "message".to_string(),
                        tool_type: None,
                        title: None,
                        tool_input: None,
                        tool_output: None,
                        source_kind: dsh_source_kind(&data).map(str::to_string),
                    });
                }
            }
            "assistant/chunk" => {
                let chunk = data.get("chunk").unwrap_or(&data);
                match chunk.get("type").and_then(Value::as_str).unwrap_or("") {
                    "text-delta" => {
                        if let Some(text) = chunk.get("text").and_then(Value::as_str) {
                            assistant_buf.push_str(text);
                        }
                    }
                    "reasoning-delta" => {
                        if let Some(text) = chunk.get("text").and_then(Value::as_str) {
                            reasoning_buf.push_str(text);
                        }
                    }
                    _ => {}
                }
            }
            "assistant/message" => {
                if assistant_buf.is_empty() {
                    if let Some(text) = data.get("text").and_then(Value::as_str) {
                        assistant_buf.push_str(text);
                    }
                }
                flush_assistant(&mut messages, &mut assistant_buf, &mut reasoning_buf, &mut index);
            }
            "tool/call" => {
                index += 1;
                messages.push(DshSessionMessage {
                    id: format!("dsh-tool-{index}"),
                    role: "assistant".to_string(),
                    text: String::new(),
                    timestamp: None,
                    kind: "tool".to_string(),
                    tool_type: data
                        .get("name")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    title: data
                        .get("name")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                    tool_input: data.get("arguments").cloned().or_else(|| data.get("args").cloned()),
                    tool_output: None,
                    source_kind: None,
                });
            }
            "tool/result" => {
                if let Some(last) = messages.iter_mut().rev().find(|row| row.kind == "tool" && row.tool_output.is_none()) {
                    last.tool_output = data.get("result").cloned().or_else(|| data.get("output").cloned());
                }
            }
            "turn/end" => {
                flush_assistant(&mut messages, &mut assistant_buf, &mut reasoning_buf, &mut index);
            }
            _ => {}
        }
    }
    flush_assistant(&mut messages, &mut assistant_buf, &mut reasoning_buf, &mut index);
    messages
}

fn dsh_source_kind(data: &Value) -> Option<&str> {
    data.get("source")
        .and_then(|source| source.get("kind"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|kind| !kind.is_empty())
}

fn strip_dsh_runtime_xml_block(text: &str, tag: &str) -> String {
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let lower = text.to_ascii_lowercase();
    let open_lower = open.to_ascii_lowercase();
    let close_lower = close.to_ascii_lowercase();
    let Some(start) = lower.find(&open_lower) else {
        return text.to_string();
    };
    let after_open = &text[start + open.len()..];
    let after_open_lower = after_open.to_ascii_lowercase();
    let Some(tag_end) = after_open_lower.find('>') else {
        return text[..start].to_string();
    };
    let inner_start = start + open.len() + tag_end + 1;
    let Some(rel_end) = text[inner_start..].to_ascii_lowercase().find(&close_lower) else {
        return text[..start].to_string();
    };
    let end = inner_start + rel_end + close.len();
    let mut out = String::with_capacity(text.len().saturating_sub(end - start));
    out.push_str(&text[..start]);
    out.push_str(&text[end..]);
    out
}

fn is_dsh_runtime_context_text(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return false;
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("current runtime context.") || lower.starts_with("current runtime context:")
    {
        return true;
    }
    let mut rest = trimmed.to_string();
    for _ in 0..12 {
        let before = rest.clone();
        for tag in ["system-reminder", "available_skills", "agent_skills"] {
            rest = strip_dsh_runtime_xml_block(&rest, tag);
        }
        if rest == before {
            break;
        }
    }
    rest.trim().is_empty()
}

fn is_dsh_injected_user_message(data: &Value, text: &str) -> bool {
    match dsh_source_kind(data) {
        Some(kind) if kind.eq_ignore_ascii_case("user") => false,
        Some(_) => true,
        None => is_dsh_runtime_context_text(text),
    }
}

fn sanitize_dsh_sidebar_title(title: &str) -> String {
    if is_dsh_runtime_context_text(title) {
        String::new()
    } else {
        title.to_string()
    }
}

fn flush_assistant(
    messages: &mut Vec<DshSessionMessage>,
    assistant_buf: &mut String,
    reasoning_buf: &mut String,
    index: &mut usize,
) {
    if !reasoning_buf.is_empty() {
        *index += 1;
        messages.push(DshSessionMessage {
            id: format!("dsh-reasoning-{index}"),
            role: "assistant".to_string(),
            text: std::mem::take(reasoning_buf),
            timestamp: None,
            kind: "reasoning".to_string(),
            tool_type: None,
            title: None,
            tool_input: None,
            tool_output: None,
            source_kind: None,
        });
    }
    if !assistant_buf.is_empty() {
        *index += 1;
        messages.push(DshSessionMessage {
            id: format!("dsh-assistant-{index}"),
            role: "assistant".to_string(),
            text: std::mem::take(assistant_buf),
            timestamp: None,
            kind: "message".to_string(),
            tool_type: None,
            title: None,
            tool_input: None,
            tool_output: None,
            source_kind: None,
        });
    }
}

fn usage_from_projection(value: &Value) -> Option<DshSessionUsage> {
    Some(DshSessionUsage {
        input_tokens: value.get("uncachedInputTokens").and_then(Value::as_i64),
        output_tokens: value.get("outputTokens").and_then(Value::as_i64),
        cache_read_input_tokens: value.get("cacheReadTokens").and_then(Value::as_i64),
    })
}

fn normalize_path(path: &Path) -> String {
    session::canonicalize_host_path(path)
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string()
}

fn workspace_membership(workspace: &Value) -> Option<(HashSet<String>, HashSet<String>)> {
    let ws = workspace.get("workspace")?;
    let allowed = string_id_set(ws.get("sessionIds"))?;
    let archived = string_id_set(ws.get("archivedSessionIds")).unwrap_or_default();
    Some((allowed, archived))
}

fn string_id_set(value: Option<&Value>) -> Option<HashSet<String>> {
    let items = value?.as_array()?;
    Some(
        items
            .iter()
            .filter_map(Value::as_str)
            .filter(|id| !id.is_empty())
            .map(str::to_string)
            .collect(),
    )
}

fn session_visible(
    session_id: &str,
    allowed: &HashSet<String>,
    archived: &HashSet<String>,
) -> bool {
    allowed.contains(session_id) && !archived.contains(session_id)
}

fn paths_equal_exact(left: &str, right: &str) -> bool {
    normalize_path_text(left) == normalize_path_text(right)
}

fn normalize_path_text(value: &str) -> String {
    session::strip_windows_verbatim_prefix(value)
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn folds_user_and_assistant() {
        let entries = vec![
            json!({ "event": { "type": "user/message", "data": { "text": "hi" } } }),
            json!({ "event": { "type": "assistant/chunk", "data": { "chunk": { "type": "text-delta", "text": "hello" } } } }),
            json!({ "event": { "type": "turn/end", "data": { "reason": { "kind": "completed" } } } }),
        ];
        let messages = fold_history_events(&entries);
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[1].text, "hello");
    }

    #[test]
    fn membership_keeps_workspace_sessions_and_drops_archived() {
        let workspace = json!({
            "workspace": {
                "workspaceId": "ws-1",
                "sessionIds": ["sess-a", "sess-b", "sess-c"],
                "archivedSessionIds": ["sess-b"]
            }
        });
        let (allowed, archived) = workspace_membership(&workspace).expect("membership");
        assert!(session_visible("sess-a", &allowed, &archived));
        assert!(!session_visible("sess-b", &allowed, &archived));
        assert!(!session_visible("sess-other", &allowed, &archived));
    }

    #[test]
    fn exact_path_match_does_not_use_suffix() {
        assert!(paths_equal_exact("/Users/foo/app", "/Users/foo/app"));
        assert!(!paths_equal_exact("/Users/foo/app", "/app"));
        assert!(!paths_equal_exact("", "/Users/foo/app"));
    }

    #[test]
    fn exact_path_match_strips_windows_verbatim_prefix() {
        assert!(paths_equal_exact(
            r"\\?\C:\Users\foo\app",
            r"C:\Users\foo\app"
        ));
        assert!(paths_equal_exact(
            r"\\?\UNC\server\share\app",
            r"\\server\share\app"
        ));
    }

    #[test]
    fn skips_injected_instruction_snapshot_and_skill_catalog() {
        let entries = vec![
            json!({
                "event": {
                    "type": "user/message",
                    "data": {
                        "text": "你好",
                        "source": { "kind": "user" }
                    }
                }
            }),
            json!({
                "event": {
                    "type": "user/message",
                    "data": {
                        "text": "<system-reminder>\nInstructions from: AGENTS.md\n</system-reminder>",
                        "source": { "kind": "agent-instructions", "form": "instructions" }
                    }
                }
            }),
            json!({
                "event": {
                    "type": "user/message",
                    "data": {
                        "text": "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\nCurrent DSH file policy: workspace-write.",
                        "source": { "kind": "plugin", "plugin": "dsh-system-prompt", "form": "snapshot" }
                    }
                }
            }),
            json!({
                "event": {
                    "type": "user/message",
                    "data": {
                        "content": [{
                            "type": "text",
                            "text": "<system-reminder>\n<available_skills>\n- deploy-to-vercel\n</available_skills>\n</system-reminder>"
                        }],
                        "source": { "kind": "plugin", "plugin": "dsh-tool-skill", "form": "catalog" }
                    }
                }
            }),
            json!({
                "event": {
                    "type": "assistant/chunk",
                    "data": { "chunk": { "type": "text-delta", "text": "你好" } }
                }
            }),
            json!({ "event": { "type": "turn/end", "data": { "reason": { "kind": "completed" } } } }),
        ];
        let messages = fold_history_events(&entries);
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "user");
        assert_eq!(messages[0].text, "你好");
        assert_eq!(messages[0].source_kind.as_deref(), Some("user"));
        assert_eq!(messages[1].role, "assistant");
        assert_eq!(messages[1].text, "你好");
        assert_eq!(messages[1].source_kind, None);
    }

    #[test]
    fn keeps_real_user_prompt_that_mentions_system_reminder() {
        let entries = vec![json!({
            "event": {
                "type": "user/message",
                "data": {
                    "text": "what is a <system-reminder>?",
                    "source": { "kind": "user" }
                }
            }
        })];
        let messages = fold_history_events(&entries);
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].text, "what is a <system-reminder>?");
    }

    #[test]
    fn skips_sourceless_runtime_context_text() {
        let entries = vec![
            json!({
                "event": {
                    "type": "user/message",
                    "data": {
                        "text": "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.\n\nApproval policy: ask."
                    }
                }
            }),
            json!({
                "event": {
                    "type": "user/message",
                    "data": {
                        "text": "<system-reminder>\nInstructions from: AGENTS.md\n</system-reminder>"
                    }
                }
            }),
            json!({
                "event": {
                    "type": "user/message",
                    "data": {
                        "text": "<system-reminder>\n<available_skills>\n- deploy-to-vercel\n</available_skills>\n</system-reminder>"
                    }
                }
            }),
        ];
        let messages = fold_history_events(&entries);
        assert!(messages.is_empty());
    }

    #[test]
    fn sidebar_title_drops_injected_runtime_context() {
        assert_eq!(
            sanitize_dsh_sidebar_title(
                "<system-reminder>\nInstructions from: AGENTS.md\n</system-reminder>"
            ),
            ""
        );
        assert_eq!(
            sanitize_dsh_sidebar_title(
                "Current runtime context. This snapshot supersedes earlier runtime-context snapshots."
            ),
            ""
        );
        assert_eq!(
            sanitize_dsh_sidebar_title(
                "<system-reminder>\n<available_skills>\n- deploy-to-vercel\n</available_skills>\n</system-reminder>"
            ),
            ""
        );
        assert_eq!(sanitize_dsh_sidebar_title("你好"), "你好");
    }
}
