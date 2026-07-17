## Why

Git History 右侧 changed files tree 当前把每一级目录都渲染成独立行。对于 Java、Rust 等深层 package path，这会消耗大量纵向空间并弱化文件分组关系。项目现有 Git diff tree 已具备 `Compact Folders` 语义，本变更将同一层级规则应用到 Git History。

## 目标与边界

- 将“无直接文件且只有一个子目录”的连续 directory chain 合并为一个 dot-separated row，例如 `main.java.com.example.demo`。
- 遇到直接文件、多个子目录、leaf directory 或 repository root boundary 时停止压缩。
- 保留真实 path/key、root node、expanded/collapsed state、file status、diff stats、selection 与 open-diff interaction。
- 同一 `buildFileTreeItems()` consumer（commit details 与 Push Preview）使用一致的 compact tree projection。

## 非目标

- 不修改 Git backend、commit details payload 或 changed-file sorting contract。
- 不重做 header、status color、file row layout，也不新增用户设置开关。
- 不改变 workspace primary file tree 的独立 progressive-loading behavior。

## What Changes

- Git History changed-file hierarchy 采用已有 `buildDiffTree()` + `compactDiffTree()` 语义。
- `buildFileTreeItems()` 从 compact tree 生成 visible rows，并继续使用 compact chain 末端的 canonical path 维护 expansion identity。
- 补齐 branch boundary、direct-file boundary、Windows separator、dotted-label collision 与 root compatibility 测试。
- 不包含 breaking API change。

## 方案取舍

1. **复用 shared diff tree utility（采用）**：以同一 pure helper 建树与压缩，再适配 Git History visible rows。优点是规则一致、测试面已有基础、无需依赖或 backend 改动。
2. **在 Git History 内重新实现 collapse loop（不采用）**：改动行数略少，但会形成第三套 Compact Folders 规则，Windows path 与 dotted-label identity 容易继续漂移。
3. **用 CSS 隐藏中间目录（不采用）**：无法正确维护 expansion path、keyboard semantics 与 depth，属于视觉补丁而非 tree model 修复。

## Capabilities

### New Capabilities

<!-- 本变更不新增独立 capability。 -->

### Modified Capabilities

- `git-history-panel`: changed files tree 新增 compact single-child directory chain 的显示与兼容性要求。

## 验收标准

- `src/main/java/com/example/demo/logging/File.java` 在无分叉链路中以 compact folder row 显示。
- 同层存在 `main` 与 `test` 时，`src` 保持独立；各自后续单链分别压缩。
- 中间目录存在直接文件或多个 child folders 时不跨越边界压缩。
- compact label 相同但真实路径不同的 folder rows 保持不同 identity。
- repository root、folder toggle、file selection/open diff、POSIX/Windows path 均保持可用。
- focused Vitest、lint、typecheck、`git diff --check` 与 strict OpenSpec validation 通过。

## Impact

- Frontend pure tree projection:
  `src/features/git-history/components/git-history-panel/utils/gitHistoryPanelSharedUtils.tsx`
- Regression tests:
  `src/features/git-history/components/GitHistoryPanel.test.tsx`
- Behavior spec:
  `openspec/specs/git-history-panel/spec.md` 的 change-local delta
- Dependencies / APIs / persistence: 无变化。
