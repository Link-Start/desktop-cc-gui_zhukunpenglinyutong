## Context

Provider Continuation Dialog 分阶段：`preparing` → `confirm` → `running` → ready/error。  
`running` 对应 `createNativeProviderContinuation` await，进度 phase 含 `starting-target` / `delivering-context` / `verifying-target` / `finalizing`。

当前保护意图是：执行中勿误关。副作用是卡在目标 Provider 时无法退出。  
后端 create 路径只读 source、写入 target 与 operation store；产品文案已承诺「来源会话保持不变」。

## Goals / Non-Goals

**Goals**

- 任意 stage 可关闭 Dialog（底部取消/关闭）。
- 关闭 = 放弃本次续接对 UI 的接管（current selection / provider activate）。
- source Session 只读契约不变。
- late success 幂等忽略。

**Non-Goals**

- 后端 abort in-flight invoke。
- 删除可能已创建的 target Session。
- 性能优化交付路径。

## Decisions

### Decision 1: Cancel is frontend abandon, not backend abort

- `closeProviderContinuationDialog` 在 `running` 时：
  1. `canceledProviderContinuationOperationsRef.add(operationId)`
  2. `replaceProviderContinuationDialog(null)`
  3. `providerContinuationOperationIdsRef.delete(operationKey)`（允许同目标重新发起新 operation）
  4. 若 stage 仍是 prepared 语义（preparing/confirm/prepare-retry）则 `discard_prepared`；**running 不调用 discard**（可能已进入 creating，避免误删 recovery 所需 identity）

### Decision 2: Late success must check canceled set

在 `confirmProviderContinuation` 的 `await create...` 之后、任何 `onSelectThread` / provider activate / dialog error write 之前：

```
if (canceledProviderContinuationOperationsRef.has(operationId)) {
  canceled...delete(operationId);
  // optional: silent — no notice storm
  return; // finally still clears guardKey
}
```

同样覆盖 error 分支，避免 canceled 后弹窗被错误态重新打开。

### Decision 3: Bottom cancel is the sole new affordance

- 去掉 `disabled={isRunning}`。
- `onOpenChange(false)` 不再要求 `!isRunning`。
- 不加 header ×（与用户确认的最小方案一致）。

### Decision 4: progress events after cancel

Dialog state 为 null 时现有 progress subscription 已 no-op；无需额外改 backend。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Orphan target Session 留在列表 | 可接受；recovery 文案已说 target 可能已创建 |
| 用户以为 cancel 会 kill CLI | 本期不文案夸大；不写「已中止后端」 |
| operationKey 清理后立即重开 | 新 operationId；旧 invoke 靠 canceled set 忽略 |
| guardKey 与 concurrent create | finally 仍 delete guardKey；canceled 后允许同 source 再试 |

## Migration

无数据迁移。无 API version bump。

## Open Questions

无（本期范围已收敛）。
