## 1. Regression Tests

- [x] 1.1 [P0, depends: none] 在 `local_usage/tests.rs` 增加 Codex index overlay、latest-valid-wins 与 multi-home isolation tests；输入为临时 homes/JSONL，输出为可断言的 `summary`，以 focused cargo test 验证（<2h）。
- [x] 1.2 [P0, depends: none] 在 `claude_history_inline_tests.rs` 增加 Claude `custom-title` latest-valid-wins 与 first-message fallback tests；输入为临时 transcript，输出为 source fact display title，以 focused cargo test 验证（<2h）。
- [x] 1.3 [P0, depends: none] 增加 frontend regression tests，证明 weak-looking native titles 仍覆盖旧 first-message title，同时 GUI custom/mapped precedence 不变（<2h）。

## 2. Backend Implementation

- [x] 2.1 [P0, depends: 1.1] 在 `local_usage.rs` 实现 per-home `session_index.jsonl` reader 与 scan-local cache，并在既有 dedupe 前 overlay title；以任务 1.1 tests 验证（<2h）。
- [x] 2.2 [P0, depends: 1.2] 在 `claude_history.rs` 的单次 scan 中提取最后一个有效 `custom-title` 并递增 scanner version；以任务 1.2 和 cache tests 验证（<2h）。
- [x] 2.3 [P0, depends: 1.3] 以 additive optional `nativeTitle` 贯穿 Rust summary/catalog、Tauri response type、catalog normalizer 与 centralized frontend projection（<2h）。

## 3. Verification And Review

- [x] 3.1 [P1, depends: 2.1, 2.2] 运行 focused Rust tests、`cargo fmt --check`、相关 compile/typecheck 与 OpenSpec strict validation；输出为全部通过的命令记录（<2h）。
- [x] 3.2 [P1, depends: 3.1] 使用 Codex `/review` 等价流程仅审核本 change diff，修复有效 finding 并复验；输出为无阻断 finding 的 review 结论（<2h）。
- [x] 3.3 [P1, depends: 3.2] 创建只包含本 change 的 commit，完成 Trellis session record，并向 upstream 提交简洁 PR；输出为 commit hash、record 与 PR URL（<2h）。
