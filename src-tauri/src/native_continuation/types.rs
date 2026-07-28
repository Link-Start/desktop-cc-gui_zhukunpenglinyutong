use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::native_history::NativeHistorySource;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRef {
    pub artifact_id: String,
    pub checksum: String,
    pub media_type: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeHistoryMaterialization {
    pub operation_id: String,
    pub source: NativeHistorySource,
    pub reader_id: String,
    pub source_fingerprint: String,
    pub through_cursor: String,
    pub normalized_entries: ArtifactRef,
    pub context_package_id: String,
    pub context_package: ArtifactRef,
    pub destination: Value,
    pub prepared_at: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderContinuationOrigin {
    pub kind: String,
    pub source_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_provider_profile_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationFamilyRef {
    pub family_id: String,
    pub family_root_session_id: String,
    pub lineage_parent_session_id: String,
    pub lineage_kind: String,
    pub lineage_depth: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeProviderContinuationOperation {
    pub materialization: NativeHistoryMaterialization,
    pub request_checksum: String,
    pub phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    pub updated_at: i64,
}
