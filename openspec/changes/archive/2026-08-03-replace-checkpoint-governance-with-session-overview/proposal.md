# Proposal: replace-checkpoint-governance-with-session-overview

## Why

用户反馈:「结果」tab 顶部的「治理证据」区在客户端里没有用,干扰太大。核实后确认四个根因:

- **内容错位**:治理证据(large-file gate / heavy-test-noise / OpenSpec / Trellis)是 mossx 本仓库 CI 治理的 dogfooding 投影(起源见 archived change `2026-05-28-integrate-openspec-trellis-bridge-into-status-panel`)。经 `dynamic-project-governance-evidence` 泛化后,gate 类证据仍只认 mossx 自有的 `.artifacts/*.json` 协议;普通用户项目里该 section 只剩 pass 行与 `cost-budget` 噪音。
- **污染 verdict**:`bridgeGovernancePolicies` 让 degraded / fail 证据向 checkpoint verdict 贡献 `needs_review`,仓库 CI 状态被错误翻译成「这次会话的工作结果待复核」。
- **数据静态**:`useGovernanceEvidence` 只在 tab 激活时读一次 workspace 文件,不刷新。
- **违背自家策略**:`docs/architecture/harness-governance-strategy.md` 明确「治理对开发者默认隐形」,当前却把治理证据放在「结果」tab 头部。

现状事实:

- 「结果」tab(dock)渲染顺序为 `GovernanceEvidenceSection` → `CostBudgetSection` → `CheckpointPanel`(`src/features/status-panel/components/StatusPanel.tsx`)。
- `governanceSnapshot` 同时喂给 section 渲染与 `buildCheckpointViewModel`,两者共用一份 evidence。
- 全 app 目前没有任何「会话概览 / session info」面板;组装它所需的数据(`activeTokenUsage`、`threadStatusById`、`approvals`、`userInputRequests`、`activeRateLimits`)已全部存在于前端 store / `activeCanvasStore` snapshot,无需新增 tauri command。
- `client-ui-visibility` 注册表(`CLIENT_UI_CONTROL_REGISTRY`)已支持按 control 粒度开关 UI,settings UI 自动渲染,是治理证据开关的现成载体。

## 目标与边界

### 目标

- 「结果」tab 头部默认展示**会话概览**(session overview):engine / model / workspace、运行状态与时长、消息与 turn 统计、上下文占用、rate limit、待处理项(approvals / user input)计数。
- 治理证据默认**隐藏且不加载**:新增 client UI visibility control `bottomActivity.governanceEvidence`,默认 `false`;开关关闭时 MUST NOT 读 workspace 文件、MUST NOT 渲染治理证据 section。
- verdict 解耦:开关关闭时 `governanceSnapshot` MUST 为 `null`,checkpoint verdict 只由会话内信号(todos / subagents / fileChanges / commands / isProcessing)决定;开关打开时保持现有 advisory 语义不变。
- 治理证据功能代码(readers / adapters / section 组件)保留,供 mossx 开发者经设置开关 opt-in,不删除。
- **结果详情默认隐藏(第二轮追加)**:会话概览以下的 checkpoint 详情区(总结 hero、提示信号、验证 chips、文件变化、风险、建议动作、提交弹窗、Policy 审计)与成本区,由新增 client UI visibility control `bottomActivity.checkpointDetails` 统一门控,默认 `false` —— 默认状态下「结果」tab 只渲染会话概览;开关打开后恢复完整 checkpoint 表面。tab badge 的 verdict 仍照常计算(纯会话信号)。

### 边界

- 不删除 `src/features/governance/**`、`GovernanceEvidenceSection`、`bridgeGovernancePolicies` 等现有实现与其测试。
- 不删除 `CostBudgetSection` / `CheckpointPanel` 及其测试;两者仅被 `bottomActivity.checkpointDetails` 门控,开关打开时行为与现状一致。
- 不改动 `CostBudgetSection` 的成本/预算语义;会话概览不重复渲染 token 五维拆分与成本金额(仍在 CostBudgetSection)。
- 不做跨 session 用量聚合(`useLocalUsage` 仍是死代码,留后续)。
- 会话概览只读,不提供交互动作(不加按钮/菜单)。
- popover 变体本就不渲染治理证据,维持现状;`showCheckpointDetails` prop 默认 `true`,popover 与既有测试行为不变,只有 dock 生产链路经 `useLayoutNodes` 传入控制值。
- 顺手可做:`threadStatusById` prop 类型从 `{ isProcessing?: boolean }` 收窄到 `ThreadActivityStatus` 所需子集,不做其它类型清理。

## What Changes

- 新增 capability `status-panel-session-overview`:「结果」tab 会话概览 section 的数据来源与展示契约。
- `clientUiVisibility` 新增 control `bottomActivity.governanceEvidence`(parent `bottomActivityPanel`),**默认 false**;settings「界面可见性」自动出现该开关。
- `clientUiVisibility` 新增 control `bottomActivity.checkpointDetails`(parent `bottomActivityPanel`),**默认 false**;关闭时「结果」tab 只渲染会话概览,开启时恢复 CostBudget + CheckpointPanel 完整详情。
- `StatusPanel` 新增 props:`showGovernanceEvidence`、`showCheckpointDetails`、`workspaceName`、`activeRateLimits`、`pendingApprovalsCount`、`pendingUserInputCount`;`activeCanvasStatusPanelNode` selector 增选 `approvals` / `userInputRequests` / `activeRateLimits`。
- 「结果」tab:`GovernanceEvidenceSection` 仅在 `showGovernanceEvidence` 时渲染;`CostBudgetSection` + `CheckpointPanel` 仅在 `showCheckpointDetails` 时渲染;新增 `SessionOverviewSection` 常驻渲染。
- `governanceSnapshot` 仅在 `showGovernanceEvidence` 时构建,否则传 `null` 给 `buildCheckpointViewModel`;checkpoint view model 仍照常计算以驱动 tab badge verdict。
- i18n zh / en 补齐;其余 locale 走 fallback(zh-TW→zh,其它→en)。

## Capabilities

### New Capabilities

- `status-panel-session-overview`: 会话概览 section 的字段清单、数据来源、空态与降级行为契约。

### Modified Capabilities

- `dynamic-project-governance-evidence`: 治理证据 UI 从「默认展示」改为「默认隐藏、设置开关 opt-in」。
- `governance-evidence-bridge`: verdict 消费增加「开关关闭时 snapshot 不参与」的前置条件;开启时 advisory 语义不变。

## 验收标准

- 默认状态(用户从未打开开关)下,「结果」tab MUST NOT 渲染治理证据 section,MUST NOT 触发 `list_workspace_files` / `read_workspace_file` 治理读取,tab badge verdict MUST NOT 受任何治理证据影响。
- 默认状态下,「结果」tab MUST 只渲染会话概览,MUST NOT 渲染总结 hero、提示信号、验证 chips、文件变化、成本区、建议动作、提交弹窗或 Policy 审计;无活跃会话时 MUST 渲染空态而非崩溃。
- 会话概览 MUST 至少包含 engine、model、workspace 标识、运行状态、上下文占用。
- 用户在设置中打开 `bottomActivity.governanceEvidence` 后,治理证据 section、workspace 读取与 verdict advisory 参与 MUST 恢复现状行为。
- 用户在设置中打开 `bottomActivity.checkpointDetails` 后,成本区与完整 checkpoint 详情(含文件变化与提交流程)MUST 恢复现状行为。
- 无论详情开关状态如何,tab badge 的 verdict MUST 照常计算(仅由会话内信号决定)。
- 会话概览 MUST 只从已有前端 store / props 取数,MUST NOT 新增 tauri command、MUST NOT 引入秒级轮询。
- 会话概览的待处理计数 MUST 与消息流内嵌 approval / user-input 卡片数量一致(同源 `activeCanvasStore` snapshot)。
- settings「界面可见性」面板 MUST 展示两个新开关,开关状态 MUST 持久化并在重启后保持(复用 client-ui-visibility 既有持久化)。
