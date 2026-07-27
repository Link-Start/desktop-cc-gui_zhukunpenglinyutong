use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, State};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::app_paths;
use crate::codex;
use crate::engine::{self, EngineType};
use crate::shared::codex_core;
use crate::state::AppState;

const SHARED_SESSIONS_DIRNAME: &str = "shared-sessions";
const SHARED_STORE_LOCK_WAIT_TIMEOUT: Duration = Duration::from_secs(5);
const SHARED_STORE_LOCK_RETRY_INTERVAL: Duration = Duration::from_millis(25);
const SHARED_STORE_LOCK_STALE_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_DELTA_SYNC_TURNS: usize = 8;
const MAX_DELTA_SYNC_CHARS: usize = 4_000;

fn codex_turn_developer_instructions(settings: &crate::types::AppSettings) -> Option<String> {
    crate::backend::app_server_cli::codex_generated_developer_instructions_for_turn(settings)
}

fn is_supported_shared_session_engine(engine: EngineType) -> bool {
    matches!(engine, EngineType::Claude | EngineType::Codex)
}

fn normalize_shared_session_engine(engine: EngineType) -> EngineType {
    if is_supported_shared_session_engine(engine) {
        engine
    } else {
        EngineType::Claude
    }
}

pub(crate) fn ensure_supported_shared_session_engine(engine: EngineType) -> Result<EngineType, String> {
    if is_supported_shared_session_engine(engine) {
        Ok(engine)
    } else {
        Err(format!(
            "Unsupported shared session engine: {}",
            engine.icon()
        ))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct SharedEngineBinding {
    engine: EngineType,
    native_thread_id: String,
    created_at: u64,
    last_used_at: u64,
    last_synced_turn_seq: u64,
}

/// Target 级 Binding（Wave 4 / B.2）：Binding Key = Engine + ProviderProfile。
/// `provider_profile_id = None` 表示 default/local Provider 语义（旧 V0 binding 的归位点）。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SharedTargetBindingMeta {
    pub(crate) binding_key: String,
    pub(crate) engine: EngineType,
    pub(crate) provider_profile_id: Option<String>,
    pub(crate) native_thread_id: String,
    pub(crate) created_at: u64,
    pub(crate) last_used_at: u64,
    pub(crate) last_synced_turn_seq: u64,
    /// ready / missing-provider / missing-runtime / degraded / recovery-required。
    #[serde(default = "default_target_binding_availability")]
    pub(crate) availability: String,
}

fn default_target_binding_availability() -> String {
    "ready".to_string()
}

/// 当前选中的 Execution Target（Wave 4 / B.2 任务 2.3）。
/// `provider_profile_id = None` 表示 default/local Provider 语义。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SharedSelectedTarget {
    pub(crate) engine: EngineType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) provider_profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SharedSessionMeta {
    pub(crate) id: String,
    pub(crate) workspace_id: String,
    pub(crate) title: String,
    pub(crate) created_at: u64,
    pub(crate) updated_at: u64,
    /// V0 字段：保留写（= `selected_target.engine`），供回滚与旧版本读取。
    selected_engine: EngineType,
    /// Wave 4 起持久化；旧 meta 缺失时由 sanitize 从 `selected_engine` 迁移。
    #[serde(default)]
    pub(crate) selected_target: Option<SharedSelectedTarget>,
    pub(crate) last_turn_seq: u64,
    pub(crate) bindings_by_engine: HashMap<EngineType, SharedEngineBinding>,
    /// Wave 4 起持久化；旧 meta 缺失时由 sanitize 从 `bindings_by_engine` 迁移。
    #[serde(default)]
    pub(crate) bindings_by_target: HashMap<String, SharedTargetBindingMeta>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SharedSessionSnapshotEntry {
    kind: String,
    created_at: u64,
    selected_engine: EngineType,
    last_turn_seq: u64,
    items: Vec<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SharedSessionSummary {
    id: String,
    thread_id: String,
    title: String,
    updated_at: u64,
    selected_engine: EngineType,
    thread_kind: String,
    engine_source: EngineType,
    selected_engine_label: String,
    native_thread_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SharedSessionLoadPayload {
    id: String,
    thread_id: String,
    title: String,
    selected_engine: EngineType,
    thread_kind: String,
    engine_source: EngineType,
    items: Vec<Value>,
    updated_at: u64,
}

struct SharedStoreFileLock {
    path: PathBuf,
}

impl Drop for SharedStoreFileLock {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn shared_store_lock_file_path(path: &Path) -> PathBuf {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!("{value}.lock"))
        .unwrap_or_else(|| "lock".to_string());
    path.with_extension(extension)
}

fn is_shared_store_lock_stale(lock_path: &Path) -> bool {
    let metadata = match std::fs::metadata(lock_path) {
        Ok(metadata) => metadata,
        Err(_) => return false,
    };
    let modified_at = match metadata.modified() {
        Ok(modified_at) => modified_at,
        Err(_) => return false,
    };
    match modified_at.elapsed() {
        Ok(elapsed) => elapsed > SHARED_STORE_LOCK_STALE_TIMEOUT,
        Err(_) => false,
    }
}

fn acquire_shared_store_lock(path: &Path) -> Result<SharedStoreFileLock, String> {
    let lock_path = shared_store_lock_file_path(path);
    if let Some(parent) = lock_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let deadline = Instant::now() + SHARED_STORE_LOCK_WAIT_TIMEOUT;
    loop {
        match std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&lock_path)
        {
            Ok(mut file) => {
                let _ = writeln!(file, "pid={}", std::process::id());
                return Ok(SharedStoreFileLock { path: lock_path });
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                if is_shared_store_lock_stale(&lock_path) {
                    let _ = std::fs::remove_file(&lock_path);
                    continue;
                }
                if Instant::now() >= deadline {
                    return Err(format!(
                        "Timed out waiting for shared session file lock: {}",
                        lock_path.display()
                    ));
                }
                thread::sleep(SHARED_STORE_LOCK_RETRY_INTERVAL);
            }
            Err(error) => return Err(error.to_string()),
        }
    }
}

fn with_shared_store_lock<T>(
    path: &Path,
    op: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    let _lock_guard = acquire_shared_store_lock(path)?;
    op()
}

fn write_string_atomically(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("Shared session path has no parent: {}", path.display()))?;
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            format!(
                "Shared session path has invalid filename: {}",
                path.display()
            )
        })?;
    let temp_path = parent.join(format!(".{filename}.{}.tmp", Uuid::new_v4()));
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

pub(crate) fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| Duration::from_millis(0))
        .as_millis() as u64
}

fn shared_sessions_root_dir() -> Result<PathBuf, String> {
    Ok(app_paths::app_home_dir()?.join(SHARED_SESSIONS_DIRNAME))
}

fn workspace_shared_sessions_dir(workspace_id: &str) -> Result<PathBuf, String> {
    Ok(shared_sessions_root_dir()?.join(workspace_id))
}

fn shared_session_dir(workspace_id: &str, shared_session_id: &str) -> Result<PathBuf, String> {
    Ok(workspace_shared_sessions_dir(workspace_id)?.join(shared_session_id))
}

fn shared_session_meta_path(
    workspace_id: &str,
    shared_session_id: &str,
) -> Result<PathBuf, String> {
    Ok(shared_session_dir(workspace_id, shared_session_id)?.join("meta.json"))
}

fn shared_session_log_path(workspace_id: &str, shared_session_id: &str) -> Result<PathBuf, String> {
    Ok(shared_session_dir(workspace_id, shared_session_id)?.join("log.jsonl"))
}

pub(crate) fn shared_session_projection_source(
    workspace_id: &str,
    thread_id: &str,
) -> Result<(String, PathBuf), String> {
    let shared_session_id = parse_shared_session_id(thread_id)?;
    let log_path = shared_session_log_path(workspace_id, &shared_session_id)?;
    Ok((shared_session_id, log_path))
}

fn shared_thread_id(shared_session_id: &str) -> String {
    format!("shared:{shared_session_id}")
}

fn is_safe_shared_session_storage_id(value: &str) -> bool {
    !value.is_empty()
        && value != "."
        && value != ".."
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
}

pub(crate) fn parse_shared_session_id(thread_id: &str) -> Result<String, String> {
    let normalized = thread_id.trim();
    if let Some(rest) = normalized.strip_prefix("shared:") {
        let shared_session_id = rest.trim();
        if is_safe_shared_session_storage_id(shared_session_id) {
            return Ok(shared_session_id.to_string());
        }
    }
    Err(format!("Invalid shared session thread id: {thread_id}"))
}

fn validate_shared_native_thread_id(value: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        Err("Shared session native thread id cannot be empty".to_string())
    } else {
        Ok(normalized.to_string())
    }
}

fn is_pending_shared_binding_thread_id(engine: EngineType, thread_id: &str) -> bool {
    let normalized = thread_id.trim();
    if normalized.is_empty() {
        return true;
    }
    match engine {
        EngineType::Claude => normalized.starts_with("claude-pending-shared-"),
        // Codex native thread IDs are often UUID-shaped strings. Treat only explicit
        // shared placeholders as pending; otherwise every send would create a new
        // native Codex thread and lose shared-context continuity.
        EngineType::Codex => normalized.starts_with("codex-pending-shared-"),
        EngineType::Gemini | EngineType::OpenCode | EngineType::Kimi => false,
    }
}

fn binding_uses_established_native_thread(engine: EngineType, thread_id: &str) -> bool {
    let normalized = thread_id.trim();
    if normalized.is_empty() || is_pending_shared_binding_thread_id(engine, normalized) {
        return false;
    }
    match engine {
        EngineType::Codex => true,
        EngineType::Claude => normalized.contains(':'),
        EngineType::Gemini | EngineType::OpenCode | EngineType::Kimi => false,
    }
}

pub(crate) fn engine_binding_thread_id(engine: EngineType, seed: &str) -> String {
    match engine {
        EngineType::Claude => format!("claude-pending-shared-{seed}"),
        EngineType::Codex => format!("codex-pending-shared-{seed}"),
        EngineType::Gemini | EngineType::OpenCode | EngineType::Kimi => {
            format!("claude-pending-shared-{seed}")
        }
    }
}

/// Binding Key = Engine + ProviderProfile（Model 不进 Key）。
/// 与前端 `bindingKeyOf` 保持一致：`{engine}:{provider|"default"}`。
pub(crate) fn shared_target_binding_key(engine: EngineType, provider_profile_id: Option<&str>) -> String {
    let provider = provider_profile_id.map(str::trim).filter(|value| !value.is_empty());
    format!(
        "{}:{}",
        engine.icon(),
        provider.unwrap_or("default")
    )
}

fn sanitize_shared_session_meta(meta: &mut SharedSessionMeta) {
    // 任务 2.3：`selectedEngine → selectedTarget` 迁移；selectedTarget 为权威，
    // selected_engine 回落为 target.engine（V0 回滚读取兼容）。
    let selected_target = match meta.selected_target.take() {
        Some(mut target) => {
            if !is_supported_shared_session_engine(target.engine) {
                target.engine = normalize_shared_session_engine(target.engine);
                target.provider_profile_id = None;
            }
            target.provider_profile_id = target
                .provider_profile_id
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());
            target
        }
        None => SharedSelectedTarget {
            engine: normalize_shared_session_engine(meta.selected_engine),
            provider_profile_id: None,
        },
    };
    meta.selected_engine = selected_target.engine;
    meta.selected_target = Some(selected_target);
    meta.bindings_by_engine
        .retain(|engine, _| is_supported_shared_session_engine(*engine));
    for (engine, binding) in meta.bindings_by_engine.iter_mut() {
        binding.engine = *engine;
    }    // B.2 迁移：旧 `bindings_by_engine` 归位到 default-provider 语义。
    // V0 仍是 default binding 身份字段的权威来源（回滚兼容），
    // 因此 default key 的身份字段以 engine binding 为准做覆盖式同步；
    // managed-provider 条目（provider_profile_id != None）不受此影响。
    meta.bindings_by_target
        .retain(|key, binding| key == &binding.binding_key && is_supported_shared_session_engine(binding.engine));
    for (engine, binding) in meta.bindings_by_engine.iter() {
        let key = shared_target_binding_key(*engine, None);
        match meta.bindings_by_target.get_mut(&key) {
            Some(target) => {
                target.engine = *engine;
                target.provider_profile_id = None;
                target.native_thread_id = binding.native_thread_id.clone();
                target.created_at = binding.created_at;
                target.last_used_at = binding.last_used_at;
                target.last_synced_turn_seq = binding.last_synced_turn_seq;
            }
            None => {
                meta.bindings_by_target.insert(
                    key.clone(),
                    SharedTargetBindingMeta {
                        binding_key: key,
                        engine: *engine,
                        provider_profile_id: None,
                        native_thread_id: binding.native_thread_id.clone(),
                        created_at: binding.created_at,
                        last_used_at: binding.last_used_at,
                        last_synced_turn_seq: binding.last_synced_turn_seq,
                        availability: default_target_binding_availability(),
                    },
                );
            }
        }
    }
    // default binding 在 engine map 中已不存在时，target map 也不应残留（例如 sanitize 剔除不支持 engine）。
    let live_default_keys: std::collections::HashSet<String> = meta
        .bindings_by_engine
        .keys()
        .map(|engine| shared_target_binding_key(*engine, None))
        .collect();
    meta.bindings_by_target.retain(|key, binding| {
        binding.provider_profile_id.is_some() || live_default_keys.contains(key)
    });
}

/// 更新选中 Target（同时写 V0 `selected_engine` 保持回滚兼容）。
pub(crate) fn select_meta_target(
    meta: &mut SharedSessionMeta,
    engine: EngineType,
    provider_profile_id: Option<String>,
) {
    let provider_profile_id = provider_profile_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    meta.selected_engine = engine;
    meta.selected_target = Some(SharedSelectedTarget {
        engine,
        provider_profile_id,
    });
}

async fn ensure_shared_session_native_binding(
    workspace_id: &str,
    meta: &mut SharedSessionMeta,
    engine: EngineType,
    provider_profile_id: Option<String>,
    last_turn_seq: u64,
    state: &AppState,
    app: &AppHandle,
) -> Result<String, String> {
    let now = now_millis();
    let provider_profile_id = provider_profile_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let binding_key = shared_target_binding_key(engine, provider_profile_id.as_deref());
    let (current_native_thread_id, needs_codex_thread) = {
        let native_thread_id = if provider_profile_id.is_some() {
            let binding = meta
                .bindings_by_target
                .entry(binding_key.clone())
                .or_insert_with(|| SharedTargetBindingMeta {
                    binding_key: binding_key.clone(),
                    engine,
                    provider_profile_id: provider_profile_id.clone(),
                    native_thread_id: engine_binding_thread_id(
                        engine,
                        &Uuid::new_v4().to_string(),
                    ),
                    created_at: now,
                    last_used_at: now,
                    // New target binding should replay canonical shared history on first send.
                    last_synced_turn_seq: 0,
                    availability: default_target_binding_availability(),
                });
            binding.last_used_at = now;
            binding.native_thread_id.clone()
        } else {
            let binding =
                meta.bindings_by_engine
                    .entry(engine)
                    .or_insert_with(|| SharedEngineBinding {
                        engine,
                        native_thread_id: engine_binding_thread_id(
                            engine,
                            &Uuid::new_v4().to_string(),
                        ),
                        created_at: now,
                        last_used_at: now,
                        // New engine binding should replay canonical shared history on first send.
                        last_synced_turn_seq: 0,
                    });
            binding.last_used_at = now;
            binding.native_thread_id.clone()
        };
        let needs_codex_thread = engine == EngineType::Codex
            && !binding_uses_established_native_thread(engine, &native_thread_id);
        (native_thread_id, needs_codex_thread)
    };

    if !needs_codex_thread {
        return Ok(current_native_thread_id);
    }

    let started = codex::start_thread_with_runtime_retry_for_provider(
        workspace_id,
        None,
        provider_profile_id.clone(),
        state,
        app,
    )
    .await?;
    let result = started
        .get("result")
        .cloned()
        .unwrap_or_else(|| started.clone());
    let next_native_thread_id = result
        .get("thread")
        .and_then(|value| value.get("id"))
        .and_then(Value::as_str)
        .or_else(|| result.get("threadId").and_then(Value::as_str))
        .unwrap_or_default()
        .trim()
        .to_string();
    if next_native_thread_id.is_empty() {
        return Err("Failed to create Codex binding thread".to_string());
    }

    if provider_profile_id.is_some() {
        if let Some(binding) = meta.bindings_by_target.get_mut(&binding_key) {
            binding.native_thread_id = next_native_thread_id.clone();
            binding.created_at = now;
            binding.last_used_at = now;
            binding.last_synced_turn_seq = last_turn_seq;
        }
    } else if let Some(binding) = meta.bindings_by_engine.get_mut(&engine) {
        binding.native_thread_id = next_native_thread_id.clone();
        binding.created_at = now;
        binding.last_used_at = now;
        binding.last_synced_turn_seq = last_turn_seq;
    }

    Ok(next_native_thread_id)
}

/// 读取 binding 的已同步 turn seq（provider None → engine map 权威；Some → target map）。
fn shared_binding_synced_turn_seq(
    meta: &mut SharedSessionMeta,
    engine: EngineType,
    provider_profile_id: Option<&str>,
    now: u64,
) -> u64 {
    if provider_profile_id.is_some() {
        let key = shared_target_binding_key(engine, provider_profile_id);
        let binding = meta
            .bindings_by_target
            .entry(key.clone())
            .or_insert_with(|| SharedTargetBindingMeta {
                binding_key: key,
                engine,
                provider_profile_id: provider_profile_id.map(str::to_string),
                native_thread_id: engine_binding_thread_id(engine, &Uuid::new_v4().to_string()),
                created_at: now,
                last_used_at: now,
                last_synced_turn_seq: 0,
                availability: default_target_binding_availability(),
            });
        binding.last_synced_turn_seq
    } else {
        let binding = meta
            .bindings_by_engine
            .entry(engine)
            .or_insert_with(|| SharedEngineBinding {
                engine,
                native_thread_id: engine_binding_thread_id(engine, &Uuid::new_v4().to_string()),
                created_at: now,
                last_used_at: now,
                last_synced_turn_seq: 0,
            });
        binding.last_synced_turn_seq
    }
}

/// 发送前后触碰 binding（更新 last_used_at；可选推进 last_synced_turn_seq）。
fn touch_shared_binding(
    meta: &mut SharedSessionMeta,
    engine: EngineType,
    provider_profile_id: Option<&str>,
    now: u64,
    synced_turn_seq: Option<u64>,
) {
    if provider_profile_id.is_some() {
        let key = shared_target_binding_key(engine, provider_profile_id);
        if let Some(binding) = meta.bindings_by_target.get_mut(&key) {
            binding.last_used_at = now;
            if let Some(synced) = synced_turn_seq {
                binding.last_synced_turn_seq = synced;
            }
        }
    } else if let Some(binding) = meta.bindings_by_engine.get_mut(&engine) {
        binding.last_used_at = now;
        if let Some(synced) = synced_turn_seq {
            binding.last_synced_turn_seq = synced;
        }
    }
}

pub(crate) fn read_shared_session_meta(
    workspace_id: &str,
    shared_session_id: &str,
) -> Result<SharedSessionMeta, String> {
    let path = shared_session_meta_path(workspace_id, shared_session_id)?;
    let raw = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let mut meta: SharedSessionMeta =
        serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    sanitize_shared_session_meta(&mut meta);
    Ok(meta)
}

pub(crate) fn write_shared_session_meta(meta: &SharedSessionMeta) -> Result<(), String> {
    let path = shared_session_meta_path(&meta.workspace_id, &meta.id)?;
    with_shared_store_lock(&path, || {
        let mut sanitized = meta.clone();
        sanitize_shared_session_meta(&mut sanitized);
        let raw = serde_json::to_string_pretty(&sanitized).map_err(|error| error.to_string())?;
        write_string_atomically(&path, &raw)
    })
}

fn append_shared_session_log_entry(
    workspace_id: &str,
    shared_session_id: &str,
    entry: &SharedSessionSnapshotEntry,
) -> Result<(), String> {
    let path = shared_session_log_path(workspace_id, shared_session_id)?;
    with_shared_store_lock(&path, || {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let serialized = serde_json::to_string(entry).map_err(|error| error.to_string())?;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|error| error.to_string())?;
        writeln!(file, "{serialized}").map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        Ok(())
    })
}

fn read_latest_shared_session_snapshot(
    workspace_id: &str,
    shared_session_id: &str,
) -> Result<Option<SharedSessionSnapshotEntry>, String> {
    let path = shared_session_log_path(workspace_id, shared_session_id)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = std::fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let latest = content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<SharedSessionSnapshotEntry>(line).ok())
        .last();
    Ok(latest)
}

fn list_workspace_shared_sessions(workspace_id: &str) -> Result<Vec<SharedSessionSummary>, String> {
    let directory = workspace_shared_sessions_dir(workspace_id)?;
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let mut summaries = Vec::new();
    for entry in std::fs::read_dir(&directory).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if !file_type.is_dir() {
            continue;
        }
        let shared_session_id = entry.file_name().to_string_lossy().to_string();
        let meta = match read_shared_session_meta(workspace_id, &shared_session_id) {
            Ok(meta) => meta,
            Err(_) => continue,
        };
        let native_thread_ids = meta
            .bindings_by_engine
            .values()
            .map(|binding| binding.native_thread_id.clone())
            .collect::<Vec<_>>();
        summaries.push(SharedSessionSummary {
            id: meta.id.clone(),
            thread_id: shared_thread_id(&meta.id),
            title: meta.title.clone(),
            updated_at: meta.updated_at,
            selected_engine: meta.selected_engine,
            thread_kind: "shared".to_string(),
            engine_source: meta.selected_engine,
            selected_engine_label: meta.selected_engine.display_name().to_string(),
            native_thread_ids,
        });
    }
    summaries.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(summaries)
}

fn extract_first_user_title(items: &[Value]) -> Option<String> {
    for item in items {
        let role = item
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        if role != "user" {
            continue;
        }
        let text = item
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim();
        if text.is_empty() {
            continue;
        }
        let normalized = text.lines().next().unwrap_or(text).trim();
        if normalized.is_empty() {
            continue;
        }
        let title = if normalized.chars().count() > 32 {
            format!("{}...", normalized.chars().take(32).collect::<String>())
        } else {
            normalized.to_string()
        };
        return Some(title);
    }
    None
}

fn count_user_turns(items: &[Value]) -> u64 {
    items
        .iter()
        .filter(|item| {
            item.get("kind").and_then(Value::as_str) == Some("message")
                && item.get("role").and_then(Value::as_str) == Some("user")
        })
        .count() as u64
}

fn build_delta_sync_prefix(items: &[Value], from_turn_seq: u64) -> Option<String> {
    if items.is_empty() {
        return None;
    }
    let mut turn_index = 0_u64;
    let mut current_user: Option<String> = None;
    let mut collected: Vec<String> = Vec::new();

    for item in items {
        let kind = item.get("kind").and_then(Value::as_str).unwrap_or_default();
        if kind != "message" {
            continue;
        }
        let role = item.get("role").and_then(Value::as_str).unwrap_or_default();
        let text = item
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .replace('\n', " ");
        if role == "user" {
            turn_index += 1;
            current_user = if text.is_empty() { None } else { Some(text) };
            continue;
        }
        if role == "assistant" && turn_index > from_turn_seq {
            let engine = item
                .get("engineSource")
                .and_then(Value::as_str)
                .unwrap_or("assistant")
                .trim()
                .to_string();
            if !text.is_empty() {
                if let Some(user_text) = current_user.take() {
                    collected.push(format!(
                        "Turn {turn_index}\nUser: {user_text}\n{engine}: {text}"
                    ));
                    if collected.len() >= MAX_DELTA_SYNC_TURNS {
                        break;
                    }
                }
            }
        }
    }

    if collected.is_empty() {
        return None;
    }

    let mut merged = String::from(
        "Shared session context sync. Continue from these recent turns before answering the new request:\n\n",
    );
    for block in collected {
        if merged.len() + block.len() + 2 > MAX_DELTA_SYNC_CHARS {
            break;
        }
        merged.push_str(&block);
        merged.push_str("\n\n");
    }
    Some(merged.trim_end().to_string())
}

async fn resolve_workspace_path(
    workspaces: &Mutex<HashMap<String, crate::types::WorkspaceEntry>>,
    workspace_id: &str,
) -> Result<PathBuf, String> {
    let workspaces = workspaces.lock().await;
    let entry = workspaces
        .get(workspace_id)
        .ok_or_else(|| format!("workspace not found: {workspace_id}"))?;
    Ok(PathBuf::from(&entry.path))
}

async fn ensure_known_workspace(
    workspaces: &Mutex<HashMap<String, crate::types::WorkspaceEntry>>,
    workspace_id: &str,
) -> Result<(), String> {
    let workspaces = workspaces.lock().await;
    if workspaces.contains_key(workspace_id) {
        Ok(())
    } else {
        Err(format!("workspace not found: {workspace_id}"))
    }
}

fn load_meta_and_snapshot(
    workspace_id: &str,
    shared_session_id: &str,
) -> Result<(SharedSessionMeta, Option<SharedSessionSnapshotEntry>), String> {
    Ok((
        read_shared_session_meta(workspace_id, shared_session_id)?,
        read_latest_shared_session_snapshot(workspace_id, shared_session_id)?,
    ))
}

#[tauri::command]
pub async fn start_shared_session(
    workspace_id: String,
    selected_engine: Option<EngineType>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    ensure_known_workspace(&state.workspaces, &workspace_id).await?;

    let selected_engine = selected_engine
        .map(ensure_supported_shared_session_engine)
        .transpose()?
        .unwrap_or(EngineType::Claude);
    let now = now_millis();
    let shared_session_id = Uuid::new_v4().to_string();
    let meta = SharedSessionMeta {
        id: shared_session_id.clone(),
        workspace_id: workspace_id.clone(),
        title: "Shared Session".to_string(),
        created_at: now,
        updated_at: now,
        selected_engine,
        selected_target: Some(SharedSelectedTarget {
            engine: selected_engine,
            provider_profile_id: None,
        }),
        last_turn_seq: 0,
        bindings_by_engine: HashMap::new(),
        bindings_by_target: HashMap::new(),
    };
    let session_dir = shared_session_dir(&workspace_id, &shared_session_id)?;
    std::fs::create_dir_all(&session_dir).map_err(|error| error.to_string())?;
    write_shared_session_meta(&meta)?;

    Ok(json!({
        "result": {
            "thread": {
                "id": shared_thread_id(&shared_session_id),
                "name": meta.title,
                "updatedAt": meta.updated_at,
                "threadKind": "shared",
                "engineSource": meta.selected_engine,
                "selectedEngine": meta.selected_engine,
                "nativeThreadIds": Vec::<String>::new(),
            }
        }
    }))
}

#[tauri::command]
pub async fn list_shared_sessions(
    workspace_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    ensure_known_workspace(&state.workspaces, &workspace_id).await?;
    Ok(json!(list_workspace_shared_sessions(&workspace_id)?))
}

#[tauri::command]
pub async fn load_shared_session(
    workspace_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    ensure_known_workspace(&state.workspaces, &workspace_id).await?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let (meta, snapshot) = load_meta_and_snapshot(&workspace_id, &shared_session_id)?;
    let payload = SharedSessionLoadPayload {
        id: meta.id.clone(),
        thread_id: shared_thread_id(&meta.id),
        title: meta.title.clone(),
        selected_engine: meta.selected_engine,
        thread_kind: "shared".to_string(),
        engine_source: meta.selected_engine,
        items: snapshot
            .as_ref()
            .map(|entry| entry.items.clone())
            .unwrap_or_default(),
        updated_at: meta.updated_at,
    };
    Ok(json!(payload))
}

#[tauri::command]
pub async fn set_shared_session_selected_engine(
    workspace_id: String,
    thread_id: String,
    selected_engine: EngineType,
    provider_profile_id: Option<String>,
    state: State<'_, AppState>,
    _app: AppHandle,
) -> Result<Value, String> {
    ensure_known_workspace(&state.workspaces, &workspace_id).await?;
    let selected_engine = ensure_supported_shared_session_engine(selected_engine)?;
    let provider_profile_id = provider_profile_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let mut meta = read_shared_session_meta(&workspace_id, &shared_session_id)?;
    let now = now_millis();
    let native_thread_id = match provider_profile_id.as_deref() {
        // V2：managed provider 走 target binding（Selector update 不建联 runtime）。
        Some(provider) => {
            let binding_key =
                shared_target_binding_key(selected_engine, Some(provider));
            let entry = meta
                .bindings_by_target
                .entry(binding_key.clone())
                .or_insert_with(|| SharedTargetBindingMeta {
                    binding_key,
                    engine: selected_engine,
                    provider_profile_id: Some(provider.to_string()),
                    native_thread_id: engine_binding_thread_id(
                        selected_engine,
                        &Uuid::new_v4().to_string(),
                    ),
                    created_at: now,
                    last_used_at: now,
                    last_synced_turn_seq: 0,
                    availability: default_target_binding_availability(),
                });
            entry.last_used_at = now;
            entry.native_thread_id.clone()
        }
        None => {
            let native_thread_id = meta
                .bindings_by_engine
                .entry(selected_engine)
                .or_insert_with(|| SharedEngineBinding {
                    engine: selected_engine,
                    native_thread_id: engine_binding_thread_id(
                        selected_engine,
                        &Uuid::new_v4().to_string(),
                    ),
                    created_at: now,
                    last_used_at: now,
                    // Selector update should not create a live native session.
                    last_synced_turn_seq: 0,
                })
                .native_thread_id
                .clone();
            if let Some(binding) = meta.bindings_by_engine.get_mut(&selected_engine) {
                binding.last_used_at = now;
            }
            native_thread_id
        }
    };
    select_meta_target(&mut meta, selected_engine, provider_profile_id);
    meta.updated_at = now;
    write_shared_session_meta(&meta)?;
    Ok(json!({
        "threadId": shared_thread_id(&meta.id),
        "selectedEngine": meta.selected_engine,
        "engineSource": meta.selected_engine,
        "threadKind": "shared",
        "nativeThreadId": native_thread_id,
    }))
}

#[tauri::command]
pub async fn update_shared_session_native_binding(
    workspace_id: String,
    thread_id: String,
    engine: EngineType,
    old_native_thread_id: Option<String>,
    new_native_thread_id: String,
    provider_profile_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    ensure_known_workspace(&state.workspaces, &workspace_id).await?;
    let engine = ensure_supported_shared_session_engine(engine)?;
    let provider_profile_id = provider_profile_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let new_native_thread_id = validate_shared_native_thread_id(&new_native_thread_id)?;
    let mut meta = read_shared_session_meta(&workspace_id, &shared_session_id)?;
    if let Some(provider) = provider_profile_id.as_deref() {
        // B.5：managed provider 走 Target 级 binding；rebind 时保留 created_at，
        // 仅更新 native_thread_id / last_used_at。
        let binding_key = shared_target_binding_key(engine, Some(provider));
        let now = now_millis();
        let entry = meta
            .bindings_by_target
            .entry(binding_key.clone())
            .or_insert_with(|| SharedTargetBindingMeta {
                binding_key,
                engine,
                provider_profile_id: Some(provider.to_string()),
                native_thread_id: new_native_thread_id.clone(),
                created_at: now,
                last_used_at: now,
                last_synced_turn_seq: meta.last_turn_seq,
                availability: default_target_binding_availability(),
            });
        let matches_old = old_native_thread_id
            .as_ref()
            .map(|value| value.trim() == entry.native_thread_id.trim())
            .unwrap_or(true);
        if matches_old {
            entry.native_thread_id = new_native_thread_id.clone();
            entry.last_used_at = now;
        }
        meta.updated_at = now_millis();
        write_shared_session_meta(&meta)?;
        return Ok(json!({
            "threadId": shared_thread_id(&meta.id),
            "engine": engine,
            "providerProfileId": provider,
            "nativeThreadId": new_native_thread_id,
        }));
    }
    let entry = meta
        .bindings_by_engine
        .entry(engine)
        .or_insert_with(|| SharedEngineBinding {
            engine,
            native_thread_id: new_native_thread_id.clone(),
            created_at: now_millis(),
            last_used_at: now_millis(),
            last_synced_turn_seq: meta.last_turn_seq,
        });
    let matches_old = old_native_thread_id
        .as_ref()
        .map(|value| value.trim() == entry.native_thread_id.trim())
        .unwrap_or(true);
    if matches_old {
        entry.native_thread_id = new_native_thread_id.clone();
        entry.last_used_at = now_millis();
    }
    meta.updated_at = now_millis();
    write_shared_session_meta(&meta)?;
    Ok(json!({
        "threadId": shared_thread_id(&meta.id),
        "engine": engine,
        "nativeThreadId": new_native_thread_id,
    }))
}

#[tauri::command]
pub async fn sync_shared_session_snapshot(
    workspace_id: String,
    thread_id: String,
    items: Vec<Value>,
    selected_engine: EngineType,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    ensure_known_workspace(&state.workspaces, &workspace_id).await?;
    let selected_engine = ensure_supported_shared_session_engine(selected_engine)?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let mut meta = read_shared_session_meta(&workspace_id, &shared_session_id)?;
    select_meta_target(&mut meta, selected_engine, None);
    meta.updated_at = now_millis();
    meta.last_turn_seq = count_user_turns(&items);
    if let Some(title) = extract_first_user_title(&items) {
        meta.title = title;
    }
    write_shared_session_meta(&meta)?;
    let entry = SharedSessionSnapshotEntry {
        kind: "snapshot".to_string(),
        created_at: meta.updated_at,
        selected_engine,
        last_turn_seq: meta.last_turn_seq,
        items,
    };
    append_shared_session_log_entry(&workspace_id, &shared_session_id, &entry)?;
    let shadow_mirror = if let Some(writer) = state.shared_event_writer.as_ref() {
        let facts =
            crate::shared_event_log::canonical::shadow_v0::map_v0_snapshot_to_presentation_only_facts(
                &entry.items,
                selected_engine.icon(),
                i64::try_from(entry.created_at).unwrap_or(i64::MAX),
            );
        let mut mirrored_facts = 0usize;
        let mut mirror_error = None;
        for fact in facts {
            match writer.append_presentation_only_fact(shared_session_id.clone(), fact) {
                Ok(_) => mirrored_facts += 1,
                Err(error) => {
                    mirror_error = Some(error.to_string());
                    break;
                }
            }
        }
        if let Some(error) = mirror_error {
            eprintln!(
                "[shared-event-log] V0 shadow mirror failed session={shared_session_id}: {error}"
            );
            json!({ "status": "error", "error": error })
        } else {
            json!({ "status": "ok", "factCount": mirrored_facts })
        }
    } else {
        json!({ "status": "unavailable" })
    };
    Ok(json!({
        "threadId": shared_thread_id(&meta.id),
        "updatedAt": meta.updated_at,
        "lastTurnSeq": meta.last_turn_seq,
        "shadowMirror": shadow_mirror,
    }))
}

#[tauri::command]
pub async fn delete_shared_session(
    workspace_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    ensure_known_workspace(&state.workspaces, &workspace_id).await?;
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let path = shared_session_dir(&workspace_id, &shared_session_id)?;
    if !path.exists() {
        return Ok(json!({ "deleted": false, "threadId": thread_id }));
    }
    std::fs::remove_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(json!({ "deleted": true, "threadId": thread_id }))
}

#[tauri::command]
pub async fn send_shared_session_message(
    workspace_id: String,
    thread_id: String,
    engine: EngineType,
    text: String,
    model: Option<String>,
    effort: Option<String>,
    disable_thinking: Option<bool>,
    access_mode: Option<String>,
    images: Option<Vec<String>>,
    collaboration_mode: Option<Value>,
    preferred_language: Option<String>,
    custom_spec_root: Option<String>,
    provider_profile_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    let engine = ensure_supported_shared_session_engine(engine)?;
    let provider_profile_id = provider_profile_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let binding_key = shared_target_binding_key(engine, provider_profile_id.as_deref());
    let shared_session_id = parse_shared_session_id(&thread_id)?;
    let _workspace_path = resolve_workspace_path(&state.workspaces, &workspace_id).await?;
    let (mut meta, snapshot) = load_meta_and_snapshot(&workspace_id, &shared_session_id)?;
    let now = now_millis();
    let latest_items = snapshot
        .as_ref()
        .map(|entry| entry.items.clone())
        .unwrap_or_default();
    let latest_turn_seq = count_user_turns(&latest_items);
    let sync_from_turn_seq = shared_binding_synced_turn_seq(
        &mut meta,
        engine,
        provider_profile_id.as_deref(),
        now,
    );

    let sync_prefix = if sync_from_turn_seq < latest_turn_seq {
        build_delta_sync_prefix(&latest_items, sync_from_turn_seq)
    } else {
        None
    };
    let outbound_text = if let Some(prefix) = sync_prefix {
        format!("{prefix}\n\nCurrent user request:\n{text}")
    } else {
        text.clone()
    };

    let response = match engine {
        EngineType::Codex => {
            let native_thread_id = ensure_shared_session_native_binding(
                &workspace_id,
                &mut meta,
                engine,
                provider_profile_id.clone(),
                latest_turn_seq,
                &state,
                &app,
            )
            .await?;
            touch_shared_binding(
                &mut meta,
                engine,
                provider_profile_id.as_deref(),
                now,
                None,
            );
            select_meta_target(&mut meta, engine, provider_profile_id.clone());
            meta.updated_at = now;
            // Persist binding materialization before sending so failures don't
            // repeatedly create new native threads.
            write_shared_session_meta(&meta)?;
            let (mode_enforcement_enabled, extra_developer_instructions) = {
                let settings = state.app_settings.lock().await;
                (
                    settings.codex_mode_enforcement_enabled,
                    codex_turn_developer_instructions(&settings),
                )
            };
            let response = codex_core::send_user_message_core(
                &state.sessions,
                workspace_id.clone(),
                provider_profile_id.clone(),
                native_thread_id.clone(),
                outbound_text,
                model,
                effort,
                access_mode,
                images,
                collaboration_mode,
                preferred_language,
                custom_spec_root,
                mode_enforcement_enabled,
                extra_developer_instructions,
            )
            .await?;
            touch_shared_binding(
                &mut meta,
                engine,
                provider_profile_id.as_deref(),
                now,
                Some(latest_turn_seq + 1),
            );
            select_meta_target(&mut meta, engine, provider_profile_id.clone());
            meta.updated_at = now;
            meta.last_turn_seq = latest_turn_seq + 1;
            write_shared_session_meta(&meta)?;
            response
        }
        EngineType::Claude => {
            let native_thread_id = ensure_shared_session_native_binding(
                &workspace_id,
                &mut meta,
                engine,
                provider_profile_id.clone(),
                latest_turn_seq,
                &state,
                &app,
            )
            .await?;
            let continue_session =
                binding_uses_established_native_thread(engine, &native_thread_id);
            let session_id = if continue_session {
                native_thread_id
                    .split_once(':')
                    .map(|(_, session_id)| session_id.to_string())
            } else {
                None
            };
            touch_shared_binding(
                &mut meta,
                engine,
                provider_profile_id.as_deref(),
                now,
                None,
            );
            select_meta_target(&mut meta, engine, provider_profile_id.clone());
            meta.updated_at = now;
            write_shared_session_meta(&meta)?;
            let response = engine::engine_send_message(
                workspace_id.clone(),
                outbound_text,
                Some(engine),
                model,
                effort,
                disable_thinking,
                access_mode,
                images,
                continue_session,
                Some(native_thread_id),
                session_id,
                None,
                None,
                None,
                provider_profile_id.clone(),
                custom_spec_root,
                None,
                None,
                app,
                state,
            )
            .await?;
            touch_shared_binding(
                &mut meta,
                engine,
                provider_profile_id.as_deref(),
                now,
                Some(latest_turn_seq + 1),
            );
            select_meta_target(&mut meta, engine, provider_profile_id.clone());
            meta.updated_at = now;
            meta.last_turn_seq = latest_turn_seq + 1;
            write_shared_session_meta(&meta)?;
            response
        }
        EngineType::Gemini | EngineType::OpenCode | EngineType::Kimi => {
            return Err(format!(
                "Unsupported shared session engine: {}",
                engine.icon()
            ));
        }
    };

    Ok(json!({
        "engine": engine,
        "sharedSessionId": shared_session_id,
        "threadKind": "shared",
        "threadId": thread_id,
        "nativeThreadId": if provider_profile_id.is_some() {
            meta.bindings_by_target.get(&binding_key).map(|binding| binding.native_thread_id.clone()).unwrap_or_default()
        } else {
            meta.bindings_by_engine.get(&engine).map(|binding| binding.native_thread_id.clone()).unwrap_or_default()
        },
        "providerProfileId": provider_profile_id,
        "bindingKey": binding_key,
        "selectedEngine": meta.selected_engine,
        "result": response.get("result").cloned().unwrap_or_else(|| response.clone()),
        "turn": response.get("turn").cloned().or_else(|| response.get("result").and_then(|value| value.get("turn")).cloned()).unwrap_or(Value::Null),
        "response": response,
    }))
}

#[cfg(test)]
mod tests {
    use super::{
        binding_uses_established_native_thread, build_delta_sync_prefix, count_user_turns,
        extract_first_user_title, is_pending_shared_binding_thread_id, parse_shared_session_id,
        sanitize_shared_session_meta, shared_target_binding_key, validate_shared_native_thread_id,
        SharedEngineBinding, SharedSessionMeta, SharedTargetBindingMeta,
    };
    use crate::engine::EngineType;
    use serde_json::json;
    use std::collections::HashMap;

    #[test]
    fn derives_title_from_first_user_message() {
        let items = vec![
            json!({ "id": "u1", "kind": "message", "role": "user", "text": "帮我看看 shared session 该怎么做" }),
            json!({ "id": "a1", "kind": "message", "role": "assistant", "text": "好的" }),
        ];
        let title = extract_first_user_title(&items);
        assert_eq!(title.as_deref(), Some("帮我看看 shared session 该怎么做"));
    }

    #[test]
    fn counts_user_turns_from_snapshot_items() {
        let items = vec![
            json!({ "id": "u1", "kind": "message", "role": "user", "text": "A" }),
            json!({ "id": "a1", "kind": "message", "role": "assistant", "text": "B" }),
            json!({ "id": "u2", "kind": "message", "role": "user", "text": "C" }),
        ];
        assert_eq!(count_user_turns(&items), 2);
    }

    #[test]
    fn builds_delta_sync_prefix_from_newer_turns_only() {
        let items = vec![
            json!({ "id": "u1", "kind": "message", "role": "user", "text": "first user" }),
            json!({ "id": "a1", "kind": "message", "role": "assistant", "text": "first assistant", "engineSource": "claude" }),
            json!({ "id": "u2", "kind": "message", "role": "user", "text": "second user" }),
            json!({ "id": "a2", "kind": "message", "role": "assistant", "text": "second assistant", "engineSource": "codex" }),
        ];
        let prefix = build_delta_sync_prefix(&items, 1).expect("prefix");
        assert!(prefix.contains("Turn 2"));
        assert!(prefix.contains("second user"));
        assert!(prefix.contains("codex"));
        assert!(!prefix.contains("first assistant"));
    }

    #[test]
    fn detects_pending_shared_binding_ids() {
        assert!(is_pending_shared_binding_thread_id(
            EngineType::Claude,
            "claude-pending-shared-1"
        ));
        assert!(is_pending_shared_binding_thread_id(
            EngineType::Codex,
            "codex-pending-shared-1"
        ));
        assert!(!is_pending_shared_binding_thread_id(
            EngineType::Codex,
            "550e8400-e29b-41d4-a716-446655440000"
        ));
        assert!(!is_pending_shared_binding_thread_id(
            EngineType::Codex,
            "codex-native-thread-1"
        ));
    }

    #[test]
    fn requires_established_native_thread_before_reusing_binding() {
        assert!(!binding_uses_established_native_thread(
            EngineType::Claude,
            "claude-pending-shared-1"
        ));
        assert!(binding_uses_established_native_thread(
            EngineType::Claude,
            "claude:session-1"
        ));
        assert!(!binding_uses_established_native_thread(
            EngineType::Codex,
            "codex-pending-shared-1"
        ));
        assert!(binding_uses_established_native_thread(
            EngineType::Codex,
            "550e8400-e29b-41d4-a716-446655440000"
        ));
        assert!(binding_uses_established_native_thread(
            EngineType::Codex,
            "codex-native-thread-1"
        ));
    }

    #[test]
    fn normalizes_legacy_shared_meta_to_supported_engines_only() {
        let mut meta = SharedSessionMeta {
            id: "shared-1".to_string(),
            workspace_id: "ws-1".to_string(),
            title: "Shared Session".to_string(),
            created_at: 1,
            updated_at: 2,
            selected_engine: EngineType::Gemini,
            selected_target: None,
            last_turn_seq: 3,
            bindings_by_engine: HashMap::from([
                (
                    EngineType::Gemini,
                    SharedEngineBinding {
                        engine: EngineType::Gemini,
                        native_thread_id: "gemini:session-1".to_string(),
                        created_at: 1,
                        last_used_at: 2,
                        last_synced_turn_seq: 3,
                    },
                ),
                (
                    EngineType::Claude,
                    SharedEngineBinding {
                        engine: EngineType::Claude,
                        native_thread_id: "claude:session-1".to_string(),
                        created_at: 1,
                        last_used_at: 2,
                        last_synced_turn_seq: 3,
                    },
                ),
            ]),
            bindings_by_target: HashMap::new(),
        };

        sanitize_shared_session_meta(&mut meta);

        assert_eq!(meta.selected_engine, EngineType::Claude);
        assert!(meta.bindings_by_engine.contains_key(&EngineType::Claude));
        assert!(!meta.bindings_by_engine.contains_key(&EngineType::Gemini));
    }

    #[test]
    fn rejects_shared_session_ids_with_path_like_segments() {
        assert!(parse_shared_session_id("shared:session-1").is_ok());
        assert!(parse_shared_session_id("shared:../session-1").is_err());
        assert!(parse_shared_session_id("shared:..\\session-1").is_err());
        assert!(parse_shared_session_id("shared:session/1").is_err());
        assert!(parse_shared_session_id("shared:session\\1").is_err());
        assert!(parse_shared_session_id("shared:").is_err());
    }

    #[test]
    fn rejects_empty_shared_native_thread_ids() {
        assert!(validate_shared_native_thread_id("claude:session-1").is_ok());
        assert!(validate_shared_native_thread_id("   ").is_err());
    }

    fn meta_with_engine_binding(
        engine: EngineType,
        native_thread_id: &str,
    ) -> SharedSessionMeta {
        SharedSessionMeta {
            id: "shared-1".to_string(),
            workspace_id: "ws-1".to_string(),
            title: "Shared Session".to_string(),
            created_at: 1,
            updated_at: 2,
            selected_engine: engine,
            selected_target: None,
            last_turn_seq: 0,
            bindings_by_engine: HashMap::from([(
                engine,
                SharedEngineBinding {
                    engine,
                    native_thread_id: native_thread_id.to_string(),
                    created_at: 1,
                    last_used_at: 2,
                    last_synced_turn_seq: 3,
                },
            )]),
            bindings_by_target: HashMap::new(),
        }
    }

    #[test]
    fn binding_key_uses_engine_and_provider_with_default_fallback() {
        assert_eq!(
            shared_target_binding_key(EngineType::Claude, None),
            "claude:default"
        );
        assert_eq!(
            shared_target_binding_key(EngineType::Claude, Some("  ")),
            "claude:default"
        );
        assert_eq!(
            shared_target_binding_key(EngineType::Claude, Some("openrouter")),
            "claude:openrouter"
        );
        assert_eq!(
            shared_target_binding_key(EngineType::Codex, Some("openai")),
            "codex:openai"
        );
    }

    #[test]
    fn migrates_legacy_engine_bindings_to_default_provider_targets() {
        let mut meta = meta_with_engine_binding(EngineType::Claude, "claude:session-1");
        sanitize_shared_session_meta(&mut meta);

        let target = meta
            .bindings_by_target
            .get("claude:default")
            .expect("default target binding");
        assert_eq!(target.provider_profile_id, None);
        assert_eq!(target.native_thread_id, "claude:session-1");
        assert_eq!(target.last_synced_turn_seq, 3);
        assert_eq!(target.availability, "ready");
    }

    #[test]
    fn sanitize_keeps_engine_binding_authoritative_for_default_identity() {
        let mut meta = meta_with_engine_binding(EngineType::Claude, "claude:session-new");
        meta.bindings_by_target.insert(
            "claude:default".to_string(),
            SharedTargetBindingMeta {
                binding_key: "claude:default".to_string(),
                engine: EngineType::Claude,
                provider_profile_id: None,
                native_thread_id: "claude:session-stale".to_string(),
                created_at: 9,
                last_used_at: 9,
                last_synced_turn_seq: 9,
                availability: "recovery-required".to_string(),
            },
        );
        sanitize_shared_session_meta(&mut meta);

        let target = meta
            .bindings_by_target
            .get("claude:default")
            .expect("default target binding");
        // 身份字段以 V0 engine binding 为准（回滚兼容）；availability 保留 V2 状态。
        assert_eq!(target.native_thread_id, "claude:session-new");
        assert_eq!(target.last_synced_turn_seq, 3);
        assert_eq!(target.availability, "recovery-required");
    }

    #[test]
    fn sanitize_preserves_managed_provider_targets_untouched() {
        let mut meta = meta_with_engine_binding(EngineType::Claude, "claude:session-1");
        meta.bindings_by_target.insert(
            "claude:openrouter".to_string(),
            SharedTargetBindingMeta {
                binding_key: "claude:openrouter".to_string(),
                engine: EngineType::Claude,
                provider_profile_id: Some("openrouter".to_string()),
                native_thread_id: "claude:session-or".to_string(),
                created_at: 5,
                last_used_at: 6,
                last_synced_turn_seq: 7,
                availability: "degraded".to_string(),
            },
        );
        sanitize_shared_session_meta(&mut meta);

        let managed = meta
            .bindings_by_target
            .get("claude:openrouter")
            .expect("managed provider binding");
        assert_eq!(managed.native_thread_id, "claude:session-or");
        assert_eq!(managed.last_synced_turn_seq, 7);
        assert_eq!(managed.availability, "degraded");
        assert!(meta.bindings_by_target.contains_key("claude:default"));
    }

    #[test]
    fn sanitize_drops_target_bindings_whose_engine_is_unsupported() {
        let mut meta = meta_with_engine_binding(EngineType::Claude, "claude:session-1");
        meta.bindings_by_target.insert(
            "gemini:default".to_string(),
            SharedTargetBindingMeta {
                binding_key: "gemini:default".to_string(),
                engine: EngineType::Gemini,
                provider_profile_id: None,
                native_thread_id: "gemini:session-1".to_string(),
                created_at: 1,
                last_used_at: 2,
                last_synced_turn_seq: 3,
                availability: "ready".to_string(),
            },
        );
        sanitize_shared_session_meta(&mut meta);

        assert!(!meta.bindings_by_target.contains_key("gemini:default"));
    }

    #[test]
    fn legacy_meta_without_target_map_deserializes_via_default() {
        let raw = json!({
            "id": "shared-1",
            "workspaceId": "ws-1",
            "title": "Shared Session",
            "createdAt": 1,
            "updatedAt": 2,
            "selectedEngine": "claude",
            "lastTurnSeq": 0,
            "bindingsByEngine": {},
        });
        let mut meta: SharedSessionMeta =
            serde_json::from_value(raw).expect("legacy meta parses");
        sanitize_shared_session_meta(&mut meta);
        assert!(meta.bindings_by_target.is_empty());
    }
}
