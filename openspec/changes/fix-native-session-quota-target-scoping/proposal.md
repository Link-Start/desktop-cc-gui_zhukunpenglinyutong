# Proposal: fix-native-session-quota-target-scoping

## Why

Native session 的「结果 → 概览」错误展示**非当前供应商**的套餐额度（例如 Claude Code + DeepSeek 会话里出现「kimi 套餐额度」）。根因是 `b0ef0b9b9` 为 Shared Session 引入的多供应商额度列表，在 `StatusPanel` 里**无条件**对全部 conversation items 扫 `executionTargetSnapshot`，Native 同 CLI 换过供应商或历史消息带 snapshot 时会把旧 profile 一并查额度并分卡展示。用户期望：**只有 Shared Session 使用多供应商额度列表；Native 只显示当前会话绑定的供应商。**

## 目标与边界

### 目标

- Native session：概览额度 **只** 查询 `selectedEngine + providerProfileId`（当前 L2 binding），**不得** 因历史 `executionTargetSnapshot` 出现其他供应商额度卡。
- Shared session：保持现有多供应商列表行为（从 items 去重收集 + fallback 当前目标）。
- 把「是否扫 history」做成显式 `threadKind` / `isSharedSession` 门闩，避免注释假设（「原生通常只有 fallback」）再次漂移。
- 单测锁定 Native current-only 与 Shared multi-target 两条路径。

### 边界

- 仅改 status-panel 额度 target 收集与 prop 透传；不改后端 `get_coding_plan_quota` 路由（DeepSeek 非 coding-plan host 仍 unsupported 属正确）。
- 不改 Composer / 供应商切换 / Shared send 语义。
- 不删除 `collectSessionQuotaTargets`；Native 侧传入空 items 或 `mode: current-only` 即可。
- 不新增 tauri command、不引入轮询。

## 非目标

- 不统一 Native 同会话「历史用过的供应商额度回顾」产品能力（若以后需要，另开 change）。
- 不扩展 DeepSeek 等非 coding-plan host 的额度查询。
- 不改 i18n 文案结构（仅依赖现有 single/multi 渲染分支）。
- 不归档 / 不合并 `replace-checkpoint-governance-with-session-overview` 的其它未完成任务。

## What Changes

- `StatusPanel` 增加 `isSharedSession`（或等价 `threadKind`）prop。
- 构建 `sessionQuotaTargets` 时：
  - **Native**：`collectSessionQuotaTargets([], fallback)` 或 `mode: "current-only"` → 仅当前 engine+profile。
  - **Shared**：`collectSessionQuotaTargets(effectiveItems, fallback)` → 保持多卡列表。
- `useLayoutNodes` / `ActiveCanvasStatusPanel` 从 `activeThreadSummary.threadKind === "shared"` 透传。
- 可选加固：`collectSessionQuotaTargets` 增加 `mode` 参数，测试覆盖 mode 分支。
- 更新 `status-panel-session-overview` 行为契约（delta）。

## 方案取舍

### 方案 A：StatusPanel 门闩 + Native 只用 fallback（采用）

改动最小、语义清晰；与 commit 意图「支持**共享**会话多供应商额度列表」一致。Shared 行为零回归。

### 方案 B：Native 也扫 history，但 filter 只保留当前 profile（不采用）

仍会为「当前 profile 在 history 中的别名 / null local」产生重复 key 风险；且产品已明确 Native 不要多供应商列表。

### 方案 C：后端按 session id 过滤额度（不采用）

额度查询是账号/provider 级 API，与 session transcript 无关；问题在前端 target 收集范围，不应下沉后端。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `status-panel-session-overview`: 明确额度 target 收集范围按 session kind 分岔——Native current-only；Shared multi-provider from history。

## Impact

- Frontend：`StatusPanel.tsx`、`sessionQuotaTargets.ts`（可选）、`useLayoutNodes.tsx`、相关 tests。
- OpenSpec：本 change 下 delta + tasks；主 spec 在 verify/archive 时 sync。
- Backend / IPC：无变更。
- Dependencies：无新增。

## 验收标准

- Native Claude + DeepSeek（历史消息曾带 kimi 等其它 profile snapshot）：概览 **不得** 出现「kimi 套餐额度」卡；最多一条当前供应商额度（unsupported / empty / coding_plan 按后端路由）。
- Shared 多引擎切换后：概览仍展示多个供应商额度卡。
- 无活跃会话 / engine 为空：不崩溃、不发起无意义额度请求。
- 相关 Vitest 全绿；`tsc --noEmit` 干净。
