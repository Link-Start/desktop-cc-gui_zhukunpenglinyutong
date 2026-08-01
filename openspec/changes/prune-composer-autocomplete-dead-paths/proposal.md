## Why

输入与提示词体系审计（`docs/reports/composer-prompt-stack-optimization-impact-2026-07-25.md` 第 1、3 项）确认 Composer 层残留两类死代码：

1. `ComposerInput.tsx` 旧实现本体已删，但 `ChatInputBoxAdapter.tsx` 头部注释仍自述 *"enabling drop-in replacement of ComposerInput"*，且 guard test 文件名沿用 `ComposerInputResponsiveness`，误导后来者去搜一个不存在的目标文件。
2. `useComposerAutocompleteState.ts`（980 行）在 `Composer.tsx:1034` 被调用，但解构出的 9 个输出中 6 个被下划线弃用（`applyAutocomplete`/`handleInputKeyDown`/`autocompleteMatches`/`highlightIndex`/`setHighlightIndex`/`activeAutocompleteTrigger`）。真实补全由 `ChatInputBox.tsx` 内 7 个独立 `useCompletionDropdown` 实例完成。Composer 层每次键入仍白跑一遍：120ms 防抖的 `projectMemoryFacade.list` + `noteCardsFacade.list` 双 IPC、对数万条路径的文件打分、`useComposerAutocomplete` 全量 matches 排序——结果全部被丢弃，只剩 `isAutocompleteOpen` 布尔与两个文本变更透传回调被消费。

## What Changes

- `useComposerAutocompleteState.ts` 瘦身：只保留 Composer 真实消费的 `isAutocompleteOpen`（trigger 上下文检测）、`handleTextChange`、`handleSelectionChange`，删除记忆/便签 IPC effect、文件打分、prompt/command/skill item 构建、`applyAutocomplete`、`handleInputKeyDown` 及无消费者的 hook 入参。
- `isAutocompleteOpen` 语义改为「光标处于补全 trigger 上下文」（`/`、`$`、`@`、`@@`、`@#`），不再依赖 items 非空——该布尔只用于抑制 inline history completion 与 ↑/↓ 历史导航，trigger 上下文判定比 items 非空判定更贴合其用途。
- 删除仅被该 hook 消费的 `useComposerAutocomplete.ts`；同步收敛 `useComposerAutocompleteState.test.tsx` 为瘦身后的契约测试。
- `Composer.tsx` 调用点移除弃用输出与失效入参。
- `ChatInputBoxAdapter.tsx` 头部注释移除 ComposerInput 迁移叙事，改为描述当前职责。
- `ComposerInputResponsiveness.guard.test.ts` 重命名为 `ChatInputResponsiveness.guard.test.ts`。

## 目标与边界

- 目标：Composer 层每次键入零记忆/便签 IPC、零全量文件打分；补全事实源唯一（ChatInputBox `useCompletionDropdown`）。
- 目标：用户可见补全行为不变——下拉由 ChatInputBox 引擎渲染，本次只删 Composer 层被丢弃的平行计算。
- 边界：`isAutocompleteOpen` 语义从「trigger 激活且 items 非空」放宽为「trigger 上下文激活」，仅影响 inline history completion 抑制与历史导航抑制的边界条件（空 workspace 输入 `@` 时从放行变为抑制，属更可取的保守行为）。

## 非目标

- 不改动 ChatInputBox 内 7 个 `useCompletionDropdown` 实例的 trigger 解析、打分或渲染。
- 不合并/迁移 prompt history（属后续批次）。
- 不调整 `suggestionsOpen` 之外任何 Composer 状态流。

## 方案取舍

1. **推荐：hook 瘦身为 trigger 检测器。** 删除死计算，保留消费方真实需要的布尔与回调；`isAutocompleteOpen` 用纯文本扫描（复用原 `resolveAutocompleteState` 逻辑，仅传 trigger 字符串）。改动外科手术式，收益确定。
2. **备选：保留 items 计算但加惰性开关。** 用 `enabled` flag 跳过 IPC，但文件打分、item 构建、matches 排序仍在，且保留两套 trigger 解析的漂移风险，优化不做满，拒绝。
3. **备选：Composer 直接订阅 ChatInputBox 的 dropdown open 状态。** 需要把 7 个实例的 open 状态上抛，跨层耦合增加，收益与方案 1 相同但 diff 更大，拒绝。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-autocomplete`：Composer 层 autocomplete hook 收敛为 trigger 上下文检测；补全项计算与渲染唯一归属 ChatInputBox completion providers。

## Impact

- Frontend：`src/features/composer/hooks/useComposerAutocompleteState.ts`、`src/features/composer/hooks/useComposerAutocompleteState.test.tsx`、`src/features/composer/hooks/useComposerAutocomplete.ts`（删除）、`src/features/composer/components/Composer.tsx`、`src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`、`src/features/composer/components/ComposerInputResponsiveness.guard.test.ts`（重命名）。
- 依赖：无新增 package。

## 验收标准

- `npm run typecheck`、`npm run lint` 通过。
- `useComposerAutocompleteState.test.tsx` 收敛后的测试通过；`ChatInputResponsiveness.guard.test.ts` 通过。
- Composer 层不再 import `projectMemoryFacade`/`noteCardsFacade` 用于补全（`grep` 验证 `useComposerAutocompleteState.ts` 无 facade 引用）。
- 手动 smoke：`/`、`@`、`@@`、`@#`、`$` 补全下拉照常弹出与选择；补全打开时 ↑/↓ 不翻历史、关闭时正常翻历史。
