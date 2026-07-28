//! Critical Commit Sink：把 Runtime final snapshot 写入 Canonical Log。
//!
//! Phase 1 用 synthetic fixtures 验证 transaction ACK/幂等 contract；
//! Change B 再把本 Sink 挂到真实 `run.settled` 边界。

use super::assembler::{assemble_turn_committed, RuntimeFinalSnapshot};
use super::types::{CanonicalFact, TurnExecutionSnapshot};
use crate::shared_event_log::{AppendOutcome, BindingStateUpdate, SharedEventWriter};

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

/// 把一次 settled Run 的 terminal snapshot 提交为 `conversation.turnCommitted`。
pub fn commit_turn(
    writer: &SharedEventWriter,
    session_id: impl Into<String>,
    logical_turn_id: impl Into<String>,
    attempt_id: impl Into<String>,
    input_entry_id: impl Into<String>,
    target: TurnExecutionSnapshot,
    snapshot: RuntimeFinalSnapshot,
    committed_at: i64,
) -> Result<AppendOutcome, CommitSinkError> {
    let session_id = session_id.into();
    let logical_turn_id = logical_turn_id.into();
    let attempt_id = attempt_id.into();
    let input_entry_id = input_entry_id.into();
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
        .append_canonical_fact_at(session_id, CanonicalFact::TurnCommitted(fact), committed_at)
        .map_err(|e| CommitSinkError::new("append canonical fact", e.to_string()))
}

/// 把 terminal fact 与 Binding committed cursor/pending 作为一个 SQLite transaction 提交。
#[allow(clippy::too_many_arguments)]
pub fn commit_turn_with_binding(
    writer: &SharedEventWriter,
    session_id: impl Into<String>,
    logical_turn_id: impl Into<String>,
    attempt_id: impl Into<String>,
    input_entry_id: impl Into<String>,
    target: TurnExecutionSnapshot,
    snapshot: RuntimeFinalSnapshot,
    committed_at: i64,
    binding: &BindingStateUpdate,
) -> Result<AppendOutcome, CommitSinkError> {
    let fact = assemble_turn_committed(
        logical_turn_id.into(),
        attempt_id.into(),
        input_entry_id.into(),
        target,
        snapshot,
        committed_at,
    )
    .map_err(|error| CommitSinkError::new("assemble turn committed", error.detail))?;

    writer
        .append_canonical_fact_with_binding_at(
            session_id,
            CanonicalFact::TurnCommitted(fact),
            committed_at,
            binding,
        )
        .map_err(|error| {
            CommitSinkError::new("append canonical fact with binding", error.to_string())
        })
}
