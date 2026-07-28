use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;

use crate::shared_context::ProjectionOmission;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NativeHistoryEngine {
    Claude,
    Codex,
    Kimi,
}

impl NativeHistoryEngine {
    pub fn reader_id(self) -> &'static str {
        match self {
            Self::Claude => "claude-session-jsonl/v1",
            Self::Codex => "codex-rollout-jsonl/v1",
            Self::Kimi => "kimi-wire-jsonl/v1",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeHistorySource {
    pub session_id: String,
    pub native_session_id: String,
    pub engine: NativeHistoryEngine,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_profile_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NativeHistoryFidelity {
    Native,
    Semantic,
    Lossy,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextSourceEntry {
    pub source_entry_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub occurred_at: Option<i64>,
    pub role: String,
    pub blocks: Vec<Value>,
    pub provenance: Value,
    pub fidelity: NativeHistoryFidelity,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeHistoryCapability {
    pub readable: bool,
    pub stable_cursor: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_through_cursor: Option<String>,
    pub supported_entry_types: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsupported_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeHistoryReadResult {
    pub reader_id: String,
    pub source_fingerprint: String,
    pub through_cursor: String,
    pub entries: Vec<ContextSourceEntry>,
    pub fidelity: NativeHistoryFidelity,
    pub omissions: Vec<ProjectionOmission>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NativeHistoryErrorCode {
    UnsupportedStableCursor,
    SourceNotFound,
    PermissionDenied,
    SourceCorrupt,
    SourceDrifted,
    InvalidRequest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeHistoryError {
    pub code: NativeHistoryErrorCode,
    pub message: String,
}

impl NativeHistoryError {
    pub fn new(code: NativeHistoryErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl fmt::Display for NativeHistoryError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{:?}: {}", self.code, self.message)
    }
}

impl std::error::Error for NativeHistoryError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn source_contract_uses_stable_camel_case_fields() {
        let value = serde_json::to_value(NativeHistorySource {
            session_id: "claude:session-a".to_string(),
            native_session_id: "session-a".to_string(),
            engine: NativeHistoryEngine::Claude,
            provider_profile_id: Some("provider-a".to_string()),
        })
        .expect("serialize");

        assert_eq!(value["sessionId"], "claude:session-a");
        assert_eq!(value["nativeSessionId"], "session-a");
        assert_eq!(value["engine"], "claude");
        assert_eq!(value["providerProfileId"], "provider-a");
    }
}
