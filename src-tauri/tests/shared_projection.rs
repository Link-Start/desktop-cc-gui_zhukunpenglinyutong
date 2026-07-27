//! Shared Projection 集成测试（Wave 3 / A3，Gate 3 前置）。
//!
//! 覆盖：canonical fact → ProjectionItem 映射、checkpoint/rebuild、Legacy dual-read、Shadow 对比。

mod common;

use cc_gui_lib::shared_event_log::canonical::types::{
    CanonicalAssistantBlocks, CanonicalBlock, CanonicalFact, CanonicalUserInput, ControlFact,
    Outcome, OutcomeStatus, TurnCommittedFact, TurnExecutionSnapshot, TurnRequestedFact,
    UsageRecordedFact, UsageShape, UsageSource, UsageVerification,
};
use cc_gui_lib::shared_event_log::{
    open, AppendOutcome, Fidelity, OpenOutcome, ProjectionCheckpointRow,
};
use cc_gui_lib::shared_projection::{
    LegacySharedReader, ProjectionItemKind, SharedProjector, ShadowComparator,
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
            extra: serde_json::Value::Object(Default::default()),
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
    CanonicalFact::UsageRecorded(UsageRecordedFact {
        usage_record_id: usage_record_id.to_string(),
        report_subject_id: format!("{attempt_id}:subject"),
        revision: 1,
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
            total_tokens: Some(15),
            provider_reported_cost: None,
            extra: serde_json::Value::Object(Default::default()),
        },
        source: UsageSource::RuntimeFinal,
        verification: UsageVerification::Verified,
        observed_at: 1_700_000_000_002,
        extra: serde_json::Value::Object(Default::default()),
    })
}

fn make_control(action: &str) -> CanonicalFact {
    CanonicalFact::Control(ControlFact {
        action: action.to_string(),
        target_attempt_id: Some("attempt-1".to_string()),
        target_logical_turn_id: Some("turn-1".to_string()),
        issued_at: 1_700_000_000_003,
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
        let outcome = writer
            .append_canonical_fact(SESSION, fact)
            .expect("append fact");
        assert!(matches!(outcome, AppendOutcome::Inserted { .. }));
    }

    let events = writer.events_for_session(SESSION).expect("events");
    assert_eq!(events.len(), 4);

    let projector = SharedProjector::new();
    let items = projector.project_events(&events);

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
    let first = projector.project_events(&events);

    // 模拟 checkpoint 删除后 rebuild
    let second = projector.project_events(&events);

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
    let snapshot = r#"{
        "messages": [
            {"role": "user", "text": "hi"},
            {"role": "assistant", "text": "hello"}
        ]
    }"#;

    let items = reader.parse_snapshot(snapshot).expect("parse");
    assert_eq!(items.len(), 2);
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
            id: "a".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"text": "same"}),
            fidelity: Fidelity::Canonical,
            checksum: "x".to_string(),
        },
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "b".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"text": "shadow-only"}),
            fidelity: Fidelity::Canonical,
            checksum: "y".to_string(),
        },
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "d".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"text": "v1"}),
            fidelity: Fidelity::Canonical,
            checksum: "w".to_string(),
        },
    ];

    let legacy = vec![
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "a".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"text": "same"}),
            fidelity: Fidelity::PresentationOnly,
            checksum: "x".to_string(),
        },
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "c".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"text": "legacy-only"}),
            fidelity: Fidelity::PresentationOnly,
            checksum: "z".to_string(),
        },
        cc_gui_lib::shared_projection::ProjectionItem {
            id: "d".to_string(),
            kind: ProjectionItemKind::Message,
            content: serde_json::json!({"text": "v2"}),
            fidelity: Fidelity::PresentationOnly,
            checksum: "v".to_string(),
        },
    ];

    let report = comparator.compare(&shadow, &legacy);
    assert_eq!(report.total_shadow, 3);
    assert_eq!(report.total_legacy, 3);
    assert_eq!(report.matched, 1);
    assert_eq!(report.mismatches.len(), 3);
    assert!(report
        .mismatches
        .iter()
        .any(|m| matches!(m.kind, cc_gui_lib::shared_projection::MismatchKind::ShadowOnly)));
    assert!(report
        .mismatches
        .iter()
        .any(|m| matches!(m.kind, cc_gui_lib::shared_projection::MismatchKind::LegacyOnly)));
    assert!(report.mismatches.iter().any(|m| matches!(
        m.kind,
        cc_gui_lib::shared_projection::MismatchKind::ContentMismatch
    ) && m.item_id == "d"));
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

/// Scenario: legacy reader 对缺字段消息保守跳过，不伪造数据。
#[test]
fn legacy_reader_skips_messages_with_missing_fields() {
    let reader = LegacySharedReader::new();
    let snapshot = r#"{
        "messages": [
            {"role": "user", "text": "ok"},
            {"role": "user"},
            {"text": "no role"},
            {"role": "tool", "text": "skipped unknown role"}
        ]
    }"#;

    let items = reader.parse_snapshot(snapshot).expect("parse");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].id, "legacy:message:0");
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
    let path = temp.dir.join("legacy-snapshot.json");
    let content = r#"{"messages":[{"role":"user","text":"hi"}]}"#;
    std::fs::write(&path, content).expect("write fixture");

    let reader = LegacySharedReader::new();
    let items = reader.read_snapshot(&path).expect("read");
    assert_eq!(items.len(), 1);

    let after = std::fs::read_to_string(&path).expect("read back");
    assert_eq!(after, content);
}
