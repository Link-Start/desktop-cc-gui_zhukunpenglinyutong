//! Provider Usage Ledger：独立归属、revision/supersede 链幂等。
//!
//! 契约（Foundation §14.4.2 保留项 5）：
//! - `provider_usage_aggregate_log` 不携带任何 session 标识；
//! - PK `(provider_profile_id, window_started_at, window_ended_at, report_subject_id, revision)`
//!   命中即幂等重放，返回 [`LedgerOutcome::Duplicate`]；
//! - 新 revision 必须 = 当前最高 revision + 1，且 `supersedes_event_id` 必须指向当前最高行；
//!   跳跃/倒挂拒绝（[`StoreError::LedgerRevisionConflict`]）；
//! - aggregate-only（无关联 session 事件）是合法写入。

use rusqlite::{Connection, OptionalExtension, TransactionBehavior};
use serde_json::Value;

use super::checksum::payload_checksum;
use super::error::StoreError;

/// Ledger 行的 checksum 使用的固定 fact type（Ledger 表无 fact_type 列）。
/// 与 Wave 0 契约（`provider-usage-aggregate.schema.json`）冻结的 fact 名保持一致。
pub(crate) const LEDGER_FACT_TYPE: &str = "provider.usageAggregateRecorded";

/// 待写入的 Provider Usage Ledger 记录。
#[derive(Debug, Clone)]
pub struct ProviderUsageRecord {
    pub provider_profile_id: String,
    pub report_subject_id: String,
    pub revision: i64,
    /// 本条 usage record 的全局唯一 id（对应外部 usageRecordId）。
    pub event_id: String,
    pub window_started_at: i64,
    pub window_ended_at: i64,
    pub payload_json: String,
    pub observed_at: i64,
    /// 指向当前最高 revision 行的 `event_id`；首个 revision 必须为 `None`。
    pub supersedes_event_id: Option<String>,
    /// checksum 输入三元组之一（与 event envelope 的 schemaVersion 同义）。
    pub schema_version: u32,
}

/// Ledger 写入结果。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LedgerOutcome {
    Inserted,
    /// PK 幂等重放：行已存在，未产生第二行。
    Duplicate,
}

/// 已落盘的 Ledger 行（只读查询用）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredLedgerRow {
    pub provider_profile_id: String,
    pub report_subject_id: String,
    pub revision: i64,
    pub event_id: String,
    pub window_started_at: i64,
    pub window_ended_at: i64,
    pub payload_json: String,
    pub payload_checksum: String,
    pub observed_at: i64,
}

/// 写入一条 Ledger 记录；PK 重放幂等，revision 链在事务内校验。
pub(crate) fn record_provider_usage(
    conn: &mut Connection,
    record: &ProviderUsageRecord,
) -> Result<LedgerOutcome, StoreError> {
    let payload: Value = serde_json::from_str(&record.payload_json)
        .map_err(|source| StoreError::json("parse ledger payload_json", source))?;
    let checksum = payload_checksum(record.schema_version, LEDGER_FACT_TYPE, &payload)?;

    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|source| StoreError::sqlite("begin provider usage ledger transaction", source))?;

    // 1) PK 幂等重放：完全相同的 (provider, window, subject, revision) 直接 Duplicate。
    let pk_hit: Option<(String, String)> = tx
        .query_row(
            "SELECT event_id, payload_checksum FROM provider_usage_aggregate_log
             WHERE provider_profile_id = ?1
               AND window_started_at = ?2
               AND window_ended_at = ?3
               AND report_subject_id = ?4
               AND revision = ?5",
            rusqlite::params![
                record.provider_profile_id,
                record.window_started_at,
                record.window_ended_at,
                record.report_subject_id,
                record.revision,
            ],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|source| StoreError::sqlite("check ledger pk idempotency", source))?;
    if let Some((event_id, stored_checksum)) = pk_hit {
        if event_id == record.event_id && stored_checksum == checksum {
            return Ok(LedgerOutcome::Duplicate);
        }
        return Err(StoreError::idempotency_conflict(
            format!(
                "provider_profile_id={}, window={}..{}, subject={}, revision={}",
                record.provider_profile_id,
                record.window_started_at,
                record.window_ended_at,
                record.report_subject_id,
                record.revision
            ),
            "existing ledger row has a different event_id or payload checksum",
        ));
    }

    // 2) 读取当前最高 revision 行。
    let current_head: Option<(i64, String)> = tx
        .query_row(
            "SELECT revision, event_id FROM provider_usage_aggregate_log
             WHERE provider_profile_id = ?1
               AND window_started_at = ?2
               AND window_ended_at = ?3
               AND report_subject_id = ?4
             ORDER BY revision DESC
             LIMIT 1",
            rusqlite::params![
                record.provider_profile_id,
                record.window_started_at,
                record.window_ended_at,
                record.report_subject_id,
            ],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|source| StoreError::sqlite("read ledger head revision", source))?;

    // 3) supersede 链校验。
    match &current_head {
        None => {
            if record.revision != 1 || record.supersedes_event_id.is_some() {
                return Err(StoreError::ledger_revision_conflict(
                    1,
                    record.revision,
                    "first ledger revision must be 1 without supersedes reference",
                ));
            }
        }
        Some((head_revision, head_event_id)) => {
            let expected_revision = head_revision + 1;
            let supersedes_ok =
                record.supersedes_event_id.as_deref() == Some(head_event_id.as_str());
            if record.revision != expected_revision || !supersedes_ok {
                return Err(StoreError::ledger_revision_conflict(
                    expected_revision,
                    record.revision,
                    format!(
                        "new revision must equal head + 1 and supersede head event {}",
                        head_event_id
                    ),
                ));
            }
        }
    }

    // 4) 插入（event_id UNIQUE 兜底并发/逻辑错误的最后一道保险）。
    tx.execute(
        "INSERT INTO provider_usage_aggregate_log (
            provider_profile_id, report_subject_id, revision, event_id,
            window_started_at, window_ended_at,
            payload_json, payload_checksum, observed_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            record.provider_profile_id,
            record.report_subject_id,
            record.revision,
            record.event_id,
            record.window_started_at,
            record.window_ended_at,
            record.payload_json,
            checksum,
            record.observed_at,
        ],
    )
    .map_err(|source| map_ledger_write_error("insert provider usage ledger row", source))?;

    tx.commit()
        .map_err(|source| StoreError::sqlite("commit provider usage ledger transaction", source))?;
    Ok(LedgerOutcome::Inserted)
}

/// 约束类错误映射为 typed variant，其余保留 sqlite 上下文。
fn map_ledger_write_error(context: &str, error: rusqlite::Error) -> StoreError {
    match &error {
        rusqlite::Error::SqliteFailure(code, _)
            if code.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            StoreError::constraint_violation(format!("{context}: {error}"))
        }
        _ => StoreError::sqlite(context, error),
    }
}
