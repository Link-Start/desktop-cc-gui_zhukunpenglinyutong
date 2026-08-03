## Context

当前接线（只读结论，本 change 要切断）：

```
itemsByThread
  → useWorkspaceSessionActivity  ×2
       (useAppShellSearchRadarSection + useLayoutNodes)
  → timeline → useLiveEditPreview
  → timeline → useRecordRecentFilesFromActivity
  → isProcessing → activityLive 脉冲
  → viewModel → WorkspaceSessionActivityPanel (filePanelMode==="activity")
  → Solo enter → filePanelMode="activity"
```

雷达独立：`useSessionRadarFeed`，**不在本 change 范围**。

## Goals / Non-Goals

**Goals:**

- 用户路径上完全不可达：activity 入口、activity 面板、Solo。
- 主线程不再执行 activity 派生（两处 hook 停算）。
- 下游安全：空 timeline / 不调用，禁止 undefined 崩溃。
- 可回滚：源文件保留，用 flag/短路恢复。

**Non-Goals:**

- 不删 `src/features/session-activity/**`。
- 不改雷达、不改 bottom activity panel。
- 不追求精确 perf 百分比门禁。

## Decisions

### Decision 1: 用编译期 / 模块级 flag 整切，不用 Settings 可见性

Settings `rightToolbar.activity` 语义是「藏入口、保留数据」。本需求是整切，故在 `PanelTabs` 增加：

```ts
const SHOW_ACTIVITY_TAB = false;
```

与 `SHOW_PROMPTS_TAB` 同模式。`clientUiVisibility` 可保留配置项但无入口时无效。

### Decision 2: hook 短路优先于删 import 树

在两处调用点：

1. `useAppShellSearchRadarSection` — 不再调用 `useWorkspaceSessionActivity`，导出常量空 viewModel。
2. `useLayoutNodes` — 同上；`activityLive: false`；`filePanelMode === "activity"` 时 **不** 渲染 `WorkspaceSessionActivityPanel`，改为渲染 files 或保持上次安全 panel（见 Decision 4）。

空 stub 形状（最小字段，满足现有解构）：

```ts
const DISABLED_WORKSPACE_SESSION_ACTIVITY = {
  timeline: [],
  isProcessing: false,
  // 其余面板字段若类型要求，给空数组/空字符串，禁止 undefined
};
```

若类型过严，抽 `createDisabledWorkspaceSessionActivityViewModel()` 放在 `session-activity` 旁或 app-shell-parts 常量文件，避免复制。

### Decision 3: Solo 硬关

`useAppShellSections` 中：

```ts
const soloModeEnabled = false; // was: Boolean(...settings/capability)
```

或 `useSoloMode({ enabled: false })`。入口 UI（topTool.focus / solo 按钮）随 `soloModeEnabled` 隐藏。  
`enterSoloMode` 内对 `setFilePanelMode("activity")` 不再可达。

### Decision 4: 残留状态 normalize

| 残留 | 处理 |
|------|------|
| `filePanelMode === "activity"` | 强制改为 `"files"`（或当前默认右侧 tab） |
| `isSoloMode === true` | `exitSoloMode()` 或初始 state 强制 false |
| pin 列表含 `"activity"` | 过滤掉；不报错 |

normalize 放在 layout/filePanelMode 解析一处，避免多处 if。

### Decision 5: 连带下游一并停

| 下游 | 处理 |
|------|------|
| `useLiveEditPreview` | `timeline: []` 且/或 `enabled: false` 固定 |
| `useRecordRecentFilesFromActivity` | 不调用，或传 `[]` |
| activity 相关 focused tests 期望入口存在 | 更新为「入口不存在 / hook 不跑」或 skip 标注 disable |

### Decision 6: 源码与 CSS 保留

`WorkspaceSessionActivityPanel.tsx`、adapter、CSS 不删。注释可在接线处标明：

```ts
// DISABLED: disable-session-activity-and-solo-mode — do not re-enable without OpenSpec change
```

## Risks / Trade-offs

- [Risk] 类型上 viewModel 字段不全 → 用完整 stub 或 `satisfies` 类型，跑 typecheck。
- [Risk] 测试仍 assert activity tab → 更新 PanelTabs / layout visibility tests。
- [Risk] Live Edit / external-change 与 `liveEditPreviewEnabled` 耦合 → 本 change 固定 preview 关闭时，确认 main file external monitoring 不因半开状态抖动（沿用 live-edit-preview spec：disabled 时不监控）。
- [Risk] 用户以为「只藏 UI」→ 提案已写明 BREAKING 连带。

## Migration Plan

1. 落 OpenSpec artifacts（本 change）。
2. 接线：flag + hook 短路 + Solo 关 + normalize。
3. 改测试期望。
4. typecheck / focused vitest / lint。
5. 人工：无 activity 入口、无 Solo、雷达可用、对话正常。

Rollback：`SHOW_ACTIVITY_TAB = true`、恢复 hook 调用、恢复 `soloModeEnabled` 原逻辑。

## Open Questions

无。产品指令已明确：活动整切 + Solo 注释/禁用 + 不碰雷达。
