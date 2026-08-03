# Design: fix-shared-session-identity-id-first

## Context

Shared Session 的身份存在两套真相：稳定 id 前缀 `shared:`（create 即确定）与列表 merge 投影 `threadKind`（可丢失/可默认 native）。Picker、send、delete、续接 guard 中，picker 链路（`useLayoutNodes` / `app-shell` / `Composer`）与 `getThreadKind` 只信投影；history/delete/resume/messages 已按 id-first。身份投影一旦丢失（候选路径见 analysis §4.3，未实证），picker 走 Native 续接、send 走 native runtime、delete 不清绑定。

证据与调用链：`docs/analysis/shared-session-model-picker-native-fallback-2026-08-02.md`（含三道闸真实顺序 §3.4、爆炸半径 §4.2、变体矩阵 §6.3）。

## Goals / Non-Goals

- Goals：proposal「目标」1–5。
- Non-Goals：proposal「非目标」（T4/T5 另开 change；不根修丢失路径；不动 native 续接）。

## Decisions

### D1. 身份判定：id-first, kind-second，单一 helper

新增 `src/features/shared-session/utils/sharedSessionIdentity.ts`：

```ts
export function isSharedSessionThreadId(threadId: string | null | undefined): boolean {
  return Boolean(threadId?.trim().startsWith("shared:"));
}

export function resolveIsSharedSession(
  threadId: string | null | undefined,
  summary: { threadKind?: "native" | "shared" } | null | undefined,
): boolean {
  return isSharedSessionThreadId(threadId) || summary?.threadKind === "shared";
}
```

- `sidebarInternals.ts` 的 `isSharedSessionThreadId` 改为 re-export（或删除并改 `Sidebar.tsx` import）；**全仓库只允许这一份实现**。
- 取舍：不移除 `threadKind` 字段——它仍是投影真相，只是不再单独充当身份 hard gate。

### D2. `isSharedSession` 单一来源

`useLayoutNodes.tsx:1305` 与 `app-shell.tsx:1184` 是同一表达式的两处复制。收敛：在 composer controller 装配处计算一次（`resolveIsSharedSession(activeThreadId, activeThreadSummary)`），沿既有 prop 链下传；下游消费者（`Composer` / `StatusPanel` / `MessagesCore` / `SharedSendStatusBar`）不改接口，行为随源头归位。

### D3. `getThreadKind` id-first

```ts
const getThreadKind = useCallback((workspaceId, threadId) => {
  if (isSharedSessionThreadId(threadId)) return "shared";
  const thread = state.threadsByWorkspace[workspaceId]?.find((t) => t.id === threadId);
  return thread?.threadKind === "shared" ? "shared" : "native";
}, ...);
```

连带修好（零额外改动）：`useThreadMessagingThreadResolution.resolveThreadKind` 全部 send callsite；`useThreads.ts:2499` delete 绑定清理。

### D4. 三道闸补 id（纵深防御，不依赖上游收敛正确）

| 闸 | 位置 | 改动 |
|----|------|------|
| 1. Composer handler | `handleNativeProviderTargetChange` | `isSharedSessionThreadId(activeThreadId)` → return |
| 1'. 分叉 | `onExecutionTargetChange` | `resolveIsSharedSession(activeThreadId, summary)` 判定 shared；`shared:` id 永不落 native 续接分支；locked 时明确 no-op |
| 3. prepare | `prepareProviderContinuationDialog` | `thread.id.startsWith("shared:")` → return（与既有 kind 闸并列） |

闸 2（summary 存在性 →「来源会话已不可用」notice）为既有行为，保持。

### D5. 不根修 threadKind 丢失路径

C-a（runtime 事件归一化）/ C-b（merge truthy 覆盖）/ C-c（shared list 空失败不 merge）三条候选未实证。D1–D4 使丢失无害化；实证与 merge 保护归 T5 后续 change。

## Risks / Mitigations

| 风险 | 缓解 |
|------|------|
| native 续接回归 | 硬闸只匹配 `shared:` 前缀；native id（`claude:`/`codex:`/`kimi:`）不命中；跑 `useSidebarMenus` / Composer 续接相关既有测试 |
| helper 上提破坏 import | `Sidebar.tsx:790` 为唯一生产 callsite；保留 re-export 兜底 |
| `getThreadKind` 语义变化波及其他 caller | caller（delete 清理、messaging 代理等）对 `shared:` id 均期望 `"shared"`，方向一致；跑 `useThreads` / `useThreadMessaging` 既有套件 |
| 测试对 `threadKind: "native"` + `shared:` id 组合的旧断言 | 该组合本就属「矛盾输入」，新行为以 id 为准；逐条核对并更新断言意图 |

## Verification Plan

- `openspec validate --all --strict --no-interactive`
- `npm run typecheck`
- focused vitest：helper 新测试 + `Composer` / `useThreads` / `useThreadMessaging` / `useSidebarMenus` 相关套件
- 用户人工验收（实施后不提交，先 review）
