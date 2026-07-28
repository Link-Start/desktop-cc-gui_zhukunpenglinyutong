use std::fs::{self, File};
use std::io::{ErrorKind, Read};
use std::path::Path;

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use super::{
    ContextSourceEntry, NativeHistoryCapability, NativeHistoryEngine, NativeHistoryError,
    NativeHistoryErrorCode, NativeHistoryFidelity, NativeHistoryReadResult, NativeHistorySource,
};

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
    let mut bytes = Vec::with_capacity(size as usize);
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

fn blocks_of(value: &Value, engine: NativeHistoryEngine) -> Vec<Value> {
    if engine == NativeHistoryEngine::Codex
        && value.get("type").and_then(Value::as_str) == Some("response_item")
    {
        if let Some(payload) = value.get("payload") {
            if matches!(
                payload.get("type").and_then(Value::as_str),
                Some("function_call" | "function_call_output")
            ) {
                return vec![json!({ "kind": "native-block", "value": payload })];
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
            return vec![json!({ "kind": "text", "text": text })];
        }
        if let Some(items) = current.as_array() {
            return items
                .iter()
                .map(|item| {
                    if let Some(text) = item.get("text").and_then(Value::as_str) {
                        json!({ "kind": "text", "text": text })
                    } else {
                        json!({ "kind": "native-block", "value": item })
                    }
                })
                .collect();
        }
    }
    vec![json!({ "kind": "native-block", "value": value })]
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

fn normalize_lines(
    bytes: &[u8],
    source: &NativeHistorySource,
) -> Result<Vec<ContextSourceEntry>, NativeHistoryError> {
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
    text.lines()
        .enumerate()
        .filter(|(_, line)| !line.trim().is_empty())
        .map(|(index, line)| {
            let value: Value = serde_json::from_str(line).map_err(|error| {
                NativeHistoryError::new(
                    NativeHistoryErrorCode::SourceCorrupt,
                    format!("invalid JSONL record {}: {error}", index + 1),
                )
            })?;
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
            .unwrap_or_else(|| sha256(line.as_bytes()));
            Ok(ContextSourceEntry {
                source_entry_id,
                occurred_at: timestamp_of(&value),
                role: role_of(&value, source.engine),
                blocks: blocks_of(&value, source.engine),
                provenance: json!({
                    "engine": source.engine,
                    "providerProfileId": source.provider_profile_id,
                    "nativeSessionId": source.native_session_id,
                    "vendorEntryType": vendor_entry_type,
                    "sourceLine": index + 1,
                }),
                fidelity: NativeHistoryFidelity::Semantic,
            })
        })
        .collect()
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
    let entries = normalize_lines(&bytes, source)?;
    Ok(NativeHistoryReadResult {
        reader_id: source.engine.reader_id().to_string(),
        source_fingerprint: actual_checksum,
        through_cursor: through_cursor.to_string(),
        entries,
        fidelity: NativeHistoryFidelity::Semantic,
        omissions: Vec::new(),
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
    fn probe_fails_closed_on_incomplete_tail() {
        let path = fixture("{\"type\":\"turn.prompt\"");
        let capability = probe_history_file(&path, NativeHistoryEngine::Kimi).expect("probe");
        assert!(!capability.stable_cursor);
        assert!(capability.current_through_cursor.is_none());
        fs::remove_file(path).ok();
    }
}
