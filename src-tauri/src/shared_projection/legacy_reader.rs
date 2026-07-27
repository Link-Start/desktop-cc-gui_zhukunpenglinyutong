//! Legacy V0 snapshot dual-read reader。

use std::path::Path;

use serde_json::Value;

use crate::shared_event_log::{Fidelity, StoreError};

use super::types::{ProjectionItem, ProjectionItemKind};

/// 读取 Legacy V0 snapshot 并映射为 presentation-only 的 ProjectionItem。
///
/// 只读，不改写旧文件；不伪造 Tool ID / Signature / Target。
#[derive(Debug, Default)]
pub struct LegacySharedReader;

impl LegacySharedReader {
    pub fn new() -> Self {
        Self
    }

    /// 从 JSON 文件读取 V0 snapshot。
    pub fn read_snapshot(&self, path: &Path) -> Result<Vec<ProjectionItem>, StoreError> {
        let content = std::fs::read_to_string(path)
            .map_err(|source| StoreError::io("read legacy snapshot", source))?;
        self.parse_snapshot(&content)
    }

    /// 从 JSON 字符串解析 V0 snapshot。
    pub fn parse_snapshot(&self, content: &str) -> Result<Vec<ProjectionItem>, StoreError> {
        let root: Value = serde_json::from_str(content)
            .map_err(|source| StoreError::json("parse legacy snapshot", source))?;

        let mut items = Vec::new();

        // V0 snapshot 常见结构：{ "messages": [...], "turns": [...], ... }
        if let Some(messages) = root.get("messages").and_then(|m| m.as_array()) {
            for (index, msg) in messages.iter().enumerate() {
                if let Some(item) = self.map_message(index, msg) {
                    items.push(item);
                }
            }
        }

        if let Some(turns) = root.get("turns").and_then(|t| t.as_array()) {
            for (index, turn) in turns.iter().enumerate() {
                if let Some(item) = self.map_turn(index, turn) {
                    items.push(item);
                }
            }
        }

        Ok(items)
    }

    fn map_message(&self, index: usize, msg: &Value) -> Option<ProjectionItem> {
        let role = msg.get("role")?.as_str()?;
        let text = msg.get("text")?.as_str()?;
        let kind = match role {
            "user" | "assistant" => ProjectionItemKind::Message,
            _ => return None,
        };

        Some(ProjectionItem {
            id: format!("legacy:message:{index}"),
            kind,
            content: serde_json::json!({
                "role": role,
                "text": text,
                "isFinal": true,
            }),
            fidelity: Fidelity::PresentationOnly,
            checksum: format!("legacy:{index}"),
        })
    }

    fn map_turn(&self, index: usize, turn: &Value) -> Option<ProjectionItem> {
        // 保守映射：只提取已知字段，不猜测 Tool ID / Target。
        let status = turn.get("status").and_then(|s| s.as_str())?;
        let text = turn
            .get("assistantText")
            .and_then(|t| t.as_str())
            .unwrap_or("");

        Some(ProjectionItem {
            id: format!("legacy:turn:{index}"),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({
                "role": "assistant",
                "text": text,
                "status": status,
                "isFinal": true,
            }),
            fidelity: Fidelity::PresentationOnly,
            checksum: format!("legacy:turn:{index}"),
        })
    }
}
