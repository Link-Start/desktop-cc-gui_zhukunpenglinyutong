## Context

Quick Switcher 由三层组成：组件层（`src/features/quick-switcher/`）、shell wiring（`src/app-shell-parts/useAppShellQuickSwitcherSection.ts` base + `src/app-shell-parts/useAppShellLayoutNodesSection.tsx` wrapper 拦截）、数据中继（`src/app-shell.tsx` → `useAppShellSearchAndComposerSection.ts` → `renderAppShell.tsx`）。侦察已确认：

- `handleOpenSearchPalette`（useAppShellSearchAndComposerSection.ts:438-451）、`handleOpenNotes`（useAppShellLayoutNodesSection.tsx:1557-1568）、`handleOpenProjectMemory`（:1545-1556）均可在 wrapper 直接调用。
- `sessionRadarFeed` 创建于 `useAppShellSearchRadarSection.ts:849`，`app-shell.tsx:1257` 已解构，`:2345` 的 quick switcher 传参点在其后；`runningSessions: SessionRadarEntry[]` 已按 freshness 排序且上限 12。
- 跨 workspace 跳转：`handleQuickSwitcherSelectSession`（useAppShellQuickSwitcherSection.ts:99-119）已处理 `selectWorkspace` 切换。

## Goals / Non-Goals

- Goals：见 proposal。核心约束：**不新增订阅/定时器/轮询**（渲染红线）；**不改变既有行与入口的行为**；两个并行 worker 按本文档的接口契约各自闭环。
- Non-Goals：见 proposal「非目标」。

## Decisions

### D1：接口契约（两个 worker 的共同约定，不得偏离）

**`src/features/quick-switcher/types.ts`（Worker B 拥有）新增：**

```ts
// QuickSwitcherNavigationId 追加：
| "globalSearch" | "notes" | "memory"

export type QuickSwitcherRunningSession = {
  workspaceId: string;
  workspaceName: string;
  threadId: string;
  threadName: string;
  engine: string | null;   // 与 SessionRadarEntry.engine 对齐的实际类型为准
  startedAt: number;
};
```

**`QuickSwitcherProps`（QuickSwitcher.tsx:63-73）新增：** `runningSessions: QuickSwitcherRunningSession[]`。

**`QuickSwitcherShellBoundary`（useAppShellQuickSwitcherSection.ts:11-36，Worker A 拥有）新增：** `runningSessions: SessionRadarEntry[]`。

**导航 action 路由分工：**
- `globalSearch` / `notes` / `memory` → wrapper 拦截（Worker A，layoutNodesSection `handleQuickSwitcherNavigate` 同款分支），调对应 canonical action 后 `closeQuickSwitcher()`。

**数据映射（Worker A）：** base section 内把 `SessionRadarEntry[]` 映射为 `QuickSwitcherRunningSession[]`（`threadId/threadName/engine/startedAt` 直取，`workspaceId/workspaceName` 直取），透出为 `quickSwitcherRunningSessions`；中继链（`useAppShellSearchAndComposerSection.ts` props → `renderAppShell.tsx` → `<QuickSwitcher runningSessions={...}>`）照抄 `quickSwitcherSessionGroups` 的现有链路。

### D2：「进行中」区渲染与去重（Worker B）

- sessions pane 顶部新增 section：标题 `quickSwitcher.runningSessions`（「进行中」），仅 `runningSessions.length > 0` 时渲染。
- 行结构复用 session row 模式：live pulse badge（复用 Radar 绿色视觉语言 `#57d18c`，CSS 类新建于 `quick-switcher.css`，不新增 CSS 变量）+ engine icon + 标题 + workspace 名 + 相对开始时间（复用 `formatRelativeTimeShort`）。
- 行进入 sessions pane 的扁平化行计数（放在各 workspace group 之前），keyboard model（↑↓/Enter/roving index）自然覆盖，无需改 pane 结构。
- 去重：project 阶段后过滤——`projectQuickSwitcherSessionGroups` 输出中剔除 `runningSessions` 已含的 `workspaceId:threadId`（Worker B 在组件内或 Worker A 在投影后处理均可，约定为 **Worker B 在组件渲染前过滤**，保持 Worker A 的投影纯数据不动）。
- 点击：复用既有 `onSelectSession(workspaceId, threadId)`。

### D3：新导航入口的 UI 位置与 icon（Worker B）

- `globalSearch` 固定在导航栏**第一项**（高频发现动作）；`notes` / `memory` 追加在 `settings` 之前。
- icon 用项目既有 icon 体系（lucide 或现有 semantic icon 集），风格与既有 10 项一致；新增 key 的 i18n 文案报告给集成 worker 合并 10 locale。

### D4：测试策略

- Worker A：base/wrapper wiring tests——3 个新 id 触发正确 action 且面板关闭；`runningSessions` 映射正确（SessionRadarEntry → QuickSwitcherRunningSession）；中继 mock 更新。
- Worker B：component tests——running section 渲染/空态不渲染/去重/点击回调/键盘可达/新导航行渲染与 onNavigate id。
- 集成 worker：locale parity、focused vitest、lint/typecheck、openspec validate、diff 审计。

## Risks / Trade-offs

- **wrapper 与 base 的覆盖顺序**：新 id 的 wrapper 拦截依赖 `renderAppShell` 中 `...ctx.layoutNodes` 最后 spread 的既有契约（已有源码断言守护）。
- **并行改 QuickSwitcher.tsx 冲突**：Worker B 独占组件/CSS/types/tests；Worker A 独占 shell 层文件；接口契约在 D1 冻结，双方不得改对方文件。
- **i18n 冲突**：两个 worker 均禁止改 `src/i18n/locales/**`，新 key 报告给集成 worker 统一合并（沿用上一 change 的成熟流程）。
- **running 区行数抖动**：流式期间 runningSessions 引用高频变化，但 Quick Switcher 是临时弹窗且 runningLimit=12，渲染成本有界；行 clamp effect（QuickSwitcher.tsx:153-161）已处理行数变化。

## Migration Plan

- 无数据 migration、无 feature flag；回滚 = `git checkout --` 本变更文件。

## Open Questions

- 无。（运行日志/主题/更新入口留待后续 change 评估，已在 proposal 非目标记录。）
