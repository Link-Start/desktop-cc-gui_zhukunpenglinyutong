use std::path::{Path, PathBuf};

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, State};

use crate::engine::{EngineConfig, EngineType};
use crate::native_history::{
    probe_history_file, read_history_file, NativeHistoryEngine, NativeHistorySource,
};
use crate::shared_context::{
    compile_native_context, read_artifact, read_typed_artifact, write_artifact,
    write_typed_artifact, ArtifactReadRequest, CompileNativeContextRequest, ContextPackage,
    ProjectionMode,
};
use crate::shared_event_log::deterministic_json_bytes;
use crate::shared_session_v2::{
    codex_import_items, codex_import_projection, context_capabilities, ExecutionTargetInput,
};
use crate::state::AppState;

use super::{
    load_operation, prepare_operation, update_operation_phase, ArtifactRef,
    NativeHistoryMaterialization, NativeProviderContinuationOperation,
};

fn now_millis() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn app_data_root(state: &AppState) -> Result<&Path, String> {
    state
        .storage_path
        .parent()
        .ok_or_else(|| "app data directory unavailable".to_string())
}

fn request_checksum(
    source: &NativeHistorySource,
    destination: &ExecutionTargetInput,
) -> Result<String, String> {
    let bytes = deterministic_json_bytes(&json!({
        "source": source,
        "destination": destination,
    }))
    .map_err(|error| error.to_string())?;
    Ok(format!("sha256:{:x}", Sha256::digest(bytes)))
}

fn engine_name(engine: NativeHistoryEngine) -> &'static str {
    match engine {
        NativeHistoryEngine::Claude => "claude",
        NativeHistoryEngine::Codex => "codex",
        NativeHistoryEngine::Kimi => "kimi",
    }
}

fn source_engine_type(engine: NativeHistoryEngine) -> EngineType {
    match engine {
        NativeHistoryEngine::Claude => EngineType::Claude,
        NativeHistoryEngine::Codex => EngineType::Codex,
        NativeHistoryEngine::Kimi => EngineType::Kimi,
    }
}

fn context_acceptance_marker(package: &ContextPackage) -> String {
    format!(
        "MOSSX_CONTEXT_ACCEPTED:{}:{}",
        package.package_id, package.manifest.source_checksum
    )
}

async fn workspace_path(state: &AppState, workspace_id: &str) -> Result<PathBuf, String> {
    state
        .workspaces
        .lock()
        .await
        .get(workspace_id)
        .map(|workspace| PathBuf::from(&workspace.path))
        .ok_or_else(|| "workspace not found".to_string())
}

fn engine_config_with_home(
    config: Option<EngineConfig>,
    home: Option<PathBuf>,
) -> Option<EngineConfig> {
    if let Some(home) = home {
        let mut config = config.unwrap_or_default();
        config.home_dir = Some(home.to_string_lossy().to_string());
        Some(config)
    } else {
        config
    }
}

async fn resolve_source_path(
    state: &AppState,
    workspace_id: &str,
    source: &NativeHistorySource,
) -> Result<PathBuf, String> {
    let workspace_path = workspace_path(state, workspace_id).await?;
    match source.engine {
        NativeHistoryEngine::Claude => {
            let config = state
                .engine_manager
                .get_engine_config(EngineType::Claude)
                .await;
            crate::engine::claude_history::resolve_claude_session_file_with_config(
                &workspace_path,
                &source.native_session_id,
                config.as_ref(),
            )
        }
        NativeHistoryEngine::Codex => {
            let provider = source
                .provider_profile_id
                .as_deref()
                .ok_or_else(|| "source Codex provider identity is required".to_string())?;
            crate::codex::resolve_codex_native_history_path(
                state,
                workspace_id,
                &source.native_session_id,
                provider,
            )
            .await
        }
        NativeHistoryEngine::Kimi => {
            let launch_profile =
                crate::engine::kimi_provider_profile::resolve_kimi_provider_launch_profile(
                    workspace_id,
                    source.provider_profile_id.as_deref(),
                )?;
            let config = engine_config_with_home(
                state
                    .engine_manager
                    .get_engine_config(EngineType::Kimi)
                    .await,
                launch_profile.home_dir,
            );
            crate::engine::kimi_history::resolve_kimi_session_history_path(
                &workspace_path,
                &source.native_session_id,
                config
                    .as_ref()
                    .and_then(|config| config.home_dir.as_deref()),
            )
            .await
        }
    }
}

fn validate_artifacts(
    root: &Path,
    workspace_id: &str,
    operation: &NativeProviderContinuationOperation,
) -> Result<ContextPackage, String> {
    let session_id = &operation.materialization.source.session_id;
    read_typed_artifact(
        root,
        &ArtifactReadRequest {
            workspace_id: workspace_id.to_string(),
            session_id: session_id.clone(),
            artifact_id: operation
                .materialization
                .normalized_entries
                .artifact_id
                .clone(),
            checksum: operation
                .materialization
                .normalized_entries
                .checksum
                .clone(),
        },
    )
    .map_err(|error| format!("artifact-integrity: {error}"))?;
    read_artifact(
        root,
        &ArtifactReadRequest {
            workspace_id: workspace_id.to_string(),
            session_id: session_id.clone(),
            artifact_id: operation
                .materialization
                .context_package
                .artifact_id
                .clone(),
            checksum: operation.materialization.context_package.checksum.clone(),
        },
    )
    .map(|record| record.package)
    .map_err(|error| format!("artifact-integrity: {error}"))
}

async fn prepare(
    state: &AppState,
    workspace_id: &str,
    operation_id: &str,
    source: &NativeHistorySource,
    destination: &ExecutionTargetInput,
) -> Result<(NativeProviderContinuationOperation, ContextPackage), String> {
    let root = app_data_root(state)?;
    let checksum = request_checksum(source, destination)?;
    if let Some(existing) = load_operation(root, operation_id).map_err(|error| error.to_string())? {
        if existing.request_checksum != checksum {
            return Err("operation-conflict".to_string());
        }
        let package = validate_artifacts(root, workspace_id, &existing).map_err(|error| {
            let _ = update_operation_phase(
                root,
                operation_id,
                "recovery-required",
                None,
                Some("artifact-integrity"),
                now_millis(),
            );
            error
        })?;
        return Ok((existing, package));
    }

    let path = resolve_source_path(state, workspace_id, source).await?;
    let capability = probe_history_file(&path, source.engine).map_err(|error| error.to_string())?;
    let cursor = capability
        .stable_cursor
        .then_some(capability.current_through_cursor)
        .flatten()
        .ok_or_else(|| "unsupported-stable-cursor".to_string())?;
    let history = read_history_file(&path, source, &cursor).map_err(|error| error.to_string())?;
    let mut capabilities = context_capabilities(destination);
    if destination.engine == EngineType::Codex {
        capabilities.structured_history_import = true;
        capabilities.tool_history = true;
        capabilities.strong_context_ack = true;
    }
    let package = compile_native_context(&CompileNativeContextRequest {
        session_id: source.session_id.clone(),
        binding_key: format!("continuation:{operation_id}"),
        destination: serde_json::to_value(destination).map_err(|error| error.to_string())?,
        source: source.clone(),
        history: history.clone(),
        capabilities,
        budget_estimated_tokens: None,
    })?;
    let prepared_at = now_millis();
    let normalized_entries = write_typed_artifact(
        root,
        workspace_id,
        &source.session_id,
        "application/vnd.mossx.native-history-entries+json",
        &serde_json::to_value(&history.entries).map_err(|error| error.to_string())?,
        prepared_at,
    )?;
    let context_package = write_artifact(
        root,
        workspace_id,
        &source.session_id,
        &package,
        prepared_at,
    )?;
    let operation = NativeProviderContinuationOperation {
        materialization: NativeHistoryMaterialization {
            operation_id: operation_id.to_string(),
            source: source.clone(),
            reader_id: history.reader_id,
            source_fingerprint: history.source_fingerprint,
            through_cursor: history.through_cursor,
            normalized_entries: ArtifactRef {
                artifact_id: normalized_entries.artifact_id,
                checksum: normalized_entries.checksum,
                media_type: normalized_entries.media_type,
            },
            context_package_id: package.package_id.clone(),
            context_package: ArtifactRef {
                artifact_id: context_package.artifact_id,
                checksum: context_package.checksum,
                media_type: context_package.media_type,
            },
            destination: serde_json::to_value(destination).map_err(|error| error.to_string())?,
            prepared_at,
        },
        request_checksum: checksum,
        phase: "prepared".to_string(),
        result_session_id: None,
        error_code: None,
        updated_at: prepared_at,
    };
    let operation = prepare_operation(root, &operation).map_err(|error| error.to_string())?;
    Ok((operation, package))
}

async fn persist_target_metadata(
    state: &AppState,
    workspace_id: &str,
    operation: &NativeProviderContinuationOperation,
    destination: &ExecutionTargetInput,
    target_session_id: &str,
) -> Result<(), String> {
    let provider_profile_id = destination
        .normalized_provider()
        .ok_or_else(|| "destination provider identity is required".to_string())?;
    match destination.engine {
        EngineType::Codex => {
            crate::codex::record_codex_provider_binding_checked(
                state,
                workspace_id,
                target_session_id,
                &provider_profile_id,
            )
            .await?;
        }
        EngineType::Claude => {
            let binding = crate::engine::claude::resolve_claude_provider_launch_profile(Some(
                &provider_profile_id,
            ))?
            .map(|profile| profile.binding)
            .unwrap_or_else(|| crate::session_management::EngineProviderBinding {
                provider_profile_id: provider_profile_id.clone(),
                provider_profile_source: destination
                    .provider_profile_source
                    .clone()
                    .unwrap_or_else(|| "disk".to_string()),
                provider_profile_name: destination
                    .provider_profile_name_snapshot
                    .clone()
                    .unwrap_or_else(|| provider_profile_id.clone()),
                provider_availability: "available".to_string(),
            });
            crate::session_management::record_engine_provider_binding_core(
                &state.workspaces,
                state.storage_path.as_path(),
                workspace_id.to_string(),
                target_session_id.to_string(),
                "claude".to_string(),
                binding,
            )
            .await?;
        }
        _ => return Err("unsupported target engine".to_string()),
    }
    crate::session_management::record_provider_continuation_metadata_core(
        &state.workspaces,
        state.storage_path.as_path(),
        workspace_id.to_string(),
        target_session_id.to_string(),
        operation.materialization.source.session_id.clone(),
        operation.materialization.source.provider_profile_id.clone(),
    )
    .await?;
    Ok(())
}

async fn execute_codex(
    state: &AppState,
    app: &AppHandle,
    workspace_id: &str,
    operation: NativeProviderContinuationOperation,
    destination: &ExecutionTargetInput,
    package: &ContextPackage,
) -> Result<NativeProviderContinuationOperation, String> {
    let root = app_data_root(state)?;
    if operation.phase == "ready" {
        return Ok(operation);
    }
    if operation.phase == "recovery-required" {
        if let Some(canonical_target_session_id) = operation.result_session_id.as_deref() {
            let target_session_id = canonical_target_session_id.trim_start_matches("codex:");
            let provider_profile_id = destination
                .normalized_provider()
                .ok_or_else(|| "destination provider identity is required".to_string())?;
            crate::codex::ensure_codex_session_for_provider(
                workspace_id,
                &provider_profile_id,
                state,
                app,
            )
            .await?;
            let response = crate::shared::codex_core::resume_thread_core(
                &state.sessions,
                workspace_id.to_string(),
                Some(provider_profile_id),
                target_session_id.to_string(),
            )
            .await?;
            let marker = format!(
                "MOSSX_CONTEXT_PACKAGE:{}:{}",
                package.package_id, package.manifest.source_checksum
            );
            if response.to_string().contains(&marker) {
                persist_target_metadata(
                    state,
                    workspace_id,
                    &operation,
                    destination,
                    canonical_target_session_id,
                )
                .await?;
                return update_operation_phase(
                    root,
                    &operation.materialization.operation_id,
                    "ready",
                    Some(canonical_target_session_id),
                    None,
                    now_millis(),
                )
                .map_err(|error| error.to_string());
            }
        }
        return Err(format!(
            "recovery-required: {}",
            operation.error_code.as_deref().unwrap_or("unknown")
        ));
    }
    if operation.phase == "creating" && operation.result_session_id.is_none() {
        let _ = update_operation_phase(
            root,
            &operation.materialization.operation_id,
            "recovery-required",
            None,
            Some("acceptance-ambiguous"),
            now_millis(),
        );
        return Err("acceptance-ambiguous: target creation state is unknown".to_string());
    }
    if let Some(canonical_target_session_id) = operation.result_session_id.as_deref() {
        if operation.error_code.as_deref() == Some("catalog-commit-failed") {
            persist_target_metadata(
                state,
                workspace_id,
                &operation,
                destination,
                canonical_target_session_id,
            )
            .await?;
            return update_operation_phase(
                root,
                &operation.materialization.operation_id,
                "ready",
                Some(canonical_target_session_id),
                None,
                now_millis(),
            )
            .map_err(|error| error.to_string());
        }
        let _ = update_operation_phase(
            root,
            &operation.materialization.operation_id,
            "recovery-required",
            Some(canonical_target_session_id),
            Some("acceptance-ambiguous"),
            now_millis(),
        );
        return Err("acceptance-ambiguous: target identity already exists".to_string());
    }

    let provider_profile_id = destination
        .normalized_provider()
        .ok_or_else(|| "destination provider identity is required".to_string())?;
    crate::codex::ensure_codex_session_for_provider(workspace_id, &provider_profile_id, state, app)
        .await?;
    update_operation_phase(
        root,
        &operation.materialization.operation_id,
        "creating",
        None,
        None,
        now_millis(),
    )
    .map_err(|error| error.to_string())?;
    let response = match crate::shared::codex_core::start_thread_core(
        &state.sessions,
        workspace_id.to_string(),
        Some(provider_profile_id.clone()),
        destination.model.clone(),
    )
    .await
    {
        Ok(response) => response,
        Err(error) => {
            let _ = update_operation_phase(
                root,
                &operation.materialization.operation_id,
                "recovery-required",
                None,
                Some("acceptance-ambiguous"),
                now_millis(),
            );
            return Err(format!("acceptance-ambiguous: {error}"));
        }
    };
    let Some(target_session_id) =
        crate::shared::codex_core::extract_thread_id_from_response(&response)
    else {
        let _ = update_operation_phase(
            root,
            &operation.materialization.operation_id,
            "recovery-required",
            None,
            Some("acceptance-ambiguous"),
            now_millis(),
        );
        return Err("acceptance-ambiguous: Codex thread identity missing".to_string());
    };
    let canonical_target_session_id = format!("codex:{target_session_id}");
    let operation = update_operation_phase(
        root,
        &operation.materialization.operation_id,
        "creating",
        Some(&canonical_target_session_id),
        None,
        now_millis(),
    )
    .map_err(|error| error.to_string())?;
    let items = codex_import_items(package);
    if items.is_empty() {
        let _ = update_operation_phase(
            root,
            &operation.materialization.operation_id,
            "recovery-required",
            Some(&canonical_target_session_id),
            Some("empty-context-package"),
            now_millis(),
        );
        return Err("empty-context-package: no portable history items".to_string());
    }
    if let Err(error) = crate::shared::codex_core::inject_thread_items_core(
        &state.sessions,
        workspace_id,
        Some(&provider_profile_id),
        &target_session_id,
        items,
    )
    .await
    {
        let _ = update_operation_phase(
            root,
            &operation.materialization.operation_id,
            "recovery-required",
            Some(&canonical_target_session_id),
            Some("acceptance-ambiguous"),
            now_millis(),
        );
        return Err(format!("acceptance-ambiguous: {error}"));
    }
    if let Err(error) = persist_target_metadata(
        state,
        workspace_id,
        &operation,
        destination,
        &canonical_target_session_id,
    )
    .await
    {
        let _ = update_operation_phase(
            root,
            &operation.materialization.operation_id,
            "creating",
            Some(&canonical_target_session_id),
            Some("catalog-commit-failed"),
            now_millis(),
        );
        return Err(format!("catalog-commit-failed: {error}"));
    }
    update_operation_phase(
        root,
        &operation.materialization.operation_id,
        "ready",
        Some(&canonical_target_session_id),
        None,
        now_millis(),
    )
    .map_err(|error| error.to_string())
}

async fn claude_history_contains_marker(
    state: &AppState,
    workspace_id: &str,
    target_session_id: &str,
    marker: &str,
) -> Result<bool, String> {
    let workspace_path = workspace_path(state, workspace_id).await?;
    let config = state
        .engine_manager
        .get_engine_config(EngineType::Claude)
        .await;
    let path = crate::engine::claude_history::resolve_claude_session_file_with_config(
        &workspace_path,
        target_session_id,
        config.as_ref(),
    )?;
    let content = std::fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
    Ok(claude_assistant_ack_in_jsonl(&content, marker))
}

fn claude_assistant_ack_in_jsonl(content: &str, marker: &str) -> bool {
    content.lines().any(|line| {
        let Ok(entry) = serde_json::from_str::<Value>(line) else {
            return false;
        };
        let is_assistant = entry.get("type").and_then(Value::as_str) == Some("assistant")
            || entry.pointer("/message/role").and_then(Value::as_str) == Some("assistant");
        is_assistant
            && entry
                .pointer("/message/content")
                .and_then(Value::as_array)
                .is_some_and(|blocks| {
                    blocks.iter().any(|block| {
                        block.get("text").and_then(Value::as_str).map(str::trim) == Some(marker)
                    })
                })
    })
}

async fn execute_claude(
    state: &AppState,
    workspace_id: &str,
    operation: NativeProviderContinuationOperation,
    destination: &ExecutionTargetInput,
    package: &ContextPackage,
) -> Result<NativeProviderContinuationOperation, String> {
    let root = app_data_root(state)?;
    if operation.phase == "ready" {
        return Ok(operation);
    }

    let marker = context_acceptance_marker(package);
    if let Some(target_session_id) = operation.result_session_id.as_deref() {
        if operation.error_code.as_deref() == Some("catalog-commit-failed") {
            persist_target_metadata(
                state,
                workspace_id,
                &operation,
                destination,
                target_session_id,
            )
            .await?;
            return update_operation_phase(
                root,
                &operation.materialization.operation_id,
                "ready",
                Some(target_session_id),
                None,
                now_millis(),
            )
            .map_err(|error| error.to_string());
        }
        let accepted = if operation.phase == "recovery-required" {
            claude_history_contains_marker(
                state,
                workspace_id,
                target_session_id.trim_start_matches("claude:"),
                &marker,
            )
            .await
            .map_err(|error| format!("recovery-required: {error}"))?
        } else {
            false
        };
        if accepted {
            let canonical_target_session_id =
                format!("claude:{}", target_session_id.trim_start_matches("claude:"));
            persist_target_metadata(
                state,
                workspace_id,
                &operation,
                destination,
                &canonical_target_session_id,
            )
            .await?;
            return update_operation_phase(
                root,
                &operation.materialization.operation_id,
                "ready",
                Some(&canonical_target_session_id),
                None,
                now_millis(),
            )
            .map_err(|error| error.to_string());
        }
        return Err(format!(
            "recovery-required: {}",
            operation
                .error_code
                .as_deref()
                .unwrap_or("acceptance-ambiguous")
        ));
    }
    if operation.phase == "creating" {
        let _ = update_operation_phase(
            root,
            &operation.materialization.operation_id,
            "recovery-required",
            None,
            Some("acceptance-ambiguous"),
            now_millis(),
        );
        return Err("acceptance-ambiguous: target creation state is unknown".to_string());
    }

    let provider_profile_id = destination
        .normalized_provider()
        .ok_or_else(|| "destination provider identity is required".to_string())?;
    let provider_launch_profile =
        crate::engine::claude::resolve_claude_provider_launch_profile(Some(&provider_profile_id))?;
    let workspace_path = workspace_path(state, workspace_id).await?;
    let session = state
        .engine_manager
        .get_claude_session_for_provider(workspace_id, &workspace_path, Some(&provider_profile_id))
        .await;
    let target_native_session_id = uuid::Uuid::new_v4().to_string();
    let canonical_target_session_id = format!("claude:{target_native_session_id}");
    let operation = update_operation_phase(
        root,
        &operation.materialization.operation_id,
        "creating",
        Some(&canonical_target_session_id),
        None,
        now_millis(),
    )
    .map_err(|error| error.to_string())?;
    let prompt = format!(
        "{}\n\n\
         The context above was prepared by MossX from an existing native session. \
         Treat it as prior conversation context. Reply with exactly this acceptance marker \
         and no other text:\n{}",
        package.prompt_prefix, marker
    );
    let params = crate::engine::SendMessageParams {
        text: prompt,
        model: destination.model.clone(),
        session_id: Some(target_native_session_id),
        continue_session: false,
        ..Default::default()
    };
    let turn_id = format!(
        "provider-continuation-{}",
        operation.materialization.operation_id
    );
    let app_settings = state.app_settings.lock().await.clone();
    let response = match session
        .send_message_with_app_settings_and_provider_env(
            params,
            &turn_id,
            Some(&app_settings),
            provider_launch_profile.as_ref().map(|profile| &profile.env),
        )
        .await
    {
        Ok(response) => response,
        Err(error) => {
            let _ = update_operation_phase(
                root,
                &operation.materialization.operation_id,
                "recovery-required",
                Some(&canonical_target_session_id),
                Some("acceptance-ambiguous"),
                now_millis(),
            );
            return Err(format!("acceptance-ambiguous: {error}"));
        }
    };
    if response.trim() != marker {
        let _ = update_operation_phase(
            root,
            &operation.materialization.operation_id,
            "recovery-required",
            Some(&canonical_target_session_id),
            Some("acceptance-ambiguous"),
            now_millis(),
        );
        return Err("acceptance-ambiguous: Claude did not echo the context marker".to_string());
    }
    if let Err(error) = persist_target_metadata(
        state,
        workspace_id,
        &operation,
        destination,
        &canonical_target_session_id,
    )
    .await
    {
        let _ = update_operation_phase(
            root,
            &operation.materialization.operation_id,
            "creating",
            Some(&canonical_target_session_id),
            Some("catalog-commit-failed"),
            now_millis(),
        );
        return Err(format!("catalog-commit-failed: {error}"));
    }
    update_operation_phase(
        root,
        &operation.materialization.operation_id,
        "ready",
        Some(&canonical_target_session_id),
        None,
        now_millis(),
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn create_native_provider_continuation(
    workspace_id: String,
    operation_id: String,
    source: NativeHistorySource,
    destination: ExecutionTargetInput,
    confirm_degraded: Option<bool>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    if crate::remote_backend::is_remote_mode(&*state).await {
        return crate::remote_backend::call_remote(
            &*state,
            app,
            "create_native_provider_continuation",
            json!({
                "workspaceId": workspace_id,
                "operationId": operation_id,
                "source": source,
                "destination": destination,
                "confirmDegraded": confirm_degraded,
            }),
        )
        .await;
    }
    if operation_id.trim().is_empty() {
        return Err("operation_id is required".to_string());
    }
    if source.session_id.trim().is_empty() || source.native_session_id.trim().is_empty() {
        return Err("source session identity is required".to_string());
    }
    let expected_source_session_id = format!(
        "{}:{}",
        engine_name(source.engine),
        source.native_session_id.trim()
    );
    if source.session_id.trim() != expected_source_session_id {
        return Err("source session identity does not match native session identity".to_string());
    }
    if destination.normalized_provider().is_none() {
        return Err("destination provider identity is required".to_string());
    }
    let authoritative_provider =
        crate::session_management::provider_profile_id_for_session_at_path(
            state.storage_path.as_path(),
            &workspace_id,
            &source.session_id,
            engine_name(source.engine),
        )?;
    if authoritative_provider.is_some()
        && authoritative_provider.as_deref() != source.provider_profile_id.as_deref()
    {
        return Err("source provider identity changed; reload the session catalog".to_string());
    }
    if !matches!(destination.engine, EngineType::Codex | EngineType::Claude) {
        return Err(
            "unsupported-target-acceptance: target adapter cannot prove context acceptance"
                .to_string(),
        );
    }
    if source_engine_type(source.engine) == destination.engine
        && source.provider_profile_id.as_deref() == destination.normalized_provider().as_deref()
    {
        return Err("destination provider must differ from the source provider".to_string());
    }

    let (operation, package) = prepare(
        &state,
        &workspace_id,
        operation_id.trim(),
        &source,
        &destination,
    )
    .await?;
    let adapter_dropped_entries = if destination.engine == EngineType::Codex {
        codex_import_projection(&package).1
    } else {
        0
    };
    let degraded = !package.manifest.omitted.is_empty()
        || (destination.engine == EngineType::Codex
            && package.manifest.mode != ProjectionMode::NativeHistoryImport)
        || adapter_dropped_entries > 0;
    if degraded && confirm_degraded != Some(true) {
        return Ok(json!({
            "status": "confirmation-required",
            "operation": operation,
            "fidelity": "degraded",
            "projectionMode": package.manifest.mode,
            "omissions": package.manifest.omitted,
            "adapterDroppedEntries": adapter_dropped_entries,
            "sourceEstimatedTokens": package.compression.source_estimated_tokens,
            "packageEstimatedTokens": package.compression.package_estimated_tokens,
        }));
    }
    let operation = match destination.engine {
        EngineType::Codex => {
            execute_codex(
                &state,
                &app,
                &workspace_id,
                operation,
                &destination,
                &package,
            )
            .await?
        }
        EngineType::Claude => {
            execute_claude(&state, &workspace_id, operation, &destination, &package).await?
        }
        _ => unreachable!("target engine validated above"),
    };
    Ok(json!({
        "status": operation.phase,
        "operation": operation,
        "fidelity": if degraded { "degraded" } else { "strong" },
    }))
}

#[cfg(test)]
mod tests {
    use super::claude_assistant_ack_in_jsonl;

    #[test]
    fn claude_recovery_requires_assistant_ack_not_user_prompt_marker() {
        let marker = "MOSSX_CONTEXT_ACCEPTED:package:checksum";
        let user_only = format!(
            r#"{{"type":"user","message":{{"role":"user","content":[{{"type":"text","text":"{marker}"}}]}}}}"#
        );
        assert!(!claude_assistant_ack_in_jsonl(&user_only, marker));

        let assistant = format!(
            r#"{{"type":"assistant","message":{{"role":"assistant","content":[{{"type":"text","text":"{marker}"}}]}}}}"#
        );
        assert!(claude_assistant_ack_in_jsonl(&assistant, marker));
    }
}
