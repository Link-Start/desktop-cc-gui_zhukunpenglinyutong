//! Projection 类型定义。

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::shared_event_log::Fidelity;

/// 单个投影项，与前端 `ConversationItem` 结构对齐。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionItem {
    pub id: String,
    pub kind: ProjectionItemKind,
    pub content: Value,
    pub fidelity: Fidelity,
    pub checksum: String,
}

/// 投影项类型，覆盖 `ConversationItem` 的主要 kind。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProjectionItemKind {
    Message,
    Reasoning,
    Tool,
    Diff,
    Review,
    Explore,
    GeneratedImage,
    SystemNotice,
    Metadata,
}
