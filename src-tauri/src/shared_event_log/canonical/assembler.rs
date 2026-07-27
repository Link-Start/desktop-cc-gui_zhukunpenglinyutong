//! Run/Turn Assembler：从 authoritative final snapshot 装配 `conversation.turnCommitted`。
//!
//! A2.3 / A2.5 实现占位。完整实现需要接入 Runtime final snapshot 格式；
//! 本 change 先提供类型与最小装配函数，供测试与 Sink 调用。

use super::types::{
    AtomicToolExchange, CanonicalAssistantBlocks, CanonicalBlock, Outcome, OutcomeStatus, ToolCall,
    ToolResult, ToolResultStatus, TurnCommittedFact, TurnExecutionSnapshot,
};

/// 待装配的 authoritative final snapshot（简化版，后续随 Runtime 集成扩展）。
#[derive(Debug, Clone)]
pub struct RuntimeFinalSnapshot {
    pub assistant_text: Option<String>,
    pub tool_calls: Vec<RuntimeToolCall>,
    pub tool_results: Vec<RuntimeToolResult>,
    pub artifacts: Vec<super::types::ArtifactRef>,
    pub outcome: OutcomeStatus,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub stop_reason: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RuntimeToolCall {
    pub tool_call_id: String,
    pub tool_name: String,
    pub arguments_summary: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RuntimeToolResult {
    pub tool_call_id: String,
    pub status: ToolResultStatus,
    pub output_summary: Option<String>,
    pub error_message: Option<String>,
}

/// 装配错误。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssemblyError {
    pub context: String,
    pub detail: String,
}

/// 从 Runtime final snapshot 装配 `conversation.turnCommitted`。
pub fn assemble_turn_committed(
    logical_turn_id: String,
    attempt_id: String,
    input_entry_id: String,
    target: TurnExecutionSnapshot,
    snapshot: RuntimeFinalSnapshot,
    committed_at: i64,
) -> Result<TurnCommittedFact, AssemblyError> {
    let mut assistant_blocks = Vec::new();
    if let Some(text) = snapshot.assistant_text {
        if !text.is_empty() {
            assistant_blocks.push(CanonicalBlock::Text { text });
        }
    }

    let exchanges = pair_tool_exchanges(snapshot.tool_calls, snapshot.tool_results);

    let outcome = Outcome {
        status: snapshot.outcome,
        error_code: snapshot.error_code,
        error_message: snapshot.error_message,
        stop_reason: snapshot.stop_reason,
        extra: serde_json::Value::Object(Default::default()),
    };

    Ok(TurnCommittedFact {
        logical_turn_id,
        attempt_id,
        input_entry_id,
        assistant: CanonicalAssistantBlocks {
            blocks: assistant_blocks,
            extra: serde_json::Value::Object(Default::default()),
        },
        atomic_tool_exchanges: exchanges,
        artifact_refs: snapshot.artifacts,
        target,
        provider_private_refs: vec![],
        omissions: vec![],
        outcome,
        committed_at,
        extra: serde_json::Value::Object(Default::default()),
    })
}

fn pair_tool_exchanges(
    calls: Vec<RuntimeToolCall>,
    results: Vec<RuntimeToolResult>,
) -> Vec<AtomicToolExchange> {
    let mut exchanges = Vec::new();
    let mut results_by_id: std::collections::HashMap<String, RuntimeToolResult> = results
        .into_iter()
        .map(|r| (r.tool_call_id.clone(), r))
        .collect();

    for call in calls {
        let result = results_by_id.remove(&call.tool_call_id);
        let tool_result = match result {
            Some(r) => ToolResult {
                status: r.status,
                output_summary: r.output_summary,
                output_artifact_ref: None,
                error_message: r.error_message,
                extra: serde_json::Value::Object(Default::default()),
            },
            None => ToolResult {
                status: ToolResultStatus::Incomplete,
                output_summary: None,
                output_artifact_ref: None,
                error_message: Some("tool result missing at terminal".to_string()),
                extra: serde_json::Value::Object(Default::default()),
            },
        };
        exchanges.push(AtomicToolExchange {
            tool_call_id: call.tool_call_id,
            tool_name: call.tool_name,
            call: ToolCall {
                arguments_summary: call.arguments_summary,
                arguments_artifact_ref: None,
                extra: serde_json::Value::Object(Default::default()),
            },
            result: tool_result,
            extra: serde_json::Value::Object(Default::default()),
        });
    }

    // 未配对 result 丢弃（不伪造成功 exchange）。
    let _ = results_by_id;
    exchanges
}

#[cfg(test)]
mod tests {
    use super::super::types::{TurnExecutionSnapshot, UsageShape};
    use super::*;

    fn snapshot() -> TurnExecutionSnapshot {
        TurnExecutionSnapshot {
            engine: "claude".to_string(),
            provider_profile_id: Some("profile-1".to_string()),
            model: Some("claude-opus".to_string()),
            reasoning: None,
            provider_profile_name_snapshot: None,
            provider_profile_source: None,
            runtime_capability_fingerprint: None,
            extra: serde_json::Value::Object(Default::default()),
        }
    }

    #[test]
    fn assemble_complete_text_turn() {
        let final_snapshot = RuntimeFinalSnapshot {
            assistant_text: Some("hello back".to_string()),
            tool_calls: vec![],
            tool_results: vec![],
            artifacts: vec![],
            outcome: OutcomeStatus::Completed,
            error_code: None,
            error_message: None,
            stop_reason: None,
        };

        let fact = assemble_turn_committed(
            "turn-1".to_string(),
            "attempt-1".to_string(),
            "entry-1".to_string(),
            snapshot(),
            final_snapshot,
            1_700_000_000_000,
        )
        .expect("assemble");

        assert_eq!(fact.atomic_tool_exchanges.len(), 0);
        assert!(matches!(fact.outcome.status, OutcomeStatus::Completed));
    }

    #[test]
    fn unpaired_tool_call_is_incomplete() {
        let final_snapshot = RuntimeFinalSnapshot {
            assistant_text: None,
            tool_calls: vec![RuntimeToolCall {
                tool_call_id: "call-1".to_string(),
                tool_name: "read_file".to_string(),
                arguments_summary: Some("{path: \"x\"}".to_string()),
            }],
            tool_results: vec![],
            artifacts: vec![],
            outcome: OutcomeStatus::Completed,
            error_code: None,
            error_message: None,
            stop_reason: None,
        };

        let fact = assemble_turn_committed(
            "turn-1".to_string(),
            "attempt-1".to_string(),
            "entry-1".to_string(),
            snapshot(),
            final_snapshot,
            1_700_000_000_000,
        )
        .expect("assemble");

        assert_eq!(fact.atomic_tool_exchanges.len(), 1);
        assert!(matches!(
            fact.atomic_tool_exchanges[0].result.status,
            ToolResultStatus::Incomplete
        ));
    }

    #[test]
    fn unpaired_tool_result_is_dropped() {
        let final_snapshot = RuntimeFinalSnapshot {
            assistant_text: None,
            tool_calls: vec![],
            tool_results: vec![RuntimeToolResult {
                tool_call_id: "call-ghost".to_string(),
                status: ToolResultStatus::Completed,
                output_summary: Some("orphan".to_string()),
                error_message: None,
            }],
            artifacts: vec![],
            outcome: OutcomeStatus::Completed,
            error_code: None,
            error_message: None,
            stop_reason: None,
        };

        let fact = assemble_turn_committed(
            "turn-1".to_string(),
            "attempt-1".to_string(),
            "entry-1".to_string(),
            snapshot(),
            final_snapshot,
            1_700_000_000_000,
        )
        .expect("assemble");

        assert!(fact.atomic_tool_exchanges.is_empty());
    }
}
