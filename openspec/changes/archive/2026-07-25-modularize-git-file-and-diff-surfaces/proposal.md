## Why

`GitDiffPanel`、`FileViewPanel` 及其主测试文件均超过 large-file hard gate。两套 AI commit 编排仍分别维护，diff/compare surface 也缺少共享 presentation contract，导致修复同步成本和回归半径持续扩大。

## 目标与边界

- 让四个目标文件退出 large-file gate。
- 按 capability owner 拆 production code 与 tests，不做无语义的行数搬运。
- 统一 Git Changes 与 Worktree 的 AI commit generation controller。
- 为 editable/review/read-only diff surface 建立共享 presentation model。

## 非目标

- 不重做 Git/File UI。
- 不修改 Rust Git command payload。
- 不承诺本批清零仓库其余 large-file failures。

## What Changes

- 从 `GitDiffPanel` 抽出 commit generation 与 menu orchestration。
- 从 `FileViewPanel` 抽出独立 view capability。
- 将超大测试按 capability suite 拆分，并复用 test utilities。
- 引入最小 diff presentation model，保留各 surface 的 editing/read-only policy。

## Capabilities

### New Capabilities

- `git-file-surface-modularity`：Git/File 高频入口必须按 capability owner 维护，并共享 AI commit 与 diff presentation contracts。

### Modified Capabilities

- 无。

## Impact

- Frontend：GitDiffPanel、GitHistoryWorktreePanel、FileViewPanel、diff/compare surfaces。
- Tests：GitDiffPanel 与 FileViewPanel focused suites。
- Tooling：large-file gate。
- 无 backend schema 变化；尽量不新增 dependency。

## 验收标准

- 四个目标文件不再触发对应 hard threshold。
- 两个 AI commit 入口调用同一 controller。
- diff surfaces 共享 presentation model，policy 保持独立。
- 增量 tests、typecheck、touched lint 与 targeted large-file check 通过。
