use serde::Deserialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hasher;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

use crate::backend::app_server::RuntimeShutdownSource;
use crate::state::AppState;
use crate::types::AppSettings;

use super::process_diagnostics::{current_host_untracked_engine_roots, terminate_pid_tree};
use super::session_lifecycle::{close_runtime, evict_runtime};
use super::{
    normalize_engine, RuntimePoolRow, RuntimePoolSnapshot, TurnReconciliationStatusQuery,
    TurnReconciliationStatusResponse,
};

/// 前端 runtime dock 订阅的差量事件：仅 snapshot 语义内容变化时 emit，
/// 替代前端 5s 常驻轮询。
pub(crate) const RUNTIME_POOL_CHANGED_EVENT: &str = "runtime-pool-changed";

static LAST_RUNTIME_POOL_SIGNATURE: OnceLock<Mutex<Option<u64>>> = OnceLock::new();

/// 与前端 `areRuntimeRowsSignalEquivalent` 口径一致，另含 error/exit 信息，
/// 保证 dock 派生通知依赖的字段变化也会触发 emit。对 rows 先按
/// (workspace_id, engine) 排序，与前端 Map 比对的顺序无关语义对齐。
fn runtime_pool_rows_signature(rows: &[RuntimePoolRow]) -> u64 {
    let mut sorted: Vec<&RuntimePoolRow> = rows.iter().collect();
    sorted.sort_by(|a, b| {
        (&a.workspace_id, &a.engine).cmp(&(&b.workspace_id, &b.engine))
    });
    let mut hasher = DefaultHasher::new();
    for row in sorted {
        // 枚举/Option 字段未统一 derive Hash，用 Debug 串写入 hasher；
        // 15s reconcile 周期 + 行数个位数，开销可忽略。
        let fingerprint = format!(
            "{:?}{:?}{:?}{:?}{:?}{:?}{:?}{:?}{:?}{:?}{:?}{:?}{:?}{:?}{:?}",
            row.workspace_id,
            row.engine,
            row.workspace_name,
            row.workspace_path,
            row.state,
            row.lifecycle_state,
            row.foreground_work_state,
            row.startup_state,
            row.reason_code,
            row.recovery_source,
            row.retryable,
            row.user_action,
            row.error,
            row.last_exit_reason_code,
            row.last_exit_message,
        );
        hasher.write(fingerprint.as_bytes());
    }
    hasher.finish()
}

/// 若 snapshot 较上次发布有语义变化，则向 webview emit
/// [`RUNTIME_POOL_CHANGED_EVENT`]。reconcile cycle 与手动 mutation 路径共用。
pub(crate) async fn publish_runtime_pool_snapshot_if_changed(
    app: &AppHandle,
    snapshot: &RuntimePoolSnapshot,
) {
    let signature = runtime_pool_rows_signature(&snapshot.rows);
    let last = LAST_RUNTIME_POOL_SIGNATURE.get_or_init(|| Mutex::new(None));
    let mut guard = last.lock().await;
    if *guard == Some(signature) {
        return;
    }
    *guard = Some(signature);
    let _ = app.emit(RUNTIME_POOL_CHANGED_EVENT, snapshot);
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action")]
pub(crate) enum RuntimePoolMutation {
    Close {
        #[serde(alias = "workspaceId")]
        workspace_id: String,
        #[serde(default)]
        engine: Option<String>,
    },
    ReleaseToCold {
        #[serde(alias = "workspaceId")]
        workspace_id: String,
        #[serde(default)]
        engine: Option<String>,
    },
    Pin {
        #[serde(alias = "workspaceId")]
        workspace_id: String,
        #[serde(default)]
        engine: Option<String>,
        pinned: bool,
    },
}

pub(crate) async fn run_reconcile_cycle(state: &AppState, settings: &AppSettings) {
    let candidates = state.runtime_manager.reconcile_pool(settings).await;
    for candidate in candidates {
        if !state
            .runtime_manager
            .can_evict(&candidate.engine, &candidate.workspace_id)
            .await
        {
            state.runtime_manager.note_coordinator_abort().await;
            continue;
        }
        let _ = if candidate.reason == "manual-release" {
            close_runtime(
                state,
                &candidate.engine,
                &candidate.workspace_id,
                RuntimeShutdownSource::ManualRelease,
            )
            .await
        } else {
            evict_runtime(
                state,
                &candidate.engine,
                &candidate.workspace_id,
                RuntimeShutdownSource::IdleEviction,
            )
            .await
        };
        log::info!(
            "[runtime] evicted engine={} workspace_id={} reason={}",
            candidate.engine,
            candidate.workspace_id,
            candidate.reason
        );
    }

    // Startup restore should not leave detached Codex app-server roots behind.
    // If the host has no tracked Codex runtime and no acquire in progress, any
    // host-owned Codex root is stale and can be reclaimed.
    let tracked_codex_pids = state.runtime_manager.tracked_engine_pids("codex").await;
    let has_pending_codex_acquire = state
        .runtime_manager
        .has_pending_acquire_for_engine("codex")
        .await;
    if tracked_codex_pids.is_empty() && !has_pending_codex_acquire {
        if let Ok(untracked_roots) =
            current_host_untracked_engine_roots("codex", &tracked_codex_pids)
        {
            for pid in untracked_roots {
                if terminate_pid_tree(pid).unwrap_or(false) {
                    state.runtime_manager.note_force_kill().await;
                    log::warn!(
                        "[runtime] reclaimed untracked host codex root pid={pid} during reconcile"
                    );
                }
            }
        }
    }
}

#[tauri::command]
pub(crate) async fn ensure_runtime_ready(
    workspace_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let entry = {
        let workspaces = state.workspaces.lock().await;
        workspaces
            .get(&workspace_id)
            .cloned()
            .ok_or_else(|| "workspace not found".to_string())?
    };
    if entry
        .settings
        .engine_type
        .as_deref()
        .map(|value| !value.eq_ignore_ascii_case("codex"))
        .unwrap_or(false)
    {
        return Ok(());
    }
    crate::codex::ensure_codex_session(&workspace_id, &state, &app).await?;
    let settings = state.app_settings.lock().await.clone();
    run_reconcile_cycle(&state, &settings).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn prewarm_codex_disk_runtime(
    workspace_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    crate::codex::ensure_codex_session(&workspace_id, &state, &app).await?;
    let settings = state.app_settings.lock().await.clone();
    run_reconcile_cycle(&state, &settings).await;
    Ok(())
}

#[tauri::command]
pub(crate) async fn get_runtime_pool_snapshot(
    state: State<'_, AppState>,
) -> Result<RuntimePoolSnapshot, String> {
    let settings = state.app_settings.lock().await.clone();
    Ok(state.runtime_manager.snapshot(&settings).await)
}

#[tauri::command]
pub(crate) async fn note_web_service_reconnected(
    workspace_id: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<RuntimePoolSnapshot, String> {
    let entry = {
        let workspaces = state.workspaces.lock().await;
        workspaces
            .get(&workspace_id)
            .cloned()
            .ok_or_else(|| "workspace not found".to_string())?
    };
    let engine = entry
        .settings
        .engine_type
        .as_deref()
        .map(normalize_engine)
        .unwrap_or_else(|| "codex".to_string());
    state
        .runtime_manager
        .note_reconnect_refresh(&engine, &workspace_id, "web-service-reconnected")
        .await;
    let settings = state.app_settings.lock().await.clone();
    run_reconcile_cycle(&state, &settings).await;
    let snapshot = state.runtime_manager.snapshot(&settings).await;
    publish_runtime_pool_snapshot_if_changed(&app, &snapshot).await;
    Ok(snapshot)
}

#[tauri::command]
pub(crate) async fn mutate_runtime_pool(
    mutation: RuntimePoolMutation,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<RuntimePoolSnapshot, String> {
    match mutation {
        RuntimePoolMutation::Close {
            workspace_id,
            engine,
        } => {
            close_runtime(
                &state,
                &normalize_engine(engine.as_deref().unwrap_or("codex")),
                &workspace_id,
                RuntimeShutdownSource::UserManualShutdown,
            )
            .await?;
        }
        RuntimePoolMutation::ReleaseToCold {
            workspace_id,
            engine,
        } => {
            let engine = normalize_engine(engine.as_deref().unwrap_or("codex"));
            if engine == "codex" {
                state
                    .runtime_manager
                    .request_release_to_cold(&engine, &workspace_id)
                    .await;
            } else {
                close_runtime(
                    &state,
                    &engine,
                    &workspace_id,
                    RuntimeShutdownSource::ManualRelease,
                )
                .await?;
            }
        }
        RuntimePoolMutation::Pin {
            workspace_id,
            engine,
            pinned,
        } => {
            state
                .runtime_manager
                .pin_runtime(
                    &normalize_engine(engine.as_deref().unwrap_or("codex")),
                    &workspace_id,
                    pinned,
                )
                .await;
        }
    }
    let settings = state.app_settings.lock().await.clone();
    run_reconcile_cycle(&state, &settings).await;
    let snapshot = state.runtime_manager.snapshot(&settings).await;
    publish_runtime_pool_snapshot_if_changed(&app, &snapshot).await;
    Ok(snapshot)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QueryTurnReconciliationStatusRequest {
    #[serde(alias = "workspace_id")]
    workspace_id: String,
    engine: String,
    #[serde(alias = "thread_id")]
    thread_id: String,
    #[serde(default, alias = "turn_id")]
    turn_id: Option<String>,
    #[serde(default, alias = "runtime_session_id")]
    runtime_session_id: Option<String>,
    #[serde(default, alias = "runtime_lease_id")]
    runtime_lease_id: Option<String>,
    #[serde(alias = "request_source")]
    request_source: String,
    #[serde(alias = "requested_at_ms")]
    requested_at_ms: u64,
}

#[tauri::command]
pub(crate) async fn query_turn_reconciliation_status(
    request: QueryTurnReconciliationStatusRequest,
    state: State<'_, AppState>,
) -> Result<TurnReconciliationStatusResponse, String> {
    Ok(state
        .runtime_manager
        .query_turn_reconciliation_status(TurnReconciliationStatusQuery {
            workspace_id: request.workspace_id,
            engine: request.engine,
            thread_id: request.thread_id,
            turn_id: request.turn_id,
            runtime_session_id: request.runtime_session_id,
            runtime_lease_id: request.runtime_lease_id,
            request_source: request.request_source,
            requested_at_ms: request.requested_at_ms,
        })
        .await)
}
