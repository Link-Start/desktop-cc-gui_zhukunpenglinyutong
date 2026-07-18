//! Engine manager
//!
//! Unified management of multiple engine types, handling engine switching,
//! session management, and configuration.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

use super::claude::{ClaudeSession, ClaudeSessionManager};
use super::gemini::GeminiSession;
use super::opencode::OpenCodeSession;
use super::status::{
    detect_all_engines, detect_claude_status, detect_codex_status, detect_opencode_status,
};
use super::{disabled_engine_status, EngineConfig, EngineStatus, EngineType};

/// Unified engine manager
pub struct EngineManager {
    /// Currently active engine type (global default)
    active_engine: RwLock<EngineType>,

    /// Cached engine statuses
    engine_statuses: RwLock<HashMap<EngineType, EngineStatus>>,

    /// Claude session manager. Wrapped in `Arc` so the in-process AskUserQuestion
    /// MCP server can hold a shared handle for session lookup (see `askuser_mcp`).
    pub claude_manager: Arc<ClaudeSessionManager>,

    /// OpenCode sessions per workspace
    opencode_sessions: Mutex<HashMap<String, Arc<OpenCodeSession>>>,

    /// Gemini sessions per workspace
    gemini_sessions: Mutex<GeminiSessionRegistry>,

    /// Engine configurations
    engine_configs: RwLock<HashMap<EngineType, EngineConfig>>,
}

#[derive(Default)]
struct GeminiSessionRegistry {
    sessions: HashMap<String, Arc<GeminiSession>>,
    // Workspace ID 是非复用 UUID；持久 tombstone 阻止旧请求在删除后重新取得 process owner。
    removed_workspaces: HashSet<String>,
    shutting_down: bool,
}

impl EngineManager {
    /// Create a new engine manager
    pub fn new() -> Self {
        Self {
            active_engine: RwLock::new(EngineType::default()),
            engine_statuses: RwLock::new(HashMap::new()),
            claude_manager: Arc::new(ClaudeSessionManager::new()),
            opencode_sessions: Mutex::new(HashMap::new()),
            gemini_sessions: Mutex::new(GeminiSessionRegistry::default()),
            engine_configs: RwLock::new(HashMap::new()),
        }
    }

    /// Get the currently active engine type
    pub async fn get_active_engine(&self) -> EngineType {
        *self.active_engine.read().await
    }

    /// Set the active engine type
    pub async fn set_active_engine(&self, engine_type: EngineType) -> Result<(), String> {
        // Verify engine is installed
        let statuses = self.engine_statuses.read().await;
        if let Some(status) = statuses.get(&engine_type) {
            if !status.installed {
                return Err(format!(
                    "{} is not installed. Please install it first.",
                    engine_type.display_name()
                ));
            }
        } else {
            // Status not cached, check now
            drop(statuses);
            let status = self.detect_single_engine(engine_type).await;
            if !status.installed {
                return Err(format!(
                    "{} is not installed. Please install it first.",
                    engine_type.display_name()
                ));
            }
        }

        *self.active_engine.write().await = engine_type;
        Ok(())
    }

    /// Detect a single engine's status
    async fn detect_single_engine(&self, engine_type: EngineType) -> EngineStatus {
        self.detect_single_engine_with_gates(engine_type, true, true)
            .await
    }

    async fn detect_single_engine_with_gates(
        &self,
        engine_type: EngineType,
        _gemini_enabled: bool,
        opencode_enabled: bool,
    ) -> EngineStatus {
        let configs = self.engine_configs.read().await;
        let config = configs.get(&engine_type);
        let bin = config.and_then(|c| c.bin_path.as_deref());

        let status = match engine_type {
            EngineType::Claude => detect_claude_status(bin).await,
            EngineType::Codex => detect_codex_status(bin).await,
            EngineType::Gemini => disabled_engine_status(engine_type),
            EngineType::OpenCode if !opencode_enabled => disabled_engine_status(engine_type),
            EngineType::OpenCode => detect_opencode_status(bin).await,
        };

        // Cache the result
        let mut statuses = self.engine_statuses.write().await;
        statuses.insert(engine_type, status.clone());

        status
    }

    /// Force-refresh a single engine status while honoring CLI validation gates.
    pub async fn refresh_engine_status_with_gates(
        &self,
        engine_type: EngineType,
        gemini_enabled: bool,
        opencode_enabled: bool,
    ) -> EngineStatus {
        self.detect_single_engine_with_gates(engine_type, gemini_enabled, opencode_enabled)
            .await
    }

    pub async fn detect_engines_with_gates(
        &self,
        gemini_enabled: bool,
        opencode_enabled: bool,
    ) -> Vec<EngineStatus> {
        let gemini_enabled = gemini_enabled && crate::engine_policy::GEMINI_RUNTIME_ENABLED;
        let (claude_bin, codex_bin, gemini_bin, opencode_bin) = {
            let configs = self.engine_configs.read().await;
            (
                configs
                    .get(&EngineType::Claude)
                    .and_then(|c| c.bin_path.clone()),
                configs
                    .get(&EngineType::Codex)
                    .and_then(|c| c.bin_path.clone()),
                configs
                    .get(&EngineType::Gemini)
                    .and_then(|c| c.bin_path.clone()),
                configs
                    .get(&EngineType::OpenCode)
                    .and_then(|c| c.bin_path.clone()),
            )
        };

        let statuses = detect_all_engines(
            claude_bin.as_deref(),
            codex_bin.as_deref(),
            gemini_bin.as_deref(),
            opencode_bin.as_deref(),
            gemini_enabled,
            opencode_enabled,
        )
        .await;

        let statuses = statuses
            .into_iter()
            .map(|status| match status.engine_type {
                EngineType::Gemini if !gemini_enabled => disabled_engine_status(EngineType::Gemini),
                EngineType::OpenCode if !opencode_enabled => {
                    disabled_engine_status(EngineType::OpenCode)
                }
                _ => status,
            })
            .collect::<Vec<_>>();

        // Cache results
        let mut cached = self.engine_statuses.write().await;
        for status in &statuses {
            cached.insert(status.engine_type, status.clone());
        }

        statuses
    }

    /// Get cached engine status
    pub async fn get_engine_status(&self, engine_type: EngineType) -> Option<EngineStatus> {
        let statuses = self.engine_statuses.read().await;
        statuses.get(&engine_type).cloned()
    }

    /// Get all cached engine statuses
    pub async fn get_all_statuses(&self) -> Vec<EngineStatus> {
        let statuses = self.engine_statuses.read().await;
        statuses.values().cloned().collect()
    }

    /// Set engine configuration
    pub async fn set_engine_config(&self, engine_type: EngineType, config: EngineConfig) {
        let mut configs = self.engine_configs.write().await;
        configs.insert(engine_type, config.clone());

        // Update Claude manager if it's Claude config
        if engine_type == EngineType::Claude {
            self.claude_manager.set_config(config).await;
        }
    }

    /// Get engine configuration
    pub async fn get_engine_config(&self, engine_type: EngineType) -> Option<EngineConfig> {
        let configs = self.engine_configs.read().await;
        configs.get(&engine_type).cloned()
    }

    // ==================== Claude Session Management ====================

    /// Get or create a Claude session for a workspace
    pub async fn get_claude_session(
        &self,
        workspace_id: &str,
        workspace_path: &Path,
    ) -> Arc<ClaudeSession> {
        self.claude_manager
            .get_or_create_session(workspace_id, workspace_path)
            .await
    }

    /// Remove a Claude session
    pub async fn remove_claude_session(&self, workspace_id: &str) {
        if let Some(session) = self.claude_manager.remove_session(workspace_id).await {
            session.mark_disposed();
            if let Err(error) = session.interrupt().await {
                log::warn!(
                    "[engine_manager] failed to interrupt claude session during remove (workspace={}): {}",
                    workspace_id,
                    error
                );
            }
        }
    }

    /// The GUI runtime no longer tracks Codex adapters locally. Keep cleanup callers stable.
    pub async fn remove_codex_adapter(&self, _workspace_id: &str) {}

    // ==================== OpenCode Session Management ====================

    /// Get or create an OpenCode session for a workspace
    pub async fn get_or_create_opencode_session(
        &self,
        workspace_id: &str,
        workspace_path: &Path,
    ) -> Arc<OpenCodeSession> {
        {
            let sessions = self.opencode_sessions.lock().await;
            if let Some(session) = sessions.get(workspace_id) {
                return session.clone();
            }
        }

        let config = self.get_engine_config(EngineType::OpenCode).await;
        let session = Arc::new(OpenCodeSession::new(
            workspace_id.to_string(),
            workspace_path.to_path_buf(),
            config,
        ));
        let mut sessions = self.opencode_sessions.lock().await;
        sessions.insert(workspace_id.to_string(), session.clone());
        session
    }

    /// Get OpenCode session by workspace
    pub async fn get_opencode_session(&self, workspace_id: &str) -> Option<Arc<OpenCodeSession>> {
        let sessions = self.opencode_sessions.lock().await;
        sessions.get(workspace_id).cloned()
    }

    /// Remove an OpenCode session
    pub async fn remove_opencode_session(&self, workspace_id: &str) {
        let mut sessions = self.opencode_sessions.lock().await;
        sessions.remove(workspace_id);
    }

    // ==================== Gemini Session Management ====================

    /// Get or create a Gemini session for a workspace
    pub async fn get_or_create_gemini_session(
        &self,
        workspace_id: &str,
        workspace_path: &Path,
    ) -> Result<Arc<GeminiSession>, String> {
        {
            let registry = self.gemini_sessions.lock().await;
            if registry.shutting_down {
                return Err("Gemini session manager is shutting down".to_string());
            }
            if registry.removed_workspaces.contains(workspace_id) {
                return Err(format!(
                    "Gemini session owner is unavailable for removed workspace: {workspace_id}"
                ));
            }
            if let Some(session) = registry.sessions.get(workspace_id) {
                return Ok(session.clone());
            }
        }

        let config = self.get_engine_config(EngineType::Gemini).await;
        let mut registry = self.gemini_sessions.lock().await;
        if registry.shutting_down {
            return Err("Gemini session manager is shutting down".to_string());
        }
        if registry.removed_workspaces.contains(workspace_id) {
            return Err(format!(
                "Gemini session owner is unavailable for removed workspace: {workspace_id}"
            ));
        }
        if let Some(session) = registry.sessions.get(workspace_id) {
            return Ok(session.clone());
        }
        let session = Arc::new(GeminiSession::new(
            workspace_id.to_string(),
            workspace_path.to_path_buf(),
            config,
        ));
        registry
            .sessions
            .insert(workspace_id.to_string(), session.clone());
        Ok(session)
    }

    /// Get Gemini session by workspace
    pub async fn get_gemini_session(&self, workspace_id: &str) -> Option<Arc<GeminiSession>> {
        let registry = self.gemini_sessions.lock().await;
        registry.sessions.get(workspace_id).cloned()
    }

    /// Snapshot all tracked OpenCode sessions.
    pub async fn list_opencode_sessions(&self) -> Vec<(String, Arc<OpenCodeSession>)> {
        let sessions = self.opencode_sessions.lock().await;
        sessions
            .iter()
            .map(|(workspace_id, session)| (workspace_id.clone(), session.clone()))
            .collect()
    }

    /// Snapshot all tracked Gemini sessions.
    pub async fn list_gemini_sessions(&self) -> Vec<(String, Arc<GeminiSession>)> {
        let registry = self.gemini_sessions.lock().await;
        registry
            .sessions
            .iter()
            .map(|(workspace_id, session)| (workspace_id.clone(), session.clone()))
            .collect()
    }
    /// Remove a Gemini session
    pub async fn remove_gemini_session(&self, workspace_id: &str) -> Result<(), String> {
        let session = {
            let mut registry = self.gemini_sessions.lock().await;
            if registry.shutting_down {
                return Err("Gemini session manager is shutting down".to_string());
            }
            registry.removed_workspaces.insert(workspace_id.into());
            registry.sessions.get(workspace_id).cloned()
        };
        let Some(session) = session else {
            return Ok(());
        };
        session.close().await.map_err(|error| {
            format!("failed to close Gemini session for workspace {workspace_id}: {error}")
        })?;

        let mut registry = self.gemini_sessions.lock().await;
        let should_remove = registry
            .sessions
            .get(workspace_id)
            .is_some_and(|current| Arc::ptr_eq(current, &session));
        if should_remove {
            registry.sessions.remove(workspace_id);
        }
        Ok(())
    }

    /// Drain and terminate all Gemini sessions during host shutdown.
    pub async fn shutdown_gemini_sessions(&self) -> Result<(), String> {
        let sessions = {
            let mut registry = self.gemini_sessions.lock().await;
            registry.shutting_down = true;
            registry
                .sessions
                .iter()
                .map(|(workspace_id, session)| (workspace_id.clone(), Arc::clone(session)))
                .collect::<Vec<_>>()
        };
        let mut cleanup_errors = Vec::new();
        for (workspace_id, session) in sessions {
            if let Err(error) = session.close().await {
                cleanup_errors.push(format!("{workspace_id}: {error}"));
                continue;
            }
            let mut registry = self.gemini_sessions.lock().await;
            let should_remove = registry
                .sessions
                .get(&workspace_id)
                .is_some_and(|current| Arc::ptr_eq(current, &session));
            if should_remove {
                registry.sessions.remove(&workspace_id);
            }
        }
        if cleanup_errors.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "failed to close {} Gemini session(s): {}",
                cleanup_errors.len(),
                cleanup_errors.join("; ")
            ))
        }
    }

    // ==================== Utility Methods ====================

    /// Check if an engine is available (installed and ready)
    pub async fn is_engine_available(&self, engine_type: EngineType) -> bool {
        if let Some(status) = self.get_engine_status(engine_type).await {
            status.installed
        } else {
            let status = self.detect_single_engine(engine_type).await;
            status.installed
        }
    }

    /// Get list of available (installed) engines
    pub async fn get_available_engines(&self) -> Vec<EngineType> {
        let statuses = self.engine_statuses.read().await;
        statuses
            .iter()
            .filter(|(_, status)| status.installed)
            .map(|(engine_type, _)| *engine_type)
            .collect()
    }
}

impl Default for EngineManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn default_engine_is_claude() {
        let manager = EngineManager::new();
        assert_eq!(manager.get_active_engine().await, EngineType::Claude);
    }

    #[tokio::test]
    async fn engine_config_storage() {
        let manager = EngineManager::new();

        let config = EngineConfig {
            bin_path: Some("/custom/claude".to_string()),
            ..Default::default()
        };

        manager
            .set_engine_config(EngineType::Claude, config.clone())
            .await;

        let retrieved = manager.get_engine_config(EngineType::Claude).await;
        assert!(retrieved.is_some());
        assert_eq!(
            retrieved.unwrap().bin_path,
            Some("/custom/claude".to_string())
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 4)]
    async fn concurrent_gemini_creation_returns_single_owned_session() {
        const CALLER_COUNT: usize = 32;

        let manager = Arc::new(EngineManager::new());
        let workspace_path = Arc::new(std::env::temp_dir().join(format!(
            "ccgui-concurrent-gemini-session-{}",
            std::process::id()
        )));
        let start = Arc::new(tokio::sync::Barrier::new(CALLER_COUNT + 1));
        let config_guard = manager.engine_configs.write().await;
        let mut callers = Vec::with_capacity(CALLER_COUNT);

        for _ in 0..CALLER_COUNT {
            let manager = Arc::clone(&manager);
            let workspace_path = Arc::clone(&workspace_path);
            let start = Arc::clone(&start);
            callers.push(tokio::spawn(async move {
                start.wait().await;
                manager
                    .get_or_create_gemini_session("shared-workspace", workspace_path.as_path())
                    .await
                    .expect("concurrent Gemini creation should stay available")
            }));
        }

        start.wait().await;
        for _ in 0..CALLER_COUNT {
            tokio::task::yield_now().await;
        }
        drop(config_guard);

        let mut returned_sessions = Vec::with_capacity(CALLER_COUNT);
        for caller in callers {
            returned_sessions.push(caller.await.expect("Gemini session caller should join"));
        }
        let first = returned_sessions
            .first()
            .expect("at least one Gemini session");
        assert!(returned_sessions
            .iter()
            .all(|session| Arc::ptr_eq(first, session)));

        let tracked = manager
            .get_gemini_session("shared-workspace")
            .await
            .expect("manager should track the shared Gemini session");
        assert!(Arc::ptr_eq(first, &tracked));
        assert_eq!(manager.list_gemini_sessions().await.len(), 1);
    }

    #[tokio::test]
    async fn repeated_remove_retries_session_retained_behind_tombstone() {
        let manager = EngineManager::new();
        let workspace_path =
            std::env::temp_dir().join(format!("ccgui-gemini-remove-retry-{}", std::process::id()));
        manager
            .get_or_create_gemini_session("remove-retry", &workspace_path)
            .await
            .expect("create initial Gemini session");
        manager
            .remove_gemini_session("remove-retry")
            .await
            .expect("remove initial Gemini session");

        let retained_session = Arc::new(GeminiSession::new(
            "remove-retry".to_string(),
            workspace_path.clone(),
            None,
        ));
        manager
            .gemini_sessions
            .lock()
            .await
            .sessions
            .insert("remove-retry".to_string(), retained_session);

        manager
            .remove_gemini_session("remove-retry")
            .await
            .expect("retry retained Gemini session removal");

        assert!(manager.get_gemini_session("remove-retry").await.is_none());
        assert!(manager
            .get_or_create_gemini_session("remove-retry", &workspace_path)
            .await
            .is_err());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn legacy_enabled_bulk_detection_does_not_spawn_configured_gemini_cli() {
        use std::os::unix::fs::PermissionsExt;

        let manager = EngineManager::new();
        let test_dir = std::env::temp_dir().join(format!(
            "ccgui-gemini-detection-policy-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&test_dir).expect("create detection policy test directory");
        let script_path = test_dir.join("fake-gemini");
        let marker_path = test_dir.join("spawned");
        std::fs::write(
            &script_path,
            format!("#!/bin/sh\nprintf spawned > '{}'\n", marker_path.display()),
        )
        .expect("write fake Gemini CLI");
        let mut permissions = std::fs::metadata(&script_path)
            .expect("read fake Gemini CLI metadata")
            .permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&script_path, permissions)
            .expect("make fake Gemini CLI executable");
        manager
            .set_engine_config(
                EngineType::Gemini,
                EngineConfig {
                    bin_path: Some(script_path.to_string_lossy().to_string()),
                    ..Default::default()
                },
            )
            .await;

        let statuses = manager.detect_engines_with_gates(true, false).await;
        let status = statuses
            .iter()
            .find(|status| status.engine_type == EngineType::Gemini)
            .expect("bulk detection should include disabled Gemini status");

        assert!(!status.installed);
        assert_eq!(
            status.error.as_deref(),
            Some(crate::engine_policy::GEMINI_DISABLED_DIAGNOSTIC)
        );
        assert!(
            !marker_path.exists(),
            "disabled Gemini detection must not spawn"
        );
        let _ = std::fs::remove_dir_all(test_dir);
    }

    #[tokio::test]
    async fn gated_refresh_returns_disabled_status_for_disabled_optional_engine() {
        let manager = EngineManager::new();

        let status = manager
            .refresh_engine_status_with_gates(EngineType::OpenCode, true, false)
            .await;

        assert_eq!(status.engine_type, EngineType::OpenCode);
        assert!(!status.installed);
        assert_eq!(
            status.error.as_deref(),
            Some(super::super::OPENCODE_DISABLED_DIAGNOSTIC)
        );

        let cached = manager
            .get_engine_status(EngineType::OpenCode)
            .await
            .expect("status should be cached");
        assert_eq!(
            cached.error.as_deref(),
            Some(super::super::OPENCODE_DISABLED_DIAGNOSTIC)
        );
    }
}
