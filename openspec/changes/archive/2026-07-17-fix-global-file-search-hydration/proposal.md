## Why

全局搜索目前把 progressive file tree 的 shallow/partial `files[]` 当成完整 workspace 文件缓存，导致 Composer `@` 能找到的嵌套文件在搜索面板的“当前”与“全局” scope 中没有结果。现有实现还会把加载失败缓存为永久空数组，使“索引未完成”被错误呈现为“没有搜索结果”。

## 目标与边界

- 让搜索面板复用 Composer 已验证的 bounded full-snapshot hydration 思路。
- 当前 workspace 优先，跨 workspace hydration 保持有界并发。
- 保留现有搜索排序、打开行为、content filter 与快捷键。
- 显式保留 `complete`、`partial`、`error` 等文件索引状态。

## 非目标

- 不修改 Tauri workspace file listing command 或扫描预算。
- 不重做全局搜索 UI、分组和通用 ranking。
- 不让每次 keystroke 触发新的 full workspace scan。
- 不修改 progressive file tree 的 shallow-first 加载策略。

## What Changes

- 搜索文件缓存从裸 `string[]` 升级为带 hydration status、source version 和 scan metadata 的 workspace snapshot。
- 搜索面板打开且文件 provider 生效时，为当前或全局 scope 启动 bounded full-snapshot hydration；优先 active workspace，并复用 in-flight/completed snapshot。
- shallow candidates 可立即参与搜索，但不能阻止 full snapshot 补齐。
- hydration 失败不再写入永久“已完成”的空缓存；stale response 不覆盖更新的 workspace snapshot。
- partial/error hydration 在搜索面板中与真实零结果区分。
- 添加当前 scope、全局 scope、cache reuse、error retry 和 stale drop 的 focused tests。

## 技术方案对比

1. **推荐：在现有 search orchestration 中增加 typed hydration cache。** 改动集中，复用现有 `getWorkspaceFiles()`、active-first 与 concurrency=2 机制，能保留 metadata 并修复 cache poisoning。
2. **抽取 Composer/Search 共用的全局 file-index service。** 长期复用度更高，但会扩大本次变更到 shared service 生命周期、invalidation 和多个 consumer，不符合当前最小修复范围。

选择方案 1；先修复召回与状态契约，后续若第三个 consumer 出现再提炼 shared service。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `search-hydration-complement`: 搜索 hydration 必须区分 shallow/partial/complete/error，并在需要时补齐 bounded full workspace snapshot。

## Impact

- Frontend orchestration: `src/app-shell-parts/useAppShellSearchRadarSection.ts`
- Search state/types and palette rendering: `src/app-shell-parts/useAppShellSearchPaletteSection.ts`、`src/features/search/**`
- Focused tests for search hydration and partial/error presentation
- 无新增 dependency，无 backend API 变更

## 验收标准

- shallow active file list 不含目标文件时，“当前”文件搜索可在 hydration 后找到 full snapshot 中的嵌套文件。
- global cache 已含 shallow/empty active entry 时，“全局”文件搜索仍会补齐该 workspace。
- 同一 workspace 的连续 query 复用 in-flight/completed snapshot。
- hydration failure 可重试，且 UI 不显示成确定性的零结果。
- palette 关闭或 workspace 变化后，stale hydration 不覆盖新状态。
- focused tests、typecheck、lint 与 strict OpenSpec validation 通过。
