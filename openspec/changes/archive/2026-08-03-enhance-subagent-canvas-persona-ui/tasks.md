## 1. OpenSpec / foundation

- [x] 1.1 创建 change `enhance-subagent-canvas-persona-ui` 与 proposal/design/specs
- [x] 1.2 `openspec validate` 本 change（实现前/后各一次）

## 2. Persona + ViewModel

- [x] 2.1 静态作者池 `personaAuthorPool.ts`（写死权重，无 git）
- [x] 2.2 `personaAssign.ts`：agentId 稳定映射 + 循环复用 + unit tests
- [x] 2.3 `isSubagentTool` + `subagentViewModel`：从 tool item / SubagentInfo 投影卡片字段
- [x] 2.4 进度语义：completed 满条；running 非 100%

## 3. UI components

- [x] 3.1 `SubagentProgressBar` / `SubagentPersonaCard`
- [x] 3.2 `SubagentSquadGrid`（标题 + 网格）
- [x] 3.3 `SubagentInspectorDrawer`（描述/status/工具数/output 占位）
- [x] 3.4 样式：幕布 split 观感（宽屏侧栏，窄屏 overlay）

## 4. Canvas integration

- [x] 4.1 `groupToolItems`：连续 agent/task → `subagentGroup`
- [x] 4.2 Timeline / ToolBlock 渲染链接入单卡与小队
- [x] 4.3 Messages 层挂载 inspector state + 抽屉布局
- [x] 4.4 i18n `subagentUi.*`（至少 zh + en）

## 5. Status panel

- [x] 5.1 `SubagentList` 始终可点（不依赖 navigationTarget）
- [x] 5.2 点击走共享 `openSubagentInspector` → 同一幕布抽屉
- [x] 5.3 StatusPanel 相关测试通过（既有 suite）

## 6. Verify

- [x] 6.1 focused Vitest（persona / grouping / viewModel）
- [x] 6.2 typecheck 相关路径（无新增 error）
- [x] 6.3 人工 smoke：多 agent 网格、单卡、无 output、右下角打开抽屉（用户已验收通过）

## 7. Review 补丁（P0/P1）

- [x] 7.1 subAgent tool 不进 process-phase 折叠（完成后仍留幕布）
- [x] 7.2 切 thread/workspace 关闭 inspector，防串台
- [x] 7.3 StatusPanel 主点击只开抽屉；导航改为次要按钮
- [x] 7.4 subagentGroup 虚拟列表估高按卡片数
- [x] 7.5 补 collapse / store / row-size 测试
