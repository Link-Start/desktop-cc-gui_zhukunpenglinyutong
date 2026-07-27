//! V0 final-evidence → presentation-only canonical fact 映射。
//!
//! 不回写产品状态，仅作为 A2 验证对比的 Shadow Canonical Log。

use super::types::{
    CanonicalAssistantBlocks, CanonicalBlock, CanonicalFact, Outcome, OutcomeStatus,
    TurnCommittedFact, TurnExecutionSnapshot,
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

/// 把 V0 evidence 映射为 `fidelity = "presentation-only"` 的 `conversation.turnCommitted`。
pub fn map_v0_to_presentation_only(evidence: V0FinalEvidence) -> CanonicalFact {
    let target = TurnExecutionSnapshot {
        engine: evidence.engine,
        provider_profile_id: evidence.provider_profile_id,
        model: evidence.model,
        reasoning: None,
        provider_profile_name_snapshot: None,
        provider_profile_source: None,
        runtime_capability_fingerprint: None,
        extra: serde_json::Value::Object(Default::default()),
    };

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
            extra: serde_json::Value::Object(Default::default()),
        },
        committed_at: evidence.committed_at,
        extra: serde_json::Value::Object(Default::default()),
    })
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
}
