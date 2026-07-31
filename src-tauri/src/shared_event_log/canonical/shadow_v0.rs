//! V0 final-evidence → presentation-only canonical fact 映射。
//!
//! 不回写产品状态，仅作为 A2 验证对比的 Shadow Canonical Log。

use serde_json::{json, Value};

use super::types::{
    CanonicalAssistantBlocks, CanonicalBlock, CanonicalFact, CanonicalUserInput, Outcome,
    OutcomeStatus, TurnCommittedFact, TurnExecutionSnapshot, TurnRequestedFact,
};

/// 简化版 V0 evidence 输入（后续随 Legacy Import 扩展）。
#[derive(Debug, Clone)]
pub struct V0FinalEvidence {
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub input_entry_id: String,
    pub user_text: String,
    pub assistant_text: String,
    pub engine: String,
    pub provider_profile_id: Option<String>,
    pub model: Option<String>,
    pub committed_at: i64,
}

fn target_from_evidence(evidence: &V0FinalEvidence) -> TurnExecutionSnapshot {
    TurnExecutionSnapshot {
        engine: evidence.engine.clone(),
        provider_profile_id: evidence.provider_profile_id.clone(),
        model_catalog_entry_id: None,
        model: evidence.model.clone(),
        reasoning: None,
        provider_profile_name_snapshot: None,
        provider_profile_source: None,
        runtime_capability_fingerprint: None,
        extra: Value::Object(Default::default()),
    }
}

/// 把 V0 evidence 映射为 `fidelity = "presentation-only"` 的 `conversation.turnCommitted`。
pub fn map_v0_to_presentation_only(evidence: V0FinalEvidence) -> CanonicalFact {
    let target = target_from_evidence(&evidence);
    CanonicalFact::TurnCommitted(TurnCommittedFact {
        logical_turn_id: evidence.logical_turn_id,
        attempt_id: evidence.attempt_id,
        input_entry_id: evidence.input_entry_id,
        assistant: CanonicalAssistantBlocks {
            blocks: vec![CanonicalBlock::Text {
                text: evidence.assistant_text,
            }],
        },
        atomic_tool_exchanges: vec![],
        artifact_refs: vec![],
        target,
        provider_private_refs: vec![],
        omissions: vec![],
        outcome: Outcome {
            status: OutcomeStatus::Completed,
            error_code: None,
            error_message: None,
            stop_reason: None,
            extra: Value::Object(Default::default()),
        },
        committed_at: evidence.committed_at,
        extra: json!({ "shadowSource": "v0-final-evidence" }),
    })
}

/// 把一次 V0 final evidence 映射成完整的 user/assistant fact 对。
pub fn map_v0_turn_to_presentation_only_facts(evidence: V0FinalEvidence) -> [CanonicalFact; 2] {
    let requested = CanonicalFact::TurnRequested(TurnRequestedFact {
        logical_turn_id: evidence.logical_turn_id.clone(),
        attempt_id: evidence.attempt_id.clone(),
        retry_of_attempt_id: None,
        input: CanonicalUserInput {
            text: Some(evidence.user_text.clone()),
            image_refs: None,
            attachment_refs: None,
            extra: Value::Object(Default::default()),
        },
        target: target_from_evidence(&evidence),
        requested_at: evidence.committed_at,
        extra: json!({ "shadowSource": "v0-final-evidence" }),
    });
    let committed = map_v0_to_presentation_only(evidence);
    [requested, committed]
}

/// 从 V0 snapshot 中只提取 terminal Assistant Final。
///
/// ponytail: V0 没有完整 runtime lifecycle，只镜像可证明的 final message；
/// Change B 接入 authoritative Runtime ingress 后删除这条 snapshot adapter。
pub fn map_v0_snapshot_to_presentation_only_facts(
    items: &[Value],
    selected_engine: &str,
    snapshot_created_at: i64,
) -> Vec<CanonicalFact> {
    let mut latest_user: Option<(usize, &Value)> = None;
    let mut facts = Vec::new();

    for (index, item) in items.iter().enumerate() {
        if item.get("kind").and_then(Value::as_str) != Some("message") {
            continue;
        }
        match item.get("role").and_then(Value::as_str) {
            Some("user") => latest_user = Some((index, item)),
            Some("assistant") if item.get("isFinal").and_then(Value::as_bool) == Some(true) => {
                let Some((user_index, user)) = latest_user else {
                    continue;
                };
                let assistant_id = item
                    .get("id")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("assistant-{index}"));
                let logical_turn_id = item
                    .get("turnId")
                    .and_then(Value::as_str)
                    .or_else(|| user.get("turnId").and_then(Value::as_str))
                    .filter(|value| !value.trim().is_empty())
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("v0-turn-{index}"));
                let input_entry_id = user
                    .get("id")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .map(str::to_string)
                    .unwrap_or_else(|| format!("v0-input-{user_index}"));
                let committed_at = item
                    .get("finalCompletedAt")
                    .and_then(Value::as_i64)
                    .unwrap_or(snapshot_created_at);
                let engine = item
                    .get("engineSource")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or(selected_engine)
                    .to_string();
                let evidence = V0FinalEvidence {
                    logical_turn_id,
                    attempt_id: format!("v0-shadow:{assistant_id}"),
                    input_entry_id,
                    user_text: user
                        .get("text")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    assistant_text: item
                        .get("text")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    engine,
                    provider_profile_id: None,
                    model: None,
                    committed_at,
                };
                facts.extend(map_v0_turn_to_presentation_only_facts(evidence));
            }
            _ => {}
        }
    }

    facts
}

/// 构造最小 V0 evidence（测试用）。
pub fn v0_evidence(
    logical_turn_id: &str,
    attempt_id: &str,
    user_text: &str,
    assistant_text: &str,
) -> V0FinalEvidence {
    V0FinalEvidence {
        logical_turn_id: logical_turn_id.to_string(),
        attempt_id: attempt_id.to_string(),
        input_entry_id: format!("{attempt_id}:input"),
        user_text: user_text.to_string(),
        assistant_text: assistant_text.to_string(),
        engine: "claude".to_string(),
        provider_profile_id: Some("profile-1".to_string()),
        model: Some("claude-opus".to_string()),
        committed_at: 1_700_000_000_000,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v0_maps_to_presentation_only_fact() {
        let evidence = v0_evidence("turn-1", "attempt-1", "hi", "hello");
        let fact = map_v0_to_presentation_only(evidence);
        assert_eq!(fact.fact_type(), "conversation.turnCommitted");
    }

    #[test]
    fn snapshot_mirrors_only_final_assistant_turns() {
        let items = vec![
            json!({"id": "u1", "kind": "message", "role": "user", "text": "hi"}),
            json!({"id": "partial", "kind": "message", "role": "assistant", "text": "h"}),
            json!({
                "id": "a1",
                "kind": "message",
                "role": "assistant",
                "text": "hello",
                "isFinal": true,
                "engineSource": "claude",
                "finalCompletedAt": 42
            }),
        ];

        let facts = map_v0_snapshot_to_presentation_only_facts(&items, "codex", 10);

        assert_eq!(facts.len(), 2);
        assert_eq!(facts[0].fact_type(), "conversation.turnRequested");
        assert_eq!(facts[1].fact_type(), "conversation.turnCommitted");
        assert_eq!(facts[0].attempt_id(), Some("v0-shadow:a1"));
    }
}
