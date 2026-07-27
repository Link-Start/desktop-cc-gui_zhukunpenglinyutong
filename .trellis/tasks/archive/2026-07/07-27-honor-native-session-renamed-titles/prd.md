# PRD: honor-native-session-renamed-titles

## OpenSpec

- Change: `honor-native-session-renamed-titles`
- Source of truth: `openspec/changes/honor-native-session-renamed-titles/**`

## 用户问题

Codex `/rename` 或 Claude 原生 rename 后，cc gui 仍显示第一条消息，用户容易误以为目标会话没有加载。

## Scope

- Codex 按 `CODEX_HOME` 读取 `session_index.jsonl`，用 UUID 对应的最后一个有效 `thread_name` 覆盖该 home 的扫描 summary。
- Claude 在现有 JSONL scan 中读取最后一个有效 `custom-title.customTitle`。
- 以 backward-compatible optional `nativeTitle` 贯穿 backend summary/catalog、Tauri response type 与 frontend centralized title projection；不新增 command 或 frontend state。
- 增加 focused Rust / Vitest regression tests，不改 GUI custom/mapped title 的既有高优先级。

## Acceptance

- 原生 rename 可见，最后有效记录胜出。
- 缺失/损坏 metadata 保持 first-message fallback。
- 多 Codex home 不串名，且每个 home 单次 scan 最多读取一次 index。
- Claude cache version 递增并由测试覆盖行为。
- `Agent 12`、generic session name 与短 hex 等合法原生标题不再被 weak-title heuristic 丢弃；GUI custom/mapped title 仍优先。
- OpenSpec strict validation、focused tests、format 与相关 quality gates 通过。
