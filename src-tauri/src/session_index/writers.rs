use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use serde_json::Value;

use super::store::{
    invalidate_source_freshness, load_backfill_state, mark_source_synced, normalize_path_key,
    save_backfill_state, source_is_fresh, upsert_rows, BackfillState, SessionIndexRow,
};
use crate::engine::claude_history::encode_project_path;

/// Freshness window for source fingerprints. Within this, list can skip rescan.
/// Kept short so CLI-created sessions appear in the sidebar without force refresh.
pub(crate) const SOURCE_FRESH_MAX_AGE_MS: i64 = 8_000;

#[derive(Debug, Default)]
pub(crate) struct WriterResult {
    pub upserted: usize,
    pub engines: Vec<String>,
    pub partial_source: Option<String>,
    pub skipped_fresh: bool,
}

fn mtime_fingerprint(path: &Path) -> String {
    let meta = fs::metadata(path).ok();
    let modified = meta
        .as_ref()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let len = meta.map(|metadata| metadata.len()).unwrap_or(0);
    format!("{modified}:{len}")
}

fn file_mtime_ms(path: &Path) -> i64 {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

/// Result of one bounded historical-backfill batch (import daemon tail).
#[derive(Debug, Default)]
pub(crate) struct BackfillBatchResult {
    pub upserted: usize,
    pub complete: bool,
}

/// Claude backfill: page through project-dir files (mtime desc) by offset.
pub(crate) const CLAUDE_BACKFILL_BATCH_SIZE: usize = 100;
/// Codex backfill: distinct partition days processed per tick.
pub(crate) const CODEX_BACKFILL_PARTITIONS_PER_BATCH: usize = 3;
/// Codex non-partitioned fallback root cap (one-shot, first batch only).
pub(crate) const CODEX_BACKFILL_PLAIN_FILE_CAP: usize = 1_000;
/// Kimi backfill: matched index lines per tick.
pub(crate) const KIMI_BACKFILL_BATCH_SIZE: usize = 100;

fn list_claude_project_session_files(project_dir: &Path) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = fs::read_dir(project_dir)
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("jsonl"))
                .collect()
        })
        .unwrap_or_default();
    files.sort_by(|left, right| {
        file_mtime_ms(right)
            .cmp(&file_mtime_ms(left))
            .then_with(|| left.to_string_lossy().cmp(&right.to_string_lossy()))
    });
    files
}

fn claude_index_row_from_file(
    path: &Path,
    workspace_path: &Path,
    titles: &HashMap<String, String>,
) -> Option<SessionIndexRow> {
    let session_id = path
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if session_id.is_empty() {
        return None;
    }
    let updated_at = file_mtime_ms(path);
    let title_from_history = titles.get(&session_id).cloned();
    let title = title_from_history
        .clone()
        .or_else(|| peek_claude_first_user_preview(path))
        .unwrap_or_else(|| "Claude Session".to_string());
    let size_bytes = fs::metadata(path).ok().map(|metadata| metadata.len());
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    Some(SessionIndexRow {
        engine: "claude".into(),
        session_id: session_id.clone(),
        title: title.clone(),
        native_title: title_from_history,
        updated_at,
        created_at: None,
        cwd: Some(workspace_key.clone()),
        workspace_path: Some(workspace_key),
        physical_path: Some(path.to_string_lossy().to_string()),
        parent_session_id: super::shared_visibility::extract_claude_parent_session_id(
            &session_id,
        ),
        size_bytes,
    })
}

fn codex_summary_to_index_row(
    summary: crate::types::LocalUsageSessionSummary,
    workspace_key: &str,
) -> SessionIndexRow {
    let title = summary
        .native_title
        .clone()
        .or(summary.summary.clone())
        .unwrap_or_else(|| "Codex Session".to_string());
    SessionIndexRow {
        engine: "codex".into(),
        session_id: summary.session_id,
        title: title.clone(),
        native_title: summary.native_title.or(summary.summary),
        updated_at: summary.timestamp,
        created_at: None,
        cwd: summary
            .cwd
            .as_deref()
            .map(normalize_path_key)
            .or_else(|| Some(workspace_key.to_string())),
        workspace_path: Some(workspace_key.to_string()),
        physical_path: summary.physical_path,
        parent_session_id: summary.parent_session_id,
        size_bytes: summary.file_size_bytes,
    }
}

fn kimi_session_index_path() -> Option<PathBuf> {
    let home = dirs::home_dir().map(|home| home.join(".kimi"))?;
    let home = std::env::var("KIMI_HOME")
        .ok()
        .and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(PathBuf::from(trimmed))
            }
        })
        .unwrap_or(home);
    Some(home.join("session_index.jsonl"))
}

fn parse_kimi_index_line(line: &str, target: &str) -> Option<SessionIndexRow> {
    if line.len() > 256_000 {
        return None;
    }
    let value = serde_json::from_str::<Value>(line).ok()?;
    let work_dir = value
        .get("workDir")
        .or_else(|| value.get("work_dir"))
        .or_else(|| value.get("cwd"))
        .and_then(Value::as_str)
        .map(normalize_path_key)
        .unwrap_or_default();
    if work_dir.is_empty() || work_dir != target {
        return None;
    }
    let session_id = value
        .get("sessionId")
        .or_else(|| value.get("session_id"))
        .or_else(|| value.get("id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())?;
    let session_dir = value
        .get("sessionDir")
        .or_else(|| value.get("session_dir"))
        .and_then(Value::as_str)
        .map(PathBuf::from);
    let updated_at = session_dir
        .as_ref()
        .map(|path| file_mtime_ms(path))
        .filter(|value| *value > 0)
        .unwrap_or_else(|| now_ms_fallback());
    let title = value
        .get("title")
        .or_else(|| value.get("name"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "Kimi Session".to_string());
    Some(SessionIndexRow {
        engine: "kimi".into(),
        session_id: session_id.to_string(),
        title,
        native_title: None,
        updated_at,
        created_at: None,
        cwd: Some(target.to_string()),
        workspace_path: Some(target.to_string()),
        physical_path: session_dir.map(|path| path.to_string_lossy().to_string()),
        parent_session_id: None,
        size_bytes: None,
    })
}

pub(crate) fn backfill_claude_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    batch_size: usize,
) -> Result<BackfillBatchResult, String> {
    let source_key = format!(
        "claude:{}",
        normalize_path_key(&workspace_path.to_string_lossy())
    );
    let state = load_backfill_state(connection, &source_key)?;
    if state.complete {
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let Some(claude_home) = crate::claude_home::resolve_effective_claude_home(None) else {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    };
    let encoded = encode_project_path(&workspace_path.to_string_lossy());
    let project_dir = claude_home.join("projects").join(&encoded);
    if !project_dir.is_dir() {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let history_path = claude_home.join("history.jsonl");
    let titles = read_claude_history_titles(&history_path, workspace_path);
    let files = list_claude_project_session_files(&project_dir);
    let offset: usize = state.cursor.trim().parse().unwrap_or(0);
    if offset >= files.len() {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let end = offset.saturating_add(batch_size).min(files.len());
    let mut rows = Vec::new();
    for path in &files[offset..end] {
        if let Some(row) = claude_index_row_from_file(path, workspace_path, &titles) {
            rows.push(row);
        }
    }
    let upserted = upsert_rows(connection, &rows)?;
    let complete = end >= files.len();
    save_backfill_state(
        connection,
        &source_key,
        &BackfillState {
            cursor: end.to_string(),
            complete,
        },
    )?;
    Ok(BackfillBatchResult { upserted, complete })
}

pub(crate) fn backfill_codex_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    sessions_roots: &[PathBuf],
    max_partitions: usize,
) -> Result<BackfillBatchResult, String> {
    let source_key = format!(
        "codex:{}",
        normalize_path_key(&workspace_path.to_string_lossy())
    );
    let state = load_backfill_state(connection, &source_key)?;
    if state.complete {
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let parsed = serde_json::from_str::<Value>(&state.cursor).ok();
    let cursor_day = parsed
        .as_ref()
        .and_then(|value| value.get("day"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let mut plain_done = parsed
        .as_ref()
        .and_then(|value| value.get("plainDone"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    let mut upserted = 0usize;

    if !plain_done {
        let files = crate::local_usage::collect_codex_jsonl_candidates_capped(
            sessions_roots,
            CODEX_BACKFILL_PLAIN_FILE_CAP,
        );
        if !files.is_empty() {
            let summaries = crate::local_usage::scan_codex_session_summaries_for_files(
                Some(workspace_path),
                files,
            )?;
            let rows: Vec<SessionIndexRow> = summaries
                .into_iter()
                .map(|summary| codex_summary_to_index_row(summary, &workspace_key))
                .collect();
            upserted += upsert_rows(connection, &rows)?;
        }
        plain_done = true;
    }

    let partitions = crate::local_usage::list_codex_day_partitions(sessions_roots);
    let mut dates: Vec<String> = Vec::new();
    for partition in &partitions {
        if !dates.iter().any(|key| key == &partition.key) {
            dates.push(partition.key.clone());
        }
    }
    let remaining: Vec<String> = dates
        .iter()
        .filter(|key| cursor_day.is_empty() || *key < &cursor_day)
        .cloned()
        .collect();
    let batch_dates: Vec<String> = remaining.iter().take(max_partitions).cloned().collect();

    let save_state = |day: &str, plain: bool, complete: bool| {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: format!("{{\"day\":{:?},\"plainDone\":{}}}", day, plain),
                complete,
            },
        )
    };

    if batch_dates.is_empty() {
        save_state(&cursor_day, plain_done, true)?;
        return Ok(BackfillBatchResult {
            upserted,
            complete: true,
        });
    }

    let selected: Vec<_> = partitions
        .into_iter()
        .filter(|partition| batch_dates.contains(&partition.key))
        .collect();
    let summaries = crate::local_usage::scan_codex_session_summaries_for_day_dirs(
        Some(workspace_path),
        &selected,
    )?;
    let rows: Vec<SessionIndexRow> = summaries
        .into_iter()
        .map(|summary| codex_summary_to_index_row(summary, &workspace_key))
        .collect();
    upserted += upsert_rows(connection, &rows)?;

    let oldest = batch_dates.last().cloned().unwrap_or_default();
    let complete = !dates.iter().any(|key| *key < oldest);
    save_state(&oldest, plain_done, complete)?;
    Ok(BackfillBatchResult { upserted, complete })
}

pub(crate) fn backfill_kimi_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    batch_size: usize,
) -> Result<BackfillBatchResult, String> {
    let source_key = format!(
        "kimi:{}",
        normalize_path_key(&workspace_path.to_string_lossy())
    );
    let state = load_backfill_state(connection, &source_key)?;
    if state.complete {
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let Some(index_path) = kimi_session_index_path() else {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    };
    if !index_path.is_file() {
        save_backfill_state(
            connection,
            &source_key,
            &BackfillState {
                cursor: state.cursor.clone(),
                complete: true,
            },
        )?;
        return Ok(BackfillBatchResult {
            upserted: 0,
            complete: true,
        });
    }
    let offset: usize = state.cursor.trim().parse().unwrap_or(0);
    let target = normalize_path_key(&workspace_path.to_string_lossy());
    let file = File::open(&index_path).map_err(|error| error.to_string())?;
    let mut matched = 0usize;
    let mut rows = Vec::new();
    let mut hit_batch_limit = false;
    for line in BufReader::new(file).lines() {
        let Ok(line) = line else {
            continue;
        };
        let Some(row) = parse_kimi_index_line(&line, &target) else {
            continue;
        };
        matched += 1;
        if matched <= offset {
            continue;
        }
        if rows.len() >= batch_size {
            hit_batch_limit = true;
            break;
        }
        rows.push(row);
    }
    let upserted = upsert_rows(connection, &rows)?;
    let covered = offset + rows.len();
    let complete = !hit_batch_limit;
    save_backfill_state(
        connection,
        &source_key,
        &BackfillState {
            cursor: covered.to_string(),
            complete,
        },
    )?;
    Ok(BackfillBatchResult { upserted, complete })
}

/// Sync Claude sessions for one workspace via project-dir mtime + history.jsonl titles.
pub(crate) fn sync_claude_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    limit: usize,
    force: bool,
) -> Result<WriterResult, String> {
    let limit = limit.clamp(1, 500);
    let claude_home = crate::claude_home::resolve_effective_claude_home(None)
        .ok_or_else(|| "claude home not found".to_string())?;
    let projects_dir = claude_home.join("projects");
    let encoded = encode_project_path(&workspace_path.to_string_lossy());
    let project_dir = projects_dir.join(&encoded);
    let history_path = claude_home.join("history.jsonl");

    let source_key = format!("claude:{}", normalize_path_key(&workspace_path.to_string_lossy()));
    let fingerprint = format!(
        "{}|{}",
        mtime_fingerprint(&project_dir),
        mtime_fingerprint(&history_path)
    );
    if !force && source_is_fresh(connection, &source_key, &fingerprint, SOURCE_FRESH_MAX_AGE_MS)? {
        return Ok(WriterResult {
            skipped_fresh: true,
            engines: vec!["claude".into()],
            ..WriterResult::default()
        });
    }

    let titles = read_claude_history_titles(&history_path, workspace_path);
    let mut rows = Vec::new();
    if project_dir.is_dir() {
        let mut files: Vec<PathBuf> = fs::read_dir(&project_dir)
            .map_err(|error| error.to_string())?
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("jsonl"))
            .collect();
        files.sort_by(|left, right| {
            file_mtime_ms(right)
                .cmp(&file_mtime_ms(left))
                .then_with(|| left.to_string_lossy().cmp(&right.to_string_lossy()))
        });
        files.truncate(limit.saturating_mul(2).max(limit));
        for path in files {
            let session_id = path
                .file_stem()
                .and_then(|name| name.to_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if session_id.is_empty() {
                continue;
            }
            let updated_at = file_mtime_ms(&path);
            let title_from_history = titles.get(&session_id).cloned();
            let title = title_from_history
                .clone()
                .or_else(|| peek_claude_first_user_preview(&path))
                .unwrap_or_else(|| "Claude Session".to_string());
            let size_bytes = fs::metadata(&path).ok().map(|metadata| metadata.len());
            let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
            rows.push(SessionIndexRow {
                engine: "claude".into(),
                session_id: session_id.clone(),
                title: title.clone(),
                native_title: title_from_history,
                updated_at,
                created_at: None,
                cwd: Some(workspace_key.clone()),
                workspace_path: Some(workspace_key),
                physical_path: Some(path.to_string_lossy().to_string()),
                parent_session_id: super::shared_visibility::extract_claude_parent_session_id(
                    &session_id,
                ),
                size_bytes,
            });
            if rows.len() >= limit {
                break;
            }
        }
    }

    let upserted = upsert_rows(connection, &rows)?;
    mark_source_synced(connection, &source_key, &fingerprint, rows.len())?;
    Ok(WriterResult {
        upserted,
        engines: vec!["claude".into()],
        partial_source: if project_dir.is_dir() {
            None
        } else {
            Some("claude-project-dir-missing".into())
        },
        skipped_fresh: false,
    })
}

fn read_claude_history_titles(
    history_path: &Path,
    workspace_path: &Path,
) -> HashMap<String, String> {
    let Ok(file) = File::open(history_path) else {
        return HashMap::new();
    };
    let target = normalize_path_key(&workspace_path.to_string_lossy());
    let mut titles: HashMap<String, (i64, String)> = HashMap::new();
    for line in BufReader::new(file).lines() {
        let Ok(line) = line else {
            continue;
        };
        if line.len() > 256_000 {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let project = value
            .get("project")
            .and_then(Value::as_str)
            .map(normalize_path_key)
            .unwrap_or_default();
        if project.is_empty() || project != target {
            // Tolerate trailing-slash / slash style differences only via normalize.
            continue;
        }
        let session_id = value
            .get("sessionId")
            .or_else(|| value.get("session_id"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let Some(session_id) = session_id else {
            continue;
        };
        let display = value
            .get("display")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let Some(display) = display else {
            continue;
        };
        let timestamp = value
            .get("timestamp")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        let entry = titles
            .entry(session_id.to_string())
            .or_insert((timestamp, display.to_string()));
        // Keep earliest user prompt as title (first message), but allow refresh if empty.
        if entry.1.is_empty() || (timestamp > 0 && timestamp < entry.0) {
            *entry = (timestamp, display.to_string());
        }
    }
    titles
        .into_iter()
        .map(|(session_id, (_ts, title))| (session_id, truncate_title(&title, 80)))
        .collect()
}

fn peek_claude_first_user_preview(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file).take(64 * 1024);
    for line in reader.lines().flatten().take(40) {
        if line.len() > 200_000 {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let role = value
            .get("type")
            .and_then(Value::as_str)
            .or_else(|| value.get("role").and_then(Value::as_str))
            .unwrap_or("");
        if role != "user" && role != "human" {
            // Claude JSONL often wraps messages; try nested message.role.
            let nested_role = value
                .pointer("/message/role")
                .and_then(Value::as_str)
                .unwrap_or("");
            if nested_role != "user" {
                continue;
            }
        }
        if let Some(text) = extract_text_preview(&value) {
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(truncate_title(trimmed, 80));
            }
        }
    }
    None
}

fn extract_text_preview(value: &Value) -> Option<String> {
    if let Some(text) = value.get("text").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    if let Some(text) = value.pointer("/message/content").and_then(|content| {
        if let Some(text) = content.as_str() {
            return Some(text.to_string());
        }
        if let Some(arr) = content.as_array() {
            let mut parts = Vec::new();
            for item in arr {
                if item.get("type").and_then(Value::as_str) == Some("text") {
                    if let Some(text) = item.get("text").and_then(Value::as_str) {
                        parts.push(text);
                    }
                }
            }
            if !parts.is_empty() {
                return Some(parts.join(" "));
            }
        }
        None
    }) {
        return Some(text);
    }
    value
        .get("display")
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn truncate_title(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let mut out = trimmed.chars().take(max_chars.saturating_sub(1)).collect::<String>();
    out.push('…');
    out
}

/// Sync Codex sessions for one workspace using bounded ThreadPreview scanner.
pub(crate) fn sync_codex_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    sessions_roots: &[PathBuf],
    limit: usize,
    force: bool,
) -> Result<WriterResult, String> {
    let limit = limit.clamp(1, 500);
    let source_key = format!("codex:{}", normalize_path_key(&workspace_path.to_string_lossy()));
    let fingerprint = sessions_roots
        .iter()
        .map(|root| mtime_fingerprint(root))
        .collect::<Vec<_>>()
        .join("|");
    // Also include session_index.jsonl when present under parent home.
    let mut fingerprint = fingerprint;
    for root in sessions_roots {
        if let Some(home) = root.parent() {
            let index = home.join("session_index.jsonl");
            fingerprint.push('|');
            fingerprint.push_str(&mtime_fingerprint(&index));
        }
    }
    if !force && source_is_fresh(connection, &source_key, &fingerprint, SOURCE_FRESH_MAX_AGE_MS)? {
        return Ok(WriterResult {
            skipped_fresh: true,
            engines: vec!["codex".into()],
            ..WriterResult::default()
        });
    }

    let (summaries, _scanned) = crate::local_usage::scan_codex_session_summaries_for_index(
        Some(workspace_path),
        sessions_roots,
        limit,
    )?;
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    let rows: Vec<SessionIndexRow> = summaries
        .into_iter()
        .map(|summary| {
            let title = summary
                .native_title
                .clone()
                .or(summary.summary.clone())
                .unwrap_or_else(|| "Codex Session".to_string());
            SessionIndexRow {
                engine: "codex".into(),
                session_id: summary.session_id,
                title: title.clone(),
                native_title: summary.native_title.or(summary.summary),
                updated_at: summary.timestamp,
                created_at: None,
                cwd: summary
                    .cwd
                    .as_deref()
                    .map(normalize_path_key)
                    .or_else(|| Some(workspace_key.clone())),
                workspace_path: Some(workspace_key.clone()),
                physical_path: summary.physical_path,
                parent_session_id: summary.parent_session_id,
                size_bytes: summary.file_size_bytes,
            }
        })
        .collect();
    let upserted = upsert_rows(connection, &rows)?;
    mark_source_synced(connection, &source_key, &fingerprint, rows.len())?;
    Ok(WriterResult {
        upserted,
        engines: vec!["codex".into()],
        partial_source: None,
        skipped_fresh: false,
    })
}

/// Sync Kimi via session_index.jsonl (light index).
pub(crate) fn sync_kimi_for_workspace(
    connection: &Connection,
    workspace_path: &Path,
    limit: usize,
    force: bool,
) -> Result<WriterResult, String> {
    let limit = limit.clamp(1, 500);
    let home = dirs::home_dir()
        .map(|home| home.join(".kimi"))
        .ok_or_else(|| "home not found".to_string())?;
    // Kimi may use custom home; best-effort default + env.
    let home = std::env::var("KIMI_HOME")
        .ok()
        .and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(PathBuf::from(trimmed))
            }
        })
        .unwrap_or(home);
    let index_path = home.join("session_index.jsonl");
    let source_key = format!("kimi:{}", normalize_path_key(&workspace_path.to_string_lossy()));
    let fingerprint = mtime_fingerprint(&index_path);
    if !force && source_is_fresh(connection, &source_key, &fingerprint, SOURCE_FRESH_MAX_AGE_MS)? {
        return Ok(WriterResult {
            skipped_fresh: true,
            engines: vec!["kimi".into()],
            ..WriterResult::default()
        });
    }
    if !index_path.is_file() {
        mark_source_synced(connection, &source_key, &fingerprint, 0)?;
        return Ok(WriterResult {
            engines: vec!["kimi".into()],
            partial_source: Some("kimi-index-missing".into()),
            ..WriterResult::default()
        });
    }
    let target = normalize_path_key(&workspace_path.to_string_lossy());
    let file = File::open(&index_path).map_err(|error| error.to_string())?;
    let mut rows = Vec::new();
    for line in BufReader::new(file).lines() {
        if rows.len() >= limit {
            break;
        }
        let Ok(line) = line else {
            continue;
        };
        if line.len() > 256_000 {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let work_dir = value
            .get("workDir")
            .or_else(|| value.get("work_dir"))
            .or_else(|| value.get("cwd"))
            .and_then(Value::as_str)
            .map(normalize_path_key)
            .unwrap_or_default();
        if work_dir.is_empty() || work_dir != target {
            continue;
        }
        let session_id = value
            .get("sessionId")
            .or_else(|| value.get("session_id"))
            .or_else(|| value.get("id"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let Some(session_id) = session_id else {
            continue;
        };
        let session_dir = value
            .get("sessionDir")
            .or_else(|| value.get("session_dir"))
            .and_then(Value::as_str)
            .map(PathBuf::from);
        let updated_at = session_dir
            .as_ref()
            .map(|path| file_mtime_ms(path))
            .filter(|value| *value > 0)
            .unwrap_or_else(|| now_ms_fallback());
        let title = value
            .get("title")
            .or_else(|| value.get("name"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| "Kimi Session".to_string());
        rows.push(SessionIndexRow {
            engine: "kimi".into(),
            session_id: session_id.to_string(),
            title,
            native_title: None,
            updated_at,
            created_at: None,
            cwd: Some(target.clone()),
            workspace_path: Some(target.clone()),
            physical_path: session_dir.map(|path| path.to_string_lossy().to_string()),
            parent_session_id: None,
            size_bytes: None,
        });
    }
    let upserted = upsert_rows(connection, &rows)?;
    mark_source_synced(connection, &source_key, &fingerprint, rows.len())?;
    Ok(WriterResult {
        upserted,
        engines: vec!["kimi".into()],
        partial_source: None,
        skipped_fresh: false,
    })
}

fn now_ms_fallback() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

/// Commit prebuilt rows for one engine (used by async Gemini/Grok/OpenCode writers).
pub(crate) fn commit_engine_rows(
    connection: &Connection,
    engine: &str,
    workspace_path: &Path,
    rows: Vec<SessionIndexRow>,
    fingerprint: &str,
    partial_source: Option<String>,
) -> Result<WriterResult, String> {
    let engine = engine.trim().to_ascii_lowercase();
    if engine.is_empty() {
        return Err("engine is required".to_string());
    }
    let source_key = format!(
        "{}:{}",
        engine,
        normalize_path_key(&workspace_path.to_string_lossy())
    );
    let is_partial = partial_source.is_some();
    if is_partial && rows.is_empty() {
        invalidate_source_freshness(connection, &source_key)?;
        return Ok(WriterResult {
            upserted: 0,
            engines: vec![engine],
            partial_source,
            skipped_fresh: false,
        });
    }
    let upserted = upsert_rows(connection, &rows)?;
    if is_partial {
        invalidate_source_freshness(connection, &source_key)?;
    } else {
        mark_source_synced(connection, &source_key, fingerprint, rows.len())?;
    }
    Ok(WriterResult {
        upserted,
        engines: vec![engine],
        partial_source,
        skipped_fresh: false,
    })
}

pub(crate) fn engine_source_is_fresh(
    connection: &Connection,
    engine: &str,
    workspace_path: &Path,
    fingerprint: &str,
) -> Result<bool, String> {
    let source_key = format!(
        "{}:{}",
        engine.trim().to_ascii_lowercase(),
        normalize_path_key(&workspace_path.to_string_lossy())
    );
    source_is_fresh(connection, &source_key, fingerprint, SOURCE_FRESH_MAX_AGE_MS)
}

pub(crate) fn gemini_home_fingerprint() -> String {
    let home = std::env::var("GEMINI_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".gemini")))
        .unwrap_or_else(|| PathBuf::from(".gemini"));
    mtime_fingerprint(&home)
}

pub(crate) fn pi_home_fingerprint() -> String {
    let sessions = crate::engine::pi_history::resolve_pi_sessions_root(None);
    let home = sessions
        .parent()
        .map(std::path::Path::to_path_buf)
        .unwrap_or_else(|| sessions.clone());
    let mut parts = vec![mtime_fingerprint(&home), mtime_fingerprint(&sessions)];
    // New jsonl lives in sessions/<encoded-cwd>/; parent mtime often stays
    // unchanged, so include each cwd-dir fingerprint.
    if let Ok(entries) = fs::read_dir(&sessions) {
        let mut child_prints = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = path
                .file_name()
                .map(|value| value.to_string_lossy().into_owned())
                .unwrap_or_default();
            if name.starts_with('.') {
                continue;
            }
            child_prints.push(format!("{name}:{}", mtime_fingerprint(&path)));
        }
        child_prints.sort();
        parts.extend(child_prints);
    }
    parts.join("|")
}

pub(crate) fn grok_home_fingerprint() -> String {
    let home = std::env::var("GROK_HOME")
        .ok()
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".grok")))
        .unwrap_or_else(|| PathBuf::from(".grok"));
    let sessions = home.join("sessions");
    format!(
        "{}|{}",
        mtime_fingerprint(&home),
        mtime_fingerprint(&sessions)
    )
}

pub(crate) fn opencode_source_fingerprint(workspace_path: &Path) -> String {
    // OpenCode has no durable local index file we control; use wall-clock bucket
    // so soft re-sync can refresh without force while still de-duping storms.
    let bucket = now_ms_fallback() / 15_000;
    format!(
        "opencode:{}:{}",
        normalize_path_key(&workspace_path.to_string_lossy()),
        bucket
    )
}

pub(crate) fn dsh_source_fingerprint(workspace_path: &Path) -> String {
    // DSH sessions live in the host process / $DSH_HOME. Home mtime catches
    // durable writes; a short wall-clock bucket still re-probes live host
    // sessions created without immediate disk churn (same idea as OpenCode).
    let home = std::env::var_os("DSH_HOME")
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".dsh")))
        .unwrap_or_else(|| PathBuf::from(".dsh"));
    let bucket = now_ms_fallback() / 15_000;
    format!(
        "dsh:{}:{}:{}",
        normalize_path_key(&workspace_path.to_string_lossy()),
        mtime_fingerprint(&home),
        bucket
    )
}

pub(crate) fn rows_from_gemini_summaries(
    workspace_path: &Path,
    sessions: &[crate::engine::gemini_history::GeminiSessionSummary],
) -> Vec<SessionIndexRow> {
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    sessions
        .iter()
        .map(|session| {
            let title = {
                let trimmed = session.first_message.trim();
                if trimmed.is_empty() {
                    "Gemini Session".to_string()
                } else {
                    truncate_title(trimmed, 80)
                }
            };
            SessionIndexRow {
                engine: "gemini".into(),
                session_id: session.session_id.clone(),
                title,
                native_title: None,
                updated_at: session.updated_at,
                created_at: Some(session.created_at).filter(|value| *value > 0),
                cwd: Some(workspace_key.clone()),
                workspace_path: Some(workspace_key.clone()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: session.file_size_bytes,
            }
        })
        .collect()
}

pub(crate) fn rows_from_pi_summaries(
    workspace_path: &Path,
    sessions: &[crate::engine::pi_history::PiSessionSummary],
) -> Vec<SessionIndexRow> {
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    sessions
        .iter()
        .map(|session| {
            let title = {
                let trimmed = session.first_message.trim();
                if trimmed.is_empty() {
                    "PI Session".to_string()
                } else {
                    truncate_title(trimmed, 80)
                }
            };
            SessionIndexRow {
                engine: "pi".into(),
                session_id: session.session_id.clone(),
                title,
                native_title: None,
                updated_at: session.updated_at,
                created_at: Some(session.created_at).filter(|value| *value > 0),
                cwd: Some(workspace_key.clone()),
                workspace_path: Some(workspace_key.clone()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: session.file_size_bytes,
            }
        })
        .collect()
}

pub(crate) fn rows_from_dsh_summaries(
    workspace_path: &Path,
    sessions: &[crate::engine::dsh::history::DshSessionSummary],
) -> Vec<SessionIndexRow> {
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    sessions
        .iter()
        .map(|session| {
            let title = {
                let trimmed = session.first_message.trim();
                if trimmed.is_empty() {
                    "DeepSeek Harness Session".to_string()
                } else {
                    truncate_title(trimmed, 80)
                }
            };
            SessionIndexRow {
                engine: "dsh".into(),
                session_id: session.session_id.clone(),
                title,
                native_title: None,
                updated_at: session.updated_at,
                created_at: Some(session.created_at).filter(|value| *value > 0),
                cwd: Some(workspace_key.clone()),
                workspace_path: Some(workspace_key.clone()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: None,
            }
        })
        .collect()
}

pub(crate) fn rows_from_grok_summaries(
    workspace_path: &Path,
    sessions: &[crate::engine::grok_history::GrokSessionSummary],
) -> Vec<SessionIndexRow> {
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    sessions
        .iter()
        .map(|session| {
            let title = {
                let trimmed = session.first_message.trim();
                if trimmed.is_empty() {
                    "Grok Session".to_string()
                } else {
                    truncate_title(trimmed, 80)
                }
            };
            SessionIndexRow {
                engine: "grok".into(),
                session_id: session.session_id.clone(),
                title,
                native_title: None,
                updated_at: session.updated_at,
                created_at: Some(session.created_at).filter(|value| *value > 0),
                cwd: Some(workspace_key.clone()),
                workspace_path: Some(workspace_key.clone()),
                physical_path: None,
                parent_session_id: session.parent_session_id.clone(),
                size_bytes: session.file_size_bytes,
            }
        })
        .collect()
}

pub(crate) fn rows_from_opencode_entries(
    workspace_path: &Path,
    entries: &[crate::engine::OpenCodeSessionEntry],
) -> Vec<SessionIndexRow> {
    let workspace_key = normalize_path_key(&workspace_path.to_string_lossy());
    entries
        .iter()
        .map(|entry| {
            let title = {
                let trimmed = entry.title.trim();
                if trimmed.is_empty() {
                    "OpenCode Session".to_string()
                } else {
                    truncate_title(trimmed, 80)
                }
            };
            let cwd = entry
                .directory
                .as_deref()
                .map(normalize_path_key)
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| workspace_key.clone());
            SessionIndexRow {
                engine: "opencode".into(),
                session_id: entry.session_id.clone(),
                title,
                native_title: None,
                updated_at: entry.updated_at.unwrap_or_else(now_ms_fallback),
                created_at: None,
                cwd: Some(cwd.clone()),
                workspace_path: Some(workspace_key.clone()),
                physical_path: None,
                parent_session_id: None,
                size_bytes: None,
            }
        })
        .collect()
}

/// Soft-invalidate all sources for a workspace so the next sync rescans.
pub(crate) fn invalidate_workspace_sources(
    connection: &Connection,
    workspace_path: &Path,
) -> Result<usize, String> {
    let key = normalize_path_key(&workspace_path.to_string_lossy());
    if key.is_empty() {
        return Ok(0);
    }
    let pattern = format!("%:{}", key);
    let changed = connection
        .execute(
            "UPDATE session_index_sources
             SET last_sync_ms = 0
             WHERE source_key LIKE ?1 OR source_key LIKE ?2",
            rusqlite::params![pattern, format!("%{}", key)],
        )
        .map_err(|error| error.to_string())?;
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::store::mark_source_synced;

    #[test]
    fn rows_from_pi_summaries_prefix_engine_and_title() {
        let rows = rows_from_pi_summaries(
            Path::new("/Users/chenxiangning/code/AI/reach/ai-reach"),
            &[crate::engine::pi_history::PiSessionSummary {
                session_id: "019ffb7b-dedc-7b36-8d2f-f85f35501036".into(),
                first_message: "你在干什么".into(),
                updated_at: 10,
                created_at: 9,
                message_count: 2,
                file_size_bytes: Some(128),
                engine: Some("pi".into()),
                canonical_session_id: None,
                attribution_status: None,
            }],
        );
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].engine, "pi");
        assert_eq!(rows[0].session_id, "019ffb7b-dedc-7b36-8d2f-f85f35501036");
        assert_eq!(rows[0].title, "你在干什么");
        assert_eq!(rows[0].size_bytes, Some(128));
    }

    #[test]
    fn rows_from_dsh_summaries_prefix_engine_and_title() {
        let rows = rows_from_dsh_summaries(
            Path::new("/Users/zhukunpeng/Desktop/CC GUI 项目/desktop-cc-gui"),
            &[crate::engine::dsh::history::DshSessionSummary {
                session_id: "session-aba863d5-ef07-4a41-94a6-4dc7c2226d3d".into(),
                first_message: "无法查看DSH历史记录".into(),
                updated_at: 1_786_896_696_172,
                created_at: 1_786_896_696_172,
                message_count: 0,
                engine: Some("dsh".into()),
                canonical_session_id: Some(
                    "session-aba863d5-ef07-4a41-94a6-4dc7c2226d3d".into(),
                ),
            }],
        );
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].engine, "dsh");
        assert_eq!(
            rows[0].session_id,
            "session-aba863d5-ef07-4a41-94a6-4dc7c2226d3d"
        );
        assert_eq!(rows[0].title, "无法查看DSH历史记录");
        assert!(rows[0]
            .workspace_path
            .as_deref()
            .is_some_and(|path| path.contains("desktop-cc-gui")));
    }

    #[test]
    fn pi_fingerprint_changes_when_cwd_subdir_gets_new_jsonl() {
        let dir = std::env::temp_dir().join(format!(
            "pi-fp-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let sessions = dir.join("sessions");
        let cwd = sessions.join("--tmp-ws--");
        std::fs::create_dir_all(&cwd).expect("mkdir");
        std::fs::write(cwd.join("a.jsonl"), "x").expect("write a");
        let previous = std::env::var("PI_CODING_AGENT_DIR").ok();
        std::env::set_var("PI_CODING_AGENT_DIR", &dir);
        let first = pi_home_fingerprint();
        std::thread::sleep(std::time::Duration::from_millis(30));
        std::fs::write(cwd.join("b.jsonl"), "y").expect("write b");
        let second = pi_home_fingerprint();
        match previous {
            Some(value) => std::env::set_var("PI_CODING_AGENT_DIR", value),
            None => std::env::remove_var("PI_CODING_AGENT_DIR"),
        }
        let _ = std::fs::remove_dir_all(&dir);
        assert_ne!(first, second, "cwd jsonl must change PI fingerprint");
    }

    #[test]
    fn incremental_sync_helper_treats_missing_mismatch_and_invalidate() {
        let connection = Connection::open_in_memory().expect("db");
        connection
            .execute_batch(
                "CREATE TABLE session_index_sources (
                   source_key TEXT PRIMARY KEY,
                   fingerprint TEXT NOT NULL,
                   last_sync_ms INTEGER NOT NULL,
                   row_count INTEGER NOT NULL DEFAULT 0
                 );",
            )
            .expect("ddl");
        let workspace = Path::new("/tmp/ccgui-pi-stale-ws");
        assert!(!engine_source_is_fresh(&connection, "pi", workspace, "fp-a").expect("missing"));
        mark_source_synced(&connection, "pi:/tmp/ccgui-pi-stale-ws", "fp-a", 1).expect("mark");
        assert!(engine_source_is_fresh(&connection, "pi", workspace, "fp-a").expect("match"));
        assert!(!engine_source_is_fresh(&connection, "pi", workspace, "fp-b").expect("mismatch"));
        connection
            .execute(
                "UPDATE session_index_sources SET last_sync_ms = 0 WHERE source_key = ?1",
                ["pi:/tmp/ccgui-pi-stale-ws"],
            )
            .expect("invalidate");
        assert!(
            !engine_source_is_fresh(&connection, "pi", workspace, "fp-a").expect("invalidated")
        );
    }

    #[test]
    fn commit_engine_rows_timeout_does_not_wipe_or_mark_fresh() {
        let connection = Connection::open_in_memory().expect("db");
        connection
            .execute_batch(super::super::store::DDL)
            .expect("ddl");
        let workspace = Path::new(r"C:\Users\me\proj");
        let existing = SessionIndexRow {
            engine: "grok".into(),
            session_id: "grok-keep".into(),
            title: "keep".into(),
            native_title: None,
            updated_at: 200,
            created_at: None,
            cwd: Some(r"C:\Users\me\proj".into()),
            workspace_path: Some(r"C:\Users\me\proj".into()),
            physical_path: None,
            parent_session_id: None,
            size_bytes: None,
        };
        upsert_rows(&connection, &[existing]).expect("seed");
        mark_source_synced(
            &connection,
            "grok:c:/users/me/proj",
            "fp-ok",
            1,
        )
        .expect("mark");
        assert!(engine_source_is_fresh(&connection, "grok", workspace, "fp-ok").expect("fresh"));

        let result = commit_engine_rows(
            &connection,
            "grok",
            workspace,
            Vec::new(),
            "fp-ok",
            Some("grok-sync-timeout".into()),
        )
        .expect("timeout commit");
        assert_eq!(result.upserted, 0);
        assert_eq!(result.partial_source.as_deref(), Some("grok-sync-timeout"));
        assert!(
            !engine_source_is_fresh(&connection, "grok", workspace, "fp-ok")
                .expect("must not stay fresh")
        );
        let listed = super::super::store::list_for_workspace_path(
            &connection,
            r"C:\Users\me\proj",
            10,
        )
        .expect("list");
        assert!(
            listed.iter().any(|row| row.session_id == "grok-keep"),
            "timeout empty commit must not wipe indexed grok rows: {listed:?}"
        );
    }
}
