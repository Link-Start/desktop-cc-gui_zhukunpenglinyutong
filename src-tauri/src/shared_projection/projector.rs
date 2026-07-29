//! SharedProjector：Canonical Fact → ProjectionItem 映射。

use std::collections::{HashMap, HashSet};

use serde_json::{json, Value};

use crate::shared_event_log::canonical::types::{
    ArtifactRef, CanonicalBlock, CanonicalFact, ControlFact, OutcomeStatus, ToolResultStatus,
    TurnCommittedFact, TurnRequestedFact, UsageRecordedFact, UsageSource,
};
use crate::shared_event_log::{
    ProjectionCheckpointRow, SharedEventWriter, StoreError, StoredEvent,
};

use super::types::{ProjectionItem, ProjectionItemKind};

fn decode_canonical_fact(event: &StoredEvent) -> Result<CanonicalFact, StoreError> {
    let context = format!(
        "project canonical event session={} sequence={} fact_type={}",
        event.session_id, event.sequence, event.fact_type
    );
    let mut payload = serde_json::from_str::<Value>(&event.payload_json)
        .map_err(|source| StoreError::json(context.clone(), source))?;
    let object = payload.as_object_mut().ok_or_else(|| {
        StoreError::validation_failed(context.clone(), "canonical payload must be a JSON object")
    })?;
    match object.get("type") {
        Some(Value::String(payload_type)) if payload_type == &event.fact_type => {}
        Some(Value::String(payload_type)) => {
            return Err(StoreError::validation_failed(
                context,
                format!(
                    "payload type '{}' conflicts with durable fact_type '{}'",
                    payload_type, event.fact_type
                ),
            ));
        }
        Some(_) => {
            return Err(StoreError::validation_failed(
                context,
                "canonical payload type must be a string",
            ));
        }
        None => {
            object.insert("type".to_string(), Value::String(event.fact_type.clone()));
        }
    }
    serde_json::from_value::<CanonicalFact>(payload)
        .map_err(|source| StoreError::json(context, source))
}

/// Canonical Fact 到 UI 的单向投影器。
#[derive(Debug, Default)]
pub struct SharedProjector;

impl SharedProjector {
    pub fn new() -> Self {
        Self
    }

    /// 把一组 StoredEvent 投影为 ProjectionItem 列表。
    pub fn project_events(
        &self,
        events: &[StoredEvent],
    ) -> Result<Vec<ProjectionItem>, StoreError> {
        let canonical_turn_ids = events
            .iter()
            .filter(|event| event.fidelity == crate::shared_event_log::Fidelity::Canonical)
            .filter_map(|event| event.logical_turn_id.as_deref())
            .collect::<HashSet<_>>();
        let mut decoded = Vec::with_capacity(events.len());
        let mut preferred_usage_by_attempt: HashMap<String, (u8, i64, i64)> = HashMap::new();
        for event in events {
            // Legacy/V0 shadow may be appended after its V2 canonical fact. It can keep richer
            // presentation-only content for legacy-only Turns, but it must never downgrade the
            // immutable target of a logical Turn already owned by canonical V2.
            if event.fidelity == crate::shared_event_log::Fidelity::PresentationOnly
                && event
                    .logical_turn_id
                    .as_deref()
                    .is_some_and(|turn_id| canonical_turn_ids.contains(turn_id))
            {
                continue;
            }
            let fact = decode_canonical_fact(event)?;
            if let CanonicalFact::UsageRecorded(usage) = &fact {
                let priority = match usage.source {
                    UsageSource::RuntimeFinal => 0,
                    UsageSource::ProviderReport => 1,
                };
                preferred_usage_by_attempt
                    .entry(usage.attempt_id.clone())
                    .and_modify(|current| {
                        if (priority, usage.revision, event.sequence) > *current {
                            *current = (priority, usage.revision, event.sequence);
                        }
                    })
                    .or_insert((priority, usage.revision, event.sequence));
            }
            decoded.push((event, fact));
        }

        let mut items = Vec::new();
        for (event, fact) in decoded {
            if let CanonicalFact::UsageRecorded(usage) = &fact {
                let selected_sequence = preferred_usage_by_attempt
                    .get(&usage.attempt_id)
                    .map(|selected| selected.2);
                if selected_sequence != Some(event.sequence) {
                    continue;
                }
            }
            items.extend(self.project_fact(event, &fact));
        }
        Ok(items)
    }

    /// 使用持久化 checkpoint 增量投影；version 不匹配或旧 cache 不可用时全量 rebuild。
    pub fn project(
        &self,
        writer: &SharedEventWriter,
        session_id: &str,
        projection_name: &str,
        projection_version: i64,
    ) -> Result<Vec<ProjectionItem>, StoreError> {
        let checkpoint = writer.get_projection_checkpoint(session_id, projection_name)?;
        let (mut items, through_sequence) = match checkpoint {
            Some(checkpoint) if checkpoint.projection_version == projection_version => {
                match serde_json::from_str::<Vec<ProjectionItem>>(&checkpoint.payload_json) {
                    Ok(items) => (items, checkpoint.through_sequence),
                    Err(_) => {
                        return self.rebuild(
                            writer,
                            session_id,
                            projection_name,
                            projection_version,
                        )
                    }
                }
            }
            _ => {
                return self.rebuild(writer, session_id, projection_name, projection_version);
            }
        };

        let events = writer.read_projection_events(session_id, through_sequence)?;
        if events
            .iter()
            .any(|event| event.fidelity == crate::shared_event_log::Fidelity::PresentationOnly)
        {
            let all_events = writer.events_for_session(session_id)?;
            if all_events
                .iter()
                .any(|event| event.fidelity == crate::shared_event_log::Fidelity::Canonical)
            {
                // ponytail: V0 rollback/shadow writes are rare and projection loads are
                // session-scoped. Rebuild only at this compatibility boundary so canonical
                // precedence can compare against the complete logical-Turn set.
                let items = self.project_events(&all_events)?;
                let new_through_sequence = all_events
                    .iter()
                    .map(|event| event.sequence)
                    .max()
                    .unwrap_or(through_sequence);
                self.persist_checkpoint(
                    writer,
                    session_id,
                    projection_name,
                    projection_version,
                    new_through_sequence,
                    &items,
                )?;
                return Ok(items);
            }
        }
        let projected = self.project_events(&events)?;
        merge_projected_items(&mut items, projected);
        let new_through_sequence = events
            .iter()
            .map(|event| event.sequence)
            .max()
            .unwrap_or(through_sequence);
        self.persist_checkpoint(
            writer,
            session_id,
            projection_name,
            projection_version,
            new_through_sequence,
            &items,
        )?;
        Ok(items)
    }

    /// 全量 rebuild：扫描 session 全部事件，投影并更新 checkpoint。
    ///
    /// rebuild 是幂等的：相同事件流 + 相同 projection_version 产出相同 items 与 checkpoint。
    pub fn rebuild(
        &self,
        writer: &SharedEventWriter,
        session_id: &str,
        projection_name: &str,
        projection_version: i64,
    ) -> Result<Vec<ProjectionItem>, StoreError> {
        let events = writer.events_for_session(session_id)?;
        let items = self.project_events(&events)?;
        let through_sequence = events.iter().map(|event| event.sequence).max().unwrap_or(0);
        self.persist_checkpoint(
            writer,
            session_id,
            projection_name,
            projection_version,
            through_sequence,
            &items,
        )?;
        Ok(items)
    }

    fn persist_checkpoint(
        &self,
        writer: &SharedEventWriter,
        session_id: &str,
        projection_name: &str,
        projection_version: i64,
        through_sequence: i64,
        items: &[ProjectionItem],
    ) -> Result<(), StoreError> {
        let payload_json = serde_json::to_string(items)
            .map_err(|source| StoreError::json("serialize projection checkpoint", source))?;
        writer.upsert_projection_checkpoint(&ProjectionCheckpointRow {
            session_id: session_id.to_string(),
            projection_name: projection_name.to_string(),
            projection_version,
            through_sequence,
            payload_json,
        })
    }

    fn project_fact(&self, event: &StoredEvent, fact: &CanonicalFact) -> Vec<ProjectionItem> {
        match fact {
            CanonicalFact::TurnRequested(f) => self.project_turn_requested(event, f),
            CanonicalFact::TurnCommitted(f) => self.project_turn_committed(event, f),
            CanonicalFact::UsageRecorded(f) => self.project_usage_recorded(event, f),
            CanonicalFact::Control(f) => self.project_control(event, f),
            _ => vec![],
        }
    }

    fn project_turn_requested(
        &self,
        event: &StoredEvent,
        fact: &TurnRequestedFact,
    ) -> Vec<ProjectionItem> {
        let text = fact.input.text.clone().unwrap_or_default();
        vec![ProjectionItem {
            id: format!("{}:user", event.sequence),
            kind: ProjectionItemKind::Message,
            content: json!({
                "role": "user",
                "text": text,
                "turnId": fact.logical_turn_id,
                "engineSource": fact.target.engine,
                "executionTargetSnapshot": fact.target,
            }),
            fidelity: event.fidelity,
            checksum: event.payload_checksum.clone(),
        }]
    }

    fn project_turn_committed(
        &self,
        event: &StoredEvent,
        fact: &TurnCommittedFact,
    ) -> Vec<ProjectionItem> {
        let mut items = Vec::new();
        let mut projected_artifact_ids = HashSet::new();
        let mut has_assistant_message = false;
        let checksum = event.payload_checksum.clone();

        // Assistant blocks → message / reasoning items
        for (index, block) in fact.assistant.blocks.iter().enumerate() {
            match block {
                CanonicalBlock::Text { text } => {
                    has_assistant_message = true;
                    items.push(ProjectionItem {
                        id: format!("{}:assistant:{}", event.sequence, index),
                        kind: ProjectionItemKind::Message,
                        content: json!({
                            "role": "assistant",
                            "text": text,
                            "turnId": fact.logical_turn_id,
                            "engineSource": fact.target.engine,
                            "executionTargetSnapshot": fact.target,
                            "isFinal": true,
                            "finalCompletedAt": fact.committed_at,
                        }),
                        fidelity: event.fidelity,
                        checksum: checksum.clone(),
                    });
                }
                CanonicalBlock::Reasoning { text } => {
                    items.push(ProjectionItem {
                        id: format!("{}:reasoning:{}", event.sequence, index),
                        kind: ProjectionItemKind::Reasoning,
                        content: json!({
                            "summary": text,
                            "content": text,
                            "engineSource": fact.target.engine,
                        }),
                        fidelity: event.fidelity,
                        checksum: checksum.clone(),
                    });
                }
                CanonicalBlock::RedactedReasoning { .. } => {
                    items.push(ProjectionItem {
                        id: format!("{}:reasoning:{}", event.sequence, index),
                        kind: ProjectionItemKind::Reasoning,
                        content: json!({
                            "summary": "[redacted]",
                            "content": "[redacted]",
                            "engineSource": fact.target.engine,
                        }),
                        fidelity: event.fidelity,
                        checksum: checksum.clone(),
                    });
                }
                CanonicalBlock::ArtifactRef { artifact_ref } => {
                    projected_artifact_ids.insert(artifact_ref.artifact_id.clone());
                    let (kind, content) = project_artifact_ref(
                        artifact_ref,
                        &fact.logical_turn_id,
                        &fact.target.engine,
                    );
                    items.push(ProjectionItem {
                        id: format!("{}:artifact:{}", event.sequence, index),
                        kind,
                        content,
                        fidelity: event.fidelity,
                        checksum: checksum.clone(),
                    });
                }
            }
        }

        // Runtime-owned standalone artifacts are canonical facts too. Project them
        // even when the assistant block stream did not carry an inline ArtifactRef.
        for (index, artifact_ref) in fact.artifact_refs.iter().enumerate() {
            if !projected_artifact_ids.insert(artifact_ref.artifact_id.clone()) {
                continue;
            }
            let (kind, content) =
                project_artifact_ref(artifact_ref, &fact.logical_turn_id, &fact.target.engine);
            items.push(ProjectionItem {
                id: format!("{}:artifact-ref:{}", event.sequence, index),
                kind,
                content,
                fidelity: event.fidelity,
                checksum: checksum.clone(),
            });
        }

        // Tool exchanges → tool items
        for (index, exchange) in fact.atomic_tool_exchanges.iter().enumerate() {
            let status = match exchange.result.status {
                ToolResultStatus::Completed => "completed",
                ToolResultStatus::Error => "error",
                ToolResultStatus::Incomplete => "incomplete",
            };
            items.push(ProjectionItem {
                id: format!("{}:tool:{}", event.sequence, index),
                kind: ProjectionItemKind::Tool,
                content: json!({
                    "toolType": exchange.tool_name,
                    "turnId": fact.logical_turn_id,
                    "title": exchange.tool_name,
                    "detail": exchange.call.arguments_summary.clone().unwrap_or_default(),
                    "status": status,
                    "output": exchange.result.output_summary.clone().unwrap_or_default(),
                    "engineSource": fact.target.engine,
                }),
                fidelity: event.fidelity,
                checksum: checksum.clone(),
            });
        }

        // 非成功 terminal 也是本轮可见的 assistant 结果。必须携带同一个 immutable
        // target snapshot，否则 history reload 会同时丢掉错误与 CLI/Provider/Model label。
        if !matches!(fact.outcome.status, OutcomeStatus::Completed) {
            has_assistant_message = true;
            let status_text = match fact.outcome.status {
                OutcomeStatus::Completed => "completed",
                OutcomeStatus::Failed => "failed",
                OutcomeStatus::Cancelled => "cancelled",
                OutcomeStatus::Replaced => "replaced",
            };
            items.push(ProjectionItem {
                id: format!("{}:outcome", event.sequence),
                kind: ProjectionItemKind::Message,
                content: json!({
                    "role": "assistant",
                    "text": format!("Turn {}: {}", status_text, fact.outcome.error_message.clone().unwrap_or_default()),
                    "turnId": fact.logical_turn_id,
                    "engineSource": fact.target.engine,
                    "executionTargetSnapshot": fact.target,
                    "isFinal": true,
                    "finalCompletedAt": fact.committed_at,
                }),
                fidelity: event.fidelity,
                checksum: checksum.clone(),
            });
        }

        // Reasoning-only / tool-only completed Turns still need one presentation anchor
        // carrying the immutable Target. MessageRow renders the per-turn CLI/Provider/Model
        // badge even when the assistant body is empty; current Picker state is never consulted.
        if !has_assistant_message {
            items.push(ProjectionItem {
                id: format!("{}:provenance", event.sequence),
                kind: ProjectionItemKind::Message,
                content: json!({
                    "role": "assistant",
                    "text": "",
                    "turnId": fact.logical_turn_id,
                    "engineSource": fact.target.engine,
                    "executionTargetSnapshot": fact.target,
                    "isFinal": true,
                    "finalCompletedAt": fact.committed_at,
                }),
                fidelity: event.fidelity,
                checksum,
            });
        }

        items
    }

    fn project_usage_recorded(
        &self,
        event: &StoredEvent,
        fact: &UsageRecordedFact,
    ) -> Vec<ProjectionItem> {
        vec![ProjectionItem {
            id: format!("{}:usage", event.sequence),
            kind: ProjectionItemKind::Metadata,
            content: json!({
                "type": "usage",
                "turnId": fact.logical_turn_id,
                "attemptId": fact.attempt_id,
                "inputTokens": fact.usage.input_tokens,
                "outputTokens": fact.usage.output_tokens,
                "totalTokens": fact.usage.total_tokens,
                "source": fact.source,
                "revision": fact.revision,
            }),
            fidelity: event.fidelity,
            checksum: event.payload_checksum.clone(),
        }]
    }

    fn project_control(&self, event: &StoredEvent, fact: &ControlFact) -> Vec<ProjectionItem> {
        vec![ProjectionItem {
            id: format!("{}:control", event.sequence),
            kind: ProjectionItemKind::SystemNotice,
            content: json!({
                "text": format!("Control: {}", fact.control_kind),
                "attemptId": fact.attempt_id,
                "logicalTurnId": fact.logical_turn_id,
                "bindingKey": fact.binding_key,
                "reason": fact.reason,
            }),
            fidelity: event.fidelity,
            checksum: event.payload_checksum.clone(),
        }]
    }
}

fn project_artifact_ref(
    artifact_ref: &ArtifactRef,
    logical_turn_id: &str,
    engine: &str,
) -> (ProjectionItemKind, Value) {
    if artifact_ref.media_type.starts_with("image/") {
        return (
            ProjectionItemKind::GeneratedImage,
            json!({
                "status": "completed",
                "sourceToolName": "artifact",
                "promptText": artifact_ref.locator,
                "turnId": logical_turn_id,
                "engineSource": engine,
                "images": [{
                    "src": artifact_ref.locator,
                    "localPath": artifact_ref.locator,
                }],
            }),
        );
    }
    (
        ProjectionItemKind::Metadata,
        json!({
            "type": "artifact",
            "artifactId": artifact_ref.artifact_id,
            "mediaType": artifact_ref.media_type,
            "locator": artifact_ref.locator,
            "turnId": logical_turn_id,
            "engineSource": engine,
        }),
    )
}

fn merge_projected_items(items: &mut Vec<ProjectionItem>, projected: Vec<ProjectionItem>) {
    for item in projected {
        if let Some((attempt_id, priority, revision)) = usage_projection_precedence(&item) {
            let existing_precedence = items
                .iter()
                .filter_map(usage_projection_precedence)
                .find(|(existing_attempt, _, _)| existing_attempt == &attempt_id);
            if existing_precedence.as_ref().is_some_and(
                |(_, existing_priority, existing_revision)| {
                    (*existing_priority, *existing_revision) >= (priority, revision)
                },
            ) {
                continue;
            }
            items.retain(|existing| {
                usage_projection_precedence(existing)
                    .is_none_or(|(existing_attempt, _, _)| existing_attempt != attempt_id)
            });
        }
        items.push(item);
    }
}

fn usage_projection_precedence(item: &ProjectionItem) -> Option<(String, u8, i64)> {
    if item.kind != ProjectionItemKind::Metadata
        || item.content.get("type").and_then(serde_json::Value::as_str) != Some("usage")
    {
        return None;
    }
    let attempt_id = item
        .content
        .get("attemptId")
        .and_then(serde_json::Value::as_str)?
        .to_string();
    let priority = match item
        .content
        .get("source")
        .and_then(serde_json::Value::as_str)
    {
        Some("provider-report") => 1,
        _ => 0,
    };
    let revision = item
        .content
        .get("revision")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or_default();
    Some((attempt_id, priority, revision))
}
