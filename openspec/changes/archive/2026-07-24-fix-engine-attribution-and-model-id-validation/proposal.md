# Proposal: fix-engine-attribution-and-model-id-validation

## Why

当前已有 5 个 engine(`claude` / `codex` / `gemini` / `kimi` / `opencode`),但两处代码仍停留在"非 codex 即 claude"的二元假设,导致 `kimi` / `opencode` / `gemini` 引擎的 subagent task output 被错误标注为 `claude`:

1. `useStatusPanelData.ts` 中 `engine: isCodexEngine ? "codex" : "claude"`,上游 `useLayoutNodes.tsx` 也只传入 boolean;`EngineTaskOutputEngine` 类型本身是 `"claude" | "codex"` 二元 union。
2. `buildTaskOutputSourceFromNotification` 中 `input.engine === "codex" ? "codex" : "claude"`,`MessageRow.tsx` 透传的真实 `activeEngine` 在该处被吞掉。

另外 `isValidModelId` 存在两份语义不一致的实现:`vendors/types.ts` 版只校验长度 ≤256(定义了 `MODEL_ID_PATTERN` 却从未使用),`composer/types/provider.ts` 版校验长度 ≤128 且强制 pattern(允许方括号)。两侧 `validateCodexCustomModels` 校验的是同一份 localStorage 数据,对话框(`CustomModelDialog.tsx`)放行的 id 可能被 runtime 侧(`useModels.ts` / `useEngineController.ts`)静默丢弃。

## What Changes

- 将 `EngineTaskOutputEngine` 放宽为真实 `EngineType` union,`buildTaskOutputSourceFromNotification` 对未知 engine 值做显式 normalize(合法值透传,非法值 fallback `"claude"`)。
- `useStatusPanelData` options 契约从 boolean 放宽为真实 engine 值(新增 `activeEngine`),`StatusPanel` 经已有 `selectedEngine` prop 透传真实引擎,`useLayoutNodes` 直传 `options.selectedEngine`。
- `isValidModelId` / `MODEL_ID_PATTERN` 收敛为单一实现:以 `composer/types/provider.ts` 较严语义为基准(长度 ≤128 + pattern 校验),`vendors/types.ts` 改为 re-export,消除两份漂移的正则字面量。
- 同步更新 `useStatusPanelData.test.ts`、`engineTaskOutputProjection.test.ts`、`provider.test.ts` 的相关断言。
- 两个 commit 独立落地(engine attribution / model-id validation),便于独立回滚。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- 无 main spec 级别行为变更:本变更为 internal bugfix(标签归因校正 + 校验收敛),不改变任何 user-facing workflow、Tauri command、storage schema 或 external API。

## Impact

- Affected code:
  - `src/features/engine-task-output/types.ts`
  - `src/features/engine-task-output/utils/engineTaskOutputProjection.ts`
  - `src/features/engine-task-output/utils/engineTaskOutputProjection.test.ts`
  - `src/features/status-panel/hooks/useStatusPanelData.ts`
  - `src/features/status-panel/hooks/useStatusPanelData.test.ts`
  - `src/features/status-panel/components/StatusPanel.tsx`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/vendors/types.ts`
  - `src/features/composer/types/provider.test.ts`
- APIs: 无 external API 变化;`EngineTaskOutputEngine` 仅 `engine-task-output` feature 内部使用。
- Dependencies: 不新增。
- Storage: 无 schema 变化;`isValidModelId` 收敛后 `CustomModelDialog` 与 runtime 校验口径一致,历史上已入库的合法 id(bracket 形式已被 composer 版接受)不受影响。

## 目标与边界

- 目标:`kimi` / `opencode` / `gemini` 引擎的 task output 在 StatusPanel 与 MessageRow 链路中被正确标注。
- 目标:`isValidModelId` 全仓库单一语义、单一 pattern 字面量。
- 边界:只修 attribution 与校验两处;`StatusPanel` 的 `isCodexEngine` boolean prop 保留,因其驱动的是 codex 专属 UI 分支(plan-as-tasklist、labelKey),属于合法的 engine capability 分支,不在本变更范围内重构。

## 非目标

- 不重构 `StatusPanel` 的 codex 专属 UI 分支或 capability router。
- 不改动 `MessageRow.tsx` 的调用方式(`activeEngine` 原样透传,类型链路自然通畅)。
- 不调整 model id 的 128 长度上限或 pattern 字符集本身(仅收敛,不放宽/收紧语义之外的字符)。

## 技术方案取舍

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 透传真实 engine + 显式 normalize | `EngineTaskOutputEngine = EngineType`;入口处对 unknown 值 fallback `"claude"` | diff 最小,非法值有兜底,类型链路通畅 | 保留一处 fallback 分支 | 采用 |
| B. 全链路替换 `isCodexEngine` prop | StatusPanel props 全部改为 `EngineType` | 契约彻底 | 触碰 ~20 处 test fixture 与 codex 专属 UI 分支,违反最小锚点原则 | 不采用 |
| C. isValidModelId 以 vendors 宽松版为基准 | 长度 ≤256 且不校验 pattern | 改动小 | 放宽 runtime 校验,bracket id 之外的非法字符可入库,与现有 runtime 行为冲突 | 不采用 |
| D. isValidModelId 以 composer 较严版为基准 + vendors re-export | 单一实现,单一 pattern | 对话框与 runtime 口径一致;pattern 是两侧字符集超集(含 brackets) | 对话框不再接受 >128 字符的 id(实践中不存在) | 采用 |
