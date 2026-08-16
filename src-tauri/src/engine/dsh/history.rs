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
        .unwrap_or("")
        .to_string();
    Some(DshSessionSummary {
        first_message: title,
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
                if !text.is_empty() {
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
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
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
    value.replace('\\', "/").trim_end_matches('/').to_lowercase()
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
}
