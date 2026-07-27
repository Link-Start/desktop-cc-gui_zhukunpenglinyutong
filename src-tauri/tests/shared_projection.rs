//! Shared Projection 集成测试（Wave 3 / A3，Gate 3 前置）。
//!
//! 覆盖：canonical fact → ProjectionItem 映射、checkpoint/rebuild、Legacy dual-read、Shadow 对比。

mod common;

use cc_gui_lib::shared_event_log::canonical::shadow_v0::map_v0_snapshot_to_presentation_only_facts;
use cc_gui_lib::shared_event_log::canonical::types::{
    CanonicalAssistantBlocks, CanonicalBlock, CanonicalFact, CanonicalUserInput, ControlFact,
    Outcome, OutcomeStatus, TurnCommittedFact, TurnExecutionSnapshot, TurnRequestedFact,
    UsageRecordedFact, UsageShape, UsageSource, UsageVerification,
};
use cc_gui_lib::shared_event_log::{
    open, AppendOutcome, Fidelity, NewCanonicalEvent, OpenOutcome, ProjectionCheckpointRow,
};
use cc_gui_lib::shared_projection::{
    LegacySharedReader, ProjectionItemKind, ShadowComparator, SharedProjector,
};
use common::TempStoreDir;

const SESSION: &str = "a3-session";

fn snapshot() -> TurnExecutionSnapshot {
    TurnExecutionSnapshot {
        engine: "claude".to_string(),
        provider_profile_id: Some("profile-1".to_string()),
        model: Some("claude-opus".to_string()),
        reasoning: None,
        provider_profile_name_snapshot: None,
        provider_profile_source: None,
        runtime_capability_fingerprint: None,
        extra: serde_json::Value::Object(Default::default()),
    }
}

fn make_turn_requested(attempt_id: &str) -> CanonicalFact {
    CanonicalFact::TurnRequested(TurnRequestedFact {
        logical_turn_id: "turn-1".to_string(),
        attempt_id: attempt_id.to_string(),
        retry_of_attempt_id: None,
        input: CanonicalUserInput {
            text: Some("hello".to_string()),
            image_refs: None,
            attachment_refs: None,
            extra: serde_json::Value::Object(Default::default()),
        },
        target: snapshot(),
        requested_at: 1_700_000_000_000,
        extra: serde_json::Value::Object(Default::default()),
    })
}

fn make_turn_committed(attempt_id: &str) -> CanonicalFact {
    CanonicalFact::TurnCommitted(TurnCommittedFact {
        logical_turn_id: "turn-1".to_string(),
        attempt_id: attempt_id.to_string(),
        input_entry_id: format!("{attempt_id}:input"),
        assistant: CanonicalAssistantBlocks {
            blocks: vec![
                CanonicalBlock::Text {
                    text: "hello back".to_string(),
                },
                CanonicalBlock::Reasoning {
                    text: "thinking...".to_string(),
                },
            ],
        },
        atomic_tool_exchanges: vec![],
        artifact_refs: vec![],
        target: snapshot(),
        provider_private_refs: vec![],
        omissions: vec![],
        outcome: Outcome {
            status: OutcomeStatus::Completed,
            error_code: None,
            error_message: None,
            stop_reason: None,
            extra: serde_json::Value::Object(Default::default()),
        },
        committed_at: 1_700_000_000_001,
        extra: serde_json::Value::Object(Default::default()),
    })
}

fn make_usage_recorded(usage_record_id: &str, attempt_id: &str) -> CanonicalFact {
    make_usage_recorded_with_source(
        usage_record_id,
        attempt_id,
        UsageSource::RuntimeFinal,
        1,
        15,
    )
}

fn make_usage_recorded_with_source(
    usage_record_id: &str,
    attempt_id: &str,
    source: UsageSource,
    revision: i64,
    total_tokens: i64,
) -> CanonicalFact {
    CanonicalFact::UsageRecorded(UsageRecordedFact {
        usage_record_id: usage_record_id.to_string(),
        report_subject_id: format!("{attempt_id}:subject"),
        revision,
        supersedes_usage_record_id: None,
        logical_turn_id: "turn-1".to_string(),
        attempt_id: attempt_id.to_string(),
        binding_key: "binding-1".to_string(),
        native_session_id: "native-1".to_string(),
        native_turn_id: None,
        target: snapshot(),
        usage: UsageShape {
            input_tokens: Some(10),
            cached_input_tokens: None,
            output_tokens: Some(5),
            total_tokens: Some(total_tokens),
            provider_reported_cost: None,
            extra: serde_json::Value::Object(Default::default()),
        },
        source,
        verification: UsageVerification::Verified,
        observed_at: 1_700_000_000_002,
        extra: serde_json::Value::Object(Default::default()),
    })
}

/// Scenario: provider-report 覆盖同 attempt 的 runtime-final，且不相加。
#[test]
fn provider_report_usage_replaces_runtime_final_without_summing() {
    let temp = TempStoreDir::new("usage-precedence");
    let writer = open_writer(&temp);
    writer
        .append_canonical_fact(
            SESSION,
            make_usage_recorded_with_source(
                "usage-runtime",
                "attempt-1",
                UsageSource::RuntimeFinal,
                1,
                15,
            ),
        )
        .expect("append runtime usage");

    let projector = SharedProjector::new();
    let before = projector
        .project(&writer, SESSION, "canvas", 2)
        .expect("project runtime usage");
    assert_eq!(before.len(), 1);
    assert_eq!(before[0].content["totalTokens"], 15);

    writer
        .append_canonical_fact(
            SESSION,
            make_usage_recorded_with_source(
                "usage-provider",
                "attempt-1",
                UsageSource::ProviderReport,
                2,
                12,
            ),
        )
        .expect("append provider usage");

    let after = projector
        .project(&writer, SESSION, "canvas", 2)
        .expect("project provider usage");
    assert_eq!(after.len(), 1);
    assert_eq!(after[0].content["source"], "provider-report");
    assert_eq!(after[0].content["totalTokens"], 12);

    let rebuilt = projector
        .rebuild(&writer, SESSION, "canvas", 2)
        .expect("rebuild usage projection");
    assert_eq!(rebuilt, after);

    writer
        .append_canonical_fact(
            SESSION,
            make_usage_recorded_with_source(
                "usage-runtime-late",
                "attempt-1",
                UsageSource::RuntimeFinal,
                3,
                99,
            ),
        )
        .expect("append late runtime usage");
    let after_late_runtime = projector
        .project(&writer, SESSION, "canvas", 2)
        .expect("project late runtime usage");
    assert_eq!(after_late_runtime, after);

    writer.shutdown().unwrap();
}

/// Scenario: 真实 V0 snapshot shape 可幂等镜像并投影 user/assistant final。
#[test]
fn v0_final_snapshot_mirrors_idempotently_into_shadow_projection() {
    let temp = TempStoreDir::new("v0-shadow-projection");
    let writer = open_writer(&temp);
    let items = vec![
        serde_json::json!({
            "id": "user-1",
            "kind": "message",
            "role": "user",
            "text": "hello",
            "turnId": "turn-1"
        }),
        serde_json::json!({
            "id": "assistant-1",
            "kind": "message",
            "role": "assistant",
            "text": "hello back",
            "turnId": "turn-1",
            "engineSource": "claude",
            "isFinal": true,
            "finalCompletedAt": 1_700_000_000_001_i64
        }),
    ];
    let facts = map_v0_snapshot_to_presentation_only_facts(&items, "claude", 1_700_000_000_000);

    for _ in 0..2 {
        for fact in facts.clone() {
            writer
                .append_presentation_only_fact(SESSION, fact)
                .expect("mirror fact");
        }
    }

    let events = writer.events_for_session(SESSION).expect("shadow events");
    assert_eq!(events.len(), 2);
    assert!(events
        .iter()
        .all(|event| event.fidelity == Fidelity::PresentationOnly));
    let projected = SharedProjector::new()
        .project_events(&events)
        .expect("project shadow");
    assert_eq!(projected.len(), 2);
    assert_eq!(projected[0].content["role"], "user");
    assert_eq!(projected[1].content["role"], "assistant");
    writer.shutdown().unwrap();
}

fn make_control(action: &str) -> CanonicalFact {
    CanonicalFact::Control(ControlFact {
        control_kind: format!("turn.{action}"),
        logical_turn_id: Some("turn-1".to_string()),
        attempt_id: Some("attempt-1".to_string()),
        binding_key: None,
        reason: None,
        details: None,
        extra: serde_json::Value::Object(Default::default()),
    })
}

fn open_writer(temp: &TempStoreDir) -> cc_gui_lib::shared_event_log::SharedEventWriter {
    let outcome = open(&temp.db_path).expect("open shared event store");
    match outcome {
        OpenOutcome::Ready(writer) => writer,
        OpenOutcome::ReadOnlyRecovery { .. } => panic!("fresh db must be ready"),
    }
}

/// Scenario: canonical facts project to correct ConversationItem kinds。
#[test]
fn canonical_facts_project_to_conversation_items() {
    let temp = TempStoreDir::new("projection");
    let writer = open_writer(&temp);

    let facts = vec![
        make_turn_requested("attempt-1"),
        make_turn_committed("attempt-1"),
        make_usage_recorded("usage-1", "attempt-1"),
        make_control("cancel"),
    ];

    for fact in facts {
        let outcome = if matches!(fact, CanonicalFact::Control(_)) {
            writer.append_canonical_fact_at(SESSION, fact, 1_700_000_000_003)
        } else {
            writer.append_canonical_fact(SESSION, fact)
        }
        .expect("append fact");
        assert!(matches!(outcome, AppendOutcome::Inserted { .. }));
    }

    let events = writer.events_for_session(SESSION).expect("events");
    assert_eq!(events.len(), 4);

    let projector = SharedProjector::new();
    let items = projector.project_events(&events).expect("project");

    // turnRequested → 1 user message
    // turnCommitted → 1 assistant text + 1 reasoning
    // usageRecorded → 1 metadata
    // control → 1 system notice
    assert_eq!(items.len(), 5);

    let kinds: Vec<ProjectionItemKind> = items.iter().map(|i| i.kind).collect();
    assert!(kinds.contains(&ProjectionItemKind::Message));
    assert!(kinds.contains(&ProjectionItemKind::Reasoning));
    assert!(kinds.contains(&ProjectionItemKind::Metadata));
    assert!(kinds.contains(&ProjectionItemKind::SystemNotice));

    writer.shutdown().unwrap();
}

/// Scenario: projection checkpoint round-trip。
#[test]
fn projection_checkpoint_round_trip() {
    let temp = TempStoreDir::new("checkpoint");
    let writer = open_writer(&temp);

    let checkpoint = ProjectionCheckpointRow {
        session_id: SESSION.to_string(),
        projection_name: "canvas".to_string(),
        projection_version: 1,
        through_sequence: 42,
        payload_json: "{}".to_string(),
    };

    writer
        .upsert_projection_checkpoint(&checkpoint)
        .expect("upsert");

    let loaded = writer
        .get_projection_checkpoint(SESSION, "canvas")
        .expect("get");
    assert_eq!(loaded, Some(checkpoint));

    writer.shutdown().unwrap();
}

/// Scenario: rebuild produces identical items after checkpoint deletion。
#[test]
fn rebuild_produces_identical_items() {
    let temp = TempStoreDir::new("rebuild");
    let writer = open_writer(&temp);

    let facts = vec![
        make_turn_requested("attempt-1"),
        make_turn_committed("attempt-1"),
    ];
    for fact in facts {
        writer.append_canonical_fact(SESSION, fact).expect("append");
    }

    let events = writer.events_for_session(SESSION).expect("events");
    let projector = SharedProjector::new();
    let first = projector.project_events(&events).expect("project");

    // 模拟 checkpoint 删除后 rebuild
    let second = projector.project_events(&events).expect("project");

    assert_eq!(first.len(), second.len());
    for (a, b) in first.iter().zip(second.iter()) {
        assert_eq!(a.id, b.id);
        assert_eq!(a.kind, b.kind);
        assert_eq!(a.checksum, b.checksum);
    }

    writer.shutdown().unwrap();
}

/// Scenario: legacy snapshot maps to presentation-only items。
#[test]
fn legacy_snapshot_maps_to_presentation_only() {
    let reader = LegacySharedReader::new();
    let snapshot = concat!(
        "{\"kind\":\"snapshot\",\"createdAt\":1,\"selectedEngine\":\"claude\",",
        "\"lastTurnSeq\":1,\"items\":[{\"id\":\"old\",\"kind\":\"message\",",
        "\"role\":\"user\",\"text\":\"stale\"}]}\n",
        "{\"kind\":\"snapshot\",\"createdAt\":2,\"selectedEngine\":\"codex\",",
        "\"lastTurnSeq\":1,\"items\":[",
        "{\"id\":\"user-1\",\"kind\":\"message\",\"role\":\"user\",\"text\":\"hi\"},",
        "{\"id\":\"assistant-1\",\"kind\":\"message\",\"role\":\"assistant\",",
        "\"text\":\"hello\",\"isFinal\":true}]}\n"
    );

    let items = reader.parse_snapshot(snapshot).expect("parse");
    assert_eq!(items.len(), 2);
    assert_eq!(items[0].id, "user-1");
    assert_eq!(items[1].id, "assistant-1");
    for item in items {
        assert_eq!(item.fidelity, Fidelity::PresentationOnly);
        assert_eq!(item.kind, ProjectionItemKind::Message);
    }
}

/// Scenario: shadow comparator reports mismatches correctly。
#[test]
fn shadow_comparator_reports_mismatches() {
    let comparator = ShadowComparator::new();

    let shadow = vec![
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "shadow-user".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"role": "user", "text": "same"}),
            fidelity: Fidelity::Canonical,
            checksum: "x".to_string(),
        },
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "shadow-assistant".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"role": "assistant", "text": "v1"}),
            fidelity: Fidelity::Canonical,
            checksum: "y".to_string(),
        },
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "shadow-tool".to_string(),
            kind: ProjectionItemKind::Tool,
            content: serde_json::json!({"toolType": "Read", "status": "completed"}),
            fidelity: Fidelity::Canonical,
            checksum: "w".to_string(),
        },
    ];

    let legacy = vec![
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "legacy-user".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"role": "user", "text": "same"}),
            fidelity: Fidelity::PresentationOnly,
            checksum: "x".to_string(),
        },
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "legacy-assistant".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"role": "assistant", "text": "v2"}),
            fidelity: Fidelity::PresentationOnly,
            checksum: "z".to_string(),
        },
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "legacy-reasoning".to_string(),
            kind: ProjectionItemKind::Reasoning,
            content: serde_json::json!({"summary": "thinking", "content": "thinking"}),
            fidelity: Fidelity::PresentationOnly,
            checksum: "v".to_string(),
        },
    ];

    let report = comparator.compare(&shadow, &legacy);
    assert_eq!(report.total_shadow, 3);
    assert_eq!(report.total_legacy, 3);
    assert_eq!(report.matched, 1);
    assert_eq!(report.mismatches.len(), 3);
    assert!(report.mismatches.iter().any(|m| matches!(
        m.kind,
        cc_gui_lib::shared_projection::MismatchKind::ShadowOnly
    )));
    assert!(report.mismatches.iter().any(|m| matches!(
        m.kind,
        cc_gui_lib::shared_projection::MismatchKind::LegacyOnly
    )));
    assert!(report.mismatches.iter().any(|m| matches!(
        m.kind,
        cc_gui_lib::shared_projection::MismatchKind::ContentMismatch
    )));
}

/// Scenario: rebuild 扫描全量事件并更新 checkpoint。
#[test]
fn rebuild_scans_events_and_updates_checkpoint() {
    let temp = TempStoreDir::new("rebuild-checkpoint");
    let writer = open_writer(&temp);

    for fact in [
        make_turn_requested("attempt-1"),
        make_turn_committed("attempt-1"),
    ] {
        writer.append_canonical_fact(SESSION, fact).expect("append");
    }

    let projector = SharedProjector::new();
    let items = projector
        .rebuild(&writer, SESSION, "canvas", 1)
        .expect("rebuild");
    assert_eq!(items.len(), 3); // user message + assistant text + reasoning

    let checkpoint = writer
        .get_projection_checkpoint(SESSION, "canvas")
        .expect("get checkpoint")
        .expect("checkpoint exists");
    assert_eq!(checkpoint.projection_version, 1);
    assert_eq!(checkpoint.through_sequence, 2);

    // 幂等：再次 rebuild 产出相同 items 与 checkpoint。
    let items_again = projector
        .rebuild(&writer, SESSION, "canvas", 1)
        .expect("rebuild again");
    assert_eq!(items.len(), items_again.len());
    for (a, b) in items.iter().zip(items_again.iter()) {
        assert_eq!(a.id, b.id);
        assert_eq!(a.checksum, b.checksum);
    }

    writer.shutdown().unwrap();
}

/// Scenario: checkpoint 后只读取新事件，并把 cache 与增量结果合并。
#[test]
fn projection_incrementally_reads_after_checkpoint() {
    let temp = TempStoreDir::new("projection-incremental");
    let writer = open_writer(&temp);
    writer
        .append_canonical_fact(SESSION, make_turn_requested("attempt-1"))
        .expect("append requested");

    let projector = SharedProjector::new();
    let first = projector
        .project(&writer, SESSION, "canvas", 1)
        .expect("initial project");
    assert_eq!(first.len(), 1);

    writer
        .append_canonical_fact(SESSION, make_turn_committed("attempt-1"))
        .expect("append committed");
    assert_eq!(
        writer
            .read_projection_events(SESSION, 1)
            .expect("read delta")
            .len(),
        1
    );

    let second = projector
        .project(&writer, SESSION, "canvas", 1)
        .expect("incremental project");
    assert_eq!(second.len(), 3);
    assert_eq!(
        writer
            .get_projection_checkpoint(SESSION, "canvas")
            .expect("checkpoint")
            .expect("checkpoint exists")
            .through_sequence,
        2
    );
    writer.shutdown().unwrap();
}

/// Scenario: projection version 变化时忽略旧 cache 并全量 rebuild。
#[test]
fn projection_version_mismatch_rebuilds() {
    let temp = TempStoreDir::new("projection-version");
    let writer = open_writer(&temp);
    writer
        .append_canonical_fact(SESSION, make_turn_requested("attempt-1"))
        .expect("append");
    let projector = SharedProjector::new();
    let version_one = projector
        .project(&writer, SESSION, "canvas", 1)
        .expect("version one");
    let version_two = projector
        .project(&writer, SESSION, "canvas", 2)
        .expect("version two");
    assert_eq!(version_one, version_two);
    assert_eq!(
        writer
            .get_projection_checkpoint(SESSION, "canvas")
            .expect("checkpoint")
            .expect("checkpoint exists")
            .projection_version,
        2
    );
    writer.shutdown().unwrap();
}

/// Scenario: 坏 canonical payload 必须阻断 projection，且 checkpoint 不前移。
#[test]
fn invalid_projection_event_does_not_advance_checkpoint() {
    let temp = TempStoreDir::new("projection-invalid");
    let writer = open_writer(&temp);
    writer
        .append_canonical_fact(SESSION, make_turn_requested("attempt-1"))
        .expect("append valid");
    let projector = SharedProjector::new();
    projector
        .project(&writer, SESSION, "canvas", 1)
        .expect("initial project");

    writer
        .append_event(&NewCanonicalEvent {
            session_id: SESSION.to_string(),
            event_id: "invalid-event".to_string(),
            fact_type: "conversation.turnCommitted".to_string(),
            logical_turn_id: Some("turn-1".to_string()),
            attempt_id: Some("attempt-invalid".to_string()),
            dedupe_key: None,
            payload_json: "{}".to_string(),
            fidelity: Fidelity::Canonical,
            committed_at: 1_700_000_000_010,
            schema_version: 2,
        })
        .expect("append raw invalid event");

    assert!(projector.project(&writer, SESSION, "canvas", 1).is_err());
    assert_eq!(
        writer
            .get_projection_checkpoint(SESSION, "canvas")
            .expect("checkpoint")
            .expect("checkpoint exists")
            .through_sequence,
        1
    );
    writer.shutdown().unwrap();
}

/// Scenario: legacy reader 保留 V0 item，不伪造缺失 Tool ID。
#[test]
fn legacy_reader_preserves_items_without_fabricating_tool_ids() {
    let reader = LegacySharedReader::new();
    let snapshot = concat!(
        "{\"kind\":\"snapshot\",\"createdAt\":2,\"selectedEngine\":\"claude\",",
        "\"lastTurnSeq\":1,\"items\":[",
        "{\"id\":\"message-1\",\"kind\":\"message\",\"role\":\"user\"},",
        "{\"id\":\"tool-1\",\"kind\":\"tool\",\"title\":\"legacy tool\"}]}\n"
    );

    let items = reader.parse_snapshot(snapshot).expect("parse");
    assert_eq!(items.len(), 2);
    assert_eq!(items[1].id, "tool-1");
    assert!(items[1].content.get("toolCallId").is_none());
}

/// Scenario: legacy reader 对损坏 JSON 返回错误而不是 panic。
#[test]
fn legacy_reader_rejects_corrupted_json() {
    let reader = LegacySharedReader::new();
    let result = reader.parse_snapshot("{ not valid json");
    assert!(result.is_err());
}

/// Scenario: legacy reader 只读，不写回源文件。
#[test]
fn legacy_reader_does_not_modify_source_file() {
    let temp = TempStoreDir::new("legacy-readonly");
    let path = temp.dir.join("log.jsonl");
    let content = concat!(
        "{\"kind\":\"snapshot\",\"createdAt\":1,\"selectedEngine\":\"claude\",",
        "\"lastTurnSeq\":1,\"items\":[",
        "{\"id\":\"message-1\",\"kind\":\"message\",\"role\":\"user\",\"text\":\"hi\"}]}\n"
    );
    std::fs::write(&path, content).expect("write fixture");

    let reader = LegacySharedReader::new();
    let items = reader.read_snapshot(&path).expect("read");
    assert_eq!(items.len(), 1);

    let after = std::fs::read_to_string(&path).expect("read back");
    assert_eq!(after, content);
}
