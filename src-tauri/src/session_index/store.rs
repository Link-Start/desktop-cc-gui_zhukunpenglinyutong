use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

const DDL: &str = r#"
CREATE TABLE IF NOT EXISTS session_index (
  engine TEXT NOT NULL,
  session_id TEXT NOT NULL,
  title TEXT NOT NULL,
  native_title TEXT,
  updated_at INTEGER NOT NULL,
  created_at INTEGER,
  cwd TEXT,
  workspace_path TEXT,
  physical_path TEXT,
  parent_session_id TEXT,
  size_bytes INTEGER,
  source_fingerprint TEXT,
  indexed_at INTEGER NOT NULL,
  tombstoned_at INTEGER,
  PRIMARY KEY (engine, session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_index_workspace_mtime
  ON session_index(workspace_path, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_index_cwd_mtime
  ON session_index(cwd, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_index_engine_mtime
  ON session_index(engine, updated_at DESC);

CREATE TABLE IF NOT EXISTS session_index_sources (
  source_key TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  last_sync_ms INTEGER NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0
);
"#;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionIndexRow {
    pub engine: String,
    pub session_id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_title: Option<String>,
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub physical_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionIndexListPage {
    pub data: Vec<SessionIndexRow>,
    pub source: String,
    pub synced: bool,
    pub sync_ms: Option<u64>,
    pub engines: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partial_source: Option<String>,
    #[serde(default)]
    pub has_more: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub visibility: Option<super::shared_visibility::SharedNativeVisibilityProjection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionIndexSyncReport {
    pub upserted: usize,
    pub engines: Vec<String>,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub partial_source: Option<String>,
    pub skipped_fresh: bool,
}

pub(crate) fn database_path() -> Result<PathBuf, String> {
    Ok(crate::app_paths::app_home_dir()?.join("session-index.sqlite3"))
}

pub(crate) fn open_connection() -> Result<Connection, String> {
    let path = database_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let connection = Connection::open(&path).map_err(|error| error.to_string())?;
    connection
        .busy_timeout(Duration::from_secs(3))
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;",
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute_batch(DDL)
        .map_err(|error| error.to_string())?;
    let _ = connection.execute(
        "ALTER TABLE session_index ADD COLUMN tombstoned_at INTEGER",
        [],
    );
    let _ = connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS session_index_backfill (
           source_key TEXT PRIMARY KEY,
           cursor TEXT NOT NULL DEFAULT '',
           complete INTEGER NOT NULL DEFAULT 0,
           updated_ms INTEGER NOT NULL
         );",
    );
    Ok(connection)
}

pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

pub(crate) fn normalize_path_key(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let mut normalized = trimmed.replace('\\', "/");
    while normalized.len() > 1 && normalized.ends_with('/') {
        normalized.pop();
    }
    // Case-fold on Windows-style paths is left to comparison helper.
    normalized
}

pub(crate) fn paths_equivalent(left: &str, right: &str) -> bool {
    let left = normalize_path_key(left);
    let right = normalize_path_key(right);
    if left.is_empty() || right.is_empty() {
        return false;
    }
    if left == right {
        return true;
    }
    #[cfg(windows)]
    {
        return left.eq_ignore_ascii_case(&right);
    }
    #[cfg(not(windows))]
    {
        false
    }
}

pub(crate) fn upsert_rows(connection: &Connection, rows: &[SessionIndexRow]) -> Result<usize, String> {
    if rows.is_empty() {
        return Ok(0);
    }
    let indexed_at = now_ms();
    let tx = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;
    {
        let mut statement = tx
            .prepare(
                "INSERT INTO session_index (
                    engine, session_id, title, native_title, updated_at, created_at,
                    cwd, workspace_path, physical_path, parent_session_id, size_bytes,
                    source_fingerprint, indexed_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                 ON CONFLICT(engine, session_id) DO UPDATE SET
                    title = excluded.title,
                    native_title = excluded.native_title,
                    updated_at = excluded.updated_at,
                    created_at = COALESCE(excluded.created_at, session_index.created_at),
                    cwd = COALESCE(excluded.cwd, session_index.cwd),
                    workspace_path = COALESCE(excluded.workspace_path, session_index.workspace_path),
                    physical_path = COALESCE(excluded.physical_path, session_index.physical_path),
                    parent_session_id = COALESCE(excluded.parent_session_id, session_index.parent_session_id),
                    size_bytes = COALESCE(excluded.size_bytes, session_index.size_bytes),
                    source_fingerprint = excluded.source_fingerprint,
                    indexed_at = excluded.indexed_at
                 WHERE session_index.tombstoned_at IS NULL",
            )
            .map_err(|error| error.to_string())?;
        for row in rows {
            let engine = row.engine.trim().to_ascii_lowercase();
            let session_id = row.session_id.trim();
            if engine.is_empty() || session_id.is_empty() {
                continue;
            }
            let title = {
                let trimmed = row.title.trim();
                if trimmed.is_empty() {
                    format!("{} session", engine)
                } else {
                    trimmed.to_string()
                }
            };
            let cwd = row
                .cwd
                .as_deref()
                .map(normalize_path_key)
                .filter(|value| !value.is_empty());
            let workspace_path = row
                .workspace_path
                .as_deref()
                .map(normalize_path_key)
                .filter(|value| !value.is_empty())
                .or_else(|| cwd.clone());
            statement
                .execute(params![
                    engine,
                    session_id,
                    title,
                    row.native_title
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty()),
                    row.updated_at.max(0),
                    row.created_at.filter(|value| *value > 0),
                    cwd,
                    workspace_path,
                    row.physical_path
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty()),
                    row.parent_session_id
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty()),
                    row.size_bytes.map(|value| value as i64),
                    row.physical_path
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .unwrap_or(""),
                    indexed_at,
                ])
                .map_err(|error| error.to_string())?;
        }
    }
    tx.commit().map_err(|error| error.to_string())?;
    Ok(rows.len())
}

pub(crate) fn mark_source_synced(
    connection: &Connection,
    source_key: &str,
    fingerprint: &str,
    row_count: usize,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO session_index_sources (source_key, fingerprint, last_sync_ms, row_count)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(source_key) DO UPDATE SET
               fingerprint = excluded.fingerprint,
               last_sync_ms = excluded.last_sync_ms,
               row_count = excluded.row_count",
            params![source_key, fingerprint, now_ms(), row_count as i64],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn source_is_fresh(
    connection: &Connection,
    source_key: &str,
    fingerprint: &str,
    max_age_ms: i64,
) -> Result<bool, String> {
    let row = connection
        .query_row(
            "SELECT fingerprint, last_sync_ms FROM session_index_sources WHERE source_key = ?1",
            [source_key],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some((stored_fp, last_sync_ms)) = row else {
        return Ok(false);
    };
    if stored_fp != fingerprint {
        return Ok(false);
    }
    let age = now_ms().saturating_sub(last_sync_ms);
    Ok(age <= max_age_ms)
}

/// True when a send/create marked this workspace's Index sources stale.
/// Restart first-paint / next non-force list must rescan writers even if
/// some Claude/Codex rows already exist.
pub(crate) fn workspace_index_sources_invalidated(
    connection: &Connection,
    workspace_path: &str,
) -> Result<bool, String> {
    let key = normalize_path_key(workspace_path);
    if key.is_empty() {
        return Ok(false);
    }
    let count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM session_index_sources
             WHERE last_sync_ms <= 0
               AND (source_key LIKE ?1 OR source_key LIKE ?2)",
            rusqlite::params![format!("%:{}", key), format!("%{}", key)],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    Ok(count > 0)
}

const INDEX_LIST_ENGINES: &[&str] = &[
    "claude", "codex", "gemini", "grok", "kimi", "opencode", "pi",
];

fn list_slice_for_workspace_engine(
    connection: &Connection,
    workspace_key: &str,
    engine: &str,
    limit: usize,
) -> Result<Vec<SessionIndexRow>, String> {
    let mut statement = connection
        .prepare(
            "SELECT engine, session_id, title, native_title, updated_at, created_at,
                    cwd, workspace_path, physical_path, parent_session_id, size_bytes
             FROM session_index
             WHERE (workspace_path = ?1 OR cwd = ?1)
               AND engine = ?2
               AND tombstoned_at IS NULL
             ORDER BY updated_at DESC, session_id ASC
             LIMIT ?3",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![workspace_key, engine, limit as i64], map_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    Ok(rows)
}

pub(crate) fn list_for_workspace_path(
    connection: &Connection,
    workspace_path: &str,
    limit: usize,
) -> Result<Vec<SessionIndexRow>, String> {
    let limit = limit.clamp(1, 500);
    let key = normalize_path_key(workspace_path);
    if key.is_empty() {
        return Ok(Vec::new());
    }
    // Per-engine budget: a global LIMIT would let recent Claude/Shared rows
    // starve PI (and the sidebar would look like PI never landed).
    let mut rows = Vec::new();
    let mut existing = std::collections::HashSet::<(String, String)>::new();
    for engine in INDEX_LIST_ENGINES {
        for row in list_slice_for_workspace_engine(connection, &key, engine, limit)? {
            let identity = (row.engine.clone(), row.session_id.clone());
            if existing.insert(identity) {
                rows.push(row);
            }
        }
    }

    if rows.is_empty() {
        // Fallback: scan a larger recent window and path-equivalent filter.
        let mut fallback = connection
            .prepare(
                "SELECT engine, session_id, title, native_title, updated_at, created_at,
                        cwd, workspace_path, physical_path, parent_session_id, size_bytes
                 FROM session_index
                 WHERE tombstoned_at IS NULL
                 ORDER BY updated_at DESC, session_id ASC
                 LIMIT ?1",
            )
            .map_err(|error| error.to_string())?;
        let recent = fallback
            .query_map(params![(limit.saturating_mul(20).max(100)) as i64], map_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        let mut per_engine: std::collections::HashMap<String, usize> =
            std::collections::HashMap::new();
        for row in recent {
            let matches = row
                .workspace_path
                .as_deref()
                .map(|value| paths_equivalent(value, &key))
                .unwrap_or(false)
                || row
                    .cwd
                    .as_deref()
                    .map(|value| paths_equivalent(value, &key))
                    .unwrap_or(false);
            if !matches {
                continue;
            }
            let identity = (row.engine.clone(), row.session_id.clone());
            if !existing.insert(identity) {
                continue;
            }
            let count = per_engine.entry(row.engine.clone()).or_insert(0);
            if *count >= limit {
                continue;
            }
            *count += 1;
            rows.push(row);
        }
    }
    rows.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| left.session_id.cmp(&right.session_id))
    });
    Ok(rows)
}

pub(crate) fn list_for_workspace_path_before(
    connection: &Connection,
    workspace_path: &str,
    limit: usize,
    before: Option<(i64, String)>,
) -> Result<Vec<SessionIndexRow>, String> {
    let limit = limit.clamp(1, 500);
    let key = normalize_path_key(workspace_path);
    if key.is_empty() {
        return Ok(Vec::new());
    }
    // Prefer exact workspace_path / cwd match in SQL; post-filter with
    // paths_equivalent for Windows case folding edge cases.
    let fetch_limit = (limit.saturating_add(1)) as i64;
    let mut statement = connection
        .prepare(
            "SELECT engine, session_id, title, native_title, updated_at, created_at,
                    cwd, workspace_path, physical_path, parent_session_id, size_bytes
             FROM session_index
             WHERE (workspace_path = ?1 OR cwd = ?1)
               AND tombstoned_at IS NULL
               AND (
                 ?3 IS NULL
                 OR updated_at < ?3
                 OR (updated_at = ?3 AND session_id > ?4)
               )
             ORDER BY updated_at DESC, session_id ASC
             LIMIT ?2",
        )
        .map_err(|error| error.to_string())?;
    let before_updated = before.as_ref().map(|(updated_at, _)| *updated_at);
    let before_id = before
        .as_ref()
        .map(|(_, session_id)| session_id.as_str())
        .unwrap_or("");
    let mut rows = statement
        .query_map(
            params![key, fetch_limit, before_updated, before_id],
            map_row,
        )
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    if rows.len() < limit {
        // Fallback: scan a larger recent window and path-equivalent filter.
        // Handles path normalization mismatches (trailing slash, case).
        let mut fallback = connection
            .prepare(
                "SELECT engine, session_id, title, native_title, updated_at, created_at,
                        cwd, workspace_path, physical_path, parent_session_id, size_bytes
                 FROM session_index
                 WHERE tombstoned_at IS NULL
                 ORDER BY updated_at DESC, session_id ASC
                 LIMIT ?1",
            )
            .map_err(|error| error.to_string())?;
        let recent = fallback
            .query_map(params![(limit.saturating_mul(20).max(100)) as i64], map_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        let existing: std::collections::HashSet<(String, String)> = rows
            .iter()
            .map(|row| (row.engine.clone(), row.session_id.clone()))
            .collect();
        for row in recent {
            if rows.len() >= limit {
                break;
            }
            let matches = row
                .workspace_path
                .as_deref()
                .map(|value| paths_equivalent(value, &key))
                .unwrap_or(false)
                || row
                    .cwd
                    .as_deref()
                    .map(|value| paths_equivalent(value, &key))
                    .unwrap_or(false);
            if !matches {
                continue;
            }
            if existing.contains(&(row.engine.clone(), row.session_id.clone())) {
                continue;
            }
            rows.push(row);
        }
        rows.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| left.session_id.cmp(&right.session_id))
        });
        rows.truncate(limit);
    }
    Ok(rows)
}

/// Count all non-tombstoned rows matching a workspace (any engine).
pub(crate) fn count_for_workspace_path(
    connection: &Connection,
    workspace_path: &str,
) -> Result<i64, String> {
    let key = normalize_path_key(workspace_path);
    if key.is_empty() {
        return Ok(0);
    }
    connection
        .query_row(
            "SELECT COUNT(*) FROM session_index
             WHERE (workspace_path = ?1 OR cwd = ?1)
               AND tombstoned_at IS NULL",
            params![key],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())
}

/// Persisted incremental-backfill state for one `{engine}:{workspace_path}`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct BackfillState {
    pub cursor: String,
    pub complete: bool,
}

pub(crate) fn load_backfill_state(
    connection: &Connection,
    source_key: &str,
) -> Result<BackfillState, String> {
    let row = connection
        .query_row(
            "SELECT cursor, complete FROM session_index_backfill WHERE source_key = ?1",
            [source_key],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
        )
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(match row {
        Some((cursor, complete)) => BackfillState {
            cursor,
            complete: complete > 0,
        },
        None => BackfillState::default(),
    })
}

pub(crate) fn save_backfill_state(
    connection: &Connection,
    source_key: &str,
    state: &BackfillState,
) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO session_index_backfill (source_key, cursor, complete, updated_ms)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(source_key) DO UPDATE SET
               cursor = excluded.cursor,
               complete = excluded.complete,
               updated_ms = excluded.updated_ms",
            params![
                source_key,
                state.cursor,
                if state.complete { 1 } else { 0 },
                now_ms()
            ],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn tombstone_session_ids(
    connection: &Connection,
    session_ids: &[String],
) -> Result<usize, String> {
    if session_ids.is_empty() {
        return Ok(0);
    }
    let marked_at = now_ms();
    let mut updated = 0usize;
    let mut statement = connection
        .prepare(
            "UPDATE session_index
             SET tombstoned_at = COALESCE(tombstoned_at, ?1)
             WHERE session_id = ?2
                OR session_id = ?3
                OR (engine || ':' || session_id) = ?2",
        )
        .map_err(|error| error.to_string())?;
    // 持久删除标记：UPDATE 只能盖住已存在的行；对尚未入索引的 id 直接插入
    // tombstoned 占位行，让后续 rescan 的 INSERT 撞上 (engine, session_id)
    // 冲突并被 ON CONFLICT 的 tombstoned_at IS NULL 守卫挡下，防止已删会话
    // 在重启后的 sync/backfill 中复活。
    let mut marker = connection
        .prepare(
            "INSERT INTO session_index (
                engine, session_id, title, updated_at, indexed_at, tombstoned_at
             ) VALUES (?1, ?2, '', ?3, ?3, ?3)
             ON CONFLICT(engine, session_id) DO NOTHING",
        )
        .map_err(|error| error.to_string())?;
    for raw in session_ids {
        let full = raw.trim();
        if full.is_empty() {
            continue;
        }
        let engine_hint = full
            .split_once(':')
            .map(|(head, _)| head.trim().to_ascii_lowercase())
            .filter(|head| INDEX_LIST_ENGINES.contains(&head.as_str()));
        let bare = full
            .split_once(':')
            .map(|(_, rest)| rest.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or(full);
        updated += statement
            .execute(params![marked_at, full, bare])
            .map_err(|error| error.to_string())? as usize;
        match engine_hint {
            Some(engine) => {
                marker
                    .execute(params![engine, bare, marked_at])
                    .map_err(|error| error.to_string())?;
            }
            None if !full.contains(':') => {
                // 裸 id（如 codex threadId）无法判定 engine，为所有已知
                // engine 落标记；UUID 跨 engine 碰撞可忽略。
                for engine in INDEX_LIST_ENGINES {
                    marker
                        .execute(params![engine, full, marked_at])
                        .map_err(|error| error.to_string())?;
                }
            }
            None => {
                // 未知前缀（如 shared:）不入索引，无需标记。
            }
        }
    }
    Ok(updated)
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SessionIndexRow> {
    Ok(SessionIndexRow {
        engine: row.get(0)?,
        session_id: row.get(1)?,
        title: row.get(2)?,
        native_title: row.get(3)?,
        updated_at: row.get(4)?,
        created_at: row.get(5)?,
        cwd: row.get(6)?,
        workspace_path: row.get(7)?,
        physical_path: row.get(8)?,
        parent_session_id: row.get(9)?,
        size_bytes: row
            .get::<_, Option<i64>>(10)?
            .and_then(|value| if value >= 0 { Some(value as u64) } else { None }),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn index_row(engine: &str, session_id: &str, updated_at: i64) -> SessionIndexRow {
        SessionIndexRow {
            engine: engine.into(),
            session_id: session_id.into(),
            title: session_id.into(),
            native_title: None,
            updated_at,
            created_at: None,
            cwd: Some("/tmp/proj".into()),
            workspace_path: Some("/tmp/proj".into()),
            physical_path: None,
            parent_session_id: None,
            size_bytes: None,
        }
    }

    #[test]
    fn upsert_and_list_by_workspace() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");
        upsert_rows(
            &connection,
            &[SessionIndexRow {
                engine: "claude".into(),
                session_id: "s1".into(),
                title: "Hello".into(),
                native_title: None,
                updated_at: 200,
                created_at: Some(100),
                cwd: Some("/Users/me/proj".into()),
                workspace_path: Some("/Users/me/proj".into()),
                physical_path: Some("/tmp/s1.jsonl".into()),
                parent_session_id: None,
                size_bytes: Some(12),
            }],
        )
        .expect("upsert");
        let rows = list_for_workspace_path(&connection, "/Users/me/proj/", 10).expect("list");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].session_id, "s1");
    }

    #[test]
    fn backfill_state_roundtrips() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");

        let initial = load_backfill_state(&connection, "codex:/tmp/proj").expect("load");
        assert_eq!(initial, BackfillState::default());

        save_backfill_state(
            &connection,
            "codex:/tmp/proj",
            &BackfillState {
                cursor: "{\"day\":\"2026/07/01\",\"plainDone\":true}".into(),
                complete: false,
            },
        )
        .expect("save");
        let loaded = load_backfill_state(&connection, "codex:/tmp/proj").expect("reload");
        assert!(!loaded.complete);
        assert!(loaded.cursor.contains("2026/07/01"));

        save_backfill_state(
            &connection,
            "codex:/tmp/proj",
            &BackfillState {
                cursor: loaded.cursor.clone(),
                complete: true,
            },
        )
        .expect("save complete");
        assert!(load_backfill_state(&connection, "codex:/tmp/proj")
            .expect("reload")
            .complete);
    }

    #[test]
    fn tombstone_accepts_pi_prefixed_and_bare_session_ids() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");
        upsert_rows(
            &connection,
            &[SessionIndexRow {
                engine: "pi".into(),
                session_id: "ses_pi_1".into(),
                title: "PI Session".into(),
                native_title: None,
                updated_at: 200,
                created_at: Some(100),
                cwd: Some("/tmp/codex".into()),
                workspace_path: Some("/tmp/codex".into()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: Some(32),
            }],
        )
        .expect("upsert");

        let updated = tombstone_session_ids(&connection, &["pi:ses_pi_1".into()]).expect("tombstone");
        assert_eq!(updated, 1);
        let listed = list_for_workspace_path(&connection, "/tmp/codex", 10).expect("list");
        assert!(listed.is_empty(), "tombstoned PI rows must leave the sidebar page");
    }

    #[test]
    fn tombstone_unknown_id_blocks_later_rescan_resurrection() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");
        // 行尚不存在（会话只经磁盘列表进过侧栏）：tombstone 也要留下持久标记
        let updated = tombstone_session_ids(&connection, &["pi:ses_ghost".into()]).expect("tombstone");
        assert_eq!(updated, 0);
        // 重启后 rescan 重新 upsert 同一个 (engine, session_id)
        upsert_rows(&connection, &[index_row("pi", "ses_ghost", 300)]).expect("upsert");
        let listed = list_for_workspace_path(&connection, "/tmp/proj", 10).expect("list");
        assert!(
            listed.is_empty(),
            "tombstone marker must block rescan resurrection"
        );
    }

    #[test]
    fn tombstone_bare_id_marks_all_known_engines() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");
        // 裸 id（codex 等不带 engine 前缀的 threadId）
        tombstone_session_ids(&connection, &["ses_bare".into()]).expect("tombstone");
        upsert_rows(&connection, &[index_row("codex", "ses_bare", 300)]).expect("upsert");
        let listed = list_for_workspace_path(&connection, "/tmp/proj", 10).expect("list");
        assert!(
            listed.is_empty(),
            "bare-id tombstone markers must cover every known engine"
        );
    }

    #[test]
    fn list_keeps_per_engine_budget_so_pi_is_not_starved() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");
        let mut rows = Vec::new();
        for index in 0..8 {
            rows.push(index_row("claude", &format!("claude-{index}"), 1000 + index));
        }
        rows.push(index_row("pi", "pi-old", 1));
        upsert_rows(&connection, &rows).expect("upsert");
        let listed = list_for_workspace_path(&connection, "/tmp/proj", 2).expect("list");
        let claude = listed.iter().filter(|row| row.engine == "claude").count();
        let pi = listed.iter().filter(|row| row.engine == "pi").count();
        assert_eq!(claude, 2);
        assert_eq!(pi, 1);
        assert!(listed.iter().any(|row| row.session_id == "pi-old"));
    }

    #[test]
    fn workspace_index_sources_invalidated_after_send_marks_stale() {
        let connection = Connection::open_in_memory().expect("open");
        connection.execute_batch(DDL).expect("ddl");
        upsert_rows(&connection, &[index_row("claude", "claude-1", 100)]).expect("upsert");
        mark_source_synced(&connection, "pi:/tmp/proj", "fp-a", 1).expect("mark");
        assert!(
            !workspace_index_sources_invalidated(&connection, "/tmp/proj").expect("fresh")
        );
        connection
            .execute(
                "UPDATE session_index_sources SET last_sync_ms = 0 WHERE source_key = ?1",
                ["pi:/tmp/proj"],
            )
            .expect("invalidate");
        assert!(
            workspace_index_sources_invalidated(&connection, "/tmp/proj")
                .expect("stale after PI send")
        );
    }
}
