use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use tauri::State;
use tokio::task;

use crate::claude_home::{normalize_home_path, resolve_effective_claude_home};
use crate::codex::home::{resolve_default_codex_home, resolve_workspace_codex_home};
use crate::engine::EngineType;
use crate::state::AppState;
use crate::types::WorkspaceEntry;

const COMMAND_SOURCE_WORKSPACE_MANAGED: &str = "workspace_managed";
const COMMAND_SOURCE_PROJECT_CLAUDE: &str = "project_claude";
const COMMAND_SOURCE_PROJECT_CODEX: &str = "project_codex";
const COMMAND_SOURCE_PROJECT_AGENTS: &str = "project_agents";
const COMMAND_SOURCE_GLOBAL_CLAUDE: &str = "global_claude";
const COMMAND_SOURCE_GLOBAL_CODEX: &str = "global_codex";
const COMMAND_SOURCE_GLOBAL_AGENTS: &str = "global_agents";

#[derive(Serialize, Clone)]
pub(crate) struct ClaudeCommandEntry {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) source: String,
    pub(crate) description: Option<String>,
    #[serde(rename = "argumentHint")]
    pub(crate) argument_hint: Option<String>,
    pub(crate) content: String,
}

async fn resolve_claude_home_dir(state: &AppState) -> Option<PathBuf> {
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Claude)
        .await;
    resolve_effective_claude_home(config.as_ref())
}

fn resolve_default_agents_home() -> Option<PathBuf> {
    if let Ok(value) = std::env::var("AGENTS_HOME") {
        if let Some(path) = normalize_home_path(&value) {
            return Some(path);
        }
    }
    dirs::home_dir().map(|home| home.join(".agents"))
}

fn resolve_workspace_path(entry: &WorkspaceEntry) -> Option<PathBuf> {
    let trimmed = entry.path.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}

fn workspace_commands_dir(state: &AppState, entry: &WorkspaceEntry) -> Option<PathBuf> {
    let data_dir = state.settings_path.parent()?;
    Some(data_dir.join("workspaces").join(&entry.id).join("commands"))
}

fn resolve_codex_home_for_workspace(
    workspaces: &HashMap<String, WorkspaceEntry>,
    entry: &WorkspaceEntry,
) -> Option<PathBuf> {
    let parent_entry = entry
        .parent_id
        .as_ref()
        .and_then(|parent_id| workspaces.get(parent_id));
    resolve_workspace_codex_home(entry, parent_entry).or_else(resolve_default_codex_home)
}

fn collect_commands_dirs(root: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let primary = root.join("commands");
    if primary.exists() {
        dirs.push(primary);
    }
    let fallback = root.join("Commands");
    if fallback.exists() {
        dirs.push(fallback);
    }
    dirs
}

/// 与 `collect_commands_dirs` 同源的候选目录（不做存在性过滤）。
/// `discover_commands_in` 对不存在目录返回空列表，因此 list 语义不变；
/// watcher 需要完整候选集以便在目录被创建后补挂监听。
fn candidate_commands_dirs(root: &Path) -> Vec<PathBuf> {
    vec![root.join("commands"), root.join("Commands")]
}

fn normalize_command_name(name: &str) -> String {
    name.trim().to_ascii_lowercase()
}

fn sanitize_meta_value(value: &str) -> Option<String> {
    let mut val = value.trim().to_string();
    if val.len() >= 2 {
        let bytes = val.as_bytes();
        let first = bytes[0];
        let last = bytes[bytes.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            val = val[1..val.len().saturating_sub(1)].to_string();
        }
    }
    let trimmed = val.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn parse_meta_line(
    line: &str,
    name: &mut Option<String>,
    description: &mut Option<String>,
    argument_hint: &mut Option<String>,
) {
    let Some((key, value)) = line.split_once(':') else {
        return;
    };
    let key = key.trim().to_ascii_lowercase();
    let value = sanitize_meta_value(value);
    match key.as_str() {
        "name" => {
            if let Some(value) = value {
                *name = Some(value);
            }
        }
        "description" => {
            if let Some(value) = value {
                *description = Some(value);
            }
        }
        "argument-hint" | "argument_hint" | "argumenthint" => {
            if let Some(value) = value {
                *argument_hint = Some(value);
            }
        }
        _ => {}
    }
}

fn parse_command_frontmatter(
    content: &str,
) -> (Option<String>, Option<String>, Option<String>, String) {
    let mut segments = content.split_inclusive('\n');
    let Some(first_segment) = segments.next() else {
        return (None, None, None, String::new());
    };
    let first_line = first_segment.trim_end_matches(['\r', '\n']);

    let mut name: Option<String> = None;
    let mut description: Option<String> = None;
    let mut argument_hint: Option<String> = None;
    let mut consumed = 0;
    let mut frontmatter_closed = false;

    if first_line.trim() == "---" {
        consumed += first_segment.len();
        for segment in segments {
            let line = segment.trim_end_matches(['\r', '\n']);
            let trimmed = line.trim();
            if trimmed == "---" {
                frontmatter_closed = true;
                consumed += segment.len();
                break;
            }
            if trimmed.is_empty() || trimmed.starts_with('#') {
                consumed += segment.len();
                continue;
            }
            parse_meta_line(trimmed, &mut name, &mut description, &mut argument_hint);
            consumed += segment.len();
        }
        if !frontmatter_closed {
            return (None, None, None, content.to_string());
        }
    } else {
        if !first_line.contains(':') {
            return (None, None, None, content.to_string());
        }
        parse_meta_line(first_line, &mut name, &mut description, &mut argument_hint);
        consumed += first_segment.len();
        for segment in segments {
            let line = segment.trim_end_matches(['\r', '\n']);
            let trimmed = line.trim();
            if trimmed == "---" {
                frontmatter_closed = true;
                consumed += segment.len();
                break;
            }
            if trimmed.is_empty() || trimmed.starts_with('#') {
                consumed += segment.len();
                continue;
            }
            parse_meta_line(trimmed, &mut name, &mut description, &mut argument_hint);
            consumed += segment.len();
        }
        if !frontmatter_closed {
            return (None, None, None, content.to_string());
        }
    }

    let body = if consumed >= content.len() {
        String::new()
    } else {
        content[consumed..].to_string()
    };

    (name, description, argument_hint, body)
}

fn derive_command_name(path: &Path, root: &Path) -> Option<String> {
    let relative = path.strip_prefix(root).ok()?;
    let mut parts: Vec<String> = relative
        .components()
        .filter_map(|component| {
            component
                .as_os_str()
                .to_str()
                .map(|value| value.to_string())
        })
        .collect();
    if parts.is_empty() {
        return None;
    }
    let file_name = parts.pop()?;
    let stem = Path::new(&file_name)
        .file_stem()
        .and_then(|value| value.to_str())?;
    if stem.eq_ignore_ascii_case("readme") {
        return None;
    }
    parts.push(stem.to_string());
    Some(parts.join(":"))
}

fn discover_commands_in(dir: &Path, root: &Path, source: &str) -> Vec<ClaudeCommandEntry> {
    let mut out: Vec<ClaudeCommandEntry> = Vec::new();
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return out,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let is_dir = fs::metadata(&path).map(|m| m.is_dir()).unwrap_or(false);
        if is_dir {
            out.extend(discover_commands_in(&path, root, source));
            continue;
        }
        let is_md = path
            .extension()
            .and_then(|s| s.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("md"))
            .unwrap_or(false);
        if !is_md {
            continue;
        }
        if let Some(stem) = path.file_stem().and_then(|value| value.to_str()) {
            if stem.eq_ignore_ascii_case("readme") {
                continue;
            }
        }
        let content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(_) => continue,
        };
        let (name, description, argument_hint, body) = parse_command_frontmatter(&content);
        let resolved_name = name.or_else(|| derive_command_name(&path, root));
        let Some(resolved_name) = resolved_name else {
            continue;
        };
        let normalized = resolved_name.trim().trim_start_matches('/').to_string();
        if normalized.is_empty() {
            continue;
        }
        out.push(ClaudeCommandEntry {
            name: normalized,
            path: path.to_string_lossy().to_string(),
            source: source.to_string(),
            description,
            argument_hint,
            content: body,
        });
    }

    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

fn merge_commands_by_priority(sources: Vec<Vec<ClaudeCommandEntry>>) -> Vec<ClaudeCommandEntry> {
    let mut merged: Vec<ClaudeCommandEntry> = Vec::new();
    let mut seen_names: HashSet<String> = HashSet::new();

    for source in sources {
        for command in source {
            let normalized_name = normalize_command_name(&command.name);
            if seen_names.contains(&normalized_name) {
                continue;
            }
            seen_names.insert(normalized_name);
            merged.push(command);
        }
    }

    merged.sort_by(|a, b| a.name.cmp(&b.name));
    merged
}

/// 解析指定 workspace 作用域下的全部命令目录候选及其来源标签。
///
/// 与 `claude_commands_list` 的聚合优先级一一对应，供 list 命令与
/// `claude_commands_watch` 共享，保证 watcher 监听的目录集合与
/// list 实际扫描的目录集合一致。
pub(crate) async fn resolve_commands_dirs(
    state: &AppState,
    workspace_id: Option<&str>,
) -> Vec<(PathBuf, &'static str)> {
    let (workspace_path, workspace_managed_dir, codex_home_dir_for_workspace) =
        if let Some(workspace_id) = workspace_id {
            let workspaces = state.workspaces.lock().await;
            match workspaces.get(workspace_id) {
                Some(entry) => (
                    resolve_workspace_path(entry),
                    workspace_commands_dir(state, entry),
                    resolve_codex_home_for_workspace(&workspaces, entry),
                ),
                None => {
                    log::warn!(
                        "resolve_commands_dirs received unknown workspace id: {}",
                        workspace_id
                    );
                    (None, None, None)
                }
            }
        } else {
            (None, None, None)
        };

    let mut dirs: Vec<(PathBuf, &'static str)> = Vec::new();

    if let Some(dir) = workspace_managed_dir {
        dirs.push((dir, COMMAND_SOURCE_WORKSPACE_MANAGED));
    }

    if let Some(workspace_path) = workspace_path.as_ref() {
        for dir in candidate_commands_dirs(&workspace_path.join(".claude")) {
            dirs.push((dir, COMMAND_SOURCE_PROJECT_CLAUDE));
        }
        for dir in candidate_commands_dirs(&workspace_path.join(".codex")) {
            dirs.push((dir, COMMAND_SOURCE_PROJECT_CODEX));
        }
        for dir in candidate_commands_dirs(&workspace_path.join(".agents")) {
            dirs.push((dir, COMMAND_SOURCE_PROJECT_AGENTS));
        }
    }

    if let Some(home) = resolve_claude_home_dir(state).await {
        for dir in candidate_commands_dirs(&home) {
            dirs.push((dir, COMMAND_SOURCE_GLOBAL_CLAUDE));
        }
    }
    let codex_home = codex_home_dir_for_workspace.or_else(resolve_default_codex_home);
    if let Some(home) = codex_home {
        for dir in candidate_commands_dirs(&home) {
            dirs.push((dir, COMMAND_SOURCE_GLOBAL_CODEX));
        }
    }
    if let Some(home) = resolve_default_agents_home() {
        for dir in candidate_commands_dirs(&home) {
            dirs.push((dir, COMMAND_SOURCE_GLOBAL_AGENTS));
        }
    }

    dirs
}

#[tauri::command]
pub(crate) async fn claude_commands_list(
    state: State<'_, AppState>,
    workspace_id: Option<String>,
) -> Result<Vec<ClaudeCommandEntry>, String> {
    let dirs = resolve_commands_dirs(&state, workspace_id.as_deref()).await;

    task::spawn_blocking(move || {
        let mut sources: Vec<Vec<ClaudeCommandEntry>> = Vec::with_capacity(dirs.len());
        for (dir, source) in dirs {
            if !dir.exists() {
                continue;
            }
            sources.push(discover_commands_in(&dir, &dir, source));
        }
        Ok(merge_commands_by_priority(sources))
    })
    .await
    .map_err(|_| "command discovery failed".to_string())?
}

/// 校验并归一化自定义命令名：小写字母/数字开头，仅含 `[a-z0-9-_]`。
/// 拒绝路径分隔符与 `..`，保证写入目标恒为 managed 目录内单层文件。
fn normalize_new_command_name(raw: &str) -> Result<String, String> {
    let normalized = raw.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Err("command name is required".to_string());
    }
    let valid = normalized
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_')
        && normalized
            .chars()
            .next()
            .is_some_and(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit());
    if !valid {
        return Err(format!(
            "invalid command name `{raw}`: use lowercase letters, digits, `-` or `_`"
        ));
    }
    Ok(normalized)
}

/// 在 managed 目录写入 `<name>.md`；重名拒绝（不静默覆盖）。
fn write_managed_command(
    dir: &Path,
    name: &str,
    content: &str,
) -> Result<ClaudeCommandEntry, String> {
    let path = dir.join(format!("{name}.md"));
    fs::create_dir_all(dir).map_err(|error| format!("create commands dir failed: {error}"))?;
    let mut file = match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
    {
        Ok(file) => file,
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            return Err(format!("command `{name}` already exists"));
        }
        Err(error) => return Err(format!("create command failed: {error}")),
    };
    if let Err(error) = file.write_all(content.as_bytes()) {
        drop(file);
        let _ = fs::remove_file(&path);
        return Err(format!("write command failed: {error}"));
    }
    Ok(ClaudeCommandEntry {
        name: name.to_string(),
        path: path.to_string_lossy().to_string(),
        source: COMMAND_SOURCE_WORKSPACE_MANAGED.to_string(),
        description: None,
        argument_hint: None,
        content: content.to_string(),
    })
}

/// 对话沉淀（save-as-prompt）落盘入口：写入 workspace managed commands 目录。
/// 该目录在 `claude_commands_list` 聚合中优先级最高，且被
/// `claude_commands_watch` 监听——保存后前端经事件自动可见。
#[tauri::command]
pub(crate) async fn claude_command_create(
    workspace_id: String,
    name: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<ClaudeCommandEntry, String> {
    let normalized_name = normalize_new_command_name(&name)?;
    if content.trim().is_empty() {
        return Err("command content is required".to_string());
    }
    let managed_dir = {
        let workspaces = state.workspaces.lock().await;
        let entry = workspaces
            .get(&workspace_id)
            .ok_or_else(|| format!("unknown workspace id: {workspace_id}"))?;
        workspace_commands_dir(&state, entry)
            .ok_or_else(|| "workspace commands dir unavailable".to_string())?
    };
    task::spawn_blocking(move || write_managed_command(&managed_dir, &normalized_name, &content))
        .await
        .map_err(|_| "command create failed".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn new_temp_dir(prefix: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time is before unix epoch")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("ccgui-{prefix}-{nonce}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn command(name: &str, source: &str) -> ClaudeCommandEntry {
        ClaudeCommandEntry {
            name: name.to_string(),
            path: format!("/{source}/{name}.md"),
            source: source.to_string(),
            description: None,
            argument_hint: None,
            content: String::new(),
        }
    }

    #[test]
    fn write_managed_command_creates_markdown_file() {
        let dir = new_temp_dir("command-create");
        let entry = write_managed_command(&dir, "commit-msg", "按规范写提交信息\n")
            .expect("write should succeed");

        assert_eq!(entry.name, "commit-msg");
        assert_eq!(entry.source, COMMAND_SOURCE_WORKSPACE_MANAGED);
        assert_eq!(entry.content, "按规范写提交信息\n");
        let written = fs::read_to_string(dir.join("commit-msg.md")).expect("read written file");
        assert_eq!(written, "按规范写提交信息\n");
    }

    #[test]
    fn write_managed_command_rejects_duplicate_without_overwrite() {
        let dir = new_temp_dir("command-create-dup");
        write_managed_command(&dir, "review", "第一版").expect("first write");
        let error = match write_managed_command(&dir, "review", "第二版") {
            Ok(_) => panic!("duplicate must be rejected"),
            Err(error) => error,
        };

        assert!(error.contains("already exists"));
        let written = fs::read_to_string(dir.join("review.md")).expect("read written file");
        assert_eq!(written, "第一版");
    }

    #[test]
    fn concurrent_command_create_never_overwrites_the_winner() {
        use std::sync::{Arc, Barrier};

        let dir = Arc::new(new_temp_dir("command-create-concurrent"));
        let barrier = Arc::new(Barrier::new(2));
        let mut workers = Vec::new();
        for content in ["第一版", "第二版"] {
            let dir = Arc::clone(&dir);
            let barrier = Arc::clone(&barrier);
            workers.push(std::thread::spawn(move || {
                barrier.wait();
                write_managed_command(&dir, "review", content)
            }));
        }

        let results: Vec<_> = workers
            .into_iter()
            .map(|worker| worker.join().expect("worker should not panic"))
            .collect();
        assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
        assert_eq!(results.iter().filter(|result| result.is_err()).count(), 1);
        assert!(results
            .iter()
            .filter_map(|result| result.as_ref().err())
            .all(|error| error.contains("already exists")));

        let written = fs::read_to_string(dir.join("review.md")).expect("read winner");
        assert!(written == "第一版" || written == "第二版");
    }

    #[test]
    fn normalize_new_command_name_rejects_invalid_and_normalizes_case() {
        assert_eq!(
            normalize_new_command_name(" Commit-Msg ").as_deref(),
            Ok("commit-msg")
        );
        for raw in ["", "  ", "a/b", "..", "-lead", "_lead", "name.md", "名字"] {
            assert!(
                normalize_new_command_name(raw).is_err(),
                "expected rejection for `{raw}`"
            );
        }
    }

    #[test]
    fn merge_commands_prefers_workspace_and_project_sources_over_global() {
        let merged = merge_commands_by_priority(vec![
            vec![command("shared", COMMAND_SOURCE_WORKSPACE_MANAGED)],
            vec![command("shared", COMMAND_SOURCE_PROJECT_CLAUDE)],
            vec![command("shared", COMMAND_SOURCE_PROJECT_CODEX)],
            vec![command("shared", COMMAND_SOURCE_PROJECT_AGENTS)],
            vec![command("shared", COMMAND_SOURCE_GLOBAL_CLAUDE)],
            vec![command("shared", COMMAND_SOURCE_GLOBAL_CODEX)],
            vec![command("shared", COMMAND_SOURCE_GLOBAL_AGENTS)],
        ]);

        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].name, "shared");
        assert_eq!(merged[0].source, COMMAND_SOURCE_WORKSPACE_MANAGED);
    }

    #[test]
    fn merge_commands_normalizes_name_for_deduplication() {
        let merged = merge_commands_by_priority(vec![
            vec![command("Open-Spec:Apply", COMMAND_SOURCE_PROJECT_CLAUDE)],
            vec![command("open-spec:apply", COMMAND_SOURCE_GLOBAL_CLAUDE)],
        ]);

        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].source, COMMAND_SOURCE_PROJECT_CLAUDE);
    }

    #[test]
    fn collect_commands_dirs_supports_commands_and_commands_caps() {
        let root = new_temp_dir("command-dir-scan");
        let lower = root.join("commands");
        let upper = root.join("Commands");
        fs::create_dir_all(&lower).expect("create lower");
        fs::create_dir_all(&upper).expect("create upper");

        let dirs = collect_commands_dirs(&root);
        assert_eq!(dirs.len(), 2);
        assert!(dirs.contains(&lower));
        assert!(dirs.contains(&upper));

        let _ = fs::remove_dir_all(root);
    }
}
