use std::fs::{self, File};
use std::io::{ErrorKind, Read};
use std::path::Path;

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use super::{
    ContextSourceEntry, NativeHistoryCapability, NativeHistoryEngine, NativeHistoryError,
    NativeHistoryErrorCode, NativeHistoryFidelity, NativeHistoryReadResult, NativeHistorySource,
};
use crate::shared_context::{OmissionDisposition, ProjectionOmission};

const MAX_NATIVE_HISTORY_BYTES: u64 = 64 * 1024 * 1024;

fn sha256(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn map_io_error(path: &Path, error: std::io::Error) -> NativeHistoryError {
    let code = match error.kind() {
        ErrorKind::NotFound => NativeHistoryErrorCode::SourceNotFound,
        ErrorKind::PermissionDenied => NativeHistoryErrorCode::PermissionDenied,
        _ => NativeHistoryErrorCode::SourceCorrupt,
    };
    NativeHistoryError::new(code, format!("{}: {error}", path.display()))
}

fn cursor(size: u64, checksum: &str) -> String {
    format!("jsonl-v1:{size}:{checksum}")
}

fn parse_cursor(value: &str) -> Result<(u64, &str), NativeHistoryError> {
    let mut parts = value.splitn(3, ':');
    if parts.next() != Some("jsonl-v1") {
        return Err(NativeHistoryError::new(
            NativeHistoryErrorCode::InvalidRequest,
            "unsupported native history cursor",
        ));
    }
    let size = parts
        .next()
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or_else(|| {
            NativeHistoryError::new(
                NativeHistoryErrorCode::InvalidRequest,
                "invalid native history cursor size",
            )
        })?;
    let checksum = parts
        .next()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            NativeHistoryError::new(
                NativeHistoryErrorCode::InvalidRequest,
                "invalid native history cursor checksum",
            )
        })?;
    Ok((size, checksum))
}

fn bounded_bytes(path: &Path, size: u64) -> Result<Vec<u8>, NativeHistoryError> {
    if size > MAX_NATIVE_HISTORY_BYTES {
        return Err(NativeHistoryError::new(
            NativeHistoryErrorCode::SourceTooLarge,
            format!(
                "native history size {size} exceeds supported limit {MAX_NATIVE_HISTORY_BYTES}"
            ),
        ));
    }
    let capacity = usize::try_from(size).map_err(|_| {
        NativeHistoryError::new(
            NativeHistoryErrorCode::SourceTooLarge,
            "native history size cannot be represented on this platform",
        )
    })?;
    let file = File::open(path).map_err(|error| map_io_error(path, error))?;
    let current_size = file
        .metadata()
        .map_err(|error| map_io_error(path, error))?
        .len();
    if current_size < size {
        return Err(NativeHistoryError::new(
            NativeHistoryErrorCode::SourceDrifted,
            "native history was truncated after probe",
        ));
    }
    let mut bytes = Vec::with_capacity(capacity);
    file.take(size)
        .read_to_end(&mut bytes)
        .map_err(|error| map_io_error(path, error))?;
    if bytes.len() as u64 != size {
        return Err(NativeHistoryError::new(
            NativeHistoryErrorCode::SourceDrifted,
            "native history boundary could not be read completely",
        ));
    }
    Ok(bytes)
}

pub fn read_history_text_bounded(path: &Path) -> Result<String, NativeHistoryError> {
    let size = fs::metadata(path)
        .map_err(|error| map_io_error(path, error))?
        .len();
    String::from_utf8(bounded_bytes(path, size)?).map_err(|error| {
        NativeHistoryError::new(
            NativeHistoryErrorCode::SourceCorrupt,
            format!("native history is not UTF-8: {error}"),
        )
    })
}

fn string_at<'a>(value: &'a Value, paths: &[&[&str]]) -> Option<&'a str> {
    paths.iter().find_map(|path| {
        let mut current = value;
        for key in *path {
            current = current.get(*key)?;
        }
        current.as_str()
    })
}

fn role_of(value: &Value, engine: NativeHistoryEngine) -> String {
    let role = string_at(
        value,
        &[
            &["message", "role"],
            &["payload", "message", "role"],
            &["payload", "role"],
            &["role"],
        ],
    );
    if let Some(role) = role {
        return role.to_ascii_lowercase();
    }
    let entry_type = string_at(value, &[&["type"], &["payload", "type"]]).unwrap_or("");
    match (engine, entry_type) {
        (_, kind) if kind.contains("tool") || kind.contains("function") => "tool",
        (NativeHistoryEngine::Kimi, "turn.prompt") => "user",
        (_, kind) if kind.contains("user") => "user",
        (_, kind) if kind.contains("assistant") || kind.contains("agent") => "assistant",
        _ => "control",
    }
    .to_string()
}

fn private_block_type(value: &Value) -> bool {
    let kind = value
        .get("type")
        .or_else(|| value.get("kind"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_ascii_lowercase();
    kind.contains("thinking")
        || kind.contains("reasoning")
        || kind.contains("signature")
        || kind.contains("encrypted")
        || kind.contains("redacted")
        || value.get("signature").is_some()
        || value.get("encrypted_content").is_some()
        || value.get("encryptedContent").is_some()
        || value.get("redacted_content").is_some()
        || value.get("redactedContent").is_some()
        || value.get("thinking_signature").is_some()
}

fn tool_block(value: &Value, engine: NativeHistoryEngine) -> Option<Value> {
    let kind = value.get("type").and_then(Value::as_str).unwrap_or("");
    let (direction, call_id) = match (engine, kind) {
        (NativeHistoryEngine::Claude, "tool_use") => {
            ("call", value.get("id").and_then(Value::as_str)?)
        }
        (NativeHistoryEngine::Claude, "tool_result") => {
            ("result", value.get("tool_use_id").and_then(Value::as_str)?)
        }
        (NativeHistoryEngine::Codex, "function_call" | "custom_tool_call") => {
            ("call", value.get("call_id").and_then(Value::as_str)?)
        }
        (NativeHistoryEngine::Codex, "function_call_output" | "custom_tool_call_output") => {
            ("result", value.get("call_id").and_then(Value::as_str)?)
        }
        (NativeHistoryEngine::Kimi, "tool.call") => (
            "call",
            value
                .get("toolCallId")
                .or_else(|| value.get("uuid"))
                .and_then(Value::as_str)?,
        ),
        (NativeHistoryEngine::Kimi, "tool.result") => (
            "result",
            value
                .get("toolCallId")
                .or_else(|| value.get("parentUuid"))
                .and_then(Value::as_str)?,
        ),
        _ => return None,
    };
    Some(json!({
        "kind": format!("tool-{direction}"),
        "callId": call_id,
        "value": value,
    }))
}

fn blocks_of(value: &Value, engine: NativeHistoryEngine) -> (Vec<Value>, usize, usize) {
    if private_block_type(value) || value.get("payload").is_some_and(private_block_type) {
        return (Vec::new(), 1, 0);
    }
    if engine == NativeHistoryEngine::Codex
        && value.get("type").and_then(Value::as_str) == Some("response_item")
    {
        if let Some(payload) = value.get("payload") {
            if let Some(block) = tool_block(payload, engine) {
                return (vec![block], 0, 0);
            }
        }
    }
    for path in [
        &["message", "content"][..],
        &["payload", "message", "content"][..],
        &["payload", "content"][..],
        &["content"][..],
        &["input"][..],
    ] {
        let mut current = value;
        let mut found = true;
        for key in path {
            let Some(next) = current.get(*key) else {
                found = false;
                break;
            };
            current = next;
        }
        if !found {
            continue;
        }
        if let Some(text) = current.as_str() {
            return (vec![json!({ "kind": "text", "text": text })], 0, 0);
        }
        if let Some(items) = current.as_array() {
            let mut blocks = Vec::new();
            let mut private_count = 0;
            let mut unknown_count = 0;
            for item in items {
                if private_block_type(item) {
                    private_count += 1;
                } else if let Some(block) = tool_block(item, engine) {
                    blocks.push(block);
                } else if let Some(text) = item.get("text").and_then(Value::as_str) {
                    let kind = item.get("type").and_then(Value::as_str).unwrap_or("text");
                    if matches!(kind, "text" | "input_text" | "output_text") {
                        blocks.push(json!({ "kind": "text", "text": text }));
                    } else {
                        unknown_count += 1;
                    }
                } else {
                    unknown_count += 1;
                }
            }
            return (blocks, private_count, unknown_count);
        }
    }
    if let Some(block) = tool_block(value, engine) {
        return (vec![block], 0, 0);
    }
    if private_block_type(value) {
        (Vec::new(), 1, 0)
    } else {
        (Vec::new(), 0, 1)
    }
}

fn timestamp_of(value: &Value) -> Option<i64> {
    value
        .get("time")
        .or_else(|| value.get("timestamp"))
        .or_else(|| {
            value
                .get("payload")
                .and_then(|payload| payload.get("timestamp"))
        })
        .and_then(|timestamp| {
            timestamp
                .as_i64()
                .or_else(|| timestamp.as_str()?.parse::<i64>().ok())
        })
}

struct EffectiveHistoryRecord {
    value: Value,
    source_line: usize,
    replacement_index: Option<usize>,
    fallback_id: String,
}

fn effective_history_records(
    text: &str,
    engine: NativeHistoryEngine,
) -> Result<Vec<EffectiveHistoryRecord>, NativeHistoryError> {
    let mut records = Vec::new();
    for (index, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let source_line = index + 1;
        let value: Value = serde_json::from_str(line).map_err(|error| {
            NativeHistoryError::new(
                NativeHistoryErrorCode::SourceCorrupt,
                format!("invalid JSONL record {source_line}: {error}"),
            )
        })?;
        let replacement_history = (engine == NativeHistoryEngine::Codex
            && value.get("type").and_then(Value::as_str) == Some("compacted"))
        .then(|| value.pointer("/payload/replacement_history"))
        .flatten()
        .and_then(Value::as_array);
        if let Some(replacement_history) = replacement_history {
            records.clear();
            records.extend(replacement_history.iter().enumerate().map(
                |(replacement_index, item)| {
                    EffectiveHistoryRecord {
                        value: item.clone(),
                        source_line,
                        replacement_index: Some(replacement_index),
                        fallback_id: sha256(
                            format!(
                                "codex-compaction:{source_line}:{replacement_index}:{}",
                                item
                            )
                            .as_bytes(),
                        ),
                    }
                },
            ));
            continue;
        }
        records.push(EffectiveHistoryRecord {
            value,
            source_line,
            replacement_index: None,
            fallback_id: sha256(line.as_bytes()),
        });
    }
    Ok(records)
}

fn normalize_lines(
    bytes: &[u8],
    source: &NativeHistorySource,
) -> Result<(Vec<ContextSourceEntry>, Vec<ProjectionOmission>), NativeHistoryError> {
    let text = std::str::from_utf8(bytes).map_err(|error| {
        NativeHistoryError::new(
            NativeHistoryErrorCode::SourceCorrupt,
            format!("native history is not UTF-8: {error}"),
        )
    })?;
    if !text.is_empty() && !text.ends_with('\n') {
        return Err(NativeHistoryError::new(
            NativeHistoryErrorCode::UnsupportedStableCursor,
            "native history ends with an incomplete JSONL record",
        ));
    }
    let entries = effective_history_records(text, source.engine)?
        .into_iter()
        .map(|record| {
            let value = record.value;
            let vendor_entry_type =
                string_at(&value, &[&["type"], &["payload", "type"]]).unwrap_or("unknown");
            let source_entry_id = string_at(
                &value,
                &[
                    &["id"],
                    &["uuid"],
                    &["message", "id"],
                    &["payload", "id"],
                    &["payload", "message", "id"],
                ],
            )
            .map(str::to_string)
            .unwrap_or(record.fallback_id);
            let (blocks, private_count, unknown_count) = blocks_of(&value, source.engine);
            Ok((
                ContextSourceEntry {
                    source_entry_id,
                    occurred_at: timestamp_of(&value),
                    role: role_of(&value, source.engine),
                    blocks,
                    provenance: json!({
                        "engine": source.engine,
                        "providerProfileId": source.provider_profile_id,
                        "nativeSessionId": source.native_session_id,
                        "vendorEntryType": vendor_entry_type,
                        "sourceLine": record.source_line,
                        "replacementIndex": record.replacement_index,
                    }),
                    fidelity: NativeHistoryFidelity::Semantic,
                },
                private_count,
                unknown_count,
            ))
        })
        .collect::<Result<Vec<_>, NativeHistoryError>>()?;
    let mut omissions = Vec::new();
    let mut normalized_entries = entries
        .into_iter()
        .map(|(entry, private_count, unknown_count)| {
            if private_count > 0 {
                omissions.push(ProjectionOmission {
                    entry_id: entry.source_entry_id.clone(),
                    category: "provider-private-reasoning".to_string(),
                    reason: format!("{private_count} private block(s) were not portable"),
                    disposition: OmissionDisposition::NotRetrievable,
                    retrievable_ref: None,
                });
            }
            if unknown_count > 0 {
                omissions.push(ProjectionOmission {
                    entry_id: entry.source_entry_id.clone(),
                    category: "unknown-vendor-block".to_string(),
                    reason: format!("{unknown_count} unknown block(s) were not safely portable"),
                    disposition: OmissionDisposition::NotRetrievable,
                    retrievable_ref: None,
                });
            }
            entry
        })
        .collect::<Vec<_>>();
    pair_tool_exchanges(&mut normalized_entries, &mut omissions);
    normalized_entries.retain(|entry| !entry.blocks.is_empty());
    Ok((normalized_entries, omissions))
}

fn pair_tool_exchanges(
    entries: &mut [ContextSourceEntry],
    omissions: &mut Vec<ProjectionOmission>,
) {
    use std::collections::{HashMap, HashSet};

    let mut calls: HashMap<String, Vec<(usize, Value)>> = HashMap::new();
    let mut results: HashMap<String, Vec<(usize, Value)>> = HashMap::new();
    let mut ordered_call_ids = Vec::new();
    let mut seen_call_ids = HashSet::new();
    let mut paired_exchanges = HashMap::new();
    for (entry_index, entry) in entries.iter().enumerate() {
        for block in &entry.blocks {
            let Some(call_id) = block.get("callId").and_then(Value::as_str) else {
                continue;
            };
            if seen_call_ids.insert(call_id.to_string()) {
                ordered_call_ids.push(call_id.to_string());
            }
            match block.get("kind").and_then(Value::as_str) {
                Some("tool-call") => {
                    calls
                        .entry(call_id.to_string())
                        .or_default()
                        .push((entry_index, block["value"].clone()));
                }
                Some("tool-result") => {
                    results
                        .entry(call_id.to_string())
                        .or_default()
                        .push((entry_index, block["value"].clone()));
                }
                _ => {}
            }
        }
    }
    for call_id in &ordered_call_ids {
        let call_candidates = calls.get(call_id).map(Vec::as_slice).unwrap_or_default();
        let result_candidates = results.get(call_id).map(Vec::as_slice).unwrap_or_default();
        if let ([(_, call)], [(_, result)]) = (call_candidates, result_candidates) {
            paired_exchanges.insert(
                call_id.clone(),
                json!({
                "kind": "atomic-tool-exchange",
                "exchange": {
                    "toolCallId": call_id,
                    "toolName": call.get("name").and_then(Value::as_str).unwrap_or("tool"),
                    "call": {
                        "argumentsSummary": call.get("arguments")
                            .or_else(|| call.get("input"))
                            .or_else(|| call.get("args"))
                            .map(Value::to_string)
                            .unwrap_or_else(|| "{}".to_string())
                    },
                    "result": {
                        "outputSummary": result.get("output")
                            .or_else(|| result.get("content"))
                            .or_else(|| result.get("result"))
                            .map(|value| value.as_str().map(str::to_string).unwrap_or_else(|| value.to_string()))
                            .unwrap_or_default()
                    }
                }
                }),
            );
        } else {
            let entry_index = call_candidates
                .first()
                .or_else(|| result_candidates.first())
                .map(|(entry_index, _)| *entry_index);
            omissions.push(ProjectionOmission {
                entry_id: entry_index
                    .and_then(|index| entries.get(index))
                    .map(|entry| entry.source_entry_id.clone())
                    .unwrap_or_else(|| call_id.clone()),
                category: "incomplete-tool-exchange".to_string(),
                reason: format!(
                    "tool exchange {call_id} has {} call(s) and {} result(s)",
                    call_candidates.len(),
                    result_candidates.len()
                ),
                disposition: OmissionDisposition::NotRetrievable,
                retrievable_ref: None,
            });
        }
    }
    for entry in entries {
        entry.blocks = std::mem::take(&mut entry.blocks)
            .into_iter()
            .filter_map(|block| match block.get("kind").and_then(Value::as_str) {
                Some("tool-call") => block
                    .get("callId")
                    .and_then(Value::as_str)
                    .and_then(|call_id| paired_exchanges.get(call_id))
                    .cloned(),
                Some("tool-result") => None,
                _ => Some(block),
            })
            .collect();
    }
}

pub fn probe_history_file(
    path: &Path,
    engine: NativeHistoryEngine,
) -> Result<NativeHistoryCapability, NativeHistoryError> {
    let metadata = fs::metadata(path).map_err(|error| map_io_error(path, error))?;
    if !metadata.is_file() {
        return Err(NativeHistoryError::new(
            NativeHistoryErrorCode::SourceNotFound,
            "native history source is not a file",
        ));
    }
    let bytes = bounded_bytes(path, metadata.len())?;
    if !bytes.is_empty() && !bytes.ends_with(b"\n") {
        return Ok(NativeHistoryCapability {
            readable: true,
            stable_cursor: false,
            current_through_cursor: None,
            supported_entry_types: Vec::new(),
            unsupported_reason: Some("incomplete JSONL tail".to_string()),
        });
    }
    let checksum = sha256(&bytes);
    Ok(NativeHistoryCapability {
        readable: true,
        stable_cursor: true,
        current_through_cursor: Some(cursor(metadata.len(), &checksum)),
        supported_entry_types: match engine {
            NativeHistoryEngine::Claude => vec![
                "user".to_string(),
                "assistant".to_string(),
                "tool_use".to_string(),
                "tool_result".to_string(),
            ],
            NativeHistoryEngine::Codex => vec![
                "response_item".to_string(),
                "event_msg".to_string(),
                "turn_context".to_string(),
            ],
            NativeHistoryEngine::Kimi => vec![
                "turn.prompt".to_string(),
                "context.append_message".to_string(),
                "tool.call".to_string(),
                "tool.result".to_string(),
            ],
        },
        unsupported_reason: None,
    })
}

pub fn read_history_file(
    path: &Path,
    source: &NativeHistorySource,
    through_cursor: &str,
) -> Result<NativeHistoryReadResult, NativeHistoryError> {
    let (size, expected_checksum) = parse_cursor(through_cursor)?;
    let bytes = bounded_bytes(path, size)?;
    let actual_checksum = sha256(&bytes);
    if actual_checksum != expected_checksum {
        return Err(NativeHistoryError::new(
            NativeHistoryErrorCode::SourceDrifted,
            "native history changed inside the probed boundary",
        ));
    }
    let (entries, omissions) = normalize_lines(&bytes, source)?;
    Ok(NativeHistoryReadResult {
        reader_id: source.engine.reader_id().to_string(),
        source_fingerprint: actual_checksum,
        through_cursor: through_cursor.to_string(),
        entries,
        fidelity: NativeHistoryFidelity::Semantic,
        omissions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use uuid::Uuid;

    fn fixture(contents: &str) -> std::path::PathBuf {
        let path =
            std::env::temp_dir().join(format!("mossx-native-history-{}.jsonl", Uuid::new_v4()));
        fs::write(&path, contents).expect("write fixture");
        path
    }

    fn source(engine: NativeHistoryEngine) -> NativeHistorySource {
        NativeHistorySource {
            session_id: "session-a".to_string(),
            native_session_id: "native-a".to_string(),
            engine,
            provider_profile_id: Some("provider-a".to_string()),
        }
    }

    #[test]
    fn reader_keeps_frozen_prefix_when_source_only_appends() {
        let path =
            fixture("{\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":\"one\"}}\n");
        let capability = probe_history_file(&path, NativeHistoryEngine::Claude).expect("probe");
        let cursor = capability.current_through_cursor.expect("cursor");
        File::options()
            .append(true)
            .open(&path)
            .expect("open append")
            .write_all(b"{\"type\":\"assistant\",\"message\":{\"role\":\"assistant\",\"content\":\"two\"}}\n")
            .expect("append");

        let result =
            read_history_file(&path, &source(NativeHistoryEngine::Claude), &cursor).expect("read");
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].role, "user");
        fs::remove_file(path).ok();
    }

    #[test]
    fn reader_rejects_rewritten_frozen_prefix() {
        let path = fixture("{\"type\":\"user\",\"content\":\"one\"}\n");
        let cursor = probe_history_file(&path, NativeHistoryEngine::Codex)
            .expect("probe")
            .current_through_cursor
            .expect("cursor");
        fs::write(&path, "{\"type\":\"user\",\"content\":\"two\"}\n").expect("rewrite");

        let error = read_history_file(&path, &source(NativeHistoryEngine::Codex), &cursor)
            .expect_err("drift");
        assert_eq!(error.code, NativeHistoryErrorCode::SourceDrifted);
        fs::remove_file(path).ok();
    }

    #[test]
    fn reader_replays_last_codex_compaction_and_keeps_following_delta() {
        let path = fixture(concat!(
            "{\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"superseded\"}]}}\n",
            "{\"type\":\"compacted\",\"payload\":{\"replacement_history\":[",
            "{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"first replacement\"}]}",
            "]}}\n",
            "{\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"superseded delta\"}]}}\n",
            "{\"type\":\"compacted\",\"payload\":{\"replacement_history\":[",
            "{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"effective replacement\"}]},",
            "{\"type\":\"compaction\",\"id\":\"compact-2\",\"encrypted_content\":\"private state\"}",
            "]}}\n",
            "{\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"following delta\"}]}}\n",
        ));
        let cursor = probe_history_file(&path, NativeHistoryEngine::Codex)
            .expect("probe")
            .current_through_cursor
            .expect("cursor");

        let result =
            read_history_file(&path, &source(NativeHistoryEngine::Codex), &cursor).expect("read");
        let repeated =
            read_history_file(&path, &source(NativeHistoryEngine::Codex), &cursor).expect("repeat");
        let serialized = serde_json::to_string(&result.entries).expect("serialize");

        assert_eq!(result, repeated);
        assert_eq!(result.entries.len(), 2);
        assert!(serialized.contains("effective replacement"));
        assert!(serialized.contains("following delta"));
        assert!(!serialized.contains("superseded"));
        assert!(!serialized.contains("private state"));
        assert!(result
            .omissions
            .iter()
            .any(|omission| omission.category == "provider-private-reasoning"));
        fs::remove_file(path).ok();
    }

    #[test]
    fn probe_fails_closed_on_incomplete_tail() {
        let path = fixture("{\"type\":\"turn.prompt\"");
        let capability = probe_history_file(&path, NativeHistoryEngine::Kimi).expect("probe");
        assert!(!capability.stable_cursor);
        assert!(capability.current_through_cursor.is_none());
        fs::remove_file(path).ok();
    }

    #[test]
    fn probe_rejects_oversized_source_before_reading() {
        let path = fixture("");
        File::options()
            .write(true)
            .open(&path)
            .expect("open")
            .set_len(MAX_NATIVE_HISTORY_BYTES + 1)
            .expect("sparse resize");
        let error =
            probe_history_file(&path, NativeHistoryEngine::Claude).expect_err("oversized source");
        assert_eq!(error.code, NativeHistoryErrorCode::SourceTooLarge);
        fs::remove_file(path).ok();
    }

    #[test]
    fn reader_omits_private_blocks_and_pairs_tools_atomically() {
        let path = fixture(
            concat!(
                "{\"type\":\"assistant\",\"message\":{\"role\":\"assistant\",\"content\":[",
                "{\"type\":\"thinking\",\"thinking\":\"secret\",\"signature\":\"private\"},",
                "{\"type\":\"text\",\"text\":\"visible\"},",
                "{\"type\":\"tool_use\",\"id\":\"call-1\",\"name\":\"Read\",\"input\":{\"path\":\"a\"}}",
                "]}}\n",
                "{\"type\":\"user\",\"message\":{\"role\":\"user\",\"content\":[",
                "{\"type\":\"tool_result\",\"tool_use_id\":\"call-1\",\"content\":\"ok\"}",
                "]}}\n"
            ),
        );
        let cursor = probe_history_file(&path, NativeHistoryEngine::Claude)
            .expect("probe")
            .current_through_cursor
            .expect("cursor");
        let result =
            read_history_file(&path, &source(NativeHistoryEngine::Claude), &cursor).expect("read");
        let repeated = read_history_file(&path, &source(NativeHistoryEngine::Claude), &cursor)
            .expect("repeat");
        let serialized = serde_json::to_string(&result.entries).expect("serialize");
        assert_eq!(result, repeated);
        assert_eq!(result.entries[0].blocks[0]["kind"], "text");
        assert_eq!(result.entries[0].blocks[1]["kind"], "atomic-tool-exchange");
        assert!(serialized.contains("visible"));
        assert!(serialized.contains("atomic-tool-exchange"));
        assert!(!serialized.contains("secret"));
        assert!(!serialized.contains("private"));
        assert!(result
            .omissions
            .iter()
            .any(|omission| omission.category == "provider-private-reasoning"));
        fs::remove_file(path).ok();
    }

    #[test]
    fn reader_does_not_export_kimi_reasoning_or_unknown_vendor_payloads() {
        let path = fixture(concat!(
            "{\"type\":\"reasoning\",\"content\":\"private kimi thought\"}\n",
            "{\"type\":\"vendor.control\",\"secret\":\"opaque\"}\n",
            "{\"type\":\"turn.prompt\",\"content\":\"portable question\"}\n"
        ));
        let cursor = probe_history_file(&path, NativeHistoryEngine::Kimi)
            .expect("probe")
            .current_through_cursor
            .expect("cursor");
        let result =
            read_history_file(&path, &source(NativeHistoryEngine::Kimi), &cursor).expect("read");
        let serialized = serde_json::to_string(&result.entries).expect("serialize");
        assert!(serialized.contains("portable question"));
        assert!(!serialized.contains("private kimi thought"));
        assert!(!serialized.contains("opaque"));
        assert!(result
            .omissions
            .iter()
            .any(|omission| omission.category == "provider-private-reasoning"));
        assert!(result
            .omissions
            .iter()
            .any(|omission| omission.category == "unknown-vendor-block"));
        fs::remove_file(path).ok();
    }
}
