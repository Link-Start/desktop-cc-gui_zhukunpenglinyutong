//! Shadow Projection vs Legacy dual-read 对比器。

use std::collections::{BTreeMap, HashMap};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::types::ProjectionItem;

/// 对比结果分类。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MismatchKind {
    ShadowOnly,
    LegacyOnly,
    ContentMismatch,
}

/// 单个 mismatch 记录。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MismatchRecord {
    pub kind: MismatchKind,
    pub item_id: String,
    pub detail: String,
}

/// 完整对比报告。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MismatchReport {
    pub total_shadow: usize,
    pub total_legacy: usize,
    pub matched: usize,
    pub mismatches: Vec<MismatchRecord>,
}

/// Shadow 对比器：只读，不反向写。
#[derive(Debug, Default)]
pub struct ShadowComparator;

impl ShadowComparator {
    pub fn new() -> Self {
        Self
    }

    /// 按 item 类型/角色/出现次序对比，避免依赖两侧不同的内部 item id。
    pub fn compare(&self, shadow: &[ProjectionItem], legacy: &[ProjectionItem]) -> MismatchReport {
        let mut mismatches = Vec::new();
        let mut matched = 0;

        let shadow_by_key = correlate(shadow);
        let legacy_by_key = correlate(legacy);

        for (key, item) in &shadow_by_key {
            match legacy_by_key.get(key) {
                Some(legacy_item) => {
                    if comparable_content(item) == comparable_content(legacy_item) {
                        matched += 1;
                    } else {
                        mismatches.push(MismatchRecord {
                            kind: MismatchKind::ContentMismatch,
                            item_id: key.clone(),
                            detail: "content differs".to_string(),
                        });
                    }
                }
                None => {
                    mismatches.push(MismatchRecord {
                        kind: MismatchKind::ShadowOnly,
                        item_id: key.clone(),
                        detail: "present only in shadow".to_string(),
                    });
                }
            }
        }

        for (key, _item) in &legacy_by_key {
            if !shadow_by_key.contains_key(key) {
                mismatches.push(MismatchRecord {
                    kind: MismatchKind::LegacyOnly,
                    item_id: key.clone(),
                    detail: "present only in legacy".to_string(),
                });
            }
        }

        MismatchReport {
            total_shadow: shadow.len(),
            total_legacy: legacy.len(),
            matched,
            mismatches,
        }
    }
}

fn correlate(items: &[ProjectionItem]) -> BTreeMap<String, &ProjectionItem> {
    // ponytail: V0 没有稳定 canonical ID，先按 kind/role/ordinal 配对；
    // materialization 提供 stable correlation key 后应优先替换。
    let mut occurrence_by_base: HashMap<String, usize> = HashMap::new();
    let mut correlated = BTreeMap::new();
    for item in items {
        let role = item
            .content
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or("");
        let base = format!("{:?}:{role}", item.kind);
        let occurrence = occurrence_by_base.entry(base.clone()).or_default();
        correlated.insert(format!("{base}:{}", *occurrence), item);
        *occurrence += 1;
    }
    correlated
}

fn comparable_content(item: &ProjectionItem) -> Value {
    match item.kind {
        super::types::ProjectionItemKind::Message => json!({
            "role": item.content.get("role"),
            "text": item.content.get("text"),
        }),
        super::types::ProjectionItemKind::Reasoning => json!({
            "summary": item.content.get("summary"),
            "content": item.content.get("content"),
        }),
        super::types::ProjectionItemKind::Tool => json!({
            "toolType": item.content.get("toolType"),
            "title": item.content.get("title"),
            "status": item.content.get("status"),
            "output": item.content.get("output"),
        }),
        _ => item.content.clone(),
    }
}
