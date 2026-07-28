# Change C：Shared Context Compiler

## Goal

按 OpenSpec `add-shared-context-compiler` 与上游研究设计完成 Context Package V1、
capability-driven Compiler、Runtime ACK、two-phase cursor、Artifact Retrieval 与 Gate 5。

## Requirements

- Rust 是 canonical compile/checksum/cursor/artifact single owner。
- 五 mode 固定优先级，不按 Engine 名硬编码选择。
- Tool Call/Result atomic；Thinking/Image/aborted/control 有明确 transform/omission。
- Codex structured import 只认 JSON-RPC success；Claude 只认 checksum echo。
- compile/accept/commit 三阶段 cursor 不串线，ACK ambiguous fail closed。
- checkpoint omission 只允许 progressive retrieval，不自动补发。
- 不引入 root polling、per-entry React state 或新依赖。

## Acceptance Criteria

- [ ] OpenSpec tasks 全部完成，Gate 5 通过。
- [ ] Rust compiler/delivery/artifact/source×target 增量测试通过。
- [ ] Shared Vitest、typecheck、scoped ESLint、daemon/runtime contracts 通过。
- [ ] executable Trellis spec、verification、master checklist 同步。
- [ ] review 无 correctness/data-loss/owner-routing finding。
- [ ] OpenSpec verify/sync/archive、代码提交、task archive、session record 完成。

## Non-goals

- Native Provider Continuation / NativeHistoryReader。
- vendor history file mutation。
- ML compression、silent fallback、mid-turn switching。
