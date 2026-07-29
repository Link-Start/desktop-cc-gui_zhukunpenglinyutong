//! 启动恢复：单错误输出 `quick_check` + integrity failure → read-only 降级。
//!
//! 契约（Foundation §14.4.7 / spec「Startup Recovery MUST Fail Closed」）：
//! - 文件不存在或空文件 → 允许新建；
//! - 文件存在且非空 → 先跑 `PRAGMA quick_check(1)`（错误输出最多一条，不承诺 wall-clock timeout）；
//! - quick_check 失败或打开即损坏 → [`OpenOutcome::ReadOnlyRecovery`]，
//!   **禁止**删除/重命名/新建覆盖原文件。

use std::path::Path;

use rusqlite::{Connection, OpenFlags};

use super::error::StoreError;
use super::schema;
use super::writer::{SharedEventStore, SharedEventWriter, StoredEvent};

/// 恢复原因的 typed 描述。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RecoveryReason {
    /// `PRAGMA quick_check(1)` 失败或打开即报 SQLite 损坏。
    IntegrityCheckFailed { detail: String },
}

impl std::fmt::Display for RecoveryReason {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::IntegrityCheckFailed { detail } => {
                write!(formatter, "integrity check failed: {detail}")
            }
        }
    }
}

/// 顶层 open 结果。
pub enum OpenOutcome {
    /// 正常可写：单写者 Actor 已就绪。
    Ready(SharedEventWriter),
    /// 损坏降级：只读连接，仅用于诊断导出；原文件保持原样。
    ReadOnlyRecovery {
        reason: RecoveryReason,
        events: ReadOnlyEventReader,
    },
}

/// read-only recovery 模式下的只读查询入口。
pub struct ReadOnlyEventReader {
    conn: Connection,
}

impl ReadOnlyEventReader {
    /// 以 READ_ONLY flags 打开，不做任何写 PRAGMA / migration。
    pub fn open(path: &Path) -> Result<Self, StoreError> {
        let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(
            |source| {
                StoreError::sqlite(
                    format!("open shared event db read-only {}", path.display()),
                    source,
                )
            },
        )?;
        schema::apply_readonly_pragmas(&conn)?;
        Ok(Self { conn })
    }

    /// 单错误输出 integrity check，返回 `"ok"` 或首条错误行。
    pub fn quick_check(&self) -> Result<String, StoreError> {
        self.conn
            .query_row("PRAGMA quick_check(1)", [], |row| row.get(0))
            .map_err(|source| StoreError::sqlite("run pragma quick_check", source))
    }

    /// 统计事件数（损坏库上可能返回错误，直接透传）。
    pub fn count_events(&self) -> Result<i64, StoreError> {
        self.conn
            .query_row("SELECT count(*) FROM shared_event_log", [], |row| {
                row.get(0)
            })
            .map_err(|source| StoreError::sqlite("count events read-only", source))
    }

    /// 按 sequence 升序导出 session 事件（诊断导出用）。
    pub fn events_for_session(&self, session_id: &str) -> Result<Vec<StoredEvent>, StoreError> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT session_id, sequence, event_id, fact_type, logical_turn_id, attempt_id,
                        dedupe_key, payload_json, payload_checksum, fidelity, committed_at
                 FROM shared_event_log WHERE session_id = ?1 ORDER BY sequence ASC",
            )
            .map_err(|source| StoreError::sqlite("prepare read-only event query", source))?;
        let rows = stmt
            .query_map([session_id], |row| {
                let fidelity_raw: String = row.get(9)?;
                Ok(StoredEvent {
                    session_id: row.get(0)?,
                    sequence: row.get(1)?,
                    event_id: row.get(2)?,
                    fact_type: row.get(3)?,
                    logical_turn_id: row.get(4)?,
                    attempt_id: row.get(5)?,
                    dedupe_key: row.get(6)?,
                    payload_json: row.get(7)?,
                    payload_checksum: row.get(8)?,
                    fidelity: super::writer::Fidelity::from_db_str(&fidelity_raw, 9)?,
                    committed_at: row.get(10)?,
                })
            })
            .map_err(|source| StoreError::sqlite("query read-only events", source))?;
        let mut events = Vec::new();
        for row in rows {
            events
                .push(row.map_err(|source| StoreError::sqlite("map read-only event row", source))?);
        }
        Ok(events)
    }
}

/// 打开共享事件存储：缺失 → 新建；存在 → integrity 探测后决定 Ready / ReadOnlyRecovery。
pub fn open(path: &Path) -> Result<OpenOutcome, StoreError> {
    let needs_probe = match std::fs::metadata(path) {
        Ok(metadata) => metadata.len() > 0,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => {
            return Err(StoreError::io(
                format!("stat shared event db {}", path.display()),
                error,
            ))
        }
    };

    if !needs_probe {
        return open_ready(path);
    }

    match probe_integrity(path) {
        Ok(()) => open_ready(path),
        Err(reason) => {
            // 绝不删除/重命名/覆盖原文件；read-only 打开供诊断导出。
            let reader = ReadOnlyEventReader::open(path).map_err(|open_error| {
                StoreError::corruption(format!(
                    "integrity probe failed ({reason}) and read-only open also failed: {open_error}"
                ))
            })?;
            Ok(OpenOutcome::ReadOnlyRecovery {
                reason,
                events: reader,
            })
        }
    }
}

fn open_ready(path: &Path) -> Result<OpenOutcome, StoreError> {
    let store = SharedEventStore::open(path)?;
    let writer = SharedEventWriter::spawn(store)?;
    Ok(OpenOutcome::Ready(writer))
}

/// 非破坏性 integrity 探测：READ_ONLY 连接 + 单错误输出 quick_check。
fn probe_integrity(path: &Path) -> Result<(), RecoveryReason> {
    let conn =
        Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|source| {
            RecoveryReason::IntegrityCheckFailed {
                detail: format!("open for probe: {source}"),
            }
        })?;
    conn.busy_timeout(schema::BUSY_TIMEOUT).map_err(|source| {
        RecoveryReason::IntegrityCheckFailed {
            detail: format!("configure probe busy_timeout: {source}"),
        }
    })?;
    let status: Result<String, rusqlite::Error> =
        conn.query_row("PRAGMA quick_check(1)", [], |row| row.get(0));
    match status {
        Ok(status) if status == "ok" => Ok(()),
        Ok(status) => Err(RecoveryReason::IntegrityCheckFailed { detail: status }),
        Err(source) => Err(RecoveryReason::IntegrityCheckFailed {
            detail: source.to_string(),
        }),
    }
}
