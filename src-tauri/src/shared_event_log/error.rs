//! Shared Event Storage 的 typed error。
//!
//! 手写 `Display` / `Error` / `From`（不引入 thiserror，遵守零新增依赖）。
//! message 统一携带「动作 + 对象 + 原因」上下文，不泄露敏感内容。

use std::fmt;

/// 存储层统一错误类型。
#[derive(Debug)]
pub enum StoreError {
    /// 文件系统 IO 失败（建目录、设权限、读 metadata 等）。
    Io {
        context: String,
        source: std::io::Error,
    },
    /// SQLite 调用失败（非约束类）。
    Sqlite {
        context: String,
        source: rusqlite::Error,
    },
    /// payload JSON 解析 / deterministic-json 序列化失败。
    Json {
        context: String,
        source: serde_json::Error,
    },
    /// 启动或读取阶段发现数据库损坏。
    Corruption { detail: String },
    /// migration 失败或数据库 user_version 高于本模块支持版本（fail closed）。
    MigrationFailed { from_version: u32, detail: String },
    /// Provider Usage Ledger revision/supersede 链不合法。
    LedgerRevisionConflict {
        expected_revision: i64,
        actual_revision: i64,
        detail: String,
    },
    /// Canonical Fact 字段级校验失败。
    ValidationFailed { context: String, detail: String },
    /// 同一幂等 key 对应了不同 payload，拒绝把冲突伪装成成功重放。
    IdempotencyConflict { key: String, detail: String },
    /// 命中 SQLite constraint 且无法解释为幂等重放。
    ConstraintViolation { detail: String },
    /// 单写者 Actor 线程已终止或 channel 断开。
    ActorTerminated { detail: String },
    /// 尚有其他 writer handle，当前 handle 无权关闭共享 actor。
    WriterStillShared { handle_count: usize },
}

impl StoreError {
    pub(crate) fn io(context: impl Into<String>, source: std::io::Error) -> Self {
        Self::Io {
            context: context.into(),
            source,
        }
    }

    pub(crate) fn sqlite(context: impl Into<String>, source: rusqlite::Error) -> Self {
        Self::Sqlite {
            context: context.into(),
            source,
        }
    }

    pub(crate) fn json(context: impl Into<String>, source: serde_json::Error) -> Self {
        Self::Json {
            context: context.into(),
            source,
        }
    }

    pub(crate) fn corruption(detail: impl Into<String>) -> Self {
        Self::Corruption {
            detail: detail.into(),
        }
    }

    pub(crate) fn migration_failed(from_version: u32, detail: impl Into<String>) -> Self {
        Self::MigrationFailed {
            from_version,
            detail: detail.into(),
        }
    }

    pub(crate) fn ledger_revision_conflict(
        expected_revision: i64,
        actual_revision: i64,
        detail: impl Into<String>,
    ) -> Self {
        Self::LedgerRevisionConflict {
            expected_revision,
            actual_revision,
            detail: detail.into(),
        }
    }

    pub(crate) fn idempotency_conflict(key: impl Into<String>, detail: impl Into<String>) -> Self {
        Self::IdempotencyConflict {
            key: key.into(),
            detail: detail.into(),
        }
    }

    pub(crate) fn constraint_violation(detail: impl Into<String>) -> Self {
        Self::ConstraintViolation {
            detail: detail.into(),
        }
    }

    pub(crate) fn validation_failed(context: impl Into<String>, detail: impl Into<String>) -> Self {
        Self::ValidationFailed {
            context: context.into(),
            detail: detail.into(),
        }
    }

    pub(crate) fn actor_terminated(detail: impl Into<String>) -> Self {
        Self::ActorTerminated {
            detail: detail.into(),
        }
    }
}

impl fmt::Display for StoreError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io { context, source } => write!(formatter, "{context}: {source}"),
            Self::Sqlite { context, source } => write!(formatter, "{context}: {source}"),
            Self::Json { context, source } => write!(formatter, "{context}: {source}"),
            Self::Corruption { detail } => {
                write!(formatter, "shared event store corruption: {detail}")
            }
            Self::MigrationFailed {
                from_version,
                detail,
            } => write!(
                formatter,
                "shared event store migration failed at user_version {from_version}: {detail}"
            ),
            Self::LedgerRevisionConflict {
                expected_revision,
                actual_revision,
                detail,
            } => write!(
                formatter,
                "provider usage ledger revision conflict: expected {expected_revision}, got {actual_revision}: {detail}"
            ),
            Self::IdempotencyConflict { key, detail } => {
                write!(formatter, "shared event idempotency conflict at {key}: {detail}")
            }
            Self::ValidationFailed { context, detail } => {
                write!(formatter, "shared event validation failed ({context}): {detail}")
            }
            Self::ConstraintViolation { detail } => {
                write!(formatter, "shared event store constraint violation: {detail}")
            }
            Self::ActorTerminated { detail } => {
                write!(formatter, "shared event writer actor terminated: {detail}")
            }
            Self::WriterStillShared { handle_count } => write!(
                formatter,
                "shared event writer still has {handle_count} active handles"
            ),
        }
    }
}

impl std::error::Error for StoreError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            Self::Sqlite { source, .. } => Some(source),
            Self::Json { source, .. } => Some(source),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for StoreError {
    fn from(source: rusqlite::Error) -> Self {
        Self::sqlite("sqlite operation failed", source)
    }
}

impl From<serde_json::Error> for StoreError {
    fn from(source: serde_json::Error) -> Self {
        Self::json("json operation failed", source)
    }
}

impl From<std::io::Error> for StoreError {
    fn from(source: std::io::Error) -> Self {
        Self::io("io operation failed", source)
    }
}

impl From<super::canonical::validator::FactValidationError> for StoreError {
    fn from(source: super::canonical::validator::FactValidationError) -> Self {
        Self::validation_failed(source.context, source.detail)
    }
}
