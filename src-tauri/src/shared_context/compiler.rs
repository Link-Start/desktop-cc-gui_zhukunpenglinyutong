use std::collections::{HashMap, HashSet};

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::native_history::{NativeHistoryReadResult, NativeHistorySource};
use crate::shared_event_log::{deterministic_json_bytes, Fidelity, StoredEvent};

use super::types::{
    CompressionCategory, ContextCompressionReport, ContextPackage, ContextPackageSource,
    OmissionDisposition, PortableContextEntry, ProjectionManifest, ProjectionMode,
    ProjectionOmission, RuntimeContextCapabilities,
};

const COMPILER_VERSION: &str = "mossx-shared-context/1";
const DEFAULT_TRANSCRIPT_BUDGET: u64 = 12_000;

#[derive(Debug, Clone)]
pub struct CompileContextRequest {
    pub session_id: String,
    pub binding_key: String,
    pub destination: Value,
    pub destination_native_session_id: Option<String>,
    pub from_sequence_exclusive: Option<i64>,
    pub through_sequence_inclusive: Option<i64>,
    pub exclude_attempt_id: Option<String>,
    pub capabilities: RuntimeContextCapabilities,
    pub budget_estimated_tokens: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct CompileNativeContextRequest {
    pub session_id: String,
    pub binding_key: String,
    pub destination: Value,
    pub source: NativeHistorySource,
    pub history: NativeHistoryReadResult,
    pub capabilities: RuntimeContextCapabilities,
    pub budget_estimated_tokens: Option<u64>,
}

fn estimated_tokens(text: &str) -> u64 {
    text.chars().count().div_ceil(4) as u64
}

fn sha256(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let hex = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    format!("sha256:{hex}")
}

fn select_mode(
    capabilities: &RuntimeContextCapabilities,
    has_destination_identity: bool,
    source_estimated_tokens: u64,
    budget: u64,
) -> (ProjectionMode, String) {
    if has_destination_identity && capabilities.native_delta {
        return (
            ProjectionMode::NativeDelta,
            "destination identity + native delta capability".to_string(),
        );
    }
    if capabilities.structured_history_import {
        return (
            ProjectionMode::NativeHistoryImport,
            "structured history import capability".to_string(),
        );
    }
    if capabilities.native_clone {
        return (
            ProjectionMode::NativeHistoryClone,
            "native clone capability".to_string(),
        );
    }
    if capabilities.user_channel_transcript && source_estimated_tokens <= budget {
        return (
            ProjectionMode::PortableTranscript,
            "portable transcript capability within budget".to_string(),
        );
    }
    (
        ProjectionMode::Checkpoint,
        "structured import unavailable or transcript exceeds budget".to_string(),
    )
}

fn text_block(text: impl Into<String>) -> Value {
    json!({ "kind": "text", "text": text.into() })
}

fn event_payload(event: &StoredEvent) -> Result<Value, String> {
    serde_json::from_str(&event.payload_json)
        .map_err(|error| format!("parse {} payload: {error}", event.fact_type))
}

fn destination_owned_attempts(events: &[StoredEvent], binding_key: &str) -> HashSet<String> {
    events
        .iter()
        .filter(|event| event.fact_type == "conversation.turnAccepted")
        .filter_map(|event| {
            let payload = event_payload(event).ok()?;
            (payload.get("bindingKey").and_then(Value::as_str) == Some(binding_key))
                .then(|| event.attempt_id.clone())
                .flatten()
        })
        .collect()
}

fn transform_event(
    event: &StoredEvent,
    payload: &Value,
    capabilities: &RuntimeContextCapabilities,
    omissions: &mut Vec<ProjectionOmission>,
) -> Option<PortableContextEntry> {
    let entry_id = event.event_id.clone();
    match event.fact_type.as_str() {
        "conversation.turnRequested" => {
            let input = payload.get("input")?;
            let mut blocks = Vec::new();
            if let Some(text) = input.get("text").and_then(Value::as_str) {
                blocks.push(text_block(text));
            }
            for field in ["imageRefs", "attachmentRefs"] {
                if let Some(refs) = input.get(field).and_then(Value::as_array) {
                    for artifact_ref in refs {
                        if capabilities.image_history || field == "attachmentRefs" {
                            blocks.push(json!({
                                "kind": "artifact-ref",
                                "artifactRef": artifact_ref,
                                "referenceOnly": true,
                            }));
                        } else {
                            omissions.push(ProjectionOmission {
                                entry_id: entry_id.clone(),
                                category: "image".to_string(),
                                reason: "destination does not support image history".to_string(),
                                disposition: OmissionDisposition::RetrievableOnDemand,
                                retrievable_ref: artifact_ref
                                    .get("artifactId")
                                    .and_then(Value::as_str)
                                    .map(str::to_string),
                            });
                        }
                    }
                }
            }
            Some(PortableContextEntry {
                entry_id,
                sequence: event.sequence,
                role: "user".to_string(),
                blocks,
                outcome: None,
            })
        }
        "conversation.turnCommitted" => {
            let outcome = payload
                .pointer("/outcome/status")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            if outcome != "completed" {
                omissions.push(ProjectionOmission {
                    entry_id,
                    category: "assistant".to_string(),
                    reason: format!("assistant outcome is {outcome}; not replayed as success"),
                    disposition: OmissionDisposition::NotRetrievable,
                    retrievable_ref: None,
                });
                return None;
            }
            let mut blocks = payload
                .get("assistant")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter(|block| {
                    let portable = block.get("kind").and_then(Value::as_str) != Some("reasoning");
                    if !portable {
                        omissions.push(ProjectionOmission {
                            entry_id: event.event_id.clone(),
                            category: "provider-private-reasoning".to_string(),
                            reason: "private reasoning is not portable".to_string(),
                            disposition: OmissionDisposition::NotRetrievable,
                            retrievable_ref: None,
                        });
                    }
                    portable
                })
                .collect::<Vec<_>>();
            let exchanges = payload
                .get("atomicToolExchanges")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            if capabilities.tool_history {
                blocks.extend(exchanges.into_iter().map(
                    |exchange| json!({ "kind": "atomic-tool-exchange", "exchange": exchange }),
                ));
            } else if !exchanges.is_empty() {
                omissions.push(ProjectionOmission {
                    entry_id: event.event_id.clone(),
                    category: "tool-exchange".to_string(),
                    reason: "destination does not support tool history; pair omitted atomically"
                        .to_string(),
                    disposition: OmissionDisposition::NotRetrievable,
                    retrievable_ref: None,
                });
            }
            Some(PortableContextEntry {
                entry_id: event.event_id.clone(),
                sequence: event.sequence,
                role: "assistant".to_string(),
                blocks,
                outcome: Some(outcome.to_string()),
            })
        }
        "conversation.controlFact" => {
            omissions.push(ProjectionOmission {
                entry_id,
                category: "historical-control".to_string(),
                reason: "historical control is reference-only and never re-executed".to_string(),
                disposition: OmissionDisposition::NotRetrievable,
                retrievable_ref: None,
            });
            None
        }
        _ => None,
    }
}

fn transcript(entries: &[PortableContextEntry], checkpoint: bool) -> String {
    let mut output = if checkpoint {
        "Shared Context Checkpoint\n\n".to_string()
    } else {
        "Shared Context Transcript\n\n".to_string()
    };
    for entry in entries {
        output.push_str(&format!("[{}:{}]\n", entry.role, entry.entry_id));
        for block in &entry.blocks {
            if let Some(text) = block.get("text").and_then(Value::as_str) {
                output.push_str(text);
                output.push('\n');
            } else {
                output.push_str(&block.to_string());
                output.push('\n');
            }
        }
        output.push('\n');
    }
    output
}

fn fold_text(text: &str) -> (&'static str, String) {
    if let Ok(value) = serde_json::from_str::<Value>(text) {
        let folded = match value {
            Value::Array(items) => json!({
                "kind": "folded-json-array",
                "count": items.len(),
                "head": items.iter().take(2).collect::<Vec<_>>(),
                "tail": items.iter().rev().take(2).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>(),
            }),
            Value::Object(object) => json!({
                "kind": "folded-json-object",
                "keys": object.keys().collect::<Vec<_>>(),
                "fieldCount": object.len(),
            }),
            _ => value,
        };
        return ("tool-json-schema-count-head-tail", folded.to_string());
    }
    let lines = text.lines().collect::<Vec<_>>();
    if text.contains("diff --git") || text.contains("\n@@ ") || text.contains("```") {
        let anchors = lines
            .iter()
            .filter(|line| {
                let trimmed = line.trim_start();
                trimmed.starts_with("diff --git")
                    || trimmed.starts_with("--- ")
                    || trimmed.starts_with("+++ ")
                    || trimmed.starts_with("@@")
                    || trimmed.starts_with("fn ")
                    || trimmed.starts_with("function ")
                    || trimmed.starts_with("class ")
                    || trimmed.starts_with("struct ")
            })
            .take(40)
            .copied()
            .collect::<Vec<_>>();
        return (
            "code-diff-path-signature-hunk",
            format!(
                "{}\n{}\n{}",
                lines
                    .iter()
                    .take(12)
                    .copied()
                    .collect::<Vec<_>>()
                    .join("\n"),
                anchors.join("\n"),
                lines
                    .iter()
                    .rev()
                    .take(12)
                    .copied()
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect::<Vec<_>>()
                    .join("\n")
            ),
        );
    }
    let evidence = lines
        .iter()
        .filter(|line| {
            let lower = line.to_ascii_lowercase();
            lower.contains("error") || lower.contains("warning") || lower.contains("failed")
        })
        .take(30)
        .copied()
        .collect::<Vec<_>>();
    (
        "log-error-warning-head-tail",
        format!(
            "{}\n{}\n{}",
            lines
                .iter()
                .take(12)
                .copied()
                .collect::<Vec<_>>()
                .join("\n"),
            evidence.join("\n"),
            lines
                .iter()
                .rev()
                .take(12)
                .copied()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join("\n")
        ),
    )
}

fn fold_checkpoint_entries(
    entries: &mut [PortableContextEntry],
    omissions: &mut Vec<ProjectionOmission>,
) -> Vec<CompressionCategory> {
    let mut categories: HashMap<String, (u64, u64)> = HashMap::new();
    for entry in entries {
        for block in &mut entry.blocks {
            let Some(text) = block.get("text").and_then(Value::as_str) else {
                continue;
            };
            if text.chars().count() <= 800 {
                continue;
            }
            let source_tokens = estimated_tokens(text);
            let (strategy, folded) = fold_text(text);
            let package_tokens = estimated_tokens(&folded);
            *block = text_block(folded);
            let totals = categories.entry(strategy.to_string()).or_default();
            totals.0 += source_tokens;
            totals.1 += package_tokens;
            omissions.push(ProjectionOmission {
                entry_id: entry.entry_id.clone(),
                category: "deterministic-fold".to_string(),
                reason: format!("{strategy}; full content was folded for checkpoint budget"),
                disposition: OmissionDisposition::NotRetrievable,
                retrievable_ref: None,
            });
        }
    }
    categories
        .into_iter()
        .map(
            |(strategy, (source_estimated_tokens, package_estimated_tokens))| CompressionCategory {
                category: "checkpoint-content".to_string(),
                strategy,
                source_estimated_tokens,
                package_estimated_tokens,
            },
        )
        .collect()
}

pub fn compile_context(
    events: &[StoredEvent],
    request: &CompileContextRequest,
) -> Result<ContextPackage, String> {
    let upper = request
        .through_sequence_inclusive
        .or_else(|| events.last().map(|event| event.sequence))
        .unwrap_or(0);
    let lower = request.from_sequence_exclusive.unwrap_or(0);
    let source = events
        .iter()
        .filter(|event| {
            event.fidelity == Fidelity::Canonical
                && event.sequence > lower
                && event.sequence <= upper
                && event.attempt_id.as_deref() != request.exclude_attempt_id.as_deref()
        })
        .cloned()
        .collect::<Vec<_>>();
    let source_value = source
        .iter()
        .map(|event| {
            json!({
                "sequence": event.sequence,
                "eventId": event.event_id,
                "factType": event.fact_type,
                "payloadChecksum": event.payload_checksum,
            })
        })
        .collect::<Vec<_>>();
    let source_bytes =
        deterministic_json_bytes(&json!(source_value)).map_err(|error| error.to_string())?;
    let source_checksum = sha256(&source_bytes);
    let source_estimated_tokens = estimated_tokens(
        &source
            .iter()
            .map(|event| event.payload_json.as_str())
            .collect::<Vec<_>>()
            .join(""),
    );
    let budget = request
        .budget_estimated_tokens
        .unwrap_or(DEFAULT_TRANSCRIPT_BUDGET);
    let (mode, mode_reason) = select_mode(
        &request.capabilities,
        request.destination_native_session_id.is_some(),
        source_estimated_tokens,
        budget,
    );
    let owned_attempts = destination_owned_attempts(events, &request.binding_key);
    let mut omissions = Vec::new();
    let mut included_entry_ids = Vec::new();
    let mut entries = Vec::new();
    for event in &source {
        if mode == ProjectionMode::NativeDelta
            && event
                .attempt_id
                .as_ref()
                .is_some_and(|attempt| owned_attempts.contains(attempt))
        {
            omissions.push(ProjectionOmission {
                entry_id: event.event_id.clone(),
                category: "destination-owned".to_string(),
                reason: "entry already belongs to destination native history".to_string(),
                disposition: OmissionDisposition::NotRetrievable,
                retrievable_ref: None,
            });
            continue;
        }
        let payload = event_payload(event)?;
        if let Some(entry) = transform_event(event, &payload, &request.capabilities, &mut omissions)
        {
            included_entry_ids.push(entry.entry_id.clone());
            entries.push(entry);
        }
    }
    let mut compression_categories = if mode == ProjectionMode::Checkpoint {
        fold_checkpoint_entries(&mut entries, &mut omissions)
    } else {
        Vec::new()
    };
    let stable_prefix = format!(
        "MOSSX_SHARED_CONTEXT_V1\nsession:{}\nbinding:{}\n",
        request.session_id, request.binding_key
    );
    let projected_text = transcript(&entries, mode == ProjectionMode::Checkpoint);
    let package_estimated_tokens = estimated_tokens(&projected_text);
    let manifest = ProjectionManifest {
        compiler_version: COMPILER_VERSION.to_string(),
        mode,
        mode_reason,
        included_entry_ids,
        omitted: omissions,
        from_sequence_exclusive: request.from_sequence_exclusive,
        through_sequence_inclusive: upper,
        source_checksum: source_checksum.clone(),
    };
    let identity = json!({
        "sessionId": request.session_id,
        "bindingKey": request.binding_key,
        "fromSequenceExclusive": request.from_sequence_exclusive,
        "throughSequenceInclusive": upper,
        "sourceChecksum": source_checksum,
    });
    let package_id =
        sha256(&deterministic_json_bytes(&identity).map_err(|error| error.to_string())?);
    let marker = format!("MOSSX_CONTEXT_PACKAGE:{package_id}:{source_checksum}");
    let prompt_prefix = match mode {
        ProjectionMode::PortableTranscript | ProjectionMode::Checkpoint => {
            format!("{marker}\n{stable_prefix}\n{projected_text}\n{marker}\n")
        }
        _ => String::new(),
    };
    Ok(ContextPackage {
        schema_version: 1,
        package_id,
        session_id: request.session_id.clone(),
        binding_key: request.binding_key.clone(),
        source: ContextPackageSource::SharedCanonical {
            session_id: request.session_id.clone(),
            from_sequence_exclusive: request.from_sequence_exclusive,
            through_sequence_inclusive: upper,
        },
        destination: request.destination.clone(),
        stable_prefix,
        delta: entries,
        prompt_prefix,
        manifest,
        compression: ContextCompressionReport {
            estimator: "deterministic-char-div-4".to_string(),
            source_estimated_tokens,
            package_estimated_tokens,
            per_category: {
                compression_categories.push(CompressionCategory {
                    category: "portable-turns".to_string(),
                    strategy: if mode == ProjectionMode::Checkpoint {
                        "bounded-checkpoint".to_string()
                    } else {
                        "portable-transcript".to_string()
                    },
                    source_estimated_tokens,
                    package_estimated_tokens,
                });
                compression_categories
            },
        },
    })
}

pub fn compile_native_context(
    request: &CompileNativeContextRequest,
) -> Result<ContextPackage, String> {
    if request.history.reader_id != request.source.engine.reader_id() {
        return Err("native history reader identity mismatch".to_string());
    }
    if request.history.through_cursor.trim().is_empty()
        || request.history.source_fingerprint.trim().is_empty()
    {
        return Err("native history fingerprint and cursor are required".to_string());
    }
    let source_identity = ContextPackageSource::NativeHistory {
        session_id: request.source.session_id.clone(),
        native_session_id: request.source.native_session_id.clone(),
        engine: format!("{:?}", request.source.engine).to_ascii_lowercase(),
        provider_profile_id: request.source.provider_profile_id.clone(),
        reader_id: request.history.reader_id.clone(),
        source_fingerprint: request.history.source_fingerprint.clone(),
        through_cursor: request.history.through_cursor.clone(),
    };
    let source_value = json!({
        "source": source_identity,
        "entries": request.history.entries,
    });
    let source_checksum =
        sha256(&deterministic_json_bytes(&source_value).map_err(|error| error.to_string())?);
    let source_estimated_tokens = estimated_tokens(
        &request
            .history
            .entries
            .iter()
            .flat_map(|entry| entry.blocks.iter())
            .map(Value::to_string)
            .collect::<Vec<_>>()
            .join(""),
    );
    let budget = request
        .budget_estimated_tokens
        .unwrap_or(DEFAULT_TRANSCRIPT_BUDGET);
    let (mode, mode_reason) = select_mode(
        &request.capabilities,
        false,
        source_estimated_tokens,
        budget,
    );
    let mut omissions = request.history.omissions.clone();
    let mut entries = request
        .history
        .entries
        .iter()
        .enumerate()
        .map(|(index, entry)| PortableContextEntry {
            entry_id: entry.source_entry_id.clone(),
            sequence: (index + 1) as i64,
            role: entry.role.clone(),
            blocks: entry.blocks.clone(),
            outcome: None,
        })
        .collect::<Vec<_>>();
    let included_entry_ids = entries
        .iter()
        .map(|entry| entry.entry_id.clone())
        .collect::<Vec<_>>();
    let mut compression_categories = if mode == ProjectionMode::Checkpoint {
        fold_checkpoint_entries(&mut entries, &mut omissions)
    } else {
        Vec::new()
    };
    let stable_prefix = format!(
        "MOSSX_NATIVE_CONTEXT_V1\nsource:{}\nbinding:{}\n",
        request.source.session_id, request.binding_key
    );
    let projected_text = transcript(&entries, mode == ProjectionMode::Checkpoint);
    let package_estimated_tokens = estimated_tokens(&projected_text);
    let manifest = ProjectionManifest {
        compiler_version: COMPILER_VERSION.to_string(),
        mode,
        mode_reason,
        included_entry_ids,
        omitted: omissions,
        from_sequence_exclusive: None,
        through_sequence_inclusive: entries.len() as i64,
        source_checksum: source_checksum.clone(),
    };
    let identity = json!({
        "source": source_identity,
        "bindingKey": request.binding_key,
        "destination": request.destination,
        "sourceChecksum": source_checksum,
    });
    let package_id =
        sha256(&deterministic_json_bytes(&identity).map_err(|error| error.to_string())?);
    let marker = format!("MOSSX_CONTEXT_PACKAGE:{package_id}:{source_checksum}");
    let prompt_prefix = match mode {
        ProjectionMode::PortableTranscript | ProjectionMode::Checkpoint => {
            format!("{marker}\n{stable_prefix}\n{projected_text}\n{marker}\n")
        }
        _ => String::new(),
    };
    compression_categories.push(CompressionCategory {
        category: "portable-turns".to_string(),
        strategy: if mode == ProjectionMode::Checkpoint {
            "bounded-checkpoint".to_string()
        } else {
            "portable-transcript".to_string()
        },
        source_estimated_tokens,
        package_estimated_tokens,
    });
    Ok(ContextPackage {
        schema_version: 1,
        package_id,
        session_id: request.session_id.clone(),
        binding_key: request.binding_key.clone(),
        source: source_identity,
        destination: request.destination.clone(),
        stable_prefix,
        delta: entries,
        prompt_prefix,
        manifest,
        compression: ContextCompressionReport {
            estimator: "deterministic-char-div-4".to_string(),
            source_estimated_tokens,
            package_estimated_tokens,
            per_category: compression_categories,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mode_priority_is_capability_driven_and_delta_requires_identity() {
        let all = RuntimeContextCapabilities {
            native_delta: true,
            structured_history_import: true,
            native_clone: true,
            user_channel_transcript: true,
            tool_history: true,
            image_history: true,
            strong_context_ack: true,
        };
        assert_eq!(
            select_mode(&all, true, 1, 10).0,
            ProjectionMode::NativeDelta
        );
        assert_eq!(
            select_mode(&all, false, 1, 10).0,
            ProjectionMode::NativeHistoryImport
        );
    }

    #[test]
    fn checkpoint_log_fold_is_deterministic_and_keeps_error_evidence() {
        let text = (0..200)
            .map(|index| {
                if index == 100 {
                    "ERROR durable write failed".to_string()
                } else {
                    format!("line-{index}")
                }
            })
            .collect::<Vec<_>>()
            .join("\n");
        let (left_strategy, left) = fold_text(&text);
        let (right_strategy, right) = fold_text(&text);
        assert_eq!(left_strategy, "log-error-warning-head-tail");
        assert_eq!(left_strategy, right_strategy);
        assert_eq!(left, right);
        assert!(left.contains("ERROR durable write failed"));
        assert!(left.contains("line-0"));
        assert!(left.contains("line-199"));
    }

    #[test]
    fn native_source_identity_changes_package_checksum() {
        use crate::native_history::{
            ContextSourceEntry, NativeHistoryEngine, NativeHistoryFidelity,
        };
        let compile = |fingerprint: &str| {
            compile_native_context(&CompileNativeContextRequest {
                session_id: "continuation-a".to_string(),
                binding_key: "codex:provider-b".to_string(),
                destination: json!({ "engine": "codex", "providerProfileId": "provider-b" }),
                source: NativeHistorySource {
                    session_id: "claude:source".to_string(),
                    native_session_id: "source".to_string(),
                    engine: NativeHistoryEngine::Claude,
                    provider_profile_id: Some("provider-a".to_string()),
                },
                history: NativeHistoryReadResult {
                    reader_id: NativeHistoryEngine::Claude.reader_id().to_string(),
                    source_fingerprint: fingerprint.to_string(),
                    through_cursor: "cursor-a".to_string(),
                    entries: vec![ContextSourceEntry {
                        source_entry_id: "entry-a".to_string(),
                        occurred_at: None,
                        role: "user".to_string(),
                        blocks: vec![json!({ "kind": "text", "text": "hello" })],
                        provenance: json!({ "engine": "claude" }),
                        fidelity: NativeHistoryFidelity::Semantic,
                    }],
                    fidelity: NativeHistoryFidelity::Semantic,
                    omissions: Vec::new(),
                },
                capabilities: RuntimeContextCapabilities {
                    native_delta: false,
                    structured_history_import: true,
                    native_clone: false,
                    user_channel_transcript: true,
                    tool_history: true,
                    image_history: true,
                    strong_context_ack: true,
                },
                budget_estimated_tokens: None,
            })
            .expect("compile")
        };
        let first = compile("sha256:first");
        let same = compile("sha256:first");
        let changed = compile("sha256:changed");
        assert_eq!(first.package_id, same.package_id);
        assert_eq!(
            first.manifest.source_checksum,
            same.manifest.source_checksum
        );
        assert_ne!(first.package_id, changed.package_id);
    }
}
