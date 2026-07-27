//! Canonical Fact 类型定义。
//!
//! 字段与命名尽量与 Wave 0 JSON Schema（`shared-canonical-entry.schema.json`）保持一致；
//! 未知字段在序列化时保留（通过 `serde_json::Value` 额外属性容器），以支持 round-trip。

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 全部 Shared Canonical Fact 变体。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CanonicalFact {
    #[serde(rename = "conversation.turnRequested")]
    TurnRequested(TurnRequestedFact),
    #[serde(rename = "context.deliveryPrepared")]
    DeliveryPrepared(DeliveryPreparedFact),
    #[serde(rename = "context.deliveryAccepted")]
    DeliveryAccepted(DeliveryAcceptedFact),
    #[serde(rename = "conversation.turnAccepted")]
    TurnAccepted(TurnAcceptedFact),
    #[serde(rename = "conversation.turnCommitted")]
    TurnCommitted(TurnCommittedFact),
    #[serde(rename = "conversation.usageRecorded")]
    UsageRecorded(UsageRecordedFact),
    #[serde(rename = "conversation.controlFact")]
    Control(ControlFact),
}

impl CanonicalFact {
    /// 返回 fact 的 type 字符串（与 Schema `factType` 对应）。
    pub fn fact_type(&self) -> &'static str {
        match self {
            Self::TurnRequested(_) => "conversation.turnRequested",
            Self::DeliveryPrepared(_) => "context.deliveryPrepared",
            Self::DeliveryAccepted(_) => "context.deliveryAccepted",
            Self::TurnAccepted(_) => "conversation.turnAccepted",
            Self::TurnCommitted(_) => "conversation.turnCommitted",
            Self::UsageRecorded(_) => "conversation.usageRecorded",
            Self::Control(_) => "conversation.controlFact",
        }
    }

    /// 返回 attemptId（若该 fact 类型拥有 attempt）。
    pub fn attempt_id(&self) -> Option<&str> {
        match self {
            Self::TurnRequested(f) => Some(&f.attempt_id),
            Self::DeliveryPrepared(f) => Some(&f.attempt_id),
            Self::DeliveryAccepted(f) => Some(&f.attempt_id),
            Self::TurnAccepted(f) => Some(&f.attempt_id),
            Self::TurnCommitted(f) => Some(&f.attempt_id),
            Self::UsageRecorded(f) => Some(&f.attempt_id),
            Self::Control(f) => f.attempt_id.as_deref(),
        }
    }

    /// 返回 dedupe_key（仅 usageRecorded 使用 `usageRecordId`）。
    pub fn dedupe_key(&self) -> Option<&str> {
        match self {
            Self::UsageRecorded(f) => Some(&f.usage_record_id),
            _ => None,
        }
    }

    /// 返回 logicalTurnId（若存在）。
    pub fn logical_turn_id(&self) -> Option<&str> {
        match self {
            Self::TurnRequested(f) => Some(&f.logical_turn_id),
            Self::DeliveryPrepared(f) => Some(&f.logical_turn_id),
            Self::DeliveryAccepted(f) => Some(&f.logical_turn_id),
            Self::TurnAccepted(f) => Some(&f.logical_turn_id),
            Self::TurnCommitted(f) => Some(&f.logical_turn_id),
            Self::UsageRecorded(f) => Some(&f.logical_turn_id),
            Self::Control(f) => f.logical_turn_id.as_deref(),
        }
    }
}

/// `conversation.turnRequested`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnRequestedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_of_attempt_id: Option<String>,
    pub input: CanonicalUserInput,
    pub target: TurnExecutionSnapshot,
    pub requested_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `context.deliveryPrepared`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryPreparedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub binding_key: String,
    pub package_id: String,
    pub source_checksum: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_sequence_exclusive: Option<i64>,
    pub through_sequence_inclusive: i64,
    pub mode: ContextMode,
    pub operation: ContextOperation,
    #[serde(flatten)]
    pub extra: Value,
}

/// `context.deliveryAccepted`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryAcceptedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub binding_key: String,
    pub package_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_request_id: Option<String>,
    pub accepted_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `conversation.turnAccepted`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnAcceptedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub client_turn_id: String,
    pub binding_key: String,
    pub native_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_turn_id: Option<String>,
    pub accepted_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `conversation.turnCommitted`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnCommittedFact {
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub input_entry_id: String,
    pub assistant: CanonicalAssistantBlocks,
    pub atomic_tool_exchanges: Vec<AtomicToolExchange>,
    pub artifact_refs: Vec<ArtifactRef>,
    pub target: TurnExecutionSnapshot,
    pub provider_private_refs: Vec<ProviderPrivateRef>,
    pub omissions: Vec<CanonicalOmission>,
    pub outcome: Outcome,
    pub committed_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `conversation.usageRecorded`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageRecordedFact {
    pub usage_record_id: String,
    pub report_subject_id: String,
    pub revision: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supersedes_usage_record_id: Option<String>,
    pub logical_turn_id: String,
    pub attempt_id: String,
    pub binding_key: String,
    pub native_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_turn_id: Option<String>,
    pub target: TurnExecutionSnapshot,
    pub usage: UsageShape,
    pub source: UsageSource,
    pub verification: UsageVerification,
    pub observed_at: i64,
    #[serde(flatten)]
    pub extra: Value,
}

/// `conversation.controlFact`
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControlFact {
    pub control_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logical_turn_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempt_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub binding_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalUserInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_refs: Option<Vec<ArtifactRef>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachment_refs: Option<Vec<ArtifactRef>>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnExecutionSnapshot {
    pub engine: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<ReasoningSelection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_profile_name_snapshot: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_profile_source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_capability_fingerprint: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReasoningSelection {
    pub effort: String,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct CanonicalAssistantBlocks {
    pub blocks: Vec<CanonicalBlock>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case", tag = "kind")]
pub enum CanonicalBlock {
    Text {
        text: String,
    },
    Reasoning {
        text: String,
    },
    RedactedReasoning {
        #[serde(rename = "artifactRef")]
        #[serde(skip_serializing_if = "Option::is_none")]
        artifact_ref: Option<ArtifactRef>,
    },
    ArtifactRef {
        #[serde(rename = "artifactRef")]
        artifact_ref: ArtifactRef,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AtomicToolExchange {
    pub tool_call_id: String,
    pub tool_name: String,
    pub call: ToolCall,
    pub result: ToolResult,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments_artifact_ref: Option<ArtifactRef>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResult {
    pub status: ToolResultStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_artifact_ref: Option<ArtifactRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ToolResultStatus {
    Completed,
    Error,
    Incomplete,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRef {
    pub artifact_id: String,
    pub media_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    pub sha256: String,
    pub locator: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redaction: Option<Value>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalOmission {
    pub category: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retrievable_ref: Option<String>,
    pub disposition: OmissionDisposition,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OmissionDisposition {
    RetrievableOnDemand,
    NotRetrievable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderPrivateRef {
    pub ref_id: String,
    pub engine: String,
    pub kind: ProviderPrivateRefKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_profile_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_ref: Option<ArtifactRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opaque_ref: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderPrivateRefKind {
    ReasoningSignature,
    EncryptedThinking,
    ProviderRaw,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub status: OutcomeStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_reason: Option<String>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OutcomeStatus {
    Completed,
    Failed,
    Cancelled,
    Replaced,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageShape {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached_input_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_reported_cost: Option<ProviderReportedCost>,
    #[serde(flatten)]
    pub extra: Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderReportedCost {
    pub amount: String,
    pub currency: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UsageSource {
    RuntimeFinal,
    ProviderReport,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UsageVerification {
    Verified,
    Unverified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ContextMode {
    NativeDelta,
    NativeHistoryImport,
    NativeHistoryClone,
    PortableTranscript,
    Checkpoint,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ContextOperation {
    ContextImport,
    PromptPrefix,
}
