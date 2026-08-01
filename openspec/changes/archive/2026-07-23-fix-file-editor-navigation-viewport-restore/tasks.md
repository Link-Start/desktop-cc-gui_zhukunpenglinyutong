## 1. Editor Snapshot Core

- [x] 1.1 [P0] 扩展 feature-local history location；输入为 CodeMirror selection head 与 `scrollDOM.scrollTop`，输出为 normalized cursor + viewport snapshot；验证 non-zero line/column/scroll capture。
- [x] 1.2 [P0, depends: 1.1] 在 semantic jump、Back、Forward 离开前刷新 current entry；输出为最新 snapshot 与保持正确的 ordered history/index；验证 Back/Forward 与 branch truncation。

## 2. Restore Timing And Isolation

- [x] 2.1 [P0, depends: 1.2] 将 pending viewport restore 接入现有 focus-success boundary；输入为 history-owned destination，输出为 cursor focus 后 exact vertical scroll restoration；验证 stale/path mismatch no-op。
- [x] 2.2 [P0, depends: 2.1] 保持 manual navigation isolation 与并发 shortcut task 能力；验证 manual file activation 清链且不应用 pending snapshot，现有 File Editor shortcuts 不回退。

## 3. Incremental Verification And Closure

- [x] 3.1 [P0, depends: 2.2] 增加 focused Vitest 并执行受影响 tests、`npm run typecheck`、`npm run lint`；不运行全量 test suite。
- [x] 3.2 [P0, depends: 3.1] 执行 changed-code review，修复 findings 后重跑增量 gate；输出无未处理 correctness/regression finding。
- [x] 3.3 [P1, depends: 3.2] 执行 strict OpenSpec validation、implementation verify、spec sync 与 archive。
