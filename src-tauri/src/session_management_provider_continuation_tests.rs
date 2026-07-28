#[tokio::test]
async fn continuation_projects_as_top_level_family_and_source_delete_does_not_cascade() {
    let base =
        std::env::temp_dir().join(format!("provider-continuation-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&base).expect("create temp dir");
    let storage_path = base.join("workspaces.json");
    std::fs::write(&storage_path, "[]").expect("seed storage path");
    let workspace = workspace_entry(
        "ws-1",
        "Workspace",
        "/tmp/ws-1",
        WorkspaceKind::Main,
        None,
    );
    let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));

    let recorded = record_provider_continuation_metadata_core(
        &workspaces,
        &storage_path,
        "ws-1".to_string(),
        "codex:target-1".to_string(),
        "claude:source-1".to_string(),
        Some("provider-a".to_string()),
    )
    .await
    .expect("record continuation");
    assert_eq!(recorded.family_id, "claude:ws-1:source-1");
    assert_eq!(recorded.lineage_depth, 1);

    let mut metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
    let target_key = metadata_stable_key_for_session_id("ws-1", "codex:target-1");
    remove_catalog_metadata_for_session(&mut metadata, "ws-1", "claude:source-1");
    assert!(metadata
        .provider_continuation_by_session_key
        .contains_key(&target_key));

    let metadata_by_workspace_id = HashMap::from([("ws-1".to_string(), metadata)]);
    let target = finalize_existing_catalog_entry(
        catalog_entry("codex:target-1", "ws-1", None, None),
        &metadata_by_workspace_id,
    );
    assert!(target.parent_session_id.is_none());
    assert_eq!(
        target.continuation.origin_kind.as_deref(),
        Some("provider-continuation")
    );
    assert_eq!(
        target.continuation.lineage_parent_session_id.as_deref(),
        Some("claude:source-1")
    );
    std::fs::remove_dir_all(base).ok();
}
