use tauri::State;

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

#[tauri::command]
pub(crate) async fn load_shared_projection(
    workspace_id: String,
    thread_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<ProjectionItem>, String> {
    let (writer, session_id, _) = projection_context(&workspace_id, &thread_id, &state).await?;
    tokio::task::spawn_blocking(move || {
        SharedProjector::new().project(
            &writer,
            &session_id,
            CANVAS_PROJECTION_NAME,
            CANVAS_PROJECTION_VERSION,
        )
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
        SharedProjector::new().rebuild(
            &writer,
            &session_id,
            CANVAS_PROJECTION_NAME,
            CANVAS_PROJECTION_VERSION,
        )
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
