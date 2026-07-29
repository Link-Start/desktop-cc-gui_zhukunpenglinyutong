use std::collections::HashMap;

use tauri::State;

use crate::engine::EngineType;
use crate::shared_sessions::shared_session_projection_source;
use crate::state::AppState;

use super::{
    LegacySharedReader, MismatchReport, ProjectionItem, ShadowComparator, SharedProjector,
    CANVAS_PROJECTION_NAME, CANVAS_PROJECTION_VERSION,
};

async fn projection_context(
    workspace_id: &str,
    thread_id: &str,
    state: &State<'_, AppState>,
) -> Result<
    (
        crate::shared_event_log::SharedEventWriter,
        String,
        std::path::PathBuf,
    ),
    String,
> {
    if !state.workspaces.lock().await.contains_key(workspace_id) {
        return Err(format!("Unknown workspace: {workspace_id}"));
    }
    let (session_id, legacy_log_path) = shared_session_projection_source(workspace_id, thread_id)?;
    let writer = state
        .shared_event_writer
        .as_ref()
        .cloned()
        .ok_or_else(|| "Shared projection store is unavailable".to_string())?;
    Ok((writer, session_id, legacy_log_path))
}

fn enrich_provider_availability(items: &mut [ProjectionItem]) {
    let mut availability_by_target = HashMap::<(EngineType, String), bool>::new();
    for item in items {
        let Some(snapshot) = item
            .content
            .get_mut("executionTargetSnapshot")
            .and_then(serde_json::Value::as_object_mut)
        else {
            continue;
        };
        let Some(provider_profile_id) = snapshot
            .get("providerProfileId")
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            snapshot.insert("providerAvailable".to_string(), true.into());
            continue;
        };
        let engine = match snapshot.get("engine").and_then(serde_json::Value::as_str) {
            Some("claude") => EngineType::Claude,
            Some("codex") => EngineType::Codex,
            _ => continue,
        };
        let local_provider = matches!(provider_profile_id, "__disk__" | "__local_settings_json__");
        let target_key = (engine, provider_profile_id.to_string());
        let available = *availability_by_target.entry(target_key).or_insert_with(|| {
            local_provider
                || crate::engine::status::get_provider_scoped_engine_models(
                    engine,
                    Some(provider_profile_id),
                )
                .is_ok()
        });
        snapshot.insert("providerAvailable".to_string(), available.into());
    }
}

#[tauri::command]
pub(crate) async fn load_shared_projection(
    workspace_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ProjectionItem>, String> {
    let (writer, session_id, _) = projection_context(&workspace_id, &thread_id, &state).await?;
    tokio::task::spawn_blocking(move || {
        let mut items = SharedProjector::new().project(
            &writer,
            &session_id,
            CANVAS_PROJECTION_NAME,
            CANVAS_PROJECTION_VERSION,
        )?;
        enrich_provider_availability(&mut items);
        Ok::<_, crate::shared_event_log::StoreError>(items)
    })
    .await
    .map_err(|error| format!("Shared projection task failed: {error}"))?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn rebuild_shared_projection(
    workspace_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ProjectionItem>, String> {
    let (writer, session_id, _) = projection_context(&workspace_id, &thread_id, &state).await?;
    tokio::task::spawn_blocking(move || {
        let mut items = SharedProjector::new().rebuild(
            &writer,
            &session_id,
            CANVAS_PROJECTION_NAME,
            CANVAS_PROJECTION_VERSION,
        )?;
        enrich_provider_availability(&mut items);
        Ok::<_, crate::shared_event_log::StoreError>(items)
    })
    .await
    .map_err(|error| format!("Shared projection rebuild task failed: {error}"))?
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn compare_shared_projection(
    workspace_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<MismatchReport, String> {
    let (writer, session_id, legacy_log_path) =
        projection_context(&workspace_id, &thread_id, &state).await?;
    tokio::task::spawn_blocking(move || {
        let shadow = SharedProjector::new().project(
            &writer,
            &session_id,
            CANVAS_PROJECTION_NAME,
            CANVAS_PROJECTION_VERSION,
        )?;
        let legacy = LegacySharedReader::new().read_snapshot(&legacy_log_path)?;
        Ok::<_, crate::shared_event_log::StoreError>(
            ShadowComparator::new().compare(&shadow, &legacy),
        )
    })
    .await
    .map_err(|error| format!("Shared projection compare task failed: {error}"))?
    .map_err(|error| error.to_string())
}
