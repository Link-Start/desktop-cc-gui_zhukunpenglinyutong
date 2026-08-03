## Why

右侧「会话活动」（workspace session activity）及其默认容器 Solo 模式当前仍常驻接线：`useWorkspaceSessionActivity` 在 app-shell / layout 双调用，并驱动 Live Edit Preview 与 AI 最近文件派生。产品侧决定**整条能力下线、不再使用**，以降低无用派生成本并去掉入口噪音；雷达（session radar）保持不动。

## 目标与边界

- **整切会话活动**：无入口、不渲染面板、不跑 activity 派生 hook（空 stub 或停调）。
- **整关 Solo 模式**：无入口、无法进入；持久化若残留 `filePanelMode: "activity"` 或 solo 态，启动后强制回落到安全面板（files/git）。
- **明确连带下线**：Live Edit Preview（timeline 源）、Quick Switcher「AI 改过的最近文件」采集（`useRecordRecentFilesFromActivity`）。
- **边界内最小改动**：用 feature flag / 切接线方式停用，**不删除** `src/features/session-activity/**` 源文件（便于回滚与后续 archive 清理）。

## 非目标

- **不碰雷达**（`useSessionRadarFeed` / `WorkspaceSessionRadarPanel` / radar 持久化）。
- 不改底部活动面板（Tasks / Agents / checkpoint 等 `bottomActivityPanel`）。
- 不删 i18n key、不删 CSS 文件、不做模块物理删除（本 change 仅 runtime disable）。
- 不改对话主链路（messages reducer / composer / engine send）。
- 不在本 change 做性能 profiling 或数字验收（性能收益为副产品，非门禁）。

## What Changes

- **BREAKING（产品行为）**：用户无法再打开「会话活动」面板；无法进入 Solo。
- **BREAKING（连带）**：Live Edit Preview 不再有 activity timeline 数据源，自动开文件预览停止；快捷切换 AI 最近文件停止从 activity 更新。
- 右侧 `PanelTabs` 隐藏 `activity` 入口（对齐 `SHOW_PROMPTS_TAB` 模式）。
- 停调 / 短路 `useWorkspaceSessionActivity`（壳层 + 布局两处），下游接空 timeline。
- `filePanelMode === "activity"` 不再挂载 `WorkspaceSessionActivityPanel`。
- `soloModeEnabled` 写死关闭；Solo 入口不展示、toggle 无操作。
- 启动 / 布局 normalize：残留 activity / solo 状态回落到默认右侧面板。
- 更新相关 main specs 的 behavior contract（见 Capabilities）。

## 技术方案取舍

- **方案 A（采用）— 接线级 disable + 保留源码**  
  入口 flag + hook 短路 + Solo 关死。改动面小、可回滚、不触发大规模 test 文件删除。
- **方案 B（不采用）— 物理删除 session-activity 模块**  
  diff 巨大、测试与 import 连锁爆炸，与「先下线再用」节奏不符。
- **方案 C（不采用）— 仅 Settings 隐藏入口**  
  数据仍常驻计算，不满足「整体切掉」。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `codex-chat-canvas-workspace-session-activity-panel`：会话活动入口、面板、派生与 Solo 承载要求改为 **runtime disabled**。
- `codex-chat-canvas-live-edit-preview`：在 activity 下线后，自动预览 MUST 保持关闭/无数据源，不得崩溃。
- `session-activity-file-open-affordances`：面板不可达时，相关 open/diff affordance 要求暂停生效（不得要求仍可点）。

## 验收标准

- 顶栏 / 更多菜单 **无**「活动 / Activity」入口。
- 任意路径 **无法** 进入 Solo；若本地曾处于 Solo，重启或下一次布局 resolve 后退出 Solo 且右侧不为 activity。
- 流式对话、消息幕布、Git / Files / Search / **雷达** 正常。
- 打开 activity 相关旧状态不 crash（空 stub / normalize）。
- Live Edit Preview 开关即使残留，也不得因缺 timeline 抛错；不自动抢文件焦点。
- focused tests / typecheck / lint 通过；`openspec validate` 对本 change 通过。

## Impact

- Frontend 接线：`PanelTabs.tsx`、`useLayoutNodes.tsx`、`useAppShellSearchRadarSection.ts`、`useAppShellSections.ts`、`useAppShellQuickSwitcherSection.ts`、`app-shell.tsx`（props 链）、`useSoloMode` 调用侧。
- 连带功能：`useLiveEditPreview`、`useRecordRecentFilesFromActivity`。
- OpenSpec：上述 3 个 capability 的 delta specs。
- API / backend / 雷达 / 底部活动面板：无改动。
- Dependencies：无新增。
