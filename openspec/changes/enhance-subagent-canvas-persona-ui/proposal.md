## Why

对话幕布与右下角 StatusPanel 的 subAgent 展示仍是「Agent / 子代理 + 截断文案」扁条，信息密度差、视觉粗糙；右下角列表常因缺少 `navigationTarget` 而不可点。并行多 subAgent 时无法一眼识别「谁在干什么」。现在补齐 persona 卡片墙 + 幕布内 inspector 抽屉，可立刻提升可读性与可操作性，而不改动 subAgent 调度/运行时契约。

## 目标与边界

- 幕布 **A**：连续 `Agent`/`Task` 类 subAgent tool 合并为 **小队网格**（参考期望稿：序号、名字、头像、任务摘要、工具数、进度条）。
- 幕布 **B**：单独出现的 subAgent 同样渲染 **同一套单卡**（不再只显示 `Agent` 一行）。
- 人名与头像：使用 **仓库内静态作者池**（写死，约 10 个真实作者 + 权重）；按 `agentId` 稳定映射；作者不够时循环复用；**运行时禁止拉 git log**。
- 点击卡片或右下角列表 → **幕布内临时 inspector 抽屉**（不占全局 right tab；视觉占比接近「开文件」水平 split）。
- 抽屉内容仅：任务描述 + status + 工具数 + output/交付报告。
- 进度条：`completed` 满条并展示真实工具数；`running` 渐进/不确定态，禁止假 100%。
- 右下角 `SubagentList` **始终可点**，与幕布点击打开同一抽屉。

## 非目标

- 不在运行时执行 `git log` / `shortlog` / 远程作者同步。
- 不占全局 right panel tab，不改 editor 全局 split 状态机。
- 不展示完整 tool 时间线（仅 output/交付报告）。
- 不改 subAgent 启动、权限、collab 调度、thread 树导航事实源。
- 不引入 GitHub 头像或用户上传头像。
- 不重做 StatusPanel 其它 tab（todo/checkpoint/plan/command）。

## What Changes

- 新增 `src/features/subagent-ui/**`：persona 池、ViewModel、单卡、小队网格、幕布内 inspector 抽屉。
- `groupToolItems`（或等价 grouping）支持连续 subAgent → `subagentGroup`。
- 幕布 tool 渲染链接入 Squad/单卡，替换 Agent/Task 扁条呈现。
- Messages 区域支持 inspector split 状态（thread 级，本地 UI state）。
- `SubagentList` 可点条件放宽；点击统一打开 inspector（与幕布共享 state）。
- 静态作者池常量（含 commit 权重，用于加权随机；仅编译期常量，非运行时 git）。
- i18n：`subagentUi.*`。
- focused Vitest：persona 稳定映射、grouping、列表可点、抽屉字段。

## 技术方案比较

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| **A. 静态作者池 + 新 subagent-ui 模块** | 作者名单写死；按 agentId 加权 hash 选人；幕布/StatusPanel 共用 ViewModel 与抽屉 | 零 IPC/零 git 抖动；映射稳定；UI 边界清晰 | 作者池需偶尔人工更新 | **采用** |
| **B. 运行时 git shortlog** | 每次/缓存拉 log 聚合作者 | 自动跟随仓库贡献者 | 慢、错环境、bot 噪声、与「不要拉 log」冲突 | **否决** |
| **C. 占全局 right tab 打开详情** | 复用 PanelTabs 新 tab | 与开文件完全同轨 | 用户明确要求幕布内抽屉、不占 right tab | **否决** |

## Capabilities

### New Capabilities

- `subagent-canvas-persona-ui`：定义幕布 subAgent 单卡/小队网格呈现、静态 persona 映射、幕布内 inspector 抽屉字段与打开/关闭 contract，以及 StatusPanel 子代理列表与幕布共享打开路径。

### Modified Capabilities

- `generic-tool-presentation`：Agent/Task 类 tool 在幕布上允许由 persona 卡片/小队网格承载，不再强制 GenericTool 扁条作为唯一呈现。
- （若有行为级要求）`subagent-session-tree-navigation`：仅补充「列表点击可打开 canvas inspector」的可选路径，不改变 thread 树导航既有事实。

## 验收标准

- 2+ 连续 Agent/Task → 小队网格，而非 N 条「Agent」。
- 单独 Agent/Task → 单卡，含名字 + AgentIcon + 描述 + status/进度 + 工具数（有则显示）。
- 同 `agentId` 多次渲染名字稳定；作者不足循环复用；无运行时 git 调用。
- 点卡片 / 点右下角行 → 幕布内抽屉打开；内容含描述、status、工具数、output（无则安全占位）。
- completed → 进度满条；running 不满条假 100%。
- 抽屉不创建全局 right tab；Esc/关闭按钮可关。
- focused Vitest + typecheck 相关路径通过。

## Impact

- **Frontend**
  - 新：`src/features/subagent-ui/**`
  - `src/features/messages/utils/groupToolItems.ts` + tool 渲染链 / Timeline
  - `src/features/messages/components/Messages*`（drawer shell）
  - `src/features/status-panel/components/SubagentList.tsx` + StatusPanel 回调
  - shell 层共享 inspector 打开回调（必要时）
  - `src/styles/*` 或 feature CSS；`src/i18n/locales/*`
- **Spec**：新 capability + generic-tool-presentation delta
- **Backend / git IPC**：无（静态池）
