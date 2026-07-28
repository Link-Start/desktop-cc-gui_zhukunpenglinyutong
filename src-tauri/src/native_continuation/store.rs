use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::{params, Connection, OptionalExtension};

use super::NativeProviderContinuationOperation;

const DDL: &str = r#"
CREATE TABLE IF NOT EXISTS native_provider_continuation (
  operation_id TEXT PRIMARY KEY,
  request_checksum TEXT NOT NULL,
  materialization_json TEXT NOT NULL,
  phase TEXT NOT NULL,
  result_session_id TEXT,
  error_code TEXT,
  updated_at INTEGER NOT NULL,
  CHECK (length(operation_id) > 0),
  CHECK (length(request_checksum) > 0),
  CHECK (length(phase) > 0)
);
"#;

#[derive(Debug)]
pub enum ContinuationStoreError {
    Sqlite(String),
    Serialization(String),
    OperationConflict,
    OperationNotFound,
}

impl fmt::Display for ContinuationStoreError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sqlite(message) | Self::Serialization(message) => formatter.write_str(message),
            Self::OperationConflict => formatter.write_str("continuation operation conflict"),
            Self::OperationNotFound => formatter.write_str("continuation operation not found"),
        }
    }
}

impl std::error::Error for ContinuationStoreError {}

fn database_path(root: &Path) -> PathBuf {
    root.join("native-provider-continuation.sqlite3")
}

fn open(root: &Path) -> Result<Connection, ContinuationStoreError> {
    fs::create_dir_all(root).map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    let connection = Connection::open(database_path(root))
        .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;",
        )
        .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    connection
        .execute_batch(DDL)
        .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    Ok(connection)
}

fn row_to_operation(
    materialization_json: String,
    request_checksum: String,
    phase: String,
    result_session_id: Option<String>,
    error_code: Option<String>,
    updated_at: i64,
) -> Result<NativeProviderContinuationOperation, ContinuationStoreError> {
    let materialization = serde_json::from_str(&materialization_json)
        .map_err(|error| ContinuationStoreError::Serialization(error.to_string()))?;
    Ok(NativeProviderContinuationOperation {
        materialization,
        request_checksum,
        phase,
        result_session_id,
        error_code,
        updated_at,
    })
}

fn load_from_connection(
    connection: &Connection,
    operation_id: &str,
) -> Result<Option<NativeProviderContinuationOperation>, ContinuationStoreError> {
    let row = connection
        .query_row(
            "SELECT materialization_json, request_checksum, phase, result_session_id,
                    error_code, updated_at
             FROM native_provider_continuation WHERE operation_id = ?1",
            [operation_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, i64>(5)?,
                ))
            },
        )
        .optional()
        .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    row.map(
        |(materialization, request_checksum, phase, result_session_id, error_code, updated_at)| {
            row_to_operation(
                materialization,
                request_checksum,
                phase,
                result_session_id,
                error_code,
                updated_at,
            )
        },
    )
    .transpose()
}

pub fn prepare_operation(
    root: &Path,
    operation: &NativeProviderContinuationOperation,
) -> Result<NativeProviderContinuationOperation, ContinuationStoreError> {
    let mut connection = open(root)?;
    let transaction = connection
        .transaction()
        .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    if let Some(existing) =
        load_from_connection(&transaction, &operation.materialization.operation_id)?
    {
        if existing.request_checksum != operation.request_checksum {
            return Err(ContinuationStoreError::OperationConflict);
        }
        transaction
            .commit()
            .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
        return Ok(existing);
    }
    let materialization_json = serde_json::to_string(&operation.materialization)
        .map_err(|error| ContinuationStoreError::Serialization(error.to_string()))?;
    transaction
        .execute(
            "INSERT INTO native_provider_continuation (
                operation_id, request_checksum, materialization_json, phase,
                result_session_id, error_code, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                operation.materialization.operation_id,
                operation.request_checksum,
                materialization_json,
                operation.phase,
                operation.result_session_id,
                operation.error_code,
                operation.updated_at,
            ],
        )
        .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    transaction
        .commit()
        .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    Ok(operation.clone())
}

pub fn load_operation(
    root: &Path,
    operation_id: &str,
) -> Result<Option<NativeProviderContinuationOperation>, ContinuationStoreError> {
    load_from_connection(&open(root)?, operation_id)
}

pub fn update_operation_phase(
    root: &Path,
    operation_id: &str,
    phase: &str,
    result_session_id: Option<&str>,
    error_code: Option<&str>,
    updated_at: i64,
) -> Result<NativeProviderContinuationOperation, ContinuationStoreError> {
    let connection = open(root)?;
    let changed = connection
        .execute(
            "UPDATE native_provider_continuation
             SET phase = ?2, result_session_id = COALESCE(?3, result_session_id),
                 error_code = ?4, updated_at = ?5
             WHERE operation_id = ?1",
            params![
                operation_id,
                phase,
                result_session_id,
                error_code,
                updated_at
            ],
        )
        .map_err(|error| ContinuationStoreError::Sqlite(error.to_string()))?;
    if changed == 0 {
        return Err(ContinuationStoreError::OperationNotFound);
    }
    load_from_connection(&connection, operation_id)?
        .ok_or(ContinuationStoreError::OperationNotFound)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_continuation::{ArtifactRef, NativeHistoryMaterialization};
    use crate::native_history::{NativeHistoryEngine, NativeHistorySource};
    use serde_json::json;
    use uuid::Uuid;

    fn operation(checksum: &str) -> NativeProviderContinuationOperation {
        NativeProviderContinuationOperation {
            materialization: NativeHistoryMaterialization {
                operation_id: "operation-a".to_string(),
                source: NativeHistorySource {
                    session_id: "claude:source".to_string(),
                    native_session_id: "source".to_string(),
                    engine: NativeHistoryEngine::Claude,
                    provider_profile_id: Some("provider-a".to_string()),
                },
                reader_id: "claude-session-jsonl/v1".to_string(),
                source_fingerprint: "sha256:source".to_string(),
                through_cursor: "cursor".to_string(),
                normalized_entries: ArtifactRef {
                    artifact_id: "entries".to_string(),
                    checksum: "sha256:entries".to_string(),
                    media_type: "application/json".to_string(),
                },
                context_package_id: "package".to_string(),
                context_package: ArtifactRef {
                    artifact_id: "package".to_string(),
                    checksum: "sha256:package".to_string(),
                    media_type: "application/json".to_string(),
                },
                destination: json!({ "engine": "codex", "providerProfileId": "provider-b" }),
                prepared_at: 1,
            },
            request_checksum: checksum.to_string(),
            phase: "prepared".to_string(),
            result_session_id: None,
            error_code: None,
            updated_at: 1,
        }
    }

    #[test]
    fn prepare_is_idempotent_and_rejects_operation_conflict() {
        let root =
            std::env::temp_dir().join(format!("mossx-native-continuation-{}", Uuid::new_v4()));
        let first = prepare_operation(&root, &operation("sha256:first")).expect("prepare");
        let replay = prepare_operation(&root, &operation("sha256:first")).expect("replay");
        assert_eq!(first, replay);
        let error = prepare_operation(&root, &operation("sha256:changed")).expect_err("conflict");
        assert!(matches!(error, ContinuationStoreError::OperationConflict));
        fs::remove_dir_all(root).ok();
    }

    #[test]
    fn phase_update_preserves_materialization_and_result_identity() {
        let root =
            std::env::temp_dir().join(format!("mossx-native-continuation-{}", Uuid::new_v4()));
        prepare_operation(&root, &operation("sha256:first")).expect("prepare");
        let ready =
            update_operation_phase(&root, "operation-a", "ready", Some("codex:target"), None, 2)
                .expect("ready");
        assert_eq!(ready.phase, "ready");
        assert_eq!(ready.result_session_id.as_deref(), Some("codex:target"));
        assert_eq!(ready.materialization.source.session_id, "claude:source");
        fs::remove_dir_all(root).ok();
    }
}
