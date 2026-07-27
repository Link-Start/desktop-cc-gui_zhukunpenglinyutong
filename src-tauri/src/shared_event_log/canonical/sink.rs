//! Critical Commit Sink：把 Runtime final snapshot 写入 Canonical Log。
//!
//! 挂接现有 `run.settled` 边界：SQLite transaction ACK 成功前，settlement 不推进。

use super::assembler::{assemble_turn_committed, RuntimeFinalSnapshot};
use super::types::{CanonicalFact, TurnExecutionSnapshot};
use crate::shared_event_log::{AppendOutcome, SharedEventWriter};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Commit Sink 错误。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitSinkError {
    pub context: String,
    pub detail: String,
}

impl CommitSinkError {
    pub fn new(context: impl Into<String>, detail: impl Into<String>) -> Self {
        Self {
            context: context.into(),
            detail: detail.into(),
        }
    }
}

/// 从 attempt_id 推导一个稳定的 `committed_at`，保证同一 attempt 的重复提交产生相同 payload。
///
/// 真实 wall-clock 时间来自 Runtime 边界；这里用 base timestamp + hash 偏移仅用于幂等去重。
fn deterministic_committed_at(attempt_id: &str) -> i64 {
    const BASE_MS: i64 = 1_700_000_000_000;
    const SPREAD_MS: i64 = 365 * 24 * 60 * 60 * 1000; // 1 年内偏移

    let mut hasher = DefaultHasher::new();
    attempt_id.hash(&mut hasher);
    let hash = hasher.finish() as i64;
    BASE_MS + hash.rem_euclid(SPREAD_MS)
}

/// 把一次 settled Run 的 terminal snapshot 提交为 `conversation.turnCommitted`。
pub fn commit_turn(
    writer: &SharedEventWriter,
    session_id: impl Into<String>,
    logical_turn_id: impl Into<String>,
    attempt_id: impl Into<String>,
    input_entry_id: impl Into<String>,
    target: TurnExecutionSnapshot,
    snapshot: RuntimeFinalSnapshot,
) -> Result<AppendOutcome, CommitSinkError> {
    let session_id = session_id.into();
    let logical_turn_id = logical_turn_id.into();
    let attempt_id = attempt_id.into();
    let input_entry_id = input_entry_id.into();
    let committed_at = deterministic_committed_at(&attempt_id);

    let fact = assemble_turn_committed(
        logical_turn_id,
        attempt_id,
        input_entry_id,
        target,
        snapshot,
        committed_at,
    )
    .map_err(|e| CommitSinkError::new("assemble turn committed", e.detail))?;

    writer
        .append_canonical_fact(session_id, CanonicalFact::TurnCommitted(fact))
        .map_err(|e| CommitSinkError::new("append canonical fact", e.to_string()))
}
