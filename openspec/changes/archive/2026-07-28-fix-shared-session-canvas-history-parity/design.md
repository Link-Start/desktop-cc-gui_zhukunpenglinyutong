## Context

Native Session 的 realtime adapter 与 history loader 都输出 `ConversationItem[]`，并由 `conversationAssembler` 负责 identity、dedupe 与 snapshot merge。Shared Session realtime 已复用 normalized adapter，但历史加载在 Shared Projection flag 开启时直接用 canonical items 替换 Legacy snapshot。

`shared_session_v2_commit_turn` 当前 canonical payload 只包含 final assistant text；realtime reasoning 虽然已进入 Shared thread state，并被 `sync_shared_session_snapshot` 持久化，却在 reload 的 canonical replacement 中被丢弃。另一方面，realtime assistant item 没有携带 `activeTurnTarget`，因此生成阶段无法显示 Turn Badge。

约束：

- Shared Session 不得读取 Native history files。
- 历史身份只能来自 frozen snapshot，不能读取当前 Picker。
- 高频 realtime path 不得新增 React root subscription、数组全量 dispatch 或轮询。
- 现有 Legacy snapshot 必须只读兼容，不执行 migration rewrite。

## Goals / Non-Goals

**Goals:**

- Shared realtime assistant item 在 normalized routing boundary 固化 `TurnExecutionSnapshot`。
- Shared history 使用 Native assembler 的 merge semantics 收敛 Legacy transcript 与 canonical identity。
- 保留 reasoning/tool 顺序与内容；canonical assistant identity 覆盖对应 Legacy assistant。
- 新 local/default Turn 明确固化 disk Provider semantic。

**Non-Goals:**

- 不改变 Shared canonical event schema。
- 不把 Provider-private reasoning 注入跨 Provider context package。
- 不让 Shared history 读取 Claude/Codex Native history。
- 不改变 Shared Projection feature flag 的 rollout 状态。

## Decisions

### 1. 在 normalized realtime routing boundary 注入 frozen target

当 raw Native thread 通过 `sharedSessionBridge` 映射到 Shared thread 时，从 `getSharedTargetState(workspaceId, sharedThreadId).activeTurnTarget` 读取已冻结快照，只对 assistant message item 增加 `executionTargetSnapshot`。

理由：

- 该位置已完成 native → shared owner mapping，归属明确。
- 后续继续走现有 `NormalizedThreadEvent → assembler → state → snapshot sync`。
- 不需要 MessageRow 订阅 target store，避免每个 delta 触发额外 render。

替代方案：在 MessageRow render 时读取 active target。拒绝，因为 Turn settle 后 store 清空，Badge 会消失且无法持久化。

### 2. Legacy transcript 为顺序基底，canonical projection 为 identity overlay

Shared history loader 先 hydrate Legacy snapshot，再用 assembler 的 history upsert semantics 合并 canonical items。Legacy 保留 reasoning/tool 与原始时间线；canonical 的 user/assistant facts 去重，并把 `executionTargetSnapshot` 覆盖到等价 assistant item。

理由：

- 能恢复现有历史中已经持久化的 reasoning。
- 复用 Native assembler 的 identity/equivalence 规则，避免 Shared 专属 parser。
- 不把 presentation-only facts写回 canonical storage。

替代方案：canonical projection 整体替换 Legacy。拒绝，因为 canonical commit 当前不包含完整 transcript。

### 3. local/default semantic 在 freeze boundary 补齐

当 `providerProfileId` 为空且 snapshot 未带 Provider metadata 时，freeze/IPC payload 统一补为：

- `providerProfileNameSnapshot = "本地配置"`
- `providerProfileSource = "disk"`

managed Provider 保持 Picker 提供的 snapshot；真正无法证明身份的 legacy Turn 不做猜测。

替代方案：Badge renderer 把所有空 Provider 当 local。拒绝，因为会伪造 legacy history。

## Data Flow

```text
Realtime Native event
  → shared owner mapping
  → normalized item + activeTurnTarget
  → conversationAssembler
  → Shared thread state
  → sync_shared_session_snapshot

History reload
  → Legacy snapshot → hydrate (order/transcript)
  → Canonical projection → history merge (identity/facts)
  → one ConversationItem[]
  → Messages canvas
```

## Risks / Trade-offs

- [Risk] Legacy 与 canonical item ID 不同导致重复 → 复用 assembler 的 user/assistant/reasoning equivalence，并补 focused mixed-ID fixtures。
- [Risk] realtime delta path增加对象复制 → 仅 Shared assistant normalized item 且 snapshot 存在时复制；不扫描 items、不新增 subscription。
- [Risk] local label硬编码漂移 → 复用统一 target normalization helper；只在 explicit no-provider semantic 下补齐。
- [Risk] canonical 仍不独立保存完整 reasoning → 本 change 用已存在的 Legacy dual-read contract保证 presentation parity；后续若移除 Legacy storage，必须先扩展 authoritative final snapshot。

## Migration Plan

1. 增加纯函数 history convergence 与 focused tests。
2. 增加 realtime target enrichment 与 routing tests。
3. 补 local target normalization 与 tests。
4. focused Vitest、typecheck、lint touched files、strict change validation。
5. 无数据 migration；回滚时恢复 Shared loader replacement 与 realtime enrichment 即可，既有文件保持不变。

## Open Questions

无。未来关闭 Legacy dual-read 前，需要独立 change 扩展 canonical final snapshot 的 reasoning/tool completeness。
