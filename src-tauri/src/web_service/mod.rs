use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::remote_backend;
use crate::state::AppState;

mod assets_package;
mod daemon_bootstrap;

fn should_retry_after_connect_error(error: &str) -> bool {
    error.contains("Failed to connect to remote backend")
        || error.contains("remote backend disconnected")
}

fn should_block_web_server_start(
    packaged_build: bool,
    local_daemon: bool,
    assets_ready: bool,
) -> bool {
    packaged_build && local_daemon && !assets_ready
}

async fn call_remote_web_service(
    state: &AppState,
    app: &AppHandle,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    match remote_backend::call_remote(state, app.clone(), method, params.clone()).await {
        Ok(value) => Ok(value),
        Err(error) => {
            if !should_retry_after_connect_error(&error) {
                return Err(error);
            }

            match daemon_bootstrap::maybe_start_local_daemon_for_remote(state, app).await {
                Ok(true) => remote_backend::call_remote(state, app.clone(), method, params).await,
                Ok(false) => Err(error),
                Err(start_error) => Err(format!("{error}. {start_error}")),
            }
        }
    }
}

#[tauri::command]
pub(crate) async fn start_web_server(
    port: Option<u16>,
    token: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if !cfg!(debug_assertions) {
        let local_daemon = daemon_bootstrap::is_local_daemon_configured(&state).await;
        let assets_ready = assets_package::ready_assets_dir(&app).is_some();
        if should_block_web_server_start(true, local_daemon, assets_ready) {
            return Err("WEB_ASSETS_NOT_READY".to_string());
        }
    }
    call_remote_web_service(
        &state,
        &app,
        "start_web_server",
        json!({
            "port": port,
            "token": token,
        }),
    )
    .await
}

#[tauri::command]
pub(crate) async fn stop_web_server(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    call_remote_web_service(&state, &app, "stop_web_server", json!({})).await
}

#[tauri::command]
pub(crate) async fn get_web_server_status(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    match call_remote_web_service(&state, &app, "get_web_server_status", json!({})).await {
        Ok(status) => Ok(status),
        Err(error) => {
            let settings = state.app_settings.lock().await;
            Ok(json!({
                "running": false,
                "rpcEndpoint": settings.remote_backend_host.clone(),
                "webPort": settings.web_service_port,
                "addresses": [],
                "webAccessToken": null,
                "lastError": error,
            }))
        }
    }
}

#[tauri::command]
pub(crate) async fn get_daemon_status(state: State<'_, AppState>) -> Result<Value, String> {
    let status = daemon_bootstrap::get_local_daemon_status(&state).await;
    serde_json::to_value(status).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn start_daemon(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    let status = daemon_bootstrap::start_local_daemon_for_remote(&state, &app).await?;
    serde_json::to_value(status).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn stop_daemon(state: State<'_, AppState>) -> Result<Value, String> {
    let status = daemon_bootstrap::stop_local_daemon_for_remote(&state).await?;
    serde_json::to_value(status).map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn get_web_assets_status(
    app: AppHandle,
) -> Result<assets_package::WebAssetsStatus, String> {
    Ok(assets_package::get_status(&app))
}

#[tauri::command]
pub(crate) async fn install_web_assets(
    app: AppHandle,
) -> Result<assets_package::WebAssetsStatus, String> {
    Ok(assets_package::install(&app).await)
}

#[tauri::command]
pub(crate) async fn install_web_assets_from_file(
    app: AppHandle,
    archive_path: String,
) -> Result<assets_package::WebAssetsStatus, String> {
    Ok(assets_package::install_from_file(&app, std::path::Path::new(&archive_path)).await)
}

#[cfg(test)]
mod tests {
    use super::should_block_web_server_start;

    #[test]
    fn packaged_local_web_service_requires_ready_assets() {
        assert!(should_block_web_server_start(true, true, false));
        assert!(!should_block_web_server_start(true, true, true));
    }

    #[test]
    fn remote_and_development_web_service_are_not_locally_gated() {
        assert!(!should_block_web_server_start(true, false, false));
        assert!(!should_block_web_server_start(false, true, false));
    }
}
