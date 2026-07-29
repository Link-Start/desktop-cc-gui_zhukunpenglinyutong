//! Legacy V0 snapshot dual-read reader。

use std::path::Path;

use serde_json::Value;

use crate::shared_event_log::{payload_checksum, Fidelity, StoreError};

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

    /// 从 V0 `log.jsonl` 解析最后一个 snapshot。
    pub fn parse_snapshot(&self, content: &str) -> Result<Vec<ProjectionItem>, StoreError> {
        let mut latest_snapshot = None;
        for (line_index, line) in content.lines().enumerate() {
            if line.trim().is_empty() {
                continue;
            }
            let entry: Value = serde_json::from_str(line).map_err(|source| {
                StoreError::json(
                    format!("parse legacy snapshot line {}", line_index + 1),
                    source,
                )
            })?;
            if entry.get("kind").and_then(Value::as_str) == Some("snapshot")
                && entry.get("items").and_then(Value::as_array).is_some()
            {
                latest_snapshot = Some(entry);
            }
        }

        let snapshot = latest_snapshot.ok_or_else(|| {
            StoreError::validation_failed(
                "legacy shared snapshot",
                "no valid snapshot entry with items found",
            )
        })?;
        let snapshot_created_at = snapshot
            .get("createdAt")
            .and_then(Value::as_u64)
            .unwrap_or_default();
        let source_items = snapshot
            .get("items")
            .and_then(Value::as_array)
            .expect("validated snapshot items");

        Ok(source_items
            .iter()
            .enumerate()
            .map(|(index, item)| self.map_item(snapshot_created_at, index, item))
            .collect())
    }

    fn map_item(&self, snapshot_created_at: u64, index: usize, item: &Value) -> ProjectionItem {
        let kind = match item.get("kind").and_then(Value::as_str) {
            Some("message") => ProjectionItemKind::Message,
            Some("reasoning") => ProjectionItemKind::Reasoning,
            Some("tool") => ProjectionItemKind::Tool,
            Some("diff") => ProjectionItemKind::Diff,
            Some("review") => ProjectionItemKind::Review,
            Some("explore") => ProjectionItemKind::Explore,
            Some("generatedImage") => ProjectionItemKind::GeneratedImage,
            _ => ProjectionItemKind::Metadata,
        };
        let id = item
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("legacy:{snapshot_created_at}:{index}"));
        let mut content = item.clone();
        if let Some(object) = content.as_object_mut() {
            object.remove("id");
            object.remove("kind");
        }
        let checksum = payload_checksum(2, "legacy.snapshot.item", item)
            .unwrap_or_else(|_| format!("legacy:{snapshot_created_at}:{index}"));

        ProjectionItem {
            id,
            kind,
            content,
            fidelity: Fidelity::PresentationOnly,
            checksum,
        }
    }
}
