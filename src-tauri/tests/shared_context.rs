//! Change C 增量集成测试：deterministic package、artifact ownership、two-phase cursor。

mod common;

use cc_gui_lib::shared_context::{
    accept_delivery, compile_context, read_artifact, write_artifact, AcceptDeliveryRequest,
    ArtifactReadRequest, CompileContextRequest, PrepareDeliveryRequest, RuntimeContextCapabilities,
};
use cc_gui_lib::shared_event_log::{open, OpenOutcome, SharedEventWriter};
use cc_gui_lib::shared_session_v2::{
    accept_turn_core, begin_turn_core, commit_turn_core, CommitOutcomeInput, EngineType,
    ExecutionTargetInput,
};
use common::TempStoreDir;
use serde_json::json;

const SESSION: &str = "context-session";

fn writer(store: &TempStoreDir) -> SharedEventWriter {
    match open(&store.db_path).expect("open store") {
        OpenOutcome::Ready(writer) => writer,
        OpenOutcome::ReadOnlyRecovery { reason, .. } => panic!("unexpected recovery: {reason}"),
    }
}

fn target(provider: Option<&str>) -> ExecutionTargetInput {
    ExecutionTargetInput {
        engine: EngineType::Claude,
        provider_profile_id: provider.map(str::to_string),
        model: Some("claude-sonnet-4-5".to_string()),
        reasoning_effort: None,
        provider_profile_name_snapshot: None,
        provider_profile_source: None,
        runtime_capability_fingerprint: Some("test".to_string()),
    }
}

fn completed() -> CommitOutcomeInput {
    CommitOutcomeInput {
        status: "completed".to_string(),
        error_code: None,
        error_message: None,
        stop_reason: Some("end_turn".to_string()),
    }
}

fn seed_history(writer: &SharedEventWriter) {
    let source = target(None);
    let begin = begin_turn_core(writer, SESSION, &source, "历史问题".to_string()).expect("begin");
    let attempt = begin.attempt_id.expect("attempt");
    let turn = begin.logical_turn_id.expect("turn");
    accept_turn_core(writer, SESSION, &attempt, &turn, &source, "claude:source").expect("accept");
    commit_turn_core(
        writer,
        SESSION,
        &attempt,
        &turn,
        &source,
        Some("历史答案".to_string()),
        &completed(),
        Some("claude:source".to_string()),
    )
    .expect("commit");
}

fn capabilities() -> RuntimeContextCapabilities {
    RuntimeContextCapabilities {
        native_delta: false,
        structured_history_import: false,
        native_clone: false,
        user_channel_transcript: true,
        tool_history: false,
        image_history: false,
        strong_context_ack: false,
    }
}

#[test]
fn package_artifact_and_two_phase_cursor_close_without_replay_gap() {
    let store = TempStoreDir::new("context-delivery");
    let writer = writer(&store);
    seed_history(&writer);

    let destination = target(Some("provider-b"));
    let begin =
        begin_turn_core(&writer, SESSION, &destination, "新问题".to_string()).expect("begin B");
    let attempt_id = begin.attempt_id.expect("attempt B");
    let logical_turn_id = begin.logical_turn_id.expect("turn B");
    let requested_sequence = writer
        .events_for_session(SESSION)
        .expect("events")
        .into_iter()
        .find(|event| event.attempt_id.as_deref() == Some(&attempt_id))
        .expect("requested")
        .sequence;
    let compile_request = CompileContextRequest {
        session_id: SESSION.to_string(),
        binding_key: "claude:provider-b".to_string(),
        destination: json!({ "engine": "claude", "providerProfileId": "provider-b" }),
        destination_native_session_id: None,
        from_sequence_exclusive: None,
        through_sequence_inclusive: Some(requested_sequence - 1),
        exclude_attempt_id: Some(attempt_id.clone()),
        capabilities: capabilities(),
        budget_estimated_tokens: None,
    };
    let events = writer.events_for_session(SESSION).expect("events");
    let first = compile_context(&events, &compile_request).expect("compile");
    let second = compile_context(&events, &compile_request).expect("recompile");
    let mut changed_destination = compile_request.clone();
    changed_destination.destination =
        json!({ "engine": "claude", "providerProfileId": "provider-c" });
    let destination_package =
        compile_context(&events, &changed_destination).expect("destination compile");
    let mut changed_budget = compile_request.clone();
    changed_budget.budget_estimated_tokens = Some(1);
    let budget_package = compile_context(&events, &changed_budget).expect("budget compile");
    assert_eq!(first.package_id, second.package_id);
    assert_ne!(first.package_id, destination_package.package_id);
    assert_ne!(first.package_id, budget_package.package_id);
    assert_eq!(
        first.manifest.source_checksum,
        second.manifest.source_checksum
    );
    assert_eq!(
        first.stable_prefix.as_bytes(),
        second.stable_prefix.as_bytes()
    );
    assert!(first.prompt_prefix.contains("历史问题"));
    assert!(first.prompt_prefix.contains("历史答案"));
    assert!(!first.prompt_prefix.contains("新问题"));

    let artifact =
        write_artifact(&store.dir, "workspace-a", SESSION, &first, 100).expect("write artifact");
    let retrieved = read_artifact(
        &store.dir,
        &ArtifactReadRequest {
            workspace_id: "workspace-a".to_string(),
            session_id: SESSION.to_string(),
            artifact_id: artifact.artifact_id.clone(),
            checksum: artifact.checksum.clone(),
        },
    )
    .expect("read artifact");
    assert!(retrieved.reference_only);
    let cross_workspace = read_artifact(
        &store.dir,
        &ArtifactReadRequest {
            workspace_id: "workspace-b".to_string(),
            session_id: SESSION.to_string(),
            artifact_id: artifact.artifact_id,
            checksum: artifact.checksum,
        },
    );
    assert!(cross_workspace.is_err());

    cc_gui_lib::shared_context::prepare_delivery(
        &writer,
        &PrepareDeliveryRequest {
            session_id: SESSION.to_string(),
            binding_key: "claude:provider-b".to_string(),
            engine: "claude".to_string(),
            provider_profile_id: Some("provider-b".to_string()),
            logical_turn_id: logical_turn_id.clone(),
            attempt_id: attempt_id.clone(),
            package: first.clone(),
            prepared_at: 101,
        },
    )
    .expect("prepare delivery");
    let prepared = writer
        .binding_state(SESSION, "claude:provider-b")
        .expect("binding")
        .expect("binding exists");
    assert_eq!(prepared.accepted_through_sequence, None);
    assert_eq!(prepared.committed_through_sequence, None);
    assert!(prepared.pending_delivery_json.is_some());
    let blocked_other_target = begin_turn_core(
        &writer,
        SESSION,
        &target(Some("provider-c")),
        "绕过".to_string(),
    )
    .expect("cross-target begin result");
    assert_eq!(
        blocked_other_target.status,
        cc_gui_lib::shared_session_v2::BeginTurnStatus::RecoveryRequired
    );

    accept_delivery(
        &writer,
        &AcceptDeliveryRequest {
            session_id: SESSION.to_string(),
            binding_key: "claude:provider-b".to_string(),
            logical_turn_id: logical_turn_id.clone(),
            attempt_id: attempt_id.clone(),
            package_id: first.package_id,
            native_session_id: Some("claude:destination".to_string()),
            native_request_id: Some("request-1".to_string()),
            accepted_at: 102,
        },
    )
    .expect("accept delivery");
    let accepted = writer
        .binding_state(SESSION, "claude:provider-b")
        .expect("binding")
        .expect("binding exists");
    assert_eq!(
        accepted.accepted_through_sequence,
        Some(requested_sequence - 1)
    );
    assert_eq!(accepted.committed_through_sequence, None);

    accept_turn_core(
        &writer,
        SESSION,
        &attempt_id,
        &logical_turn_id,
        &destination,
        "claude:destination",
    )
    .expect("accept turn");
    commit_turn_core(
        &writer,
        SESSION,
        &attempt_id,
        &logical_turn_id,
        &destination,
        Some("新答案".to_string()),
        &completed(),
        Some("claude:destination".to_string()),
    )
    .expect("atomic terminal and delivery commit");
    let committed = writer
        .binding_state(SESSION, "claude:provider-b")
        .expect("binding")
        .expect("binding exists");
    assert_eq!(
        committed.committed_through_sequence,
        Some(requested_sequence - 1)
    );
    assert!(committed.pending_delivery_json.is_none());
}
