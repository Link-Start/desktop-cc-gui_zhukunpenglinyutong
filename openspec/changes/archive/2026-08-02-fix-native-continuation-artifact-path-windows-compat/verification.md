# Verification

## Automated

- `cargo test -p cc-gui --lib shared_context::artifact_store`
  - Result: 6 passed (3 新增：prefixed session round-trip、legacy fallback 读取、
    `safe_segment` 加固矩阵；3 既有：round-trip / tamper / 并发 / orphan 全部保持通过)。
- `cargo test -p cc-gui --lib shared_context`
  - Result: 18 passed。
- `cargo test -p cc-gui --lib native_continuation::`
  - Result: 14 passed。
- `cargo test -p cc-gui --test shared_session_v2` / `--test shared_session_v2_target_matrix`
  - Result: 14 + 1 passed。
- `openspec validate fix-native-continuation-artifact-path-windows-compat --strict --no-interactive`
  - Result: passed。
- 既有失败确认与本 change 无关：`codex_zero_delta_projection_does_not_create_marker_only_import`
  （`shared_session_v2.rs:5701` compile empty projection）在 stash 本改动后同样失败。

## Manual

- macOS 回归：Native Provider Continuation prepare / 续接流程未受影响（用户实机确认）。
- Windows 实机未测（用户无环境）；本 change 的修复方向由 Windows `ERROR_DIRECTORY (267)`
  对 `:` 目录名的既有行为实证支持，并由路径 key 单测锁定。

## Scope Review

- 生产代码仅改 `src-tauri/src/shared_context/artifact_store.rs`：路径 key 化、
  legacy 读取 fallback、`safe_segment` 加固；写入逻辑、IPC、frontend 零改动。
- legacy 读取仅发生在新 key 路径不存在时，且 session_id 含 `/` `\` `.` `..` 时禁用，
  无路径穿越面。
- 孤儿扫描按 record 引用判定，与路径布局无关，mac 旧布局被引用 artifact 不会被误删。
