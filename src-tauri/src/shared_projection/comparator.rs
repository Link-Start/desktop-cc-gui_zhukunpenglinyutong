//! Shadow Projection vs Legacy dual-read 对比器。

use serde::{Deserialize, Serialize};

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

    /// 按 item id 对比 shadow 与 legacy 投影。
    pub fn compare(
        &self,
        shadow: &[ProjectionItem],
        legacy: &[ProjectionItem],
    ) -> MismatchReport {
        let mut mismatches = Vec::new();
        let mut matched = 0;

        let shadow_by_id: std::collections::HashMap<_, _> =
            shadow.iter().map(|i| (i.id.as_str(), i)).collect();
        let legacy_by_id: std::collections::HashMap<_, _> =
            legacy.iter().map(|i| (i.id.as_str(), i)).collect();

        for item in shadow {
            match legacy_by_id.get(item.id.as_str()) {
                Some(legacy_item) => {
                    if item.content == legacy_item.content {
                        matched += 1;
                    } else {
                        mismatches.push(MismatchRecord {
                            kind: MismatchKind::ContentMismatch,
                            item_id: item.id.clone(),
                            detail: "content differs".to_string(),
                        });
                    }
                }
                None => {
                    mismatches.push(MismatchRecord {
                        kind: MismatchKind::ShadowOnly,
                        item_id: item.id.clone(),
                        detail: "present only in shadow".to_string(),
                    });
                }
            }
        }

        for item in legacy {
            if !shadow_by_id.contains_key(item.id.as_str()) {
                mismatches.push(MismatchRecord {
                    kind: MismatchKind::LegacyOnly,
                    item_id: item.id.clone(),
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
