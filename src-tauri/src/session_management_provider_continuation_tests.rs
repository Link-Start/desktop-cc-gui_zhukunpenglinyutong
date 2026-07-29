#[tokio::test]
async fn continuation_projects_as_top_level_family_and_source_delete_does_not_cascade() {
    let base = std::env::temp_dir().join(format!("provider-continuation-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&base).expect("create temp dir");
    let storage_path = base.join("workspaces.json");
    std::fs::write(&storage_path, "[]").expect("seed storage path");
    let workspace = workspace_entry("ws-1", "Workspace", "/tmp/ws-1", WorkspaceKind::Main, None);
    let workspaces = Mutex::new(HashMap::from([(workspace.id.clone(), workspace)]));

    let recorded = record_provider_continuation_metadata_core(
        &workspaces,
        &storage_path,
        "ws-1".to_string(),
        "target-1".to_string(),
        "claude:source-1".to_string(),
        Some("provider-a".to_string()),
    )
    .await
    .expect("record continuation");
    assert_eq!(recorded.family_id, "claude:ws-1:source-1");
    assert_eq!(recorded.lineage_depth, 1);

    let mut metadata = read_catalog_metadata(&storage_path, "ws-1").expect("read metadata");
    let target_key = provider_continuation_stable_key_for_session_id("ws-1", "target-1");
    remove_catalog_metadata_for_session(&mut metadata, "ws-1", "claude:source-1");
    assert!(metadata
        .provider_continuation_by_session_key
        .contains_key(&target_key));

    let metadata_by_workspace_id = HashMap::from([("ws-1".to_string(), metadata)]);
    let target = finalize_existing_catalog_entry(
        catalog_entry("target-1", "ws-1", None, None),
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

#[test]
fn legacy_codex_continuation_keys_restore_raw_rows_and_family_chain() {
    let workspace_id = "ws-1";
    let root_family = "codex:ws-1:source-1";
    let mut metadata = WorkspaceSessionCatalogMetadata::default();
    metadata.provider_continuation_by_session_key.insert(
        "codex:ws-1:codex:target-1".to_string(),
        ProviderContinuationMetadata {
            origin_kind: "provider-continuation".to_string(),
            source_session_id: "source-1".to_string(),
            source_provider_profile_id: Some("provider-a".to_string()),
            family_id: root_family.to_string(),
            family_root_session_id: root_family.to_string(),
            lineage_parent_session_id: "source-1".to_string(),
            lineage_kind: "provider-continuation".to_string(),
            lineage_depth: 1,
        },
    );
    metadata.provider_continuation_by_session_key.insert(
        "codex:ws-1:codex:target-2".to_string(),
        ProviderContinuationMetadata {
            origin_kind: "provider-continuation".to_string(),
            source_session_id: "target-1".to_string(),
            source_provider_profile_id: Some("provider-b".to_string()),
            family_id: "codex:ws-1:target-1".to_string(),
            family_root_session_id: "codex:ws-1:target-1".to_string(),
            lineage_parent_session_id: "target-1".to_string(),
            lineage_kind: "provider-continuation".to_string(),
            lineage_depth: 1,
        },
    );
    let metadata_by_workspace_id =
        HashMap::from([(workspace_id.to_string(), metadata.clone())]);

    let first = finalize_existing_catalog_entry(
        catalog_entry("target-1", workspace_id, None, None),
        &metadata_by_workspace_id,
    );
    let second = finalize_existing_catalog_entry(
        catalog_entry("target-2", workspace_id, None, None),
        &metadata_by_workspace_id,
    );

    assert_eq!(
        first.continuation.family_id.as_deref(),
        Some(root_family)
    );
    assert_eq!(first.continuation.lineage_depth, Some(1));
    assert_eq!(
        second.continuation.family_id.as_deref(),
        Some(root_family)
    );
    assert_eq!(
        second.continuation.family_root_session_id.as_deref(),
        Some(root_family)
    );
    assert_eq!(second.continuation.lineage_depth, Some(2));
    assert!(catalog_metadata_lookup_keys_for_entry(&catalog_entry(
        "target-2",
        workspace_id,
        None,
        None,
    ))
    .contains(&"codex:ws-1:codex:target-2".to_string()));
}

#[test]
fn cyclic_legacy_codex_lineage_does_not_recurse_forever() {
    let mut metadata = WorkspaceSessionCatalogMetadata::default();
    for (target, source) in [("target-a", "target-b"), ("target-b", "target-a")] {
        metadata.provider_continuation_by_session_key.insert(
            format!("codex:ws-1:codex:{target}"),
            ProviderContinuationMetadata {
                origin_kind: "provider-continuation".to_string(),
                source_session_id: source.to_string(),
                source_provider_profile_id: None,
                family_id: format!("codex:ws-1:{target}"),
                family_root_session_id: format!("codex:ws-1:{target}"),
                lineage_parent_session_id: source.to_string(),
                lineage_kind: "provider-continuation".to_string(),
                lineage_depth: 1,
            },
        );
    }

    let resolved =
        resolve_provider_continuation_metadata(&metadata, "ws-1", "target-a", "codex")
            .expect("cycle should preserve a safe projection");
    assert_eq!(resolved.origin_kind, "provider-continuation");
    assert!(resolved.lineage_depth >= 1);
}
