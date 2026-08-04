# Design: fix-native-session-quota-target-scoping

## Context

`useSessionQuotaList` + `collectSessionQuotaTargets` 在 `b0ef0b9b9` 为 Shared 引入：从 `executionTargetSnapshot` 去重收集 engine+provider，并行 `get_coding_plan_quota`，概览分卡渲染。

`StatusPanel` 当前实现：

```ts
collectSessionQuotaTargets(effectiveItems, {
  engine: statusPanelEngine,
  providerProfileId,
  model: selectedModelId,
})
```

**无** `threadKind` / `isSharedSession` 分支。Native 同 CLI 多供应商（L1 切换 / 续接 / 历史 snapshot）会收集到非当前 profile，导致错误展示其它供应商套餐（用户截图：DeepSeek 会话出现 kimi 额度）。

## Goals / Non-Goals

**Goals**

1. Native：额度 target 集合 ≡ 当前 binding（fallback only）。
2. Shared：保持 history 收集 + fallback 并集。
3. 门闩显式可测，注释与行为一致。

**Non-Goals**

- 后端 coding-plan host 白名单扩展。
- Native 历史供应商额度回顾 UI。

## Decisions

### D1：门闩位置放在 StatusPanel（采用）

在构建 targets 处分支，避免 layout 层复制收集逻辑。

```ts
const sessionQuotaTargets = useMemo(() => {
  const fallback = {
    engine: statusPanelEngine,
    providerProfileId,
    model: selectedModelId,
  };
  if (!isSharedSession) {
    return collectSessionQuotaTargets([], fallback);
  }
  return collectSessionQuotaTargets(effectiveItems, fallback);
}, [isSharedSession, effectiveItems, statusPanelEngine, providerProfileId, selectedModelId]);
```

### D2：prop 命名 `isSharedSession`（采用）

与 Composer / app-shell 既有 `isSharedSession: threadKind === "shared"` 对齐，降低心智成本。默认 `false`（Native / 无会话）。

### D3：可选 `mode` 参数（轻量加固）

在 `collectSessionQuotaTargets` 增加第三参或 options：

```ts
collectSessionQuotaTargets(items, fallback, { includeHistory: boolean })
```

`includeHistory: false` 时跳过 items 循环。StatusPanel 用该参数表达意图，比「传空数组」更自文档化。

### D4：数据流

```
activeThreadSummary.threadKind
  → useLayoutNodes: isSharedSession
  → ActiveCanvasStatusPanel / StatusPanel
  → sessionQuotaTargets
  → useSessionQuotaList
  → buildSessionOverview.quotaEntries
  → SessionOverviewSection
```

Live items 仍由 `activeCanvasStatusPanelNode` selector 覆盖 `items`；kind 走 layout 静态 prop 即可（切换会话时 layout 重渲染）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Shared 误判为 Native → 只显示一条 | `threadKind === "shared"` 与现有 isSharedSession 同源 |
| Native 用户期望看历史额度 | 产品明确拒绝；文档写在 proposal 非目标 |
| 空数组 vs mode 两套语义 | 统一 `includeHistory`，测试覆盖 |

## Migration

无数据迁移。纯前端行为收口。

## Open Questions

无。产品口径已确认：仅 Shared 多供应商列表。
