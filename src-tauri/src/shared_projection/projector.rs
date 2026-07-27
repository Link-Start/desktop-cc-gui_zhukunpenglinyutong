//! SharedProjector：Canonical Fact → ProjectionItem 映射。

use serde_json::json;

use crate::shared_event_log::canonical::types::{
    CanonicalBlock, CanonicalFact, ControlFact, OutcomeStatus, ToolResultStatus, TurnCommittedFact,
    TurnRequestedFact, UsageRecordedFact,
};
use crate::shared_event_log::{payload_checksum, ProjectionCheckpointRow, SharedEventWriter, StoreError, StoredEvent};

use super::types::{ProjectionItem, ProjectionItemKind};

/// Canonical Fact 到 UI 的单向投影器。
#[derive(Debug, Default)]
pub struct SharedProjector;

impl SharedProjector {
    pub fn new() -> Self {
        Self
    }

    /// 把一组 StoredEvent 投影为 ProjectionItem 列表。
    pub fn project_events(&self, events: &[StoredEvent]) -> Vec<ProjectionItem> {
        let mut items = Vec::new();
        for event in events {
            let fact = match serde_json::from_str::<CanonicalFact>(&event.payload_json) {
                Ok(f) => f,
                Err(_) => continue, // 无法解析的 event 跳过，不阻塞整个 session
            };
            items.extend(self.project_fact(event, &fact));
        }
        items
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
        let events = writer.read_projection_events(session_id)?;
        let items = self.project_events(&events);
        let through_sequence = events.iter().map(|event| event.sequence).max().unwrap_or(0);
        writer.upsert_projection_checkpoint(&ProjectionCheckpointRow {
            session_id: session_id.to_string(),
            projection_name: projection_name.to_string(),
            projection_version,
            through_sequence,
            payload_json: "{}".to_string(),
        })?;
        Ok(items)
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
            }),
            fidelity: event.fidelity,
            checksum: payload_checksum(2, event.fact_type.as_str(), &serde_json::from_str(&event.payload_json).unwrap_or_default()).unwrap_or_default(),
        }]
    }

    fn project_turn_committed(
        &self,
        event: &StoredEvent,
        fact: &TurnCommittedFact,
    ) -> Vec<ProjectionItem> {
        let mut items = Vec::new();
        let checksum = payload_checksum(2, event.fact_type.as_str(), &serde_json::from_str(&event.payload_json).unwrap_or_default()).unwrap_or_default();

        // Assistant blocks → message / reasoning items
        for (index, block) in fact.assistant.blocks.iter().enumerate() {
            match block {
                CanonicalBlock::Text { text } => {
                    items.push(ProjectionItem {
                        id: format!("{}:assistant:{}", event.sequence, index),
                        kind: ProjectionItemKind::Message,
                        content: json!({
                            "role": "assistant",
                            "text": text,
                            "turnId": fact.logical_turn_id,
                            "engineSource": fact.target.engine,
                            "isFinal": matches!(fact.outcome.status, OutcomeStatus::Completed),
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
                CanonicalBlock::RedactedReasoning => {
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
                    items.push(ProjectionItem {
                        id: format!("{}:artifact:{}", event.sequence, index),
                        kind: ProjectionItemKind::GeneratedImage,
                        content: json!({
                            "status": "completed",
                            "sourceToolName": "artifact",
                            "promptText": artifact_ref.locator,
                            "images": [{
                                "src": artifact_ref.locator,
                                "localPath": artifact_ref.locator,
                            }],
                        }),
                        fidelity: event.fidelity,
                        checksum: checksum.clone(),
                    });
                }
            }
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

        // Outcome → system notice if not completed
        if !matches!(fact.outcome.status, OutcomeStatus::Completed) {
            let status_text = match fact.outcome.status {
                OutcomeStatus::Completed => "completed",
                OutcomeStatus::Failed => "failed",
                OutcomeStatus::Cancelled => "cancelled",
                OutcomeStatus::Replaced => "replaced",
            };
            items.push(ProjectionItem {
                id: format!("{}:outcome", event.sequence),
                kind: ProjectionItemKind::SystemNotice,
                content: json!({
                    "text": format!("Turn {}: {}", status_text, fact.outcome.error_message.clone().unwrap_or_default()),
                    "turnId": fact.logical_turn_id,
                }),
                fidelity: event.fidelity,
                checksum: checksum.clone(),
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
            }),
            fidelity: event.fidelity,
            checksum: payload_checksum(2, event.fact_type.as_str(), &serde_json::from_str(&event.payload_json).unwrap_or_default()).unwrap_or_default(),
        }]
    }

    fn project_control(&self, event: &StoredEvent, fact: &ControlFact) -> Vec<ProjectionItem> {
        vec![ProjectionItem {
            id: format!("{}:control", event.sequence),
            kind: ProjectionItemKind::SystemNotice,
            content: json!({
                "text": format!("Control: {}", fact.action),
                "targetAttemptId": fact.target_attempt_id,
                "targetLogicalTurnId": fact.target_logical_turn_id,
            }),
            fidelity: event.fidelity,
            checksum: payload_checksum(2, event.fact_type.as_str(), &serde_json::from_str(&event.payload_json).unwrap_or_default()).unwrap_or_default(),
        }]
    }
}
