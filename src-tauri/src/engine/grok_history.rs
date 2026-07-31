//! Read Grok CLI session history from
//! `<grok-home>/sessions/<url-encoded-cwd>/<sessionId>/{summary.json,chat_history.jsonl}`.
//!
//! Layout (grok 0.2.111):
//! - `sessions/<url-encoded-cwd>/`: one directory per working directory; the dir
//!   name is the session cwd URL-encoded (`/private/tmp` → `%2Fprivate%2Ftmp`).
//!   On macOS the CLI canonicalizes cwd (`/tmp` → `/private/tmp`), so workspace
//!   matching canonicalizes both sides and tolerates symlink variants.
//! - `summary.json`: `{info:{id,cwd}, session_summary, created_at, updated_at,
//!   num_messages, num_chat_messages, generated_title, ...}` (RFC3339 times;
//!   fields may evolve — parsed defensively).
//! - `chat_history.jsonl`: one JSON object per line. Relevant line types:
//!   - `user` — prompt (`content: [{type:"text", text:"<user_query>…</user_query>"}]`);
//!     lines carrying `synthetic_reason` are synthetic reminders and skipped.
//!     Runtime context envelopes Grok injects without `synthetic_reason`
//!     (`<user_info>`, `<git_status>`, bare `<system-reminder>`, …) are also
//!     skipped so they do not appear as user bubbles or drive sidebar titles.
//!   - `reasoning` — `{id, summary}` (summary string or parts array)
//!   - `assistant` — `{content, tool_calls:[{id, function:{name, arguments}}]}`
//!   - `tool_result` — `{tool_call_id, content}`
//!   Other types (`system`, unknown) are skipped. Lines carry no usage data.
//! - Sidebar `first_message` prefers the first real user prompt text; Grok's
//!   `generated_title` / `session_summary` is only a fallback.

use chrono::DateTime;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::fs;
use tokio::time::timeout;

const LOCAL_SESSION_SCAN_TIMEOUT: Duration = Duration::from_secs(60);

fn normalize_session_id(session_id: &str) -> Result<String, String> {
    let normalized = session_id.trim();
    if normalized.is_empty()
        || normalized == "."
        || normalized.contains('/')
        || normalized.contains('\\')
        || normalized.contains("..")
    {
        return Err("[SESSION_NOT_FOUND] Invalid Grok session id".to_string());
    }
    Ok(normalized.to_string())
}

/// Summary of a Grok session for sidebar display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrokSessionSummary {
    pub session_id: String,
    pub first_message: String,
    pub updated_at: i64,
    pub created_at: i64,
    pub message_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub engine: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canonical_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attribution_status: Option<String>,
}

/// Single normalized message row used by frontend history parser.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrokSessionMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    /// "message", "reasoning", or "tool"
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
pub struct GrokSessionUsage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_creation_input_tokens: Option<i64>,
    pub cache_read_input_tokens: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrokSessionLoadResult {
    pub messages: Vec<GrokSessionMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<GrokSessionUsage>,
}

fn parse_timestamp_millis(value: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|dt| dt.timestamp_millis())
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let truncated: String = value.chars().take(max_chars).collect();
    format!("{}…", truncated)
}

fn normalize_windows_path_for_comparison(path: &str) -> String {
    if path.is_empty() {
        return String::new();
    }
    let mut normalized = path.replace('\\', "/");
    if normalized.starts_with("//?/UNC/") {
        normalized = format!("//{}", &normalized["//?/UNC/".len()..]);
    } else if normalized.starts_with("//?/") {
        normalized = normalized["//?/".len()..].to_string();
    }
    while normalized.ends_with('/') && normalized.len() > 1 {
        normalized.pop();
    }
    normalized
}

fn build_path_variants(path: &str) -> Vec<String> {
    let normalized = normalize_windows_path_for_comparison(path.trim());
    if normalized.is_empty() {
        return Vec::new();
    }
    let mut variants = vec![normalized.clone()];
    if normalized.starts_with("/private/") {
        variants.push(normalized["/private".len()..].to_string());
    } else if normalized.starts_with('/') {
        variants.push(format!("/private{}", normalized));
    }
    if normalized.len() >= 2 && normalized.as_bytes()[1] == b':' {
        let mut chars = normalized.chars();
        if let Some(first) = chars.next() {
            variants.push(format!("{}{}", first.to_ascii_lowercase(), chars.as_str()));
        }
        variants.push(normalized.to_ascii_lowercase());
    }
    if normalized.starts_with("//") {
        variants.push(normalized.to_ascii_lowercase());
    }
    variants.sort();
    variants.dedup();
    variants
}

fn build_workspace_path_variants(workspace_path: &Path) -> Vec<String> {
    let workspace_raw = workspace_path.to_string_lossy().to_string();
    let mut workspace_variants = build_path_variants(&workspace_raw);
    if let Ok(canonical_workspace) = std::fs::canonicalize(workspace_path) {
        let canonical_workspace_raw = canonical_workspace.to_string_lossy().to_string();
        workspace_variants.extend(build_path_variants(&canonical_workspace_raw));
    }
    workspace_variants.sort();
    workspace_variants.dedup();
    workspace_variants
}

fn path_is_same_or_child(candidate: &str, base: &str) -> bool {
    if candidate.is_empty() || base.is_empty() {
        return false;
    }
    if candidate == base {
        return true;
    }
    if base == "/" {
        return candidate.starts_with('/');
    }
    candidate.starts_with(base) && candidate.chars().nth(base.len()) == Some('/')
}

fn matches_workspace_path(work_dir: &str, workspace_variants: &[String]) -> bool {
    if workspace_variants.is_empty() {
        return false;
    }
    let mut work_dir_variants = build_path_variants(work_dir);
    // grok canonicalizes the session cwd (e.g. macOS `/tmp` → `/private/tmp`);
    // match canonical forms on both sides to tolerate symlink variants.
    if let Ok(canonical_work_dir) = std::fs::canonicalize(work_dir) {
        work_dir_variants.extend(build_path_variants(&canonical_work_dir.to_string_lossy()));
        work_dir_variants.sort();
        work_dir_variants.dedup();
    }
    for candidate in work_dir_variants {
        for workspace in workspace_variants {
            if path_is_same_or_child(&candidate, workspace)
                || path_is_same_or_child(workspace, &candidate)
            {
                return true;
            }
        }
    }
    false
}

fn expand_home_prefixed_path(path: &str) -> Option<PathBuf> {
    if path == "~" {
        return dirs::home_dir();
    }
    let relative = path
        .strip_prefix("~/")
        .or_else(|| path.strip_prefix("~\\"))
        .filter(|value| !value.is_empty())?;
    dirs::home_dir().map(|home| home.join(relative))
}

fn resolve_grok_base_dir(custom_home: Option<&str>) -> PathBuf {
    if let Some(home) = custom_home.map(str::trim).filter(|value| !value.is_empty()) {
        if let Some(expanded) = expand_home_prefixed_path(home) {
            return expanded;
        }
        return PathBuf::from(home);
    }
    if let Some(home) = std::env::var_os("GROK_HOME").filter(|value| !value.is_empty()) {
        let configured = PathBuf::from(home);
        let configured_text = configured.to_string_lossy();
        if let Some(expanded) = expand_home_prefixed_path(&configured_text) {
            return expanded;
        }
        return configured;
    }
    dirs::home_dir().unwrap_or_default().join(".grok")
}

/// Percent-decode a `sessions/<dir>` name back into its cwd
/// (`%2Fprivate%2Ftmp` → `/private/tmp`). Invalid escapes pass through verbatim.
fn url_decode_dir_name(encoded: &str) -> String {
    let bytes = encoded.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).unwrap_or("");
            if let Ok(value) = u8::from_str_radix(hex, 16) {
                decoded.push(value);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&decoded).to_string()
}

fn extract_timestamp_text(value: &Value) -> Option<String> {
    if let Some(millis) = value.get("time").and_then(|v| v.as_i64()) {
        return DateTime::from_timestamp_millis(millis).map(|dt| dt.to_rfc3339());
    }
    for key in ["timestamp", "created_at", "createdAt"] {
        if let Some(text) = value.get(key).and_then(|v| v.as_str()) {
            if DateTime::parse_from_rfc3339(text).is_ok() {
                return Some(text.to_string());
            }
        }
    }
    None
}

/// Content may be a plain string or a `[{type:"text",text}]` parts array.
fn extract_content_text(content: Option<&Value>) -> String {
    match content {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(parts)) => parts
            .iter()
            .filter(|part| part.get("type").and_then(|v| v.as_str()) == Some("text"))
            .filter_map(|part| part.get("text").and_then(|v| v.as_str()))
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

/// Reasoning `summary` is normally a string; tolerate string arrays / parts.
fn extract_reasoning_summary(summary: Option<&Value>) -> String {
    match summary {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(parts)) => parts
            .iter()
            .map(|part| {
                part.as_str()
                    .map(|value| value.to_string())
                    .or_else(|| {
                        part.get("text")
                            .and_then(|v| v.as_str())
                            .map(|value| value.to_string())
                    })
                    .unwrap_or_default()
            })
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

fn strip_user_query_wrapper(text: &str) -> String {
    let trimmed = text.trim();
    // Prefer extracting the last <user_query>…</user_query> body when present
    // (Grok multimodal history prefixes an <image_files> block).
    if let Some(start) = trimmed.rfind("<user_query>") {
        let after = &trimmed[start + "<user_query>".len()..];
        if let Some(end) = after.find("</user_query>") {
            return after[..end].trim().to_string();
        }
    }
    let inner = trimmed
        .strip_prefix("<user_query>")
        .and_then(|rest| rest.strip_suffix("</user_query>"))
        .unwrap_or(trimmed);
    inner.trim().to_string()
}

/// Known Grok runtime envelopes that are stored as `type:"user"` but are not
/// human prompts. Grok only marks some of these with `synthetic_reason`.
const GROK_RUNTIME_CONTEXT_TAGS: &[&str] = &[
    "user_info",
    "git_status",
    "system-reminder",
    "open_and_recently_viewed_files",
    "agent_skills",
    "mcp_servers",
    "image_compression_notice",
];

fn remove_xml_block_case_insensitive(text: &str, tag: &str) -> String {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let lower = text.to_ascii_lowercase();
    let open_lower = open.to_ascii_lowercase();
    let close_lower = close.to_ascii_lowercase();
    let Some(start) = lower.find(&open_lower) else {
        return text.to_string();
    };
    let after_open = start + open.len();
    let Some(rel_end) = lower[after_open..].find(&close_lower) else {
        // Unclosed envelope: drop from the open tag to end.
        return text[..start].to_string();
    };
    let end = after_open + rel_end + close.len();
    let mut out = String::with_capacity(text.len().saturating_sub(end - start));
    out.push_str(&text[..start]);
    out.push_str(&text[end..]);
    out
}

fn strip_grok_runtime_context_envelopes(text: &str) -> String {
    let mut rest = text.to_string();
    for _ in 0..12 {
        let before = rest.clone();
        for tag in GROK_RUNTIME_CONTEXT_TAGS {
            rest = remove_xml_block_case_insensitive(&rest, tag);
        }
        if rest == before {
            break;
        }
    }
    rest
}

/// True when a Grok `user` history line is runtime-injected context rather than
/// a real human prompt. Covers envelopes Grok writes without `synthetic_reason`
/// (notably `<user_info>` / `<git_status>`).
fn is_grok_runtime_context_user_text(raw: &str) -> bool {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return true;
    }
    // Explicit user prompts (including multimodal) are never treated as context.
    if trimmed.contains("<user_query>") || trimmed.contains("<image_files>") {
        return false;
    }
    // After stripping known envelopes, pure context leaves nothing behind.
    // Free-text prompts (legacy / plain) remain and are kept.
    strip_grok_runtime_context_envelopes(trimmed)
        .trim()
        .is_empty()
}

/// Parse Grok wire user text into display text + image absolute paths.
///
/// Multimodal turns are stored as:
/// ```text
/// <image_files>
/// ...
/// 1. /path/to/assets/image-....png
/// ...
/// </image_files>
///
/// <user_query>
/// user text
/// </user_query>
/// ```
pub(crate) fn parse_grok_user_prompt_for_display(text: &str) -> (String, Vec<String>) {
    let images = extract_grok_image_files_paths(text);
    let display = strip_user_query_wrapper(text);
    // If strip left residual image_files markup (no closing user_query), drop it.
    let display = if display.contains("<image_files>") {
        display
            .split("</image_files>")
            .nth(1)
            .unwrap_or("")
            .trim()
            .to_string()
    } else {
        display
    };
    (display, images)
}

fn extract_grok_image_files_paths(text: &str) -> Vec<String> {
    let Some(start) = text.find("<image_files>") else {
        return Vec::new();
    };
    let after = &text[start + "<image_files>".len()..];
    let block = after.split("</image_files>").next().unwrap_or(after);
    let mut paths = Vec::new();
    for line in block.lines() {
        let trimmed = line.trim();
        // Numbered list: `1. /abs/path.png`
        let candidate = if let Some((_idx, rest)) = trimmed.split_once(". ") {
            rest.trim()
        } else {
            trimmed
        };
        if candidate.is_empty() {
            continue;
        }
        let looks_absolute = candidate.starts_with('/')
            || candidate.starts_with("%2F")
            || candidate.starts_with("%2f")
            || (candidate.len() >= 3
                && candidate.as_bytes()[0].is_ascii_alphabetic()
                && (candidate.as_bytes()[1] == b':' || candidate.as_bytes()[1] == b'|')
                && (candidate.as_bytes()[2] == b'/' || candidate.as_bytes()[2] == b'\\'))
            || candidate.starts_with("\\\\");
        if !looks_absolute {
            continue;
        }
        let lower = candidate.to_ascii_lowercase();
        let looks_image = lower.contains(".png")
            || lower.contains(".jpg")
            || lower.contains(".jpeg")
            || lower.contains(".gif")
            || lower.contains(".webp")
            || lower.contains(".bmp")
            || lower.contains("/assets/image-")
            || lower.contains("\\assets\\image-")
            || lower.contains("/assets/")
            || lower.contains("\\assets\\");
        if !looks_image {
            continue;
        }
        if !paths.iter().any(|existing: &String| existing == candidate) {
            paths.push(candidate.to_string());
        }
    }
    paths
}

fn stringify_tool_result_content(content: Option<&Value>) -> String {
    match content {
        Some(Value::String(text)) => text.clone(),
        Some(other) => serde_json::to_string(other).unwrap_or_default(),
        None => String::new(),
    }
}

/// Resolve tool name from Grok 4.5 flat calls (`name`) or OpenAI-style nested
/// (`function.name`). Only fall back to `"tool"` when both are missing.
fn resolve_tool_call_name(call: &Value) -> String {
    if let Some(name) = call
        .get("name")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|name| !name.is_empty())
    {
        return name.to_string();
    }
    if let Some(name) = call
        .get("function")
        .and_then(|function| function.get("name"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|name| !name.is_empty())
    {
        return name.to_string();
    }
    "tool".to_string()
}

/// Resolve tool arguments from flat `arguments` or nested `function.arguments`.
/// JSON strings are parsed into objects when possible.
fn resolve_tool_call_arguments(call: &Value) -> Option<Value> {
    let arguments = call
        .get("arguments")
        .or_else(|| {
            call.get("function")
                .and_then(|function| function.get("arguments"))
        })?;
    if let Some(raw) = arguments.as_str() {
        return serde_json::from_str::<Value>(raw)
            .ok()
            .or_else(|| Some(Value::String(raw.to_string())));
    }
    Some(arguments.clone())
}

/// Parse `chat_history.jsonl` content into normalized messages.
/// Grok history lines carry no usage data, so `usage` is always `None`.
fn parse_messages_from_chat_history(raw: &str) -> GrokSessionLoadResult {
    let mut messages: Vec<GrokSessionMessage> = Vec::new();
    let mut counter = 0usize;

    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || !line.contains("\"type\"") {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let line_type = value.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let timestamp = extract_timestamp_text(&value);

        match line_type {
            "user" => {
                // Synthetic reminders (`synthetic_reason`) are not user prompts.
                if value.get("synthetic_reason").is_some() {
                    continue;
                }
                let raw_text = extract_content_text(value.get("content"));
                // Grok also injects `<user_info>` / `<git_status>` as plain user
                // lines without `synthetic_reason` — hide those from the UI.
                if is_grok_runtime_context_user_text(&raw_text) {
                    continue;
                }
                let (display_text, image_paths) = parse_grok_user_prompt_for_display(&raw_text);
                if display_text.is_empty() && image_paths.is_empty() {
                    continue;
                }
                counter += 1;
                messages.push(GrokSessionMessage {
                    id: format!("grok-user-{}", counter),
                    role: "user".to_string(),
                    text: display_text,
                    images: if image_paths.is_empty() {
                        None
                    } else {
                        Some(image_paths)
                    },
                    timestamp,
                    kind: "message".to_string(),
                    tool_type: None,
                    title: None,
                    tool_input: None,
                    tool_output: None,
                });
            }
            "reasoning" => {
                let text = extract_reasoning_summary(value.get("summary"));
                if text.trim().is_empty() {
                    continue;
                }
                let part_id = value
                    .get("id")
                    .and_then(|v| v.as_str())
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| {
                        counter += 1;
                        format!("grok-reasoning-{}", counter)
                    });
                messages.push(GrokSessionMessage {
                    id: format!("{}-reasoning", part_id),
                    role: "assistant".to_string(),
                    text,
                    images: None,
                    timestamp,
                    kind: "reasoning".to_string(),
                    tool_type: None,
                    title: None,
                    tool_input: None,
                    tool_output: None,
                });
            }
            "assistant" => {
                let text = extract_content_text(value.get("content"));
                if !text.trim().is_empty() {
                    counter += 1;
                    messages.push(GrokSessionMessage {
                        id: format!("grok-assistant-{}", counter),
                        role: "assistant".to_string(),
                        text,
                        images: None,
                        timestamp: timestamp.clone(),
                        kind: "message".to_string(),
                        tool_type: None,
                        title: None,
                        tool_input: None,
                        tool_output: None,
                    });
                }
                if let Some(tool_calls) = value.get("tool_calls").and_then(|v| v.as_array()) {
                    for call in tool_calls {
                        let tool_name = resolve_tool_call_name(call);
                        let call_id = call
                            .get("id")
                            .and_then(|v| v.as_str())
                            .map(|value| value.to_string())
                            .unwrap_or_else(|| {
                                counter += 1;
                                format!("grok-tool-{}", counter)
                            });
                        let input_value = resolve_tool_call_arguments(call);
                        let input_text = input_value
                            .as_ref()
                            .and_then(|v| serde_json::to_string_pretty(v).ok())
                            .unwrap_or_default();
                        messages.push(GrokSessionMessage {
                            id: call_id,
                            role: "assistant".to_string(),
                            text: input_text,
                            images: None,
                            timestamp: timestamp.clone(),
                            kind: "tool".to_string(),
                            tool_type: Some(tool_name.clone()),
                            title: Some(tool_name),
                            tool_input: input_value,
                            tool_output: None,
                        });
                    }
                }
            }
            "tool_result" => {
                let output_text = stringify_tool_result_content(value.get("content"));
                if output_text.trim().is_empty() {
                    continue;
                }
                let call_id = value
                    .get("tool_call_id")
                    .and_then(|v| v.as_str())
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| {
                        counter += 1;
                        format!("grok-tool-{}", counter)
                    });
                messages.push(GrokSessionMessage {
                    id: format!("{}-result", call_id),
                    role: "assistant".to_string(),
                    text: output_text,
                    images: None,
                    timestamp,
                    kind: "tool".to_string(),
                    tool_type: Some("result".to_string()),
                    title: Some("Result".to_string()),
                    tool_input: None,
                    tool_output: value.get("content").cloned(),
                });
            }
            _ => {}
        }
    }

    GrokSessionLoadResult {
        messages,
        usage: None,
    }
}

/// Extract the first real user prompt text from `chat_history.jsonl` content.
fn first_user_prompt_text(raw: &str) -> Option<String> {
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() || !line.contains("\"type\":\"user\"") {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if value.get("synthetic_reason").is_some() {
            continue;
        }
        let raw = extract_content_text(value.get("content"));
        if is_grok_runtime_context_user_text(&raw) {
            continue;
        }
        let (display_text, image_paths) = parse_grok_user_prompt_for_display(&raw);
        let preview = if display_text.is_empty() && !image_paths.is_empty() {
            format!("[{} image(s)]", image_paths.len())
        } else {
            display_text
        };
        if !preview.is_empty() {
            return Some(preview);
        }
    }
    None
}

/// Build a sidebar summary from one session directory. Best-effort: missing
/// or malformed `summary.json` degrades individual fields instead of dropping
/// the session.
async fn build_summary_from_session_dir(
    session_id: &str,
    session_dir: &Path,
) -> GrokSessionSummary {
    let summary_path = session_dir.join("summary.json");
    let chat_history_path = session_dir.join("chat_history.jsonl");

    let summary_value = fs::read_to_string(&summary_path)
        .await
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok());
    let chat_history_raw = fs::read_to_string(&chat_history_path).await.ok();

    let file_mtime_millis = std::fs::metadata(&chat_history_path)
        .or_else(|_| std::fs::metadata(&summary_path))
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64);

    let created_at = summary_value
        .as_ref()
        .and_then(|summary| summary.get("created_at"))
        .and_then(|v| v.as_str())
        .and_then(parse_timestamp_millis)
        .or(file_mtime_millis)
        .unwrap_or_else(|| chrono::Utc::now().timestamp_millis());
    let updated_at = summary_value
        .as_ref()
        .and_then(|summary| summary.get("updated_at"))
        .and_then(|v| v.as_str())
        .and_then(parse_timestamp_millis)
        .or(file_mtime_millis)
        .unwrap_or(created_at);

    let title = summary_value
        .as_ref()
        .and_then(|summary| summary.get("session_summary"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
        .or_else(|| {
            summary_value
                .as_ref()
                .and_then(|summary| summary.get("generated_title"))
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string())
        });

    let message_count = summary_value
        .as_ref()
        .and_then(|summary| summary.get("num_chat_messages"))
        .and_then(|v| v.as_u64())
        .or_else(|| {
            summary_value
                .as_ref()
                .and_then(|summary| summary.get("num_messages"))
                .and_then(|v| v.as_u64())
        })
        .map(|value| value as usize)
        .or_else(|| {
            chat_history_raw.as_deref().map(|raw| {
                raw.lines()
                    .filter(|line| line.contains("\"type\":\"user\""))
                    .count()
            })
        })
        .unwrap_or(0);

    // Prefer the human's first real prompt over Grok's AI `generated_title`
    // so the sidebar shows e.g. "你好" instead of "Chinese Hello Greeting Session".
    let first_message = chat_history_raw
        .as_deref()
        .and_then(first_user_prompt_text)
        .or(title)
        .map(|text| truncate_chars(&text, 60))
        .unwrap_or_else(|| session_id.to_string());

    let file_size_bytes = std::fs::metadata(&chat_history_path)
        .or_else(|_| std::fs::metadata(&summary_path))
        .ok()
        .map(|metadata| metadata.len());

    GrokSessionSummary {
        canonical_session_id: Some(session_id.to_string()),
        session_id: session_id.to_string(),
        first_message,
        updated_at,
        created_at,
        message_count,
        file_size_bytes,
        engine: Some("grok".to_string()),
        attribution_status: Some("strict-match".to_string()),
    }
}

/// Collect `(session_id, session_dir)` pairs whose decoded cwd matches the
/// workspace path variants.
async fn resolve_workspace_session_dirs(
    workspace_path: &Path,
    custom_home: Option<&str>,
) -> Vec<(String, PathBuf)> {
    let sessions_root = resolve_grok_base_dir(custom_home).join("sessions");
    let workspace_variants = build_workspace_path_variants(workspace_path);
    let mut matches = Vec::new();

    let mut cwd_dirs = match fs::read_dir(&sessions_root).await {
        Ok(dirs) => dirs,
        Err(_) => return matches,
    };
    while let Ok(Some(cwd_entry)) = cwd_dirs.next_entry().await {
        let cwd_path = cwd_entry.path();
        if !cwd_path.is_dir() {
            continue;
        }
        let Some(encoded_name) = cwd_path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let decoded_cwd = url_decode_dir_name(encoded_name);
        if decoded_cwd.trim().is_empty()
            || !matches_workspace_path(&decoded_cwd, &workspace_variants)
        {
            continue;
        }
        let mut session_dirs = match fs::read_dir(&cwd_path).await {
            Ok(dirs) => dirs,
            Err(_) => continue,
        };
        while let Ok(Some(session_entry)) = session_dirs.next_entry().await {
            let session_path = session_entry.path();
            if !session_path.is_dir() {
                continue;
            }
            let Some(session_id) = session_path.file_name().and_then(|name| name.to_str()) else {
                continue;
            };
            if session_id.trim().is_empty() {
                continue;
            }
            matches.push((session_id.to_string(), session_path));
        }
    }
    matches
}

/// List Grok sessions for a workspace path.
pub async fn list_grok_sessions(
    workspace_path: &Path,
    limit: Option<usize>,
    custom_home: Option<&str>,
) -> Result<Vec<GrokSessionSummary>, String> {
    timeout(LOCAL_SESSION_SCAN_TIMEOUT, async {
        let session_dirs = resolve_workspace_session_dirs(workspace_path, custom_home).await;
        let mut sessions = Vec::new();
        for (session_id, session_dir) in session_dirs {
            sessions.push(build_summary_from_session_dir(&session_id, &session_dir).await);
        }
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        sessions.truncate(limit.unwrap_or(200));
        Ok(sessions)
    })
    .await
    .map_err(|_| "Grok session scan timed out".to_string())?
}

async fn find_workspace_session_dir(
    workspace_path: &Path,
    session_id: &str,
    custom_home: Option<&str>,
) -> Result<PathBuf, String> {
    let normalized_session_id = normalize_session_id(session_id)?;
    let session_dirs = timeout(
        LOCAL_SESSION_SCAN_TIMEOUT,
        resolve_workspace_session_dirs(workspace_path, custom_home),
    )
    .await
    .map_err(|_| "Grok session scan timed out".to_string())?;
    session_dirs
        .into_iter()
        .find(|(candidate, _)| candidate.trim() == normalized_session_id)
        .map(|(_, session_dir)| session_dir)
        .ok_or_else(|| format!("Grok session not found: {}", normalized_session_id))
}

/// Load full Grok session messages by session id.
pub async fn load_grok_session(
    workspace_path: &Path,
    session_id: &str,
    custom_home: Option<&str>,
) -> Result<GrokSessionLoadResult, String> {
    let session_dir = find_workspace_session_dir(workspace_path, session_id, custom_home).await?;
    let chat_history_path = session_dir.join("chat_history.jsonl");
    let raw = fs::read_to_string(&chat_history_path)
        .await
        .map_err(|error| {
            format!(
                "Failed to read Grok session chat history {}: {}",
                chat_history_path.display(),
                error
            )
        })?;
    Ok(parse_messages_from_chat_history(&raw))
}

/// Delete a Grok session: remove the whole session directory.
pub async fn delete_grok_session(
    workspace_path: &Path,
    session_id: &str,
    custom_home: Option<&str>,
) -> Result<(), String> {
    let normalized_session_id = normalize_session_id(session_id)?;
    let session_dir =
        find_workspace_session_dir(workspace_path, &normalized_session_id, custom_home).await?;

    if session_dir.exists() {
        fs::remove_dir_all(&session_dir).await.map_err(|error| {
            format!(
                "[IO_ERROR] Failed to delete Grok session dir {}: {}",
                session_dir.display(),
                error
            )
        })?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        first_user_prompt_text, is_grok_runtime_context_user_text, matches_workspace_path,
        parse_grok_user_prompt_for_display, parse_messages_from_chat_history,
        parse_timestamp_millis, strip_user_query_wrapper, url_decode_dir_name,
    };
    use std::path::Path;

    #[test]
    fn parses_user_assistant_reasoning_and_tool_lines() {
        let chat_history = concat!(
            "{\"type\":\"system\",\"content\":\"you are grok\"}\n",
            "{\"type\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"<system-reminder>ignore</system-reminder>\"}],\"synthetic_reason\":\"reminder\"}\n",
            "{\"type\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"<user_query>\\nfirst word of /tmp/test?\\n</user_query>\"}],\"prompt_index\":0}\n",
            "{\"type\":\"reasoning\",\"id\":\"r1\",\"summary\":\"user wants a file read\",\"encrypted_content\":\"...\",\"status\":\"done\"}\n",
            "{\"type\":\"assistant\",\"content\":\"Let me read it.\",\"tool_calls\":[{\"id\":\"call_1\",\"type\":\"function\",\"function\":{\"name\":\"Read\",\"arguments\":\"{\\\"path\\\":\\\"/tmp/test\\\"}\"}}],\"model_id\":\"grok-build\"}\n",
            "{\"type\":\"tool_result\",\"tool_call_id\":\"call_1\",\"content\":\"1→test file content\\n\"}\n",
            "{\"type\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"The first word is \"},{\"type\":\"text\",\"text\":\"test\"}],\"model_id\":\"grok-build\"}\n"
        );

        let result = parse_messages_from_chat_history(chat_history);

        assert_eq!(result.messages.len(), 6);
        assert_eq!(result.messages[0].role, "user");
        assert_eq!(result.messages[0].text, "first word of /tmp/test?");
        assert_eq!(result.messages[0].kind, "message");
        assert_eq!(result.messages[1].kind, "reasoning");
        assert_eq!(result.messages[1].text, "user wants a file read");
        assert_eq!(result.messages[2].kind, "message");
        assert_eq!(result.messages[2].text, "Let me read it.");
        assert_eq!(result.messages[3].kind, "tool");
        assert_eq!(result.messages[3].tool_type.as_deref(), Some("Read"));
        assert_eq!(result.messages[3].title.as_deref(), Some("Read"));
        assert_eq!(
            result.messages[3].tool_input,
            Some(serde_json::json!({"path": "/tmp/test"}))
        );
        assert_eq!(result.messages[4].id, "call_1-result");
        assert_eq!(result.messages[4].tool_type.as_deref(), Some("result"));
        assert_eq!(result.messages[4].text, "1→test file content\n");
        assert_eq!(result.messages[5].text, "The first word is \ntest");
        assert!(result.usage.is_none());
    }

    #[test]
    fn parses_flat_tool_calls_with_top_level_name_and_arguments() {
        // Grok 4.5 / agent sessions use flat tool_calls (no nested `function`).
        let chat_history = concat!(
            "{\"type\":\"assistant\",\"content\":\"\",\"tool_calls\":[{\"id\":\"call-flat-1\",\"name\":\"read_file\",\"arguments\":\"{\\\"target_file\\\":\\\"src/a.ts\\\"}\"},{\"id\":\"call-flat-2\",\"name\":\"grep\",\"arguments\":{\"pattern\":\"foo\",\"path\":\"src\"}},{\"id\":\"call-flat-3\",\"name\":\"run_terminal_command\",\"arguments\":\"{\\\"command\\\":\\\"ls\\\"}\"}]}\n",
            "{\"type\":\"tool_result\",\"tool_call_id\":\"call-flat-1\",\"content\":\"file body\"}\n",
            "{\"type\":\"tool_result\",\"tool_call_id\":\"call-flat-2\",\"content\":\"match\"}\n"
        );

        let result = parse_messages_from_chat_history(chat_history);
        assert_eq!(result.messages.len(), 5);

        assert_eq!(result.messages[0].kind, "tool");
        assert_eq!(result.messages[0].id, "call-flat-1");
        assert_eq!(result.messages[0].tool_type.as_deref(), Some("read_file"));
        assert_eq!(result.messages[0].title.as_deref(), Some("read_file"));
        assert_eq!(
            result.messages[0].tool_input,
            Some(serde_json::json!({"target_file": "src/a.ts"}))
        );

        assert_eq!(result.messages[1].tool_type.as_deref(), Some("grep"));
        assert_eq!(result.messages[1].title.as_deref(), Some("grep"));
        assert_eq!(
            result.messages[1].tool_input,
            Some(serde_json::json!({"pattern": "foo", "path": "src"}))
        );

        assert_eq!(
            result.messages[2].tool_type.as_deref(),
            Some("run_terminal_command")
        );
        assert_eq!(
            result.messages[2].title.as_deref(),
            Some("run_terminal_command")
        );

        assert_eq!(result.messages[3].id, "call-flat-1-result");
        assert_eq!(result.messages[3].text, "file body");
        assert_eq!(result.messages[4].id, "call-flat-2-result");
        assert_eq!(result.messages[4].text, "match");
    }

    #[test]
    fn flat_tool_call_prefers_top_level_name_over_missing_function() {
        let chat_history = concat!(
            "{\"type\":\"assistant\",\"content\":\"\",\"tool_calls\":[{\"id\":\"call-x\",\"arguments\":\"{}\"}]}\n"
        );
        let result = parse_messages_from_chat_history(chat_history);
        assert_eq!(result.messages.len(), 1);
        assert_eq!(result.messages[0].tool_type.as_deref(), Some("tool"));
        assert_eq!(result.messages[0].title.as_deref(), Some("tool"));
    }

    #[test]
    fn skips_system_synthetic_and_unknown_lines() {
        let chat_history = concat!(
            "{\"type\":\"system\",\"content\":\"sys\"}\n",
            "{\"type\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"nope\"}],\"synthetic_reason\":\"reminder\"}\n",
            "{\"type\":\"max_turns_reached\"}\n",
            "{\"type\":\"auto_compact_started\"}\n",
            "not json at all\n",
            "{\"type\":\"reasoning\",\"summary\":[\"part one\",{\"text\":\"part two\"}]}\n"
        );

        let result = parse_messages_from_chat_history(chat_history);

        assert_eq!(result.messages.len(), 1);
        assert_eq!(result.messages[0].kind, "reasoning");
        assert_eq!(result.messages[0].text, "part one\npart two");
    }

    #[test]
    fn skips_user_info_git_status_envelopes_without_synthetic_reason() {
        let chat_history = concat!(
            r#"{"type":"user","content":[{"type":"text","text":"<user_info>\nOS Version: macos\nShell: /bin/zsh\nWorkspace Path: /tmp/repo\nToday's date: 2026-07-31\n</user_info>"}]}"#,
            "\n",
            r#"{"type":"user","content":[{"type":"text","text":"<user_info>\nOS Version: macos\n</user_info>\n\n<git_status>\n## main\n M src/a.ts\n</git_status>"}]}"#,
            "\n",
            r#"{"type":"user","content":[{"type":"text","text":"<system-reminder>\nAs you answer...\n</system-reminder>"}],"synthetic_reason":"project_instructions"}"#,
            "\n",
            r#"{"type":"user","content":[{"type":"text","text":"<user_query>\n你好\n</user_query>"}],"prompt_index":0}"#,
            "\n",
            r#"{"type":"assistant","content":"你好。我是 Grok。","model_id":"grok-build"}"#,
            "\n",
        );

        let result = parse_messages_from_chat_history(chat_history);
        assert_eq!(result.messages.len(), 2);
        assert_eq!(result.messages[0].role, "user");
        assert_eq!(result.messages[0].text, "你好");
        assert_eq!(result.messages[1].role, "assistant");
        assert_eq!(result.messages[1].text, "你好。我是 Grok。");
    }

    #[test]
    fn first_user_prompt_skips_runtime_context_and_returns_real_query() {
        let chat_history = concat!(
            r#"{"type":"user","content":[{"type":"text","text":"<user_info>\nOS Version: macos\n</user_info>"}]}"#,
            "\n",
            r#"{"type":"user","content":[{"type":"text","text":"<user_query>\n你好\n</user_query>"}],"prompt_index":0}"#,
            "\n",
        );
        assert_eq!(
            first_user_prompt_text(chat_history).as_deref(),
            Some("你好")
        );
        assert!(is_grok_runtime_context_user_text(
            "<user_info>\nOS Version: macos\n</user_info>"
        ));
        assert!(!is_grok_runtime_context_user_text(
            "<user_query>\n你好\n</user_query>"
        ));
        assert!(!is_grok_runtime_context_user_text("plain hello"));
    }

    #[test]
    fn strips_user_query_wrapper() {
        assert_eq!(
            strip_user_query_wrapper("<user_query>\nhello world\n</user_query>"),
            "hello world"
        );
        assert_eq!(strip_user_query_wrapper("plain text"), "plain text");
        assert_eq!(strip_user_query_wrapper("  padded  "), "padded");
    }

    #[test]
    fn parses_multimodal_image_files_and_user_query() {
        let raw = concat!(
            "<image_files>\n",
            "The following images were provided by the user and saved to the workspace for future use:\n",
            "1. /Users/me/.grok/sessions/%2Fcode%2Fcontent/abc/assets/image-1.png\n",
            "\n",
            "These images can be copied for use in other locations.\n",
            "</image_files>\n",
            "\n",
            "<user_query>\n",
            "你看这是啥\n",
            "</user_query>",
        );
        let (display, images) = parse_grok_user_prompt_for_display(raw);
        assert_eq!(display, "你看这是啥");
        assert_eq!(
            images,
            vec!["/Users/me/.grok/sessions/%2Fcode%2Fcontent/abc/assets/image-1.png".to_string()]
        );
    }

    #[test]
    fn history_loader_extracts_images_from_image_files_block() {
        let chat_history = concat!(
            r#"{"type":"user","content":[{"type":"text","text":"<image_files>\nThe following images were provided by the user and saved to the workspace for future use:\n1. /tmp/assets/image-abc.png\n\nThese images can be copied for use in other locations.\n</image_files>\n\n<user_query>\n看图\n</user_query>"}],"prompt_index":0}"#,
            "\n",
        );
        let result = parse_messages_from_chat_history(chat_history);
        assert_eq!(result.messages.len(), 1);
        assert_eq!(result.messages[0].role, "user");
        assert_eq!(result.messages[0].text, "看图");
        assert_eq!(
            result.messages[0].images.as_deref(),
            Some(&["/tmp/assets/image-abc.png".to_string()][..])
        );
    }

    #[test]
    fn decodes_url_encoded_cwd_dir_names() {
        assert_eq!(url_decode_dir_name("%2Fprivate%2Ftmp"), "/private/tmp");
        assert_eq!(
            url_decode_dir_name("%2FUsers%2Fdemo%2Fmy%20repo"),
            "/Users/demo/my repo"
        );
        assert_eq!(url_decode_dir_name("plain"), "plain");
    }

    #[test]
    fn matches_workspace_path_variants() {
        let variants = vec![
            "/Users/demo/repo".to_string(),
            "/private/Users/demo/repo".to_string(),
        ];
        assert!(matches_workspace_path("/Users/demo/repo", &variants));
        assert!(matches_workspace_path(
            "/private/Users/demo/repo",
            &variants
        ));
        assert!(!matches_workspace_path("/Users/demo/other", &variants));
        assert!(!matches_workspace_path("", &variants));
    }

    #[test]
    fn parses_rfc3339_timestamps() {
        assert_eq!(
            parse_timestamp_millis("2026-07-27T06:31:41.023Z"),
            Some(1785133901023)
        );
        assert_eq!(parse_timestamp_millis("not-a-date"), None);
    }

    #[test]
    fn workspace_match_requires_variants() {
        assert!(!matches_workspace_path("/tmp", &[]));
        let _ = Path::new("/tmp");
    }

    #[tokio::test]
    async fn lists_loads_and_deletes_sessions_from_fixture_dirs() {
        let fixture_root = std::env::temp_dir().join(format!(
            "ccgui-grok-history-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let workspace = fixture_root.join("workspace");
        let grok_home = fixture_root.join("grok-home");
        std::fs::create_dir_all(&workspace).expect("create workspace");
        let canonical_workspace = std::fs::canonicalize(&workspace).expect("canonical workspace");
        let encoded_cwd = {
            let raw = canonical_workspace.to_string_lossy().to_string();
            raw.chars()
                .map(|ch| match ch {
                    'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => ch.to_string(),
                    _ => format!("%{:02X}", ch as u32),
                })
                .collect::<String>()
        };
        let session_dir = grok_home
            .join("sessions")
            .join(&encoded_cwd)
            .join("019fa245-0000-4000-8000-000000000001");
        std::fs::create_dir_all(&session_dir).expect("create session dir");
        std::fs::write(
            session_dir.join("summary.json"),
            "{\"info\":{\"id\":\"019fa245-0000-4000-8000-000000000001\",\"cwd\":\"/tmp\"},\"session_summary\":\"Fixture title\",\"created_at\":\"2026-07-27T06:31:41.023Z\",\"updated_at\":\"2026-07-27T07:31:41.023Z\",\"num_messages\":3,\"num_chat_messages\":2}",
        )
        .expect("write summary");
        std::fs::write(
            session_dir.join("chat_history.jsonl"),
            concat!(
                "{\"type\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"<user_query>\\nhello\\n</user_query>\"}],\"prompt_index\":0}\n",
                "{\"type\":\"assistant\",\"content\":\"hi\",\"model_id\":\"grok-build\"}\n"
            ),
        )
        .expect("write chat history");

        let listed =
            super::list_grok_sessions(&workspace, None, Some(grok_home.to_string_lossy().as_ref()))
                .await
                .expect("list sessions");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].session_id, "019fa245-0000-4000-8000-000000000001");
        // Prefer first real user prompt over Grok generated_title / session_summary.
        assert_eq!(listed[0].first_message, "hello");
        assert_eq!(listed[0].message_count, 2);
        assert_eq!(listed[0].engine.as_deref(), Some("grok"));

        let loaded = super::load_grok_session(
            &workspace,
            "019fa245-0000-4000-8000-000000000001",
            Some(grok_home.to_string_lossy().as_ref()),
        )
        .await
        .expect("load session");
        assert_eq!(loaded.messages.len(), 2);
        assert_eq!(loaded.messages[0].text, "hello");
        assert_eq!(loaded.messages[1].text, "hi");

        super::delete_grok_session(
            &workspace,
            "019fa245-0000-4000-8000-000000000001",
            Some(grok_home.to_string_lossy().as_ref()),
        )
        .await
        .expect("delete session");
        assert!(!session_dir.exists());
        let remaining =
            super::list_grok_sessions(&workspace, None, Some(grok_home.to_string_lossy().as_ref()))
                .await
                .expect("list after delete");
        assert!(remaining.is_empty());

        let _ = std::fs::remove_dir_all(&fixture_root);
    }
}
