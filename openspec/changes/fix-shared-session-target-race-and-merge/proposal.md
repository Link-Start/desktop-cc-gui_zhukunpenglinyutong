# Proposal: fix-shared-session-target-race-and-merge

## Why

`fix-shared-session-identity-id-first`（T1–T3）已将 Shared Session 身份判定改为 id-first 硬闸，核心续接误入与 send 错发已消除。但两个残余问题仍导致 Shared 会话 **UI 外观退化**（target 被意外清空→底栏回退全局 Native）与 **线程列表 merge 时 `threadKind` / 条目丢失**：

- **T4**：`handleSharedTargetChange` 先 persist 后 hydrate 无乐观更新；`sharedHistoryLoader` 对不完整 target 无条件 hydrate null；persist × history reload 竞态导致选择被弹回。
- **T5**：merge 无 `shared:` 保护，`threadKind` 可被 truthy `"native"` 覆盖；`listSharedSessions` 空/失败时 shared 条目被丢弃。

调研：`docs/analysis/shared-session-model-picker-native-fallback-2026-08-02.md` §4.3–§4.5。

> **Review 补强（2026-08-02）**：首版实现草案有两处闭环缺口，本提案一并纳入，避免「以为修好其实没兜住」。

## 目标与边界

### 目标

1. **T4 乐观更新**：`handleSharedTargetChange` 先 hydrate 再 persist；失败回滚并 toast。
2. **T4 写序 / 代次**：`sharedHistoryLoader` 用 per-thread generation 检测加载期间写入；禁止用 stale / 不完整 target 覆盖 store 中已有完整 target。
3. **T4 不降级覆盖（补强）**：loader 在 store 已有完整 `ResolvedExecutionTarget` 时，不得用「更旧 persisted」或 null 把 store 降级为空。
4. **T5 merge 保护**：`shared:` id 的 `threadKind` 恒为 `"shared"`；后置矫正兜底。
5. **T5 list 空/失败保留（补强）**：`existingSharedSummaries` MUST 从 **`existingThreads`（上一帧列表）** 提取；**仅当** `listSharedSessions` 空/失败时补回。非空 list 为成员权威，禁止复活已删除 shared。

### 非目标

- 实证 `threadKind` 丢失的具体候选路径（C-a / C-b / C-c）：merge 保护使三条路径全部无害化。
- Native 会话 merge 行为变更。
- 根修 shared list 数据源本身（后端/daemon 可靠性，另开 change）。
- Native Claude runtime model 串台（`k3` vs deepseek）——见姊妹提案 `fix-native-claude-provider-runtime-model-sync`。

## What Changes

- **Composer `handleSharedTargetChange`**：乐观更新（hydrate → persist → 失败 rollback）
- **`targetStore`**：`persistGeneration` + `getSharedTargetState` / `getPersistGeneration`
- **`sharedHistoryLoader`**：代次检测 + 不完整不覆盖完整 + 禁止用 stale 降级
- **`useThreadsReducer` merge**：`shared:` kind 硬闸 + 后置矫正
- **`useThreadActions` shared list merge**：从 `existingThreads` 提取 shared；空/失败/部分列表均补回
- **测试**：乐观 rollback、loader 写序、reducer merge、list 空/失败保留

## Capabilities

### New Capabilities

- `shared-session-target-optimistic`：Shared target 乐观更新、写序保护与竞态防御。
- `shared-session-merge-guard`：线程列表 merge 时 Shared 条目（`shared:` id）的身份字段与条目本身不受 merge 覆盖/丢弃。

### Modified Capabilities

- `shared-session-identity`：merge 保护补全 `threadKind` 投影稳定性。
- `shared-execution-target`：乐观更新写序补充 target 持久化链路稳定性。

## Impact

| 区域 | 路径 |
|------|------|
| 乐观更新 | `src/features/composer/components/Composer.tsx` |
| store 代次 | `src/features/shared-session/target/targetStore.ts` |
| history 写序 | `src/features/threads/loaders/sharedHistoryLoader.ts` |
| merge kind | `src/features/threads/hooks/useThreadsReducer.ts` |
| list 保留 | `src/features/threads/hooks/useThreadActions.ts` |
| 测试 | 上述模块对应 `*.test.ts(x)` |

## 技术方案对比

| 方案 | 说明 | 取舍 |
|------|------|------|
| A. 仅加速 persist、保持先 persist 后 hydrate | 竞态窗口仍在 | **否** |
| B. 乐观 hydrate + generation + existingThreads 补回 | 标准乐观并发 + 正确真相源 | **是** |
| C. 后端 listSharedSessions 失败返回 existing | 前端兜底更安全，不吞后端错误 | 后端另议；本 change 前端兜底 |

## 验收标准

1. Shared 切渠道后 UI 立即反映新 target；persist 失败回滚 + toast。
2. history reload 与 in-flight persist 并发时，不把乐观值清成 null / 旧值。
3. merge 后任意 `shared:` 条目 `threadKind === "shared"`。
4. `listSharedSessions` 返回 `[]` 或 throw→`[]` 时，侧栏仍保留上一帧全部 `shared:` 条目。
5. `listSharedSessions` 部分返回时，未出现在新列表中的 existing `shared:` 条目仍保留。
6. 与 `fix-shared-session-identity-id-first` 既有测试无回归；`openspec validate --strict` 通过。
