# Proposal: fix-shared-session-identity-id-first

## Why

Shared Session 内使用 Atomic 双栏模型选择器切 Claude/Codex managed 渠道时，系统可能错误走 **Native Provider 续接**（弹「续接没有完成」），违反「Shared 只改 `selectedNextTarget`」契约。根因：Shared 身份判定只信可丢失的 `threadKind` 投影，不信稳定的 `shared:` id 前缀；且该弱信号同时喂给 picker、**发送路径**与**删除清理**（`getThreadKind` 默认 native），爆炸半径大于 picker 本身。调研与证据：`docs/analysis/shared-session-model-picker-native-fallback-2026-08-02.md`（review 已回填三道闸/竞态/变体矩阵）。

## 目标与边界

### 目标

1. **身份 id-first**：`shared:` 前缀是身份 hard gate，`threadKind` 仅为投影兜底；新增 `resolveIsSharedSession(threadId, summary)`，复用并上提已有 `isSharedSessionThreadId`（`sidebarInternals.ts`），不造第二个 helper。
2. **Picker 硬闸**：`shared:` id 永不进入 `handleNativeAtomicTargetChange` 的续接分支；`handleNativeProviderTargetChange` 与 `prepareProviderContinuationDialog` 增加 id 硬闸。
3. **身份计算收敛**：`useLayoutNodes` / `app-shell` 两处复制的 `isSharedSession` 表达式收敛为 id-first 单一来源。
4. **send/delete 连带修复**：`getThreadKind` 改 id-first，`shared:` id 恒返回 `"shared"`（发送路径 `resolveThreadKind`、删除绑定清理 `useThreads.ts` 自动归位）。
5. **回归测试**：身份丢失场景下 picker 不续接、send 不走 native runtime、delete 仍清绑定、locked 不豁免。

### 非目标

- **T4 乐观更新 + hydrate 写序**（persist × history reload 竞态）：另开 change。
- **T5 列表 merge 保护**：需先实证 threadKind 丢失路径（C-a/C-b/C-c 候选），另开 change。
- `threadKind` 丢失路径本身的根修（本 change 用硬闸使其无害化）。
- Native 会话续接逻辑变更（硬闸只挡 `shared:` id，native 行为不变）。
- UI 外观变更（Atomic 双栏形态冻结）。

## What Changes

- 新增 `shared-session/utils/sharedSessionIdentity.ts`：`isSharedSessionThreadId`（自 `sidebarInternals.ts` 上提）+ `resolveIsSharedSession`
- `useLayoutNodes` / `app-shell`：`isSharedSession` 收敛为 id-first 单一来源
- `useThreads.getThreadKind`：id-first，`shared:` 恒 `"shared"`
- `Composer`：`onExecutionTargetChange` 分叉与 `handleNativeProviderTargetChange` 加 id 硬闸
- `useSidebarMenus.prepareProviderContinuationDialog`：闸 3 加 id 硬闸
- 测试：helper 矩阵 + picker/send/delete/locked 回归用例

## Capabilities

### New Capabilities

- `shared-session-identity`：Shared Thread 身份判定（id-first, kind-second）与 picker/send/delete/续接 guard 的统一语义。

### Modified Capabilities

- `shared-execution-target`：Shared Picker target 变更在身份投影丢失时仍 MUST NOT 触发 Native Provider 续接（residual delta，承接 `close-native-session-provider-create-binding`）。

## Impact

| 场景 | 路径 |
|------|------|
| 身份 helper | `src/features/shared-session/utils/sharedSessionIdentity.ts`（新）、`src/features/app/components/sidebarInternals.ts`、`src/features/app/components/Sidebar.tsx` |
| 身份来源 | `src/features/layout/hooks/useLayoutNodes.tsx`、`src/app-shell.tsx` |
| kind 解析 | `src/features/threads/hooks/useThreads.ts`（`getThreadKind`，连带 `useThreadMessagingThreadResolution.ts` 全部 send callsite 与 `useThreads.ts` delete 清理） |
| Picker 硬闸 | `src/features/composer/components/Composer.tsx` |
| 续接硬闸 | `src/features/app/hooks/useSidebarMenus.ts` |
| 测试 | 上述各文件的既有 test 文件 + helper 新测试 |
| Docs | `docs/analysis/shared-session-model-picker-native-fallback-2026-08-02.md` 状态回写（实施后） |

## 技术方案对比

| 方案 | 说明 | 取舍 |
|------|------|------|
| A. 只在 Composer 内打补丁（picker 局部判 id） | 最小 diff | **否** — send/delete 共用 `getThreadKind` 弱信号，picker 修好发送仍坏（§4.2） |
| B. id-first 统一 helper + `getThreadKind` 收敛 + 三道闸补 id | 一次修好 picker/send/delete 全链路；native 零行为变更 | **是** |
| C. 根修 threadKind 丢失路径（merge/归一化/list） | 治本但需先实证丢失路径 | **否（本 change）** — 候选三条未实证，列为 T5 后续 change；硬闸先行无害化 |

## 验收标准

- `shared:…` + `threadKind` 缺失时，切 Claude/Codex managed 渠道 MUST NOT 调用 `requestProviderContinuationDialog`；MUST 走 `set_shared_session_selected_engine` + hydrate `selectedNextTarget`
- `prepareProviderContinuationDialog` 对 source id `shared:…`（kind 任意）静默拒绝
- summary 整行缺失时续接请求走「来源会话已不可用」notice，不弹续接 dialog（既有行为保持）
- `getThreadKind(ws, "shared:x")` 在 summary 缺失/kind 缺失时恒 `"shared"`；send 路径 `resolveThreadKind` 同步归位
- delete `shared:` 会话（kind 丢失）仍执行 `clearSharedSessionBindingsForSharedThread`
- `sharedTargetPickerLocked` + 身份丢失时点选 no-op，不续接
- Native 会话（`claude:`/`codex:` id）续接行为不变
- `openspec validate --all --strict --no-interactive`、`npm run typecheck`、相关 vitest 套件通过
