//! Session Foundation (T0.6) golden fixture loader 验证。
//!
//! 校验 `tests/fixtures/session-foundation/` 下四套真实捕获、脱敏后的
//! Claude / Codex native history 与 live event fixtures：
//! - 每行均可解析为合法 JSON（NDJSON / JSONL 序列完整）
//! - 代表性事件类型存在（tool use / tool outcome / delta / completed）
//! - manifest.json 与 fixture 文件一一对应

use std::fs;
use std::path::PathBuf;

use serde_json::Value;

const TRUNC_MARK: &str = "…[truncated in fixture]";

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("session-foundation")
}

fn load_ndjson(file_name: &str) -> Vec<Value> {
    let path = fixtures_dir().join(file_name);
    let contents = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("Failed to read {path:?}: {error}"));
    let rows: Vec<Value> = contents
        .lines()
        .filter(|line| !line.trim().is_empty())
        .enumerate()
        .map(|(index, line)| {
            serde_json::from_str(line).unwrap_or_else(|error| {
                panic!("{file_name} line {} is not valid JSON: {error}", index + 1)
            })
        })
        .collect();
    assert!(
        !rows.is_empty(),
        "{file_name} must contain at least one entry"
    );
    rows
}

fn load_manifest() -> Value {
    let path = fixtures_dir().join("manifest.json");
    let contents = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("Failed to read {path:?}: {error}"));
    serde_json::from_str(&contents)
        .unwrap_or_else(|error| panic!("manifest.json is not valid JSON: {error}"))
}

fn content_block_types(entry: &Value) -> Vec<&str> {
    entry
        .pointer("/message/content")
        .and_then(Value::as_array)
        .map(|blocks| {
            blocks
                .iter()
                .filter_map(|block| block.get("type").and_then(Value::as_str))
                .collect()
        })
        .unwrap_or_default()
}

#[test]
fn claude_live_events_cover_tool_roundtrip() {
    let rows = load_ndjson("claude-live-events.ndjson");

    for row in &rows {
        assert!(
            row.get("type").and_then(Value::as_str).is_some(),
            "every claude live event must carry a top-level type"
        );
    }

    let has_init = rows.iter().any(|row| {
        row.get("type") == Some(&Value::from("system"))
            && row.get("subtype") == Some(&Value::from("init"))
    });
    assert!(has_init, "claude live events must include system/init");

    let block_types: Vec<&str> = rows.iter().flat_map(content_block_types).collect();
    for expected in ["thinking", "tool_use", "tool_result", "text"] {
        assert!(
            block_types.contains(&expected),
            "claude live events must include a `{expected}` content block"
        );
    }

    let has_result_success = rows.iter().any(|row| {
        row.get("type") == Some(&Value::from("result"))
            && row.get("subtype") == Some(&Value::from("success"))
    });
    assert!(
        has_result_success,
        "claude live events must end with result/success"
    );
}

#[test]
fn claude_native_history_covers_user_assistant_tool_entries() {
    let rows = load_ndjson("claude-native-history.jsonl");

    for row in &rows {
        assert!(
            row.get("type").and_then(Value::as_str).is_some(),
            "every claude history entry must carry a top-level type"
        );
    }

    let has_user_prompt = rows.iter().any(|row| {
        row.get("type") == Some(&Value::from("user"))
            && row
                .pointer("/message/content")
                .and_then(Value::as_str)
                .is_some()
    });
    assert!(
        has_user_prompt,
        "claude history must include the original user prompt"
    );

    let block_types: Vec<&str> = rows.iter().flat_map(content_block_types).collect();
    for expected in ["thinking", "tool_use", "tool_result", "text"] {
        assert!(
            block_types.contains(&expected),
            "claude history must include a `{expected}` content block"
        );
    }
}

#[test]
fn codex_live_events_cover_turn_and_item_lifecycle() {
    let rows = load_ndjson("codex-live-events.ndjson");

    for row in &rows {
        let is_notification = row.get("method").and_then(Value::as_str).is_some();
        let is_response =
            row.get("id").is_some() && (row.get("result").is_some() || row.get("error").is_some());
        assert!(
            is_notification || is_response,
            "every codex live event must be a JSON-RPC notification or response"
        );
    }

    let method = |name: &str| {
        rows.iter()
            .any(|row| row.get("method").and_then(Value::as_str) == Some(name))
    };
    assert!(
        method("thread/started"),
        "codex live events must include thread/started"
    );
    assert!(
        method("turn/started"),
        "codex live events must include turn/started"
    );
    assert!(
        method("turn/completed"),
        "codex live events must include turn/completed"
    );
    assert!(
        method("item/agentMessage/delta"),
        "codex live events must include agent message deltas"
    );

    let completed_item_types: Vec<&str> = rows
        .iter()
        .filter(|row| row.get("method").and_then(Value::as_str) == Some("item/completed"))
        .filter_map(|row| row.pointer("/params/item/type").and_then(Value::as_str))
        .collect();
    for expected in [
        "userMessage",
        "reasoning",
        "commandExecution",
        "agentMessage",
    ] {
        assert!(
            completed_item_types.contains(&expected),
            "codex live events must complete a `{expected}` item"
        );
    }
}

#[test]
fn codex_native_history_covers_response_items_and_task_lifecycle() {
    let rows = load_ndjson("codex-native-history.jsonl");

    assert_eq!(
        rows[0].get("type").and_then(Value::as_str),
        Some("session_meta"),
        "codex rollout must start with a session_meta row"
    );
    assert!(
        rows[0].pointer("/payload/session_id").is_some(),
        "session_meta payload must carry session_id"
    );

    for row in &rows {
        assert!(
            row.get("type").and_then(Value::as_str).is_some() && row.get("payload").is_some(),
            "every codex rollout row must carry a top-level type and payload"
        );
    }

    let response_item_types: Vec<&str> = rows
        .iter()
        .filter(|row| row.get("type").and_then(Value::as_str) == Some("response_item"))
        .filter_map(|row| row.pointer("/payload/type").and_then(Value::as_str))
        .collect();
    for expected in [
        "message",
        "reasoning",
        "function_call",
        "function_call_output",
    ] {
        assert!(
            response_item_types.contains(&expected),
            "codex rollout must include a `{expected}` response_item"
        );
    }

    let event_msg_types: Vec<&str> = rows
        .iter()
        .filter(|row| row.get("type").and_then(Value::as_str) == Some("event_msg"))
        .filter_map(|row| row.pointer("/payload/type").and_then(Value::as_str))
        .collect();
    for expected in [
        "task_started",
        "user_message",
        "agent_message",
        "task_complete",
    ] {
        assert!(
            event_msg_types.contains(&expected),
            "codex rollout must include a `{expected}` event_msg"
        );
    }
}

#[test]
fn manifest_describes_every_fixture_file() {
    let manifest = load_manifest();
    let fixtures = manifest
        .get("fixtures")
        .and_then(Value::as_array)
        .expect("manifest must contain a fixtures array");
    assert_eq!(
        fixtures.len(),
        4,
        "manifest must describe exactly 4 fixtures"
    );
    assert!(
        manifest
            .get("captured_at")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.is_empty()),
        "manifest must define a non-empty captured_at"
    );

    for fixture in fixtures {
        for field in [
            "file",
            "kind",
            "source_cli",
            "binary_version",
            "scenario",
            "entry_type_counts",
            "fidelity_notes",
        ] {
            assert!(
                fixture.get(field).is_some(),
                "manifest fixture entry must define `{field}`"
            );
        }
        let file_name = fixture
            .get("file")
            .and_then(Value::as_str)
            .expect("fixture entry must name a file");
        let path = fixtures_dir().join(file_name);
        assert!(
            path.exists(),
            "manifest references missing file {file_name}"
        );

        // manifest 与文件一一对应：文件真实可加载且非空。
        let rows = load_ndjson(file_name);
        assert!(
            !rows.is_empty(),
            "{file_name} must be loadable and non-empty"
        );
        let declared_count: u64 = fixture
            .get("entry_type_counts")
            .and_then(Value::as_object)
            .expect("entry_type_counts must be an object")
            .values()
            .map(|count| {
                count
                    .as_u64()
                    .expect("entry count must be an unsigned integer")
            })
            .sum();
        assert_eq!(
            declared_count,
            rows.len() as u64,
            "{file_name} entry_type_counts must sum to the actual row count"
        );

        // 截断标记仅出现在声明了 fidelity_notes 的上下文中，且不得破坏 JSON。
        let raw = fs::read_to_string(&path).expect("fixture file must be readable");
        if raw.contains(TRUNC_MARK) {
            let notes = fixture
                .get("fidelity_notes")
                .and_then(Value::as_str)
                .unwrap_or_default();
            assert!(
                !notes.is_empty(),
                "{file_name} uses truncation marker; fidelity_notes must explain it"
            );
        }
    }

    // 反向校验：目录中的 fixture 数据文件均已被 manifest 收录。
    let described: Vec<&str> = fixtures
        .iter()
        .filter_map(|fixture| fixture.get("file").and_then(Value::as_str))
        .collect();
    for file_name in [
        "claude-live-events.ndjson",
        "claude-native-history.jsonl",
        "codex-live-events.ndjson",
        "codex-native-history.jsonl",
    ] {
        assert!(
            described.contains(&file_name),
            "manifest must describe {file_name}"
        );
    }
}

#[test]
fn fixtures_do_not_retain_captured_host_identity_or_inventory() {
    let combined = [
        "claude-live-events.ndjson",
        "claude-native-history.jsonl",
        "codex-live-events.ndjson",
        "codex-native-history.jsonl",
        "manifest.json",
    ]
    .iter()
    .map(|file_name| {
        fs::read_to_string(fixtures_dir().join(file_name))
            .unwrap_or_else(|error| panic!("failed to read {file_name}: {error}"))
    })
    .collect::<Vec<_>>()
    .join("\n");

    for forbidden in [
        "/Users/chenxiangning",
        "5ae39644-6c1d-4b75-9237-a19be637a967",
        "019fa19c-a843-70f2-b720-7bb1039d9cb3",
        "ANTHROPIC_API_KEY",
        "<recommended_plugins>",
        "# 陈湘宁的 AI 联合架构师",
    ] {
        assert!(
            !combined.contains(forbidden),
            "fixture contains captured host metadata: {forbidden}"
        );
    }
}
