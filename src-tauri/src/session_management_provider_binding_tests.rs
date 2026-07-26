#[test]
fn engine_provider_binding_uses_explicit_engine_for_unprefixed_session_id() {
    let binding = EngineProviderBinding {
        provider_profile_id: "kimi-provider-a".to_string(),
        provider_profile_source: "managed".to_string(),
        provider_profile_name: "Kimi Provider A".to_string(),
        provider_availability: "available".to_string(),
    };
    let metadata = WorkspaceSessionCatalogMetadata {
        engine_provider_binding_by_session_key: HashMap::from([(
            "kimi:ws-1:native-session-1".to_string(),
            binding.clone(),
        )]),
        ..Default::default()
    };

    assert_eq!(
        engine_provider_binding_for_session(&metadata, "ws-1", "native-session-1", "kimi"),
        Some(binding)
    );
    assert!(
        engine_provider_binding_for_session(&metadata, "ws-1", "native-session-1", "codex")
            .is_none()
    );
}

#[test]
fn engine_provider_binding_projects_for_claude_and_kimi() {
    let metadata = WorkspaceSessionCatalogMetadata {
        engine_provider_binding_by_session_key: HashMap::from([
            (
                "claude:ws-1:claude-session-1".to_string(),
                EngineProviderBinding {
                    provider_profile_id: "claude-provider-a".to_string(),
                    provider_profile_source: "managed".to_string(),
                    provider_profile_name: "Claude Provider A".to_string(),
                    provider_availability: "available".to_string(),
                },
            ),
            (
                "kimi:ws-1:kimi-session-1".to_string(),
                EngineProviderBinding {
                    provider_profile_id: "kimi-provider-a".to_string(),
                    provider_profile_source: "managed".to_string(),
                    provider_profile_name: "Kimi Provider A".to_string(),
                    provider_availability: "available".to_string(),
                },
            ),
        ]),
        ..Default::default()
    };
    let metadata_by_workspace_id = HashMap::from([("ws-1".to_string(), metadata)]);
    let mut claude = catalog_entry("claude:claude-session-1", "ws-1", None, None);
    claude.engine = "claude".to_string();
    let mut kimi = catalog_entry("kimi:kimi-session-1", "ws-1", None, None);
    kimi.engine = "kimi".to_string();

    let claude = finalize_existing_catalog_entry(claude, &metadata_by_workspace_id);
    let kimi = finalize_existing_catalog_entry(kimi, &metadata_by_workspace_id);

    assert_eq!(
        claude.provider_profile_id.as_deref(),
        Some("claude-provider-a")
    );
    assert_eq!(
        kimi.provider_profile_name.as_deref(),
        Some("Kimi Provider A")
    );
}

#[tokio::test]
async fn record_engine_provider_binding_is_idempotent_and_restart_readable() {
    let base = std::env::temp_dir().join(format!("engine-provider-binding-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&base).expect("create temp dir");
    let storage_path = base.join("workspaces.json");
    std::fs::write(&storage_path, "[]").expect("seed storage path");
    let workspace = workspace_entry("ws-1", "Workspace", "/tmp/ws-1", WorkspaceKind::Main, None);
    let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));
    let binding = EngineProviderBinding {
        provider_profile_id: "provider-a".to_string(),
        provider_profile_source: "managed".to_string(),
        provider_profile_name: "Provider A".to_string(),
        provider_availability: "available".to_string(),
    };

    assert!(record_engine_provider_binding_core(
        &workspaces,
        &storage_path,
        "ws-1".to_string(),
        "native-session-1".to_string(),
        "kimi".to_string(),
        binding.clone(),
    )
    .await
    .expect("record binding"));
    assert!(!record_engine_provider_binding_core(
        &workspaces,
        &storage_path,
        "ws-1".to_string(),
        "native-session-1".to_string(),
        "kimi".to_string(),
        binding.clone(),
    )
    .await
    .expect("skip unchanged binding"));

    let reloaded = read_catalog_metadata(&storage_path, "ws-1").expect("reload metadata");
    assert_eq!(
        engine_provider_binding_for_session(&reloaded, "ws-1", "native-session-1", "kimi"),
        Some(binding)
    );
    std::fs::remove_dir_all(base).ok();
}

#[test]
fn effective_engine_provider_profile_prefers_request_then_catalog_then_default() {
    let base = std::env::temp_dir().join(format!("engine-provider-resolution-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&base).expect("create temp dir");
    let storage_path = base.join("workspaces.json");
    std::fs::write(&storage_path, "[]").expect("seed storage path");
    with_catalog_metadata_mutation(&storage_path, "ws-1", |metadata| {
        metadata.engine_provider_binding_by_session_key.insert(
            "claude:ws-1:session-1".to_string(),
            EngineProviderBinding {
                provider_profile_id: "persisted-provider".to_string(),
                provider_profile_source: "managed".to_string(),
                provider_profile_name: "Persisted Provider".to_string(),
                provider_availability: "available".to_string(),
            },
        );
        Ok(())
    })
    .expect("seed provider binding");

    assert_eq!(
        resolve_engine_provider_profile_id(
            &storage_path,
            "ws-1",
            Some("claude:session-1"),
            "claude",
            Some("request-provider"),
        )
        .expect("resolve request binding")
        .as_deref(),
        Some("request-provider")
    );
    assert_eq!(
        resolve_engine_provider_profile_id(
            &storage_path,
            "ws-1",
            Some("claude:session-1"),
            "claude",
            None,
        )
        .expect("resolve persisted binding")
        .as_deref(),
        Some("persisted-provider")
    );
    assert_eq!(
        resolve_engine_provider_profile_id(
            &storage_path,
            "ws-1",
            Some("claude:unknown"),
            "claude",
            None,
        )
        .expect("resolve default"),
        None
    );
    std::fs::remove_dir_all(base).ok();
}

#[test]
fn deleting_session_metadata_removes_provider_bindings() {
    let stable_key = "claude:ws-1:session-1".to_string();
    let binding = EngineProviderBinding {
        provider_profile_id: "provider-a".to_string(),
        provider_profile_source: "managed".to_string(),
        provider_profile_name: "Provider A".to_string(),
        provider_availability: "available".to_string(),
    };
    let mut metadata = WorkspaceSessionCatalogMetadata {
        engine_provider_binding_by_session_key: HashMap::from([(
            stable_key.clone(),
            binding.clone(),
        )]),
        codex_provider_binding_by_session_id: HashMap::from([(
            "claude:session-1".to_string(),
            binding,
        )]),
        ..Default::default()
    };

    remove_catalog_metadata_for_session(&mut metadata, "ws-1", "claude:session-1");

    assert!(!metadata
        .engine_provider_binding_by_session_key
        .contains_key(&stable_key));
    assert!(!metadata
        .codex_provider_binding_by_session_id
        .contains_key("claude:session-1"));
}
