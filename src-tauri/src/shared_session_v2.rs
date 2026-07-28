//! Shared Session V2 Send 写路径（Wave 4 / Change B：B.3 Send V2 + B.4 Durable Provisioning）。
//!
//! 事务边界：
//! - Tx1（`shared_session_v2_begin_turn`）：runtime side effect 之前 Commit
//!   `conversation.turnRequested` + `TurnExecutionSnapshot`，并把 durable provisioning
//!   推进到 `creating`。
//! - Tx2（`shared_session_v2_commit_turn`）：`run.settled` 后经既有 assembler/sink 写
//!   `conversation.turnCommitted`（duplicate 幂等），推进 committed cursor，provisioning → ready。
//! - ACK 不确定（`shared_session_v2_mark_recovery`）：provisioning → `recovery-required`，
//!   禁止盲目重建；只有显式 `shared_session_v2_rebuild_binding` 能归档旧 Binding 重建。
//!
//! 结构：`*_core` 纯逻辑（只依赖 `SharedEventWriter`，可集成测试）+ Tauri command 薄封装。
//! 红线：本模块只通过 `SharedEventWriter` 写库（单写者），不直接触 SQLite。

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::State;
use uuid::Uuid;

pub use crate::engine::EngineType;
use crate::shared_context::{
    accept_delivery, commit_delivery, compile_context, prepare_delivery, read_artifact,
    scan_orphan_artifacts, terminal_binding_update, write_artifact, AcceptDeliveryRequest,
    ArtifactReadRequest, CompileContextRequest, PrepareDeliveryRequest, RuntimeContextCapabilities,
};
use crate::shared_event_log::canonical::assembler::{
    RuntimeFinalSnapshot, RuntimeToolCall, RuntimeToolResult,
};
use crate::shared_event_log::canonical::sink;
use crate::shared_event_log::canonical::types::{
    CanonicalFact, CanonicalUserInput, ControlFact, OutcomeStatus, ReasoningSelection,
    TurnAcceptedFact, TurnExecutionSnapshot, TurnRequestedFact,
};
use crate::shared_event_log::{
    AppendOutcome, BindingStateUpdate, SharedEventWriter, StoreError, StoredBindingState,
};
use crate::shared_sessions::{
    engine_binding_thread_id, ensure_supported_shared_session_engine, now_millis,
    parse_shared_session_id, read_shared_session_meta, shared_target_binding_key,
    write_shared_session_meta, SharedTargetBindingMeta,
};
use crate::state::AppState;

// ---------------------------------------------------------------------------
// 输入类型
// ---------------------------------------------------------------------------

/// 前端四级 Picker 固化的 Execution Target（含 provider 元信息快照）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionTargetInput {
    pub engine: EngineType,
    pub provider_profile_id: Option<String>,
    pub model: Option<String>,
    pub reasoning_effort: Option<String>,
    pub provider_profile_name_snapshot: Option<String>,
    pub provider_profile_source: Option<String>,
    pub runtime_capability_fingerprint: Option<String>,
}

fn context_capabilities(target: &ExecutionTargetInput) -> RuntimeContextCapabilities {
    // Adapter capability 在这里显式声明；compiler 只消费 capability，不按 engine 分支。
    // 当前 runtime bridge 对 Claude/Codex 都有 user-channel prompt ACK，
    // structured import 等待对应 CLI method probe 后再打开，禁止猜测支持。
    match target.engine {
        EngineType::Codex => {
            let structured_history_import = target
                .runtime_capability_fingerprint
                .as_deref()
                .is_some_and(|fingerprint| fingerprint.contains("thread/inject_items"));
            RuntimeContextCapabilities {
                native_delta: false,
                structured_history_import,
                native_clone: false,
                user_channel_transcript: true,
                tool_history: structured_history_import,
                image_history: false,
                strong_context_ack: structured_history_import,
            }
        }
        EngineType::Claude => RuntimeContextCapabilities {
            native_delta: false,
            structured_history_import: false,
            native_clone: false,
            user_channel_transcript: true,
            tool_history: false,
            image_history: false,
            strong_context_ack: target
                .runtime_capability_fingerprint
                .as_deref()
                .is_some_and(|fingerprint| fingerprint.contains("--replay-user-messages")),
        },
        _ => RuntimeContextCapabilities {
            native_delta: false,
            structured_history_import: false,
            native_clone: false,
            user_channel_transcript: false,
            tool_history: false,
            image_history: false,
            strong_context_ack: false,
        },
    }
}

fn codex_import_items(package: &crate::shared_context::ContextPackage) -> Vec<Value> {
    package
        .delta
        .iter()
        .flat_map(|entry| {
            let text = entry
                .blocks
                .iter()
                .filter_map(|block| block.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n");
            let mut items = Vec::new();
            if !text.trim().is_empty() {
                let content_type = if entry.role == "assistant" {
                    "output_text"
                } else {
                    "input_text"
                };
                items.push(json!({
                    "type": "message",
                    "role": entry.role,
                    "content": [{ "type": content_type, "text": text }],
                }));
            }
            for block in &entry.blocks {
                if block.get("kind").and_then(Value::as_str) == Some("atomic-tool-exchange") {
                    let exchange = &block["exchange"];
                    if let (Some(name), Some(call_id)) = (
                        exchange.get("toolName").and_then(Value::as_str),
                        exchange.get("toolCallId").and_then(Value::as_str),
                    ) {
                        items.push(json!({
                            "type": "function_call",
                            "name": name,
                            "arguments": exchange.pointer("/call/argumentsSummary").and_then(Value::as_str).unwrap_or("{}"),
                            "call_id": call_id,
                        }));
                        items.push(json!({
                            "type": "function_call_output",
                            "call_id": call_id,
                            "output": exchange.pointer("/result/outputSummary").and_then(Value::as_str).unwrap_or(""),
                        }));
                    }
                }
            }
            items
        })
        .collect()
}

fn context_artifact_root(state: &AppState) -> Result<&std::path::Path, String> {
    state
        .storage_path
        .parent()
        .ok_or_else(|| "app data directory unavailable".to_string())
}

impl ExecutionTargetInput {
    pub(crate) fn normalized_provider(&self) -> Option<String> {
        self.provider_profile_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    }

    pub(crate) fn to_snapshot(&self) -> TurnExecutionSnapshot {
        TurnExecutionSnapshot {
            engine: self.engine.icon().to_string(),
            provider_profile_id: self.normalized_provider(),
            model: self
                .model
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string),
            reasoning: self
                .reasoning_effort
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|effort| ReasoningSelection {
                    effort: effort.to_string(),
                    extra: Value::Object(Default::default()),
                }),
            provider_profile_name_snapshot: self.provider_profile_name_snapshot.clone(),
            provider_profile_source: self.provider_profile_source.clone(),
            runtime_capability_fingerprint: self.runtime_capability_fingerprint.clone(),
            extra: Value::Object(Default::default()),
        }
    }
}

/// commit_turn 的 outcome 输入。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitOutcomeInput {
    pub status: String,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub stop_reason: Option<String>,
}

fn parse_outcome_status(raw: &str) -> Result<OutcomeStatus, String> {
    match raw {
        "completed" => Ok(OutcomeStatus::Completed),
        "failed" => Ok(OutcomeStatus::Failed),
        "cancelled" => Ok(OutcomeStatus::Cancelled),
        "replaced" => Ok(OutcomeStatus::Replaced),
        other => Err(format!("Unknown outcome status: {other}")),
    }
}

// ---------------------------------------------------------------------------
// Durable provisioning（B.4）
// ---------------------------------------------------------------------------

const PROVISIONING_PREPARED: &str = "prepared";
const PROVISIONING_CREATING: &str = "creating";
const PROVISIONING_READY: &str = "ready";
const PROVISIONING_RECOVERY_REQUIRED: &str = "recovery-required";

fn provisioning_json(state: &str, reason: Option<&str>, attempt_id: Option<&str>) -> String {
    json!({
        "state": state,
        "updatedAt": now_millis(),
        "reason": reason,
        "attemptId": attempt_id,
    })
    .to_string()
}

/// 从 durable 行解析 provisioning state；缺省视为 prepared（未开始）。
fn provisioning_state_of(row: &StoredBindingState) -> String {
    row.provisioning_json
        .as_deref()
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|value| {
            value
                .get("state")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| PROVISIONING_PREPARED.to_string())
}

/// 全行 read-modify-write upsert（upsert SQL 是整行覆盖，必须保留 cursor 等未变字段）。
#[allow(clippy::too_many_arguments)]
fn upsert_binding_row(
    writer: &SharedEventWriter,
    session_id: &str,
    binding_key: &str,
    engine: EngineType,
    provider_profile_id: Option<String>,
    existing: Option<&StoredBindingState>,
    native_session_id: Option<String>,
    committed_through_sequence: Option<i64>,
    provisioning: String,
    availability: &str,
) -> Result<(), StoreError> {
    let update = BindingStateUpdate {
        session_id: session_id.to_string(),
        binding_key: binding_key.to_string(),
        engine: engine.icon().to_string(),
        provider_profile_id,
        native_session_id: native_session_id
            .or_else(|| existing.and_then(|row| row.native_session_id.clone())),
        accepted_through_sequence: existing.and_then(|row| row.accepted_through_sequence),
        committed_through_sequence: committed_through_sequence
            .or_else(|| existing.and_then(|row| row.committed_through_sequence)),
        provisioning_json: Some(provisioning),
        pending_delivery_json: existing.and_then(|row| row.pending_delivery_json.clone()),
        availability: availability.to_string(),
        updated_at: now_millis() as i64,
    };
    writer.upsert_binding_state(&update)
}

fn append_control_fact(
    writer: &SharedEventWriter,
    session_id: &str,
    control_kind: &str,
    binding_key: Option<&str>,
    reason: Option<&str>,
) -> Result<(), String> {
    let fact = CanonicalFact::Control(ControlFact {
        control_kind: control_kind.to_string(),
        logical_turn_id: None,
        attempt_id: None,
        binding_key: binding_key.map(str::to_string),
        reason: reason.map(str::to_string),
        details: None,
        extra: Value::Object(Default::default()),
    });
    writer
        .append_canonical_fact_at(session_id.to_string(), fact, now_millis() as i64)
        .map_err(|error| error.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// B.3 core：Tx1 begin_turn
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BeginTurnStatus {
    Creating,
    RecoveryRequired,
    TargetUnavailable,
}

fn validate_execution_target(target: &ExecutionTargetInput) -> Result<EngineType, String> {
    let engine = ensure_supported_shared_session_engine(target.engine)?;
    let provider_profile_id = target.normalized_provider();
    let Some(models) = crate::engine::status::get_provider_scoped_engine_models(
        engine,
        provider_profile_id.as_deref(),
    )?
    else {
        return Ok(engine);
    };
    let Some(model) = target
        .model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Ok(engine);
    };
    if models
        .iter()
        .any(|candidate| candidate.id == model || candidate.model == model)
    {
        return Ok(engine);
    }
    Err(format!(
        "Model {model} is unavailable for {} provider {}",
        engine.icon(),
        provider_profile_id.as_deref().unwrap_or("default")
    ))
}

#[derive(Debug)]
pub struct BeginTurnOutcome {
    pub status: BeginTurnStatus,
    pub reason: Option<String>,
    pub attempt_id: Option<String>,
    pub logical_turn_id: Option<String>,
    pub binding_key: String,
    pub snapshot: Option<TurnExecutionSnapshot>,
}

fn unresolved_session_operation(
    writer: &SharedEventWriter,
    session_id: &str,
) -> Result<Option<(String, String)>, String> {
    let events = writer
        .events_for_session(session_id)
        .map_err(|error| error.to_string())?;
    let committed_attempts = events
        .iter()
        .filter(|event| event.fact_type == "conversation.turnCommitted")
        .filter_map(|event| event.attempt_id.clone())
        .collect::<std::collections::HashSet<_>>();
    let rebuilt_bindings = events
        .iter()
        .filter(|event| event.fact_type == "conversation.controlFact")
        .filter_map(|event| {
            let payload = serde_json::from_str::<Value>(&event.payload_json).ok()?;
            (payload.get("controlKind").and_then(Value::as_str) == Some("binding.rebuilt"))
                .then(|| {
                    payload
                        .get("bindingKey")
                        .and_then(Value::as_str)
                        .map(|binding| (binding.to_string(), event.sequence))
                })
                .flatten()
        })
        .collect::<std::collections::HashMap<_, _>>();
    for event in events.iter().rev() {
        let unresolved = event
            .attempt_id
            .as_ref()
            .map(|attempt| !committed_attempts.contains(attempt))
            .unwrap_or(false);
        if event.fact_type != "context.deliveryPrepared" || !unresolved {
            continue;
        }
        let payload: Value =
            serde_json::from_str(&event.payload_json).map_err(|error| error.to_string())?;
        let binding_key = payload
            .get("bindingKey")
            .and_then(Value::as_str)
            .ok_or_else(|| "deliveryPrepared missing bindingKey".to_string())?;
        if rebuilt_bindings
            .get(binding_key)
            .is_some_and(|rebuilt_sequence| *rebuilt_sequence > event.sequence)
        {
            continue;
        }
        return Ok(Some((
            binding_key.to_string(),
            event.attempt_id.clone().unwrap_or_default(),
        )));
    }
    Ok(None)
}

pub fn begin_turn_core(
    writer: &SharedEventWriter,
    session_id: &str,
    target: &ExecutionTargetInput,
    text: String,
) -> Result<BeginTurnOutcome, String> {
    let engine = match ensure_supported_shared_session_engine(target.engine) {
        Ok(engine) => engine,
        Err(reason) => {
            return Ok(BeginTurnOutcome {
                status: BeginTurnStatus::TargetUnavailable,
                reason: Some(reason),
                attempt_id: None,
                logical_turn_id: None,
                binding_key: String::new(),
                snapshot: None,
            });
        }
    };
    let provider_profile_id = target.normalized_provider();
    let binding_key = shared_target_binding_key(engine, provider_profile_id.as_deref());
    if let Some((pending_binding_key, pending_attempt_id)) =
        unresolved_session_operation(writer, session_id)?
    {
        return Ok(BeginTurnOutcome {
            status: BeginTurnStatus::RecoveryRequired,
            reason: Some(format!(
                "session has unresolved context delivery for attempt {pending_attempt_id}"
            )),
            attempt_id: None,
            logical_turn_id: None,
            binding_key: pending_binding_key,
            snapshot: None,
        });
    }

    let existing = writer
        .binding_state(session_id, &binding_key)
        .map_err(|error| error.to_string())?;
    if let Some(row) = existing.as_ref() {
        match provisioning_state_of(row).as_str() {
            PROVISIONING_RECOVERY_REQUIRED => {
                return Ok(BeginTurnOutcome {
                    status: BeginTurnStatus::RecoveryRequired,
                    reason: None,
                    attempt_id: None,
                    logical_turn_id: None,
                    binding_key,
                    snapshot: None,
                });
            }
            // 上次 attempt 崩溃在 creating 窗口：fail closed，禁止盲目重建（D6）。
            PROVISIONING_CREATING => {
                upsert_binding_row(
                    writer,
                    session_id,
                    &binding_key,
                    engine,
                    provider_profile_id.clone(),
                    existing.as_ref(),
                    None,
                    None,
                    provisioning_json(
                        PROVISIONING_RECOVERY_REQUIRED,
                        Some("provisioning-crash-window"),
                        None,
                    ),
                    "recovery-required",
                )
                .map_err(|error| error.to_string())?;
                append_control_fact(
                    writer,
                    session_id,
                    "binding.recovery-required",
                    Some(&binding_key),
                    Some("provisioning-crash-window"),
                )?;
                return Ok(BeginTurnOutcome {
                    status: BeginTurnStatus::RecoveryRequired,
                    reason: Some("provisioning-crash-window".to_string()),
                    attempt_id: None,
                    logical_turn_id: None,
                    binding_key,
                    snapshot: None,
                });
            }
            _ => {}
        }
    }

    let snapshot = target.to_snapshot();
    let attempt_id = Uuid::new_v4().to_string();
    let logical_turn_id = Uuid::new_v4().to_string();

    // Durable provisioning 的第一阶段。即使进程在后续 Tx1 中间被强杀，
    // 重启也能识别该 Target 已开始 provisioning，而不是盲建第二个 Binding。
    upsert_binding_row(
        writer,
        session_id,
        &binding_key,
        engine,
        provider_profile_id.clone(),
        existing.as_ref(),
        None,
        None,
        provisioning_json(PROVISIONING_PREPARED, None, Some(&attempt_id)),
        "provisioning",
    )
    .map_err(|error| error.to_string())?;

    // Tx1：User Intent durable-first，先于任何 runtime side effect。
    let fact = CanonicalFact::TurnRequested(TurnRequestedFact {
        logical_turn_id: logical_turn_id.clone(),
        attempt_id: attempt_id.clone(),
        retry_of_attempt_id: None,
        input: CanonicalUserInput {
            text: Some(text),
            image_refs: None,
            attachment_refs: None,
            extra: Value::Object(Default::default()),
        },
        target: snapshot.clone(),
        requested_at: now_millis() as i64,
        extra: Value::Object(Default::default()),
    });
    writer
        .append_canonical_fact(session_id.to_string(), fact)
        .map_err(|error| error.to_string())?;

    upsert_binding_row(
        writer,
        session_id,
        &binding_key,
        engine,
        provider_profile_id,
        existing.as_ref(),
        None,
        None,
        provisioning_json(PROVISIONING_CREATING, None, Some(&attempt_id)),
        "provisioning",
    )
    .map_err(|error| error.to_string())?;

    Ok(BeginTurnOutcome {
        status: BeginTurnStatus::Creating,
        reason: None,
        attempt_id: Some(attempt_id),
        logical_turn_id: Some(logical_turn_id),
        binding_key,
        snapshot: Some(snapshot),
    })
}

// ---------------------------------------------------------------------------
// B.3 core：typed prompt ACK → turnAccepted
// ---------------------------------------------------------------------------

fn requested_fact_for_attempt(
    writer: &SharedEventWriter,
    session_id: &str,
    attempt_id: &str,
) -> Result<TurnRequestedFact, String> {
    let fact = writer
        .events_for_session(session_id)
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|event| {
            event.fact_type == "conversation.turnRequested"
                && event.attempt_id.as_deref() == Some(attempt_id)
        })
        .ok_or_else(|| format!("no matching turnRequested for attempt {attempt_id}"))
        .and_then(|event| {
            serde_json::from_str::<CanonicalFact>(&event.payload_json)
                .map_err(|error| format!("parse turnRequested payload: {error}"))
        })?;
    match fact {
        CanonicalFact::TurnRequested(requested) => Ok(requested),
        _ => Err(format!(
            "invalid turnRequested payload for attempt {attempt_id}"
        )),
    }
}

pub fn accept_turn_core(
    writer: &SharedEventWriter,
    session_id: &str,
    attempt_id: &str,
    logical_turn_id: &str,
    target: &ExecutionTargetInput,
    native_session_id: &str,
) -> Result<(), String> {
    let engine = ensure_supported_shared_session_engine(target.engine)?;
    let provider_profile_id = target.normalized_provider();
    let binding_key = shared_target_binding_key(engine, provider_profile_id.as_deref());
    let native_session_id = native_session_id.trim();
    if native_session_id.is_empty() {
        return Err("typed prompt ACK missing native session identity".to_string());
    }
    let requested = requested_fact_for_attempt(writer, session_id, attempt_id)
        .map_err(|error| format!("turnAccepted {error}"))?;
    if requested.logical_turn_id != logical_turn_id || requested.target != target.to_snapshot() {
        return Err(format!(
            "turnAccepted owner mismatch for attempt {attempt_id}"
        ));
    }
    writer
        .append_canonical_fact_at(
            session_id.to_string(),
            CanonicalFact::TurnAccepted(TurnAcceptedFact {
                logical_turn_id: logical_turn_id.to_string(),
                attempt_id: attempt_id.to_string(),
                client_turn_id: logical_turn_id.to_string(),
                binding_key: binding_key.clone(),
                native_session_id: native_session_id.to_string(),
                native_turn_id: None,
                accepted_at: now_millis() as i64,
                extra: Value::Object(Default::default()),
            }),
            now_millis() as i64,
        )
        .map_err(|error| error.to_string())?;

    let existing = writer
        .binding_state(session_id, &binding_key)
        .map_err(|error| error.to_string())?;
    upsert_binding_row(
        writer,
        session_id,
        &binding_key,
        engine,
        provider_profile_id,
        existing.as_ref(),
        Some(native_session_id.to_string()),
        None,
        provisioning_json(PROVISIONING_READY, None, Some(attempt_id)),
        "ready",
    )
    .map_err(|error| error.to_string())
}

// ---------------------------------------------------------------------------
// B.3 core：Tx2 commit_turn（settled → assembler/sink → turnCommitted，幂等）
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub struct CommitTurnOutcome {
    pub duplicate: bool,
    pub sequence: Option<i64>,
    pub binding_key: String,
}

#[allow(clippy::too_many_arguments)]
pub fn commit_turn_core(
    writer: &SharedEventWriter,
    session_id: &str,
    attempt_id: &str,
    logical_turn_id: &str,
    target: &ExecutionTargetInput,
    assistant_text: Option<String>,
    outcome: &CommitOutcomeInput,
    native_session_id: Option<String>,
) -> Result<CommitTurnOutcome, String> {
    let engine = ensure_supported_shared_session_engine(target.engine)?;
    let provider_profile_id = target.normalized_provider();
    let binding_key = shared_target_binding_key(engine, provider_profile_id.as_deref());
    let outcome_status = parse_outcome_status(&outcome.status)?;
    let requested = requested_fact_for_attempt(writer, session_id, attempt_id)
        .map_err(|error| format!("run.settled {error}"))?;
    if requested.logical_turn_id != logical_turn_id || requested.target != target.to_snapshot() {
        return Err(format!(
            "run.settled owner mismatch for attempt {attempt_id}"
        ));
    }

    // duplicate settled 幂等预检：同一 attempt 已落 turnCommitted 时，
    // 语义一致（logicalTurnId / outcome / assistant text）→ 按重放返回既有 sequence
    // （committed_at 容差：重试方时钟不可复现）；语义不同 → 真冲突，fail loud。
    let existing_commit = writer
        .events_for_session(session_id)
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|event| {
            event.fact_type == "conversation.turnCommitted"
                && event.attempt_id.as_deref() == Some(attempt_id)
        });
    if let Some(existing) = existing_commit {
        let payload: Value = serde_json::from_str(&existing.payload_json)
            .map_err(|error| format!("parse existing turnCommitted payload: {error}"))?;
        let same_turn =
            payload.get("logicalTurnId").and_then(Value::as_str) == Some(logical_turn_id);
        let expected_status = serde_json::to_value(outcome_status)
            .ok()
            .and_then(|value| value.as_str().map(str::to_string));
        let same_outcome = payload
            .pointer("/outcome/status")
            .and_then(Value::as_str)
            .map(str::to_string)
            == expected_status;
        let existing_text = payload
            .get("assistant")
            .and_then(Value::as_array)
            .and_then(|blocks| {
                blocks.iter().find_map(|block| {
                    (block.get("kind").and_then(Value::as_str) == Some("text"))
                        .then(|| block.get("text").and_then(Value::as_str))
                        .flatten()
                })
            });
        let same_text = existing_text.map(str::to_string) == assistant_text;
        if same_turn && same_outcome && same_text {
            commit_delivery(
                writer,
                session_id,
                &binding_key,
                attempt_id,
                now_millis() as i64,
            )?;
            return Ok(CommitTurnOutcome {
                duplicate: true,
                sequence: Some(existing.sequence),
                binding_key,
            });
        }
        return Err(format!(
            "turnCommitted semantic conflict for attempt {attempt_id}: existing event does not match retry payload"
        ));
    }

    let final_snapshot = RuntimeFinalSnapshot {
        assistant_text,
        tool_calls: Vec::<RuntimeToolCall>::new(),
        tool_results: Vec::<RuntimeToolResult>::new(),
        artifacts: vec![],
        outcome: outcome_status,
        error_code: outcome.error_code.clone(),
        error_message: outcome.error_message.clone(),
        stop_reason: outcome.stop_reason.clone(),
    };

    let accepted = writer
        .events_for_session(session_id)
        .map_err(|error| error.to_string())?
        .into_iter()
        .any(|event| {
            event.fact_type == "conversation.turnAccepted"
                && event.attempt_id.as_deref() == Some(attempt_id)
        });
    if outcome_status == OutcomeStatus::Completed && !accepted {
        return Err(format!(
            "run.settled arrived before typed prompt ACK for attempt {attempt_id}"
        ));
    }

    let committed_at = now_millis() as i64;
    let existing = writer
        .binding_state(session_id, &binding_key)
        .map_err(|error| error.to_string())?;
    let provisioning = provisioning_json(PROVISIONING_READY, None, Some(attempt_id));
    let atomic_binding = existing
        .as_ref()
        .map(|row| {
            terminal_binding_update(
                row,
                attempt_id,
                native_session_id.clone(),
                Some(provisioning.clone()),
                committed_at,
            )
        })
        .transpose()?
        .flatten();
    // Change C pending 存在时，terminal fact 与 committed cursor/pending 必须同事务提交。
    let append = if let Some(binding) = atomic_binding.as_ref() {
        sink::commit_turn_with_binding(
            writer,
            session_id.to_string(),
            logical_turn_id.to_string(),
            attempt_id.to_string(),
            format!("input:{attempt_id}"),
            target.to_snapshot(),
            final_snapshot,
            committed_at,
            binding,
        )
    } else {
        sink::commit_turn(
            writer,
            session_id.to_string(),
            logical_turn_id.to_string(),
            attempt_id.to_string(),
            format!("input:{attempt_id}"),
            target.to_snapshot(),
            final_snapshot,
            committed_at,
        )
    }
    .map_err(|error| format!("{}: {}", error.context, error.detail))?;
    let (duplicate, sequence) = match append {
        AppendOutcome::Inserted { sequence, .. } => (false, Some(sequence)),
        AppendOutcome::Duplicate { existing_sequence } => (true, Some(existing_sequence)),
    };

    if atomic_binding.is_some() {
        return Ok(CommitTurnOutcome {
            duplicate,
            sequence,
            binding_key,
        });
    }
    // Change C 有 pending 时，committed cursor 必须由 commit_delivery 按 package
    // throughSequence 推进，不能误写成 turnCommitted 自身 sequence。
    let legacy_committed_sequence = if existing
        .as_ref()
        .and_then(|row| row.pending_delivery_json.as_ref())
        .is_some()
    {
        None
    } else {
        sequence
    };
    upsert_binding_row(
        writer,
        session_id,
        &binding_key,
        engine,
        provider_profile_id,
        existing.as_ref(),
        native_session_id,
        legacy_committed_sequence,
        provisioning,
        "ready",
    )
    .map_err(|error| error.to_string())?;
    commit_delivery(
        writer,
        session_id,
        &binding_key,
        attempt_id,
        now_millis() as i64,
    )?;

    Ok(CommitTurnOutcome {
        duplicate,
        sequence,
        binding_key,
    })
}

// ---------------------------------------------------------------------------
// B.4 core：recovery / rebuild
// ---------------------------------------------------------------------------

pub fn mark_recovery_core(
    writer: &SharedEventWriter,
    session_id: &str,
    binding_key: &str,
    engine: EngineType,
    provider_profile_id: Option<String>,
    reason: Option<&str>,
) -> Result<(), String> {
    let provider_profile_id = provider_profile_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let existing = writer
        .binding_state(session_id, binding_key)
        .map_err(|error| error.to_string())?;
    upsert_binding_row(
        writer,
        session_id,
        binding_key,
        engine,
        provider_profile_id,
        existing.as_ref(),
        None,
        None,
        provisioning_json(PROVISIONING_RECOVERY_REQUIRED, reason, None),
        "recovery-required",
    )
    .map_err(|error| error.to_string())?;
    append_control_fact(
        writer,
        session_id,
        "binding.recovery-required",
        Some(binding_key),
        reason,
    )
}

/// 显式重建的 durable 部分：归档旧 native identity，provisioning 回 prepared。
/// 返回被归档的 native session id（若有）。
pub fn rebuild_binding_core(
    writer: &SharedEventWriter,
    session_id: &str,
    binding_key: &str,
    engine: EngineType,
    provider_profile_id: Option<String>,
) -> Result<Option<String>, String> {
    let provider_profile_id = provider_profile_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let existing = writer
        .binding_state(session_id, binding_key)
        .map_err(|error| error.to_string())?;
    let archived_native_session_id = existing
        .as_ref()
        .and_then(|row| row.native_session_id.clone());

    // 重建必须显式清空 native_session_id 与 committed cursor（新 binding 未消费任何历史），
    // 不能走 upsert_binding_row 的“保留旧值”路径。
    writer
        .upsert_binding_state(&BindingStateUpdate {
            session_id: session_id.to_string(),
            binding_key: binding_key.to_string(),
            engine: engine.icon().to_string(),
            provider_profile_id,
            native_session_id: None,
            accepted_through_sequence: None,
            committed_through_sequence: None,
            provisioning_json: Some(
                json!({
                    "state": PROVISIONING_PREPARED,
                    "updatedAt": now_millis(),
                    "rebuiltAt": now_millis(),
                    "archivedNativeSessionId": archived_native_session_id,
                })
                .to_string(),
            ),
            pending_delivery_json: None,
            availability: "provisioning".to_string(),
            updated_at: now_millis() as i64,
        })
        .map_err(|error| error.to_string())?;
    append_control_fact(
        writer,
        session_id,
        "binding.rebuilt",
        Some(binding_key),
        Some("explicit-user-rebuild"),
    )?;
    Ok(archived_native_session_id)
}

// ---------------------------------------------------------------------------
// Probe / turn_state（只读 evidence，供 B.4.3 定性与 B.6.5 重启恢复）
// ---------------------------------------------------------------------------

fn collect_attempt_evidence(
    events: &[crate::shared_event_log::StoredEvent],
) -> (
    Vec<(String, Option<String>)>,
    std::collections::HashSet<String>,
) {
    let mut requested: Vec<(String, Option<String>)> = Vec::new();
    let mut seen_requested = std::collections::HashSet::new();
    let mut committed = std::collections::HashSet::new();
    for event in events {
        let Some(attempt_id) = event.attempt_id.clone() else {
            continue;
        };
        match event.fact_type.as_str() {
            "conversation.turnRequested" => {
                if seen_requested.insert(attempt_id.clone()) {
                    requested.push((attempt_id, event.logical_turn_id.clone()));
                }
            }
            "conversation.turnCommitted" => {
                committed.insert(attempt_id);
            }
            _ => {}
        }
    }
    let committed_set = committed;
    requested.retain(|(attempt_id, _)| !committed_set.contains(attempt_id));
    (requested, committed_set)
}

// ---------------------------------------------------------------------------
// Tauri commands（薄封装）
// ---------------------------------------------------------------------------

fn require_writer(state: &AppState) -> Result<&SharedEventWriter, String> {
    state
        .shared_event_writer
        .as_ref()
        .ok_or_else(|| "shared event log unavailable".to_string())
}

#[tauri::command]
pub async fn shared_session_v2_begin_turn(
    workspace_id: String,
    thread_id: String,
    target: ExecutionTargetInput,
    text: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let _ = workspace_id;
    let writer = require_writer(&state)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    if let Err(reason) = validate_execution_target(&target) {
        return Ok(json!({
            "status": "target-unavailable",
            "reason": reason,
        }));
    }
    let outcome = begin_turn_core(writer, &shared_session_id, &target, text)?;
    Ok(match outcome.status {
        BeginTurnStatus::Creating => json!({
            "status": "creating",
            "attemptId": outcome.attempt_id,
            "logicalTurnId": outcome.logical_turn_id,
            "bindingKey": outcome.binding_key,
            "snapshot": outcome
                .snapshot
                .map(|value| serde_json::to_value(value).ok())
                .flatten(),
        }),
        BeginTurnStatus::RecoveryRequired => json!({
            "status": "recovery-required",
            "bindingKey": outcome.binding_key,
            "reason": outcome.reason,
        }),
        BeginTurnStatus::TargetUnavailable => json!({
            "status": "target-unavailable",
            "reason": outcome.reason,
        }),
    })
}

#[tauri::command]
pub async fn shared_session_v2_prepare_context(
    workspace_id: String,
    thread_id: String,
    target: ExecutionTargetInput,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let _ = &workspace_id;
    let writer = require_writer(&state)?;
    let engine = ensure_supported_shared_session_engine(target.engine)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let binding_key = shared_target_binding_key(engine, target.normalized_provider().as_deref());
    let binding = writer
        .binding_state(&shared_session_id, &binding_key)
        .map_err(|error| error.to_string())?;
    let package = compile_context(
        &writer
            .events_for_session(&shared_session_id)
            .map_err(|error| error.to_string())?,
        &CompileContextRequest {
            session_id: shared_session_id,
            binding_key,
            destination: serde_json::to_value(&target).map_err(|error| error.to_string())?,
            destination_native_session_id: binding
                .as_ref()
                .and_then(|row| row.native_session_id.clone()),
            from_sequence_exclusive: binding
                .as_ref()
                .and_then(|row| row.accepted_through_sequence),
            through_sequence_inclusive: None,
            exclude_attempt_id: None,
            capabilities: context_capabilities(&target),
            budget_estimated_tokens: None,
        },
    )?;
    let omissions = package
        .manifest
        .omitted
        .iter()
        .map(|omission| format!("{}: {}", omission.category, omission.reason))
        .collect::<Vec<_>>();
    Ok(json!({
        "status": if omissions.is_empty() { "ready" } else { "degraded" },
        "mode": package.manifest.mode,
        "omissions": omissions,
        "manifest": package.manifest,
        "compression": package.compression,
    }))
}

/// Tx3：基于 Tx1 之后的固定 source snapshot 编译 package，先原子保存 artifact，
/// 再原子追加 deliveryPrepared + pending。当前 attempt 自身不进入历史 package。
#[tauri::command]
pub async fn shared_session_v2_prepare_delivery(
    workspace_id: String,
    thread_id: String,
    attempt_id: String,
    logical_turn_id: String,
    target: ExecutionTargetInput,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let writer = require_writer(&state)?;
    let engine = ensure_supported_shared_session_engine(target.engine)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let binding_key = shared_target_binding_key(engine, target.normalized_provider().as_deref());
    let binding = writer
        .binding_state(&shared_session_id, &binding_key)
        .map_err(|error| error.to_string())?;
    let events = writer
        .events_for_session(&shared_session_id)
        .map_err(|error| error.to_string())?;
    let source_upper = events
        .iter()
        .find(|event| {
            event.fact_type == "conversation.turnRequested"
                && event.attempt_id.as_deref() == Some(attempt_id.as_str())
        })
        .map(|event| event.sequence.saturating_sub(1))
        .ok_or_else(|| "turnRequested missing before context prepare".to_string())?;
    let package = compile_context(
        &events,
        &CompileContextRequest {
            session_id: shared_session_id.clone(),
            binding_key: binding_key.clone(),
            destination: serde_json::to_value(&target).map_err(|error| error.to_string())?,
            destination_native_session_id: binding
                .as_ref()
                .and_then(|row| row.native_session_id.clone()),
            from_sequence_exclusive: binding
                .as_ref()
                .and_then(|row| row.accepted_through_sequence),
            through_sequence_inclusive: Some(source_upper),
            exclude_attempt_id: Some(attempt_id.clone()),
            capabilities: context_capabilities(&target),
            budget_estimated_tokens: None,
        },
    )?;
    let prepared_at = now_millis() as i64;
    let artifact = write_artifact(
        context_artifact_root(&state)?,
        &workspace_id,
        &shared_session_id,
        &package,
        prepared_at,
    )?;
    prepare_delivery(
        writer,
        &PrepareDeliveryRequest {
            session_id: shared_session_id,
            binding_key,
            engine: engine.icon().to_string(),
            provider_profile_id: target.normalized_provider(),
            logical_turn_id,
            attempt_id,
            package: package.clone(),
            prepared_at,
        },
    )?;
    Ok(json!({
        "status": if package.manifest.omitted.is_empty() { "ready" } else { "degraded" },
        "packageId": package.package_id,
        "artifactId": artifact.artifact_id,
        "sourceChecksum": package.manifest.source_checksum,
        "throughSequenceInclusive": package.manifest.through_sequence_inclusive,
        "mode": package.manifest.mode,
        "operation": package.manifest.mode.operation(),
        "promptPrefix": package.prompt_prefix,
        "importItems": codex_import_items(&package),
        "manifest": package.manifest,
        "compression": package.compression,
        "ackFidelity": if context_capabilities(&target).strong_context_ack { "strong" } else { "weak" },
    }))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn shared_session_v2_accept_context(
    workspace_id: String,
    thread_id: String,
    attempt_id: String,
    logical_turn_id: String,
    binding_key: String,
    package_id: String,
    native_session_id: Option<String>,
    native_request_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let _ = workspace_id;
    let writer = require_writer(&state)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    accept_delivery(
        writer,
        &AcceptDeliveryRequest {
            session_id: shared_session_id,
            binding_key,
            logical_turn_id,
            attempt_id,
            package_id: package_id.clone(),
            native_session_id,
            native_request_id,
            accepted_at: now_millis() as i64,
        },
    )?;
    Ok(json!({ "status": "accepted", "packageId": package_id }))
}

#[tauri::command]
pub async fn shared_context_retrieve_artifact(
    workspace_id: String,
    thread_id: String,
    artifact_id: String,
    checksum: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let artifact = read_artifact(
        context_artifact_root(&state)?,
        &ArtifactReadRequest {
            workspace_id,
            session_id: shared_session_id,
            artifact_id,
            checksum,
        },
    )?;
    serde_json::to_value(artifact).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn shared_context_scan_orphans(state: State<'_, AppState>) -> Result<Value, String> {
    let writer = require_writer(&state)?;
    // ponytail: report-only maintenance path，按 artifact 读取 session events；
    // artifact 量显著增长后可升级为一次性 packageId index。
    let paths = scan_orphan_artifacts(context_artifact_root(&state)?, |artifact| {
        writer
            .events_for_session(&artifact.session_id)
            .ok()
            .is_some_and(|events| {
                events.iter().any(|event| {
                    if event.fact_type != "context.deliveryPrepared" {
                        return false;
                    }
                    serde_json::from_str::<Value>(&event.payload_json)
                        .ok()
                        .and_then(|payload| {
                            payload
                                .get("packageId")
                                .and_then(Value::as_str)
                                .map(|package_id| package_id == artifact.package.package_id)
                        })
                        .unwrap_or(false)
                })
            })
    })?;
    Ok(json!({
        "status": "report-only",
        "paths": paths,
    }))
}

#[tauri::command]
pub async fn shared_session_v2_accept_turn(
    workspace_id: String,
    thread_id: String,
    attempt_id: String,
    logical_turn_id: String,
    target: ExecutionTargetInput,
    native_session_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let _ = workspace_id;
    let writer = require_writer(&state)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    accept_turn_core(
        writer,
        &shared_session_id,
        &attempt_id,
        &logical_turn_id,
        &target,
        &native_session_id,
    )?;
    Ok(json!({
        "status": "accepted",
        "attemptId": attempt_id,
    }))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn shared_session_v2_commit_turn(
    workspace_id: String,
    thread_id: String,
    attempt_id: String,
    logical_turn_id: String,
    target: ExecutionTargetInput,
    assistant_text: Option<String>,
    outcome: CommitOutcomeInput,
    native_session_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let _ = workspace_id;
    let writer = require_writer(&state)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let result = commit_turn_core(
        writer,
        &shared_session_id,
        &attempt_id,
        &logical_turn_id,
        &target,
        assistant_text,
        &outcome,
        native_session_id,
    )?;
    Ok(json!({
        "status": "committed",
        "duplicate": result.duplicate,
        "sequence": result.sequence,
        "bindingKey": result.binding_key,
    }))
}

/// ACK 不确定（超时/崩溃/未知）：provisioning → recovery-required，禁止盲目重建。
#[tauri::command]
pub async fn shared_session_v2_mark_recovery(
    workspace_id: String,
    thread_id: String,
    binding_key: String,
    engine: EngineType,
    provider_profile_id: Option<String>,
    reason: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let _ = workspace_id;
    let engine = ensure_supported_shared_session_engine(engine)?;
    let writer = require_writer(&state)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    mark_recovery_core(
        writer,
        &shared_session_id,
        &binding_key,
        engine,
        provider_profile_id,
        reason.as_deref(),
    )?;
    Ok(json!({
        "status": "recovery-required",
        "bindingKey": binding_key,
    }))
}

/// 用户显式重建：归档旧 Binding（durable 留痕），新 Native Session 重新 provisioning。
/// Shared Session Identity 不变；committed cursor 清空（新 binding 未消费任何历史）。
#[tauri::command]
pub async fn shared_session_v2_rebuild_binding(
    workspace_id: String,
    thread_id: String,
    binding_key: String,
    engine: EngineType,
    provider_profile_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let engine = ensure_supported_shared_session_engine(engine)?;
    let writer = require_writer(&state)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let archived_native_session_id = rebuild_binding_core(
        writer,
        &shared_session_id,
        &binding_key,
        engine,
        provider_profile_id.clone(),
    )?;

    // meta 层同步：目标 binding 回到 pending native thread id（下次 send 时建联）。
    let mut meta = read_shared_session_meta(&workspace_id, &shared_session_id)?;
    let now = now_millis();
    let provider = provider_profile_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let pending_native_thread_id = engine_binding_thread_id(engine, &Uuid::new_v4().to_string());
    meta.bindings_by_target.insert(
        binding_key.clone(),
        SharedTargetBindingMeta {
            binding_key: binding_key.clone(),
            engine,
            provider_profile_id: provider,
            native_thread_id: pending_native_thread_id.clone(),
            created_at: now,
            last_used_at: now,
            last_synced_turn_seq: 0,
            availability: "provisioning".to_string(),
        },
    );
    meta.updated_at = now;
    write_shared_session_meta(&meta)?;

    Ok(json!({
        "status": PROVISIONING_PREPARED,
        "bindingKey": binding_key,
        "nativeThreadId": pending_native_thread_id,
        "archivedNativeSessionId": archived_native_session_id,
    }))
}

/// Probe（B.4.3）：读取 durable evidence 供前端定性（active / terminal / not-accepted）。
/// 不触碰 runtime，不修改任何状态。
#[tauri::command]
pub async fn shared_session_v2_probe_binding(
    workspace_id: String,
    thread_id: String,
    binding_key: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let writer = require_writer(&state)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;

    let existing = writer
        .binding_state(&shared_session_id, &binding_key)
        .map_err(|error| error.to_string())?;
    let events = writer
        .events_for_session(&shared_session_id)
        .map_err(|error| error.to_string())?;
    let (in_flight, _) = collect_attempt_evidence(&events);
    let accepted: std::collections::HashSet<String> = events
        .iter()
        .filter(|event| event.fact_type == "conversation.turnAccepted")
        .filter_map(|event| event.attempt_id.clone())
        .collect();
    let native_probe = match existing.as_ref() {
        Some(row) if row.engine == EngineType::Claude.icon() => {
            let session = state
                .engine_manager
                .claude_manager
                .get_session_for_provider(&workspace_id, row.provider_profile_id.as_deref())
                .await;
            match session {
                Some(session) => {
                    let runtime_session_id = session.get_session_id().await;
                    let expected_session_id = row
                        .native_session_id
                        .as_deref()
                        .and_then(|value| value.strip_prefix("claude:"))
                        .or(row.native_session_id.as_deref());
                    json!({
                        "status": if runtime_session_id.as_deref() == expected_session_id { "matched" } else { "mismatch" },
                        "runtimeSessionId": runtime_session_id,
                        "activeProcessIds": session.active_process_ids().await,
                    })
                }
                None => json!({ "status": "runtime-missing" }),
            }
        }
        Some(row) if row.engine == EngineType::Codex.icon() => {
            let provider = row.provider_profile_id.as_deref().unwrap_or("__disk__");
            let runtime_key =
                crate::codex::provider_profile::codex_runtime_key(&workspace_id, provider);
            let session = state.sessions.lock().await.get(&runtime_key).cloned();
            match session {
                Some(session) => {
                    let health = session.probe_health(Duration::from_secs(2)).await;
                    json!({
                        "status": if health.is_ok() { "matched" } else { "runtime-unhealthy" },
                        "runtimeKey": runtime_key,
                        "detail": health.err(),
                    })
                }
                None => json!({ "status": "runtime-missing", "runtimeKey": runtime_key }),
            }
        }
        Some(_) => json!({ "status": "unsupported-engine" }),
        None => json!({ "status": "binding-missing" }),
    };

    Ok(json!({
        "status": "ok",
        "bindingKey": binding_key,
        "provisioningState": existing.as_ref().map(provisioning_state_of),
        "nativeSessionId": existing.as_ref().and_then(|row| row.native_session_id.clone()),
        "committedThroughSequence": existing.as_ref().and_then(|row| row.committed_through_sequence),
        "nativeProbe": native_probe,
        "inFlightAttempts": in_flight
            .iter()
            .map(|(attempt_id, logical_turn_id)| json!({
                "attemptId": attempt_id,
                "logicalTurnId": logical_turn_id,
                "accepted": accepted.contains(attempt_id),
            }))
            .collect::<Vec<_>>(),
    }))
}

/// 重启恢复（B.6.5）：返回 durable evidence，前端据此恢复 running/settling/recovery-required，
/// 而不是落回 idle。只读。
#[tauri::command]
pub async fn shared_session_v2_turn_state(
    workspace_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let _ = workspace_id;
    let writer = require_writer(&state)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;

    let events = writer
        .events_for_session(&shared_session_id)
        .map_err(|error| error.to_string())?;
    let (in_flight, _) = collect_attempt_evidence(&events);
    let accepted: std::collections::HashSet<String> = events
        .iter()
        .filter(|event| event.fact_type == "conversation.turnAccepted")
        .filter_map(|event| event.attempt_id.clone())
        .collect();
    let mut binding_keys = std::collections::HashSet::new();
    for event in &events {
        if let Ok(payload) = serde_json::from_str::<Value>(&event.payload_json) {
            if let Some(binding_key) = payload.get("bindingKey").and_then(Value::as_str) {
                binding_keys.insert(binding_key.to_string());
            }
        }
    }

    let mut bindings = Vec::new();
    for binding_key in binding_keys {
        if let Some(row) = writer
            .binding_state(&shared_session_id, &binding_key)
            .map_err(|error| error.to_string())?
        {
            bindings.push(json!({
                "bindingKey": row.binding_key,
                "provisioningState": provisioning_state_of(&row),
                "availability": row.availability,
            }));
        }
    }

    Ok(json!({
        "status": "ok",
        "inFlightAttempts": in_flight
            .iter()
            .map(|(attempt_id, logical_turn_id)| json!({
                "attemptId": attempt_id,
                "logicalTurnId": logical_turn_id,
                "accepted": accepted.contains(attempt_id),
            }))
            .collect::<Vec<_>>(),
        "bindings": bindings,
    }))
}
