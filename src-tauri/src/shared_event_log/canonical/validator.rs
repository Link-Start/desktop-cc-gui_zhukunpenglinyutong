//! Canonical Fact 字段级校验。
//!
//! 规则来源：Wave 0 `shared-canonical-entry.schema.json` 的必填字段、枚举值与互斥条件。
//! 非法 payload 返回 typed `FactValidationError`，不进入 SQLite。

use std::fmt;

use super::types::{
    ArtifactRef, AtomicToolExchange, CanonicalAssistantBlocks, CanonicalBlock, CanonicalFact,
    CanonicalOmission, CanonicalUserInput, ControlFact, DeliveryAcceptedFact, DeliveryPreparedFact,
    Outcome, OutcomeStatus, ProviderPrivateRef, ToolResult, TurnAcceptedFact, TurnCommittedFact,
    TurnExecutionSnapshot, TurnRequestedFact, UsageRecordedFact,
};

/// 校验错误。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FactValidationError {
    pub context: String,
    pub detail: String,
}

impl FactValidationError {
    pub fn new(context: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            context: context.into(),
            detail: detail.into(),
        }
    }
}

impl fmt::Display for FactValidationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.context, self.detail)
    }
}

impl std::error::Error for FactValidationError {}

/// 校验任意 canonical fact。
pub fn validate_fact(fact: &CanonicalFact) -> Result<(), FactValidationError> {
    match fact {
        CanonicalFact::TurnRequested(f) => validate_turn_requested(f),
        CanonicalFact::DeliveryPrepared(f) => validate_delivery_prepared(f),
        CanonicalFact::DeliveryAccepted(f) => validate_delivery_accepted(f),
        CanonicalFact::TurnAccepted(f) => validate_turn_accepted(f),
        CanonicalFact::TurnCommitted(f) => validate_turn_committed(f),
        CanonicalFact::UsageRecorded(f) => validate_usage_recorded(f),
        CanonicalFact::Control(f) => validate_control(f),
    }
}

fn require_non_empty(value: &str, name: &str, context: &str) -> Result<(), FactValidationError> {
    if value.is_empty() {
        return Err(FactValidationError::new(
            context,
            format!("{name} must be non-empty"),
        ));
    }
    Ok(())
}

fn validate_turn_requested(f: &TurnRequestedFact) -> Result<(), FactValidationError> {
    let ctx = "conversation.turnRequested";
    require_non_empty(&f.logical_turn_id, "logicalTurnId", ctx)?;
    require_non_empty(&f.attempt_id, "attemptId", ctx)?;
    validate_user_input(&f.input, ctx)?;
    validate_turn_execution_snapshot(&f.target, ctx)?;
    validate_timestamp(f.requested_at, "requestedAt", ctx)?;
    Ok(())
}

fn validate_delivery_prepared(f: &DeliveryPreparedFact) -> Result<(), FactValidationError> {
    let ctx = "context.deliveryPrepared";
    require_non_empty(&f.logical_turn_id, "logicalTurnId", ctx)?;
    require_non_empty(&f.attempt_id, "attemptId", ctx)?;
    require_non_empty(&f.binding_key, "bindingKey", ctx)?;
    require_non_empty(&f.package_id, "packageId", ctx)?;
    require_non_empty(&f.source_checksum, "sourceChecksum", ctx)?;
    validate_timestamp(f.through_sequence_inclusive, "throughSequenceInclusive", ctx)?;
    Ok(())
}

fn validate_delivery_accepted(f: &DeliveryAcceptedFact) -> Result<(), FactValidationError> {
    let ctx = "context.deliveryAccepted";
    require_non_empty(&f.logical_turn_id, "logicalTurnId", ctx)?;
    require_non_empty(&f.attempt_id, "attemptId", ctx)?;
    require_non_empty(&f.binding_key, "bindingKey", ctx)?;
    require_non_empty(&f.package_id, "packageId", ctx)?;
    validate_timestamp(f.accepted_at, "acceptedAt", ctx)?;
    Ok(())
}

fn validate_turn_accepted(f: &TurnAcceptedFact) -> Result<(), FactValidationError> {
    let ctx = "conversation.turnAccepted";
    require_non_empty(&f.logical_turn_id, "logicalTurnId", ctx)?;
    require_non_empty(&f.attempt_id, "attemptId", ctx)?;
    require_non_empty(&f.client_turn_id, "clientTurnId", ctx)?;
    require_non_empty(&f.binding_key, "bindingKey", ctx)?;
    require_non_empty(&f.native_session_id, "nativeSessionId", ctx)?;
    validate_timestamp(f.accepted_at, "acceptedAt", ctx)?;
    Ok(())
}

fn validate_turn_committed(f: &TurnCommittedFact) -> Result<(), FactValidationError> {
    let ctx = "conversation.turnCommitted";
    require_non_empty(&f.logical_turn_id, "logicalTurnId", ctx)?;
    require_non_empty(&f.attempt_id, "attemptId", ctx)?;
    require_non_empty(&f.input_entry_id, "inputEntryId", ctx)?;
    validate_assistant_blocks(&f.assistant, ctx)?;
    validate_outcome(&f.outcome, ctx)?;
    validate_turn_execution_snapshot(&f.target, ctx)?;
    validate_timestamp(f.committed_at, "committedAt", ctx)?;
    for (index, exchange) in f.atomic_tool_exchanges.iter().enumerate() {
        validate_atomic_tool_exchange(exchange, &format!("{ctx}.atomicToolExchanges[{index}]"))?;
    }
    for (index, omission) in f.omissions.iter().enumerate() {
        validate_omission(omission, &format!("{ctx}.omissions[{index}]"))?;
    }
    for (index, pref) in f.provider_private_refs.iter().enumerate() {
        validate_provider_private_ref(pref, &format!("{ctx}.providerPrivateRefs[{index}]"))?;
    }
    Ok(())
}

fn validate_usage_recorded(f: &UsageRecordedFact) -> Result<(), FactValidationError> {
    let ctx = "conversation.usageRecorded";
    require_non_empty(&f.usage_record_id, "usageRecordId", ctx)?;
    require_non_empty(&f.report_subject_id, "reportSubjectId", ctx)?;
    require_non_empty(&f.logical_turn_id, "logicalTurnId", ctx)?;
    require_non_empty(&f.attempt_id, "attemptId", ctx)?;
    require_non_empty(&f.binding_key, "bindingKey", ctx)?;
    require_non_empty(&f.native_session_id, "nativeSessionId", ctx)?;
    validate_turn_execution_snapshot(&f.target, ctx)?;
    validate_timestamp(f.observed_at, "observedAt", ctx)?;
    if f.revision < 1 {
        return Err(FactValidationError::new(ctx, "revision must be >= 1"));
    }
    Ok(())
}

fn validate_control(f: &ControlFact) -> Result<(), FactValidationError> {
    let ctx = "conversation.controlFact";
    require_non_empty(&f.action, "action", ctx)?;
    validate_timestamp(f.issued_at, "issuedAt", ctx)?;
    Ok(())
}

fn validate_user_input(input: &CanonicalUserInput, ctx: &str) -> Result<(), FactValidationError> {
    let has_text = input.text.is_some();
    let has_images = input.image_refs.as_ref().map_or(false, |v| !v.is_empty());
    let has_attachments = input.attachment_refs.as_ref().map_or(false, |v| !v.is_empty());
    if !has_text && !has_images && !has_attachments {
        return Err(FactValidationError::new(
            ctx,
            "input must contain at least one of text/imageRefs/attachmentRefs",
        ));
    }
    if let Some(refs) = &input.image_refs {
        for (index, artifact) in refs.iter().enumerate() {
            validate_artifact_ref(artifact, &format!("{ctx}.input.imageRefs[{index}]"))?;
        }
    }
    if let Some(refs) = &input.attachment_refs {
        for (index, artifact) in refs.iter().enumerate() {
            validate_artifact_ref(artifact, &format!("{ctx}.input.attachmentRefs[{index}]"))?;
        }
    }
    Ok(())
}

fn validate_turn_execution_snapshot(
    snapshot: &TurnExecutionSnapshot,
    ctx: &str,
) -> Result<(), FactValidationError> {
    require_non_empty(&snapshot.engine, "engine", ctx)?;
    Ok(())
}

fn validate_assistant_blocks(
    blocks: &CanonicalAssistantBlocks,
    ctx: &str,
) -> Result<(), FactValidationError> {
    for (index, block) in blocks.blocks.iter().enumerate() {
        validate_block(block, &format!("{ctx}.assistant.blocks[{index}]"))?;
    }
    Ok(())
}

fn validate_block(block: &CanonicalBlock, ctx: &str) -> Result<(), FactValidationError> {
    match block {
        CanonicalBlock::Text { text } => {
            // text 允许为空字符串（如占位），不强制非空。
            let _ = text;
        }
        CanonicalBlock::Reasoning { text } => {
            let _ = text;
        }
        CanonicalBlock::RedactedReasoning => {}
        CanonicalBlock::ArtifactRef { artifact_ref } => {
            validate_artifact_ref(artifact_ref, ctx)?;
        }
    }
    Ok(())
}

fn validate_atomic_tool_exchange(
    exchange: &AtomicToolExchange,
    ctx: &str,
) -> Result<(), FactValidationError> {
    require_non_empty(&exchange.tool_call_id, "toolCallId", ctx)?;
    require_non_empty(&exchange.tool_name, "toolName", ctx)?;
    validate_tool_result(&exchange.result, &format!("{ctx}.result"))?;
    Ok(())
}

fn validate_tool_result(result: &ToolResult, ctx: &str) -> Result<(), FactValidationError> {
    if matches!(result.status, super::types::ToolResultStatus::Error) {
        if result.error_message.as_ref().map_or(true, |s| s.is_empty()) {
            return Err(FactValidationError::new(
                ctx,
                "error result must include errorMessage",
            ));
        }
    }
    Ok(())
}

fn validate_omission(omission: &CanonicalOmission, ctx: &str) -> Result<(), FactValidationError> {
    require_non_empty(&omission.category, "category", ctx)?;
    Ok(())
}

fn validate_provider_private_ref(
    pref: &ProviderPrivateRef,
    ctx: &str,
) -> Result<(), FactValidationError> {
    require_non_empty(&pref.ref_id, "refId", ctx)?;
    require_non_empty(&pref.engine, "engine", ctx)?;
    Ok(())
}

fn validate_outcome(outcome: &Outcome, ctx: &str) -> Result<(), FactValidationError> {
    if matches!(outcome.status, OutcomeStatus::Failed) {
        if outcome.error_code.as_ref().map_or(true, |s| s.is_empty()) {
            return Err(FactValidationError::new(
                ctx,
                "failed outcome must include errorCode",
            ));
        }
    }
    Ok(())
}

fn validate_artifact_ref(artifact: &ArtifactRef, ctx: &str) -> Result<(), FactValidationError> {
    require_non_empty(&artifact.artifact_id, "artifactId", ctx)?;
    require_non_empty(&artifact.media_type, "mediaType", ctx)?;
    require_non_empty(&artifact.sha256, "sha256", ctx)?;
    require_non_empty(&artifact.locator, "locator", ctx)?;
    Ok(())
}

fn validate_timestamp(value: i64, name: &str, ctx: &str) -> Result<(), FactValidationError> {
    if value < 0 {
        return Err(FactValidationError::new(
            ctx,
            format!("{name} must be non-negative"),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::types::{
        CanonicalBlock, CanonicalUserInput, Outcome, OutcomeStatus, TurnExecutionSnapshot,
        TurnRequestedFact, UsageRecordedFact, UsageShape,
    };
    use super::*;

    fn valid_snapshot() -> TurnExecutionSnapshot {
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

    fn valid_turn_requested() -> TurnRequestedFact {
        TurnRequestedFact {
            logical_turn_id: "turn-1".to_string(),
            attempt_id: "attempt-1".to_string(),
            retry_of_attempt_id: None,
            input: CanonicalUserInput {
                text: Some("hello".to_string()),
                image_refs: None,
                attachment_refs: None,
                extra: serde_json::Value::Object(Default::default()),
            },
            target: valid_snapshot(),
            requested_at: 1_700_000_000_000,
            extra: serde_json::Value::Object(Default::default()),
        }
    }

    #[test]
    fn valid_turn_requested_passes() {
        let fact = CanonicalFact::TurnRequested(valid_turn_requested());
        assert!(validate_fact(&fact).is_ok());
    }

    #[test]
    fn missing_logical_turn_id_rejected() {
        let mut f = valid_turn_requested();
        f.logical_turn_id = String::new();
        let fact = CanonicalFact::TurnRequested(f);
        let err = validate_fact(&fact).expect_err("must reject empty logicalTurnId");
        assert!(err.context.contains("conversation.turnRequested"));
    }

    #[test]
    fn empty_input_rejected() {
        let mut f = valid_turn_requested();
        f.input.text = None;
        let fact = CanonicalFact::TurnRequested(f);
        let err = validate_fact(&fact).expect_err("must reject empty input");
        assert!(err.detail.contains("input must contain"));
    }

    #[test]
    fn failed_outcome_requires_error_code() {
        let mut f = TurnCommittedFact {
            logical_turn_id: "turn-1".to_string(),
            attempt_id: "attempt-1".to_string(),
            input_entry_id: "entry-1".to_string(),
            assistant: CanonicalAssistantBlocks {
                blocks: vec![CanonicalBlock::Text {
                    text: "sorry".to_string(),
                }],
                extra: serde_json::Value::Object(Default::default()),
            },
            atomic_tool_exchanges: vec![],
            artifact_refs: vec![],
            target: valid_snapshot(),
            provider_private_refs: vec![],
            omissions: vec![],
            outcome: Outcome {
                status: OutcomeStatus::Failed,
                error_code: None,
                error_message: None,
                stop_reason: None,
                extra: serde_json::Value::Object(Default::default()),
            },
            committed_at: 1_700_000_000_000,
            extra: serde_json::Value::Object(Default::default()),
        };
        let fact = CanonicalFact::TurnCommitted(f);
        let err = validate_fact(&fact).expect_err("must require errorCode on failed");
        assert!(err.detail.contains("errorCode"));
    }

    #[test]
    fn usage_revision_must_be_positive() {
        let f = UsageRecordedFact {
            usage_record_id: "usage-1".to_string(),
            report_subject_id: "subject-1".to_string(),
            revision: 0,
            supersedes_usage_record_id: None,
            logical_turn_id: "turn-1".to_string(),
            attempt_id: "attempt-1".to_string(),
            binding_key: "binding-1".to_string(),
            native_session_id: "native-1".to_string(),
            native_turn_id: None,
            target: valid_snapshot(),
            usage: UsageShape {
                input_tokens: Some(10),
                cached_input_tokens: None,
                output_tokens: Some(5),
                total_tokens: Some(15),
                provider_reported_cost: None,
                extra: serde_json::Value::Object(Default::default()),
            },
            source: super::super::types::UsageSource::RuntimeFinal,
            verification: super::super::types::UsageVerification::Verified,
            observed_at: 1_700_000_000_000,
            extra: serde_json::Value::Object(Default::default()),
        };
        let fact = CanonicalFact::UsageRecorded(f);
        let err = validate_fact(&fact).expect_err("must reject revision 0");
        assert!(err.detail.contains("revision"));
    }
}
