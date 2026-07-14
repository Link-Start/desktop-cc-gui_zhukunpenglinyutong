## Why

当前全局搜索把不同内容类型混排为连续列表，文件结果又以完整路径作为标题，导致用户难以快速建立结果层次并容易忽略真正的文件名。本次变更聚焦提升结果扫描效率，同时保持现有搜索召回、排序和打开行为不变。

## 目标与边界

- 搜索结果按内容类型形成清晰 section，section 内保持现有相关度顺序。
- 文件结果以跨平台 basename 作为标题，完整路径继续作为 location metadata 和打开目标。
- 保持现有 scope、content filters、keyboard navigation、selection index 与 result action contract。

## What Changes

- 为 SearchPalette 增加按 `SearchResult.kind` 分组的 presentation projection 与 section heading。
- 调整 file provider 的 result title，使其仅展示文件名，同时保留 `filePath` 与 `locationLabel` 的完整路径。
- 增加中英文 section labels、分层样式以及 focused regression tests。
- 不引入新 dependency，不改变 `SearchResult` schema 或 backend API。

## 方案比较与取舍

- 方案 A：在 `useUnifiedSearch` 中重排并插入虚拟 heading rows。优点是 render 直接消费；缺点是污染 ranking output、selection index 和 open action contract。
- 方案 B：保持扁平 ranked results，在 `SearchPalette` presentation boundary 按 kind 聚合，并保留每项原始 index。该方案不改变搜索领域模型，keyboard selection 仍基于原数组，因此采用方案 B。

## 非目标

- 不调整 provider 召回、score、global hydration 或结果数量上限。
- 不新增折叠 section、section 内二次排序或 workspace 二级分组。
- 不改变文件打开路径、搜索筛选器和快捷键。

## Capabilities

### New Capabilities

- `global-search-result-presentation`: 约束全局搜索结果的类型分层、文件标题语义和跨分组选择连续性。

### Modified Capabilities

- 无。

## Impact

- Frontend: `src/features/search/providers/filesProvider.ts`、`src/features/search/components/SearchPalette.tsx` 及对应 tests。
- Presentation: `src/styles/search-palette.css` 与中英文 i18n labels。
- API / storage / backend: 无影响。

## 验收标准

- 混合搜索结果按 kind 显示稳定 section heading，且同组顺序与输入 ranked results 一致。
- 文件标题仅显示 basename；完整路径仍出现在 location metadata，并继续作为打开目标。
- ArrowUp / ArrowDown / Enter 在 section 边界保持原有连续 selection 行为。
- focused Vitest、TypeScript typecheck、lint、large-file gate 与 strict OpenSpec validation 通过。
