## Context

当前 subAgent 在幕布上走 `GenericToolBlock` 扁条（标题常为 `Agent`），右下角 `SubagentList` 仅在 `navigationTarget` 存在时可点，且点击主路径是 scroll-to-task 或切 thread。产品已确认期望图4风格小队卡片 + 幕布内抽屉，人名来自本仓库贡献者，**但必须静态写死，禁止运行时 git log**。

相关现状：

- 识别：`isTaskLikeSubagentTool`（toolName/toolType = `agent` | `task`）
- 聚合：`useStatusPanelData` → `SubagentInfo`
- 开产出：`EngineTaskOutputInspector` / agent-task card
- 头像：`AgentIcon` + seed

## Goals / Non-Goals

**Goals:**

1. 单卡 + 小队网格 UI 模块，可被幕布与 StatusPanel 共用 ViewModel。
2. 静态加权 persona 池（本仓库真实作者，去掉 bot），`agentId` 稳定映射，不足循环。
3. 幕布内 inspector 抽屉（约 55/45 split 观感），字段：描述 / status / 工具数 / output。
4. 右下角任意 subagent 行可点 → 同一抽屉。
5. 进度条语义：completed 满条 + 工具数；running 非满。

**Non-Goals:**

- 运行时 git / 网络拉作者。
- 全局 right tab。
- 完整 tool timeline。
- 改 child session 树导航事实（可选保留 thread 跳转为次要）。

## Decisions

### D1. 静态作者池（硬决策）

- 位置：`src/features/subagent-ui/constants/personaAuthorPool.ts`
- 内容（基于 2026-08 仓库 shortlog 快照，**去掉 bot**，权重 = 提交数）：

| name | weight |
|------|--------|
| chenxiangning | 3366 |
| zhukunpenglinyutong | 320 |
| zkpaiminmin | 226 |
| George Dilley | 30 |
| watsonk1998 | 20 |
| yode | 14 |
| AlphaCat | 13 |
| hpstream | 13 |
| 俊鑫 | 6 |
| zhanghang | 4 |
| codemoss | 3 |
| e_jiaxiaofenga | 2 |
| Bet4 | 1 |
| youcaizhang | 1 |

- 映射：`stableWeightedPick(agentId, pool)` — 对 agentId 做确定性 hash，按权重区间选取；若本轮已分配过的 index 需在小队内尽量少撞名时，用 `round-robin offset = hash % n` 再取 `pool[(base + k) % n]` 即可满足「不够循环复用」。
- **禁止** `get_git_log` / `invoke` 在 persona 路径上出现。

### D2. 模块边界 `features/subagent-ui`

```
subagent-ui/
  constants/personaAuthorPool.ts
  utils/personaAssign.ts
  utils/subagentViewModel.ts
  utils/isSubagentTool.ts
  hooks/useSubagentInspectorState.ts
  components/SubagentPersonaCard.tsx
  components/SubagentSquadGrid.tsx
  components/SubagentInspectorDrawer.tsx
  components/SubagentProgressBar.tsx
  index.ts
```

- ViewModel 纯函数：从 tool item 或 `SubagentInfo` 产出卡片字段。
- 不把 UI 塞进 `GenericToolBlock` 分支地狱。

### D3. 分组 A：连续 subAgent → squad

- 在 `groupToolItems` 增加 `subagentGroup`：连续 `agent`/`task` tool 合并。
- 中间夹杂 non-tool message 则打断（与现有 read/bash 组一致）。
- 1 项也可用单卡路径（B），2+ 用 `SubagentSquadGrid`。

### D4. Inspector 状态归属

- **thread 级** React state（`useSubagentInspectorState`），挂在 Messages 层（或 app-shell 下传），保证 StatusPanel 与幕布同源。
- 打开：`open(agentViewModel)`；关闭：`close()` / Esc / 点同一卡 toggle。
- 布局：Messages 容器 `display:flex`；主列 `flex:1 min-w-0`；抽屉 `width: min(42%, 480px)`，窄屏 `<720` 改 overlay。

### D5. 详情数据

- description / status / toolCount：ViewModel。
- output：优先已有 `EngineTaskOutputSource` / snapshot 投影；无则占位 i18n「暂无交付报告」。
- 不在抽屉内嵌完整 `GenericToolBlock` 树。

### D6. StatusPanel 可点修复

- `isInteractive = Boolean(onInspectSubagent || onSelectSubagent)`，不强制 `navigationTarget`。
- 主点击 → `onInspectSubagent`（打开抽屉）；若未来需 thread 导航，可作 secondary action，本期可不做。

### D7. 进度条

- `completed` → `progress=1` + 工具数文案。
- `error` → 错误色，progress 保持 1 或 last-known。
- `running` → `progress = min(0.85, 0.15 + toolCount * 0.05)` 或 indeterminate CSS；禁止固定 100%。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 作者池过期 | 常量文件头注释「快照日期 + 更新方式」；非热路径 |
| 连续 Agent 被 reasoning 打断导致无法成组 | 允许仅当相邻 tool 之间无其它 tool 时合并；接受 B 单卡 fallback |
| 抽屉与虚拟列表高度冲突 | 抽屉挂 Messages 外壳不挂 virtual row 内；避免每行 mount 抽屉 |
| StatusPanel 与 Messages 不同树 | state lift 到 shell / layout 共享 callback |
| 与 agent-task markdown card 双轨 | Agent tool 行优先新 UI；notification card 保留不删 |

## Migration Plan

1. 落 OpenSpec artifacts（本 change）。
2. 实现 persona + VM + 组件（可先 story-less Vitest）。
3. 接入 grouping + 幕布渲染 + drawer。
4. 修 StatusPanel 可点 + 接线。
5. 测与 verify；不需要数据迁移。

**Rollback：** 删除/关 grouping 分支，Agent tool 回 `GenericToolBlock`；StatusPanel 恢复 `navigationTarget` 条件（git revert 即可）。

## Open Questions

- 无（产品已确认静态池、A+B、幕布内抽屉、字段集合、右下角一并修）。
