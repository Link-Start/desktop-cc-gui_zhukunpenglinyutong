use chrono::Utc;
use std::collections::HashSet;
use std::ffi::OsStr;
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::app_paths;
use super::types::*;

pub(crate) fn with_file_lock<T>(op: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    let _guard = FILE_LOCK
        .lock()
        .map_err(|error| format!("note card file lock poisoned: {error}"))?;
    op()
}

pub(crate) fn storage_dir() -> Result<PathBuf, String> {
    app_paths::note_card_dir()
}

pub(crate) fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

pub(crate) fn normalize_note_source(
    source: Option<WorkspaceNoteCardSource>,
) -> Result<Option<WorkspaceNoteCardSource>, String> {
    let Some(source) = source else {
        return Ok(None);
    };
    let normalized = match source {
        WorkspaceNoteCardSource::CodeSelection {
            path,
            start_line,
            end_line,
            language,
        } => {
            let path = path.trim().to_string();
            if path.is_empty() {
                return Err("note source path is required".to_string());
            }
            if start_line == 0 || end_line < start_line {
                return Err("note source line range is invalid".to_string());
            }
            WorkspaceNoteCardSource::CodeSelection {
                path,
                start_line,
                end_line,
                language: language.and_then(|value| {
                    let trimmed = value.trim().to_string();
                    (!trimmed.is_empty()).then_some(trimmed)
                }),
            }
        }
        WorkspaceNoteCardSource::ConversationSelection {
            thread_id,
            item_ids,
        } => {
            let thread_id = thread_id.trim().to_string();
            if thread_id.is_empty() {
                return Err("note source thread id is required".to_string());
            }
            let mut seen = HashSet::new();
            let item_ids = item_ids
                .into_iter()
                .map(|item_id| item_id.trim().to_string())
                .filter(|item_id| !item_id.is_empty())
                .filter(|item_id| seen.insert(item_id.clone()))
                .take(MAX_NOTE_SOURCE_ITEM_IDS)
                .collect::<Vec<_>>();
            if item_ids.is_empty() {
                return Err("note source item ids are required".to_string());
            }
            WorkspaceNoteCardSource::ConversationSelection {
                thread_id,
                item_ids,
            }
        }
        WorkspaceNoteCardSource::ConversationThread {
            thread_id,
            item_count,
            captured_at,
        } => {
            let thread_id = thread_id.trim().to_string();
            if thread_id.is_empty() {
                return Err("note source thread id is required".to_string());
            }
            if item_count == 0 || captured_at <= 0 {
                return Err("note source conversation metadata is invalid".to_string());
            }
            WorkspaceNoteCardSource::ConversationThread {
                thread_id,
                item_count,
                captured_at,
            }
        }
    };
    Ok(Some(normalized))
}

pub(crate) fn derive_project_name(
    workspace_id: Option<&str>,
    workspace_name: Option<&str>,
    workspace_path: Option<&str>,
) -> String {
    let from_path = workspace_path
        .and_then(|value| Path::new(value).file_name())
        .and_then(OsStr::to_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let candidate = from_path
        .or_else(|| {
            workspace_name
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .or_else(|| {
            workspace_id
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or("workspace");
    let sanitized = candidate
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else if matches!(character, '-' | '_' | ' ') {
                '-'
            } else {
                '-'
            }
        })
        .collect::<String>();
    let collapsed = sanitized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if collapsed.is_empty() {
        "workspace".to_string()
    } else {
        collapsed
    }
}

pub(crate) fn project_dir_path(
    base: &Path,
    workspace_id: Option<&str>,
    workspace_name: Option<&str>,
    workspace_path: Option<&str>,
) -> PathBuf {
    base.join(derive_project_name(
        workspace_id,
        workspace_name,
        workspace_path,
    ))
}

pub(crate) fn active_collection_dir(project_dir: &Path) -> PathBuf {
    project_dir.join("active")
}

pub(crate) fn archive_collection_dir(project_dir: &Path) -> PathBuf {
    project_dir.join("archive")
}

pub(crate) fn assets_root_dir(project_dir: &Path) -> PathBuf {
    project_dir.join("assets")
}

pub(crate) fn note_asset_dir(project_dir: &Path, note_id: &str) -> PathBuf {
    assets_root_dir(project_dir).join(note_id)
}

pub(crate) fn note_file_path(project_dir: &Path, note_id: &str, archived: bool) -> PathBuf {
    let collection_dir = if archived {
        archive_collection_dir(project_dir)
    } else {
        active_collection_dir(project_dir)
    };
    collection_dir.join(format!("{note_id}.json"))
}

pub(crate) fn ensure_project_dirs(project_dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(active_collection_dir(project_dir))
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(archive_collection_dir(project_dir))
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(assets_root_dir(project_dir)).map_err(|error| error.to_string())?;
    Ok(())
}

pub(crate) fn write_string_atomically(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("Storage path has no parent: {}", path.display()))?;
    let filename = path
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| format!("Storage path has invalid filename: {}", path.display()))?;
    let temp_path = parent.join(format!(".{filename}.{}.tmp", uuid::Uuid::new_v4()));
    let mut temp_file = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temp_path)
        .map_err(|error| error.to_string())?;
    temp_file
        .write_all(content.as_bytes())
        .map_err(|error| error.to_string())?;
    temp_file.sync_all().map_err(|error| error.to_string())?;

    #[cfg(target_os = "windows")]
    if path.exists() {
        std::fs::remove_file(path).map_err(|error| error.to_string())?;
    }

    if let Err(error) = std::fs::rename(&temp_path, path) {
        let _ = std::fs::remove_file(&temp_path);
        return Err(error.to_string());
    }
    Ok(())
}

pub(crate) fn write_note_card(path: &Path, note: &WorkspaceNoteCard) -> Result<(), String> {
    let payload = serde_json::to_string_pretty(note).map_err(|error| error.to_string())?;
    write_string_atomically(path, &payload)
}

pub(crate) fn read_note_card(
    path: &Path,
    project_dir: &Path,
    archived: bool,
) -> Result<WorkspaceNoteCard, String> {
    let raw = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut note: WorkspaceNoteCard =
        serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    note.attachments = note
        .attachments
        .into_iter()
        .map(|attachment| {
            super::attachments::hydrate_attachment_path(project_dir, &note.id, attachment)
        })
        .collect();
    if archived && note.archived_at.is_none() {
        note.archived_at = Some(note.updated_at);
    }
    Ok(note)
}
