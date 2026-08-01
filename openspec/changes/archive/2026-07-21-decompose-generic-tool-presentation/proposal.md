## Why

`GenericToolBlock.tsx` 同时拥有 tool normalization、status/summary projection、ExitPlan
解析与 actions、file change diff/stat projection、image preview fallback、heavy output hydration
和 common shell。单文件超过 1,500 lines，使 variant correctness、copy/expand 行为与 shared
tool rendering policy 难以独立验证，也阻碍后续 messages rows/controller 拆分。

## What Changes

- 新增 pure `genericToolPresentation.ts`，集中构建 normalized status、summary、args、file
  changes、image candidate、ExitPlan content 与 hydration weight。
- 将 ExitPlan、file change、image view 的 variant JSX 与 variant-local actions 拆为专用
  content components。
- `GenericToolBlock` 继续拥有 common marker shell、expand/copy state 与 variant dispatch。
- 保持现有 DOM/a11y、copy、execution mode、diff/stat、image fallback 与 heavy hydration 行为。

## Impact

- Affected code：`src/features/messages/components/toolBlocks/GenericToolBlock*` 与新增 leaf files。
- APIs：`GenericToolBlockProps` 与外部 import path 不变。
- Dependencies：不新增 dependency；pure builder 不 import React、i18n 或 component modules。
- Compatibility：既有 GenericToolBlock regression tests MUST 保持通过。

## 验收标准

- pure presentation builder 可直接测试且覆盖主要 variants。
- specialized content components 只拥有 variant JSX/actions，不复制 common shell state。
- completed/processing/failed、heavy output、ExitPlan、file changes、image view、unknown fallback
  行为与 DOM contract 保持一致。
- focused tests、messages suite、typecheck、lint、build、boundary gate 与 strict validation 通过。
