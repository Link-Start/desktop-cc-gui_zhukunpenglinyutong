# Design: replace-checkpoint-governance-with-session-overview

## Context

「结果」tab 的内容组合在 `StatusPanel.tsx` dock 分支内硬编码:治理证据 → 成本 → checkpoint。治理证据的加载(`useGovernanceEvidence`)、cost-budget 证据合成、`governanceSnapshot` 构建、verdict 计算全部无条件执行。本设计在不删除治理能力的前提下,把它改为 opt-in,并用会话概览填补血肉。

## 方案对比

### 治理证据的开关载体

- **方案 1(选定):client-ui-visibility control** `bottomActivity.governanceEvidence`,默认 false。
  - 优点:复用既有注册表 + settings UI + 持久化(storage `app.clientUiVisibility`),用户可见、可自助恢复;与 `bottomActivity.tasks/agents/checkpoint` 同级,心智一致。
  - 缺点:语义上它不是「开发者模式」总开关,而是单点可见性开关——对本场景恰好够用。
- 方案 2:perf flag localStorage(`ccgui.perf.*`)。用户不可见,dogfooding 恢复成本高,否决。
- 方案 3:新增 `AppSettings.developerMode` 总开关。超出本次需求(YAGNI),否决。

### 会话概览的数据通路

- **选定:全部走 `activeCanvasStore` snapshot selector + 既有 props**。`ActiveCanvasSnapshot` 已含 `approvals` / `userInputRequests` / `activeRateLimits` / `activeTokenUsage` / `threadStatusById` / `processingStartedAt` / `lastDurationMs` / `isContextCompacting`;`activeCanvasStatusPanelNode` 的 selector 增选三个字段即可,享受既有 `shallowEqual` + `useDeferredValue` 防抖链路,不新增 store 订阅。
- workspace 展示名经 `useLayoutNodes` 传 `workspaceName`(同 `workspacePath` 的既有通路)。
- 不引入 queue 计数(`activeQueue` 在 app-shell 层,不在 snapshot;为一颗 chip 穿透三层不值得,留待后续)。

### 组件结构

```
结果 tab (dock)
├── SessionOverviewSection        ← 新增,常驻
│   └── buildSessionOverview(props) → SessionOverviewViewModel
├── GovernanceEvidenceSection     ← 保留,仅 showGovernanceEvidence 时渲染
├── CostBudgetSection             ← 不动
└── CheckpointPanel               ← 不动(governanceSnapshot 入参变为可空来源)
```

`SessionOverviewViewModel` 字段(全部确定性派生,无 model 参与):

| 字段 | 来源 | 空态 |
|---|---|---|
| `engine` / `model` | `selectedEngine` / `selectedModelId` | 缺失则该行不渲染 |
| `workspaceName` | prop(回退 `workspacePath` 末段) | 无 workspace 时 section 整体空态 |
| `status` | `isProcessing` + `threadStatusById[id].isContextCompacting` → `running / compacting / idle` | 恒有值 |
| `durationMs` | running 取 `processingStartedAt` 起算,idle 取 `lastDurationMs` | 无则不渲染 |
| `messageCount` / `turnCount` | `itemsByThread[activeThreadId] ?? items` 统计 user / assistant 条目 | 0 也渲染 |
| `contextUsedPercent` / `contextUsedTokens` / `modelContextWindow` | `activeTokenUsage` | 无 usage 不渲染 |
| `rateLimitPrimary` | `activeRateLimits.primary`(usedPercent / resetsAt) | null 不渲染 |
| `pendingApprovals` / `pendingUserInputs` | `approvals.length` / `userInputRequests.length` | 0 不渲染(避免常显 0 噪音) |

### verdict 解耦的实现点

`StatusPanel.tsx` 现状:`governanceSnapshot` 无条件构建并传入 `buildCheckpointViewModel`。改为:

```ts
const governanceEnabled = showGovernanceEvidence === true;
const governanceEvidenceState = useGovernanceEvidence(
  workspaceId,
  governanceEnabled && variant === "dock" && activeTab === "checkpoint" && Boolean(workspaceId),
);
const governanceSnapshot = useMemo(
  () => (governanceEnabled ? /* 现有构建逻辑 */ : null),
  [governanceEnabled, ...],
);
```

- `useGovernanceEvidence` 的 `enabled=false` 分支已有(返回空 evidence 且不读文件),无需改 hook。
- `buildCheckpointViewModel` 的 `governanceSnapshot` 本就是 optional(`checkpoint.ts`),传 `null` 后 `bridgeGovernancePolicies` 自然零贡献,verdict 退回纯会话信号。**这是「待复核」污染的修复点。**
- `costGovernanceEvidence`(pricing-unavailable / budget-unconfigured)同样只在 `governanceEnabled` 时合成——它既是 section 噪音也是 verdict 噪音,一并门控。

## 数据流

```
clientUiVisibility store (app.clientUiVisibility)
  └─ useLayoutNodes: isControlVisible("bottomActivity.governanceEvidence")
       └─ StatusPanel.showGovernanceEvidence
            ├─ useGovernanceEvidence(enabled)        → workspace 文件读取(仅开启时)
            ├─ GovernanceEvidenceSection 渲染门控
            └─ governanceSnapshot → buildCheckpointViewModel(仅开启时)

activeCanvasStore snapshot
  └─ activeCanvasStatusPanelNode selector(增选 approvals / userInputRequests / activeRateLimits)
       └─ StatusPanel → buildSessionOverview → SessionOverviewSection
```

## 风险与缓解

- **风险:开关默认 false 改变既有用户(主要是 mossx 开发者)的默认体验。** 缓解:这是本 change 的目标行为;proposal 已说明,settings 可一键恢复;`normalizeClientUiVisibilityPreference` 对存量 preference 合并默认值,无需迁移。
- **风险:verdict 从 needs_review 回落,用户可能困惑「待复核」消失。** 缓解:这正是修复意图;开启开关后行为可复现。
- **风险:selector 增选字段引发额外渲染。** `approvals` / `userInputRequests` / `activeRateLimits` 都是事件驱动低频变更,且走既有 shallowEqual + deferred 链路,符合 AGENTS.md 渲染红线(不新增高频 setState、不新增轮询)。
- **风险:测试字典(vitest.setup.ts)缺新 key 导致断言漂移。** 新增 i18n key 时同步补测试字典。

## 测试策略

- `clientUiVisibility` 单测:新 control 注册、默认 false、set/get round-trip。
- `buildSessionOverview` 单测:各字段派生、空态规则、pending 计数 0 不渲染。
- `SessionOverviewSection` 组件测试:渲染关键行、空态。
- `StatusPanel` 集成测试更新:默认不渲染治理证据、不调用治理读取、verdict 不受治理 fixture 影响;`showGovernanceEvidence` 打开后恢复旧断言。
- 既有 `governance/evidence/**`、`bridgeGovernancePolicies`、`GovernanceEvidenceSection` 测试保持绿(功能未删)。
