## Context

Shared execution、canonical Shared thread、thread reducer 与 `liveAssistantTextChannel` 分别承担执行、身份、结构和高频正文职责。当前设计要求第一条 delta 创建 reducer assistant shell，后续正文只更新外部 channel；但 active thread 切换会改变 render scheduling 与 history restore 决策。若 shell 尚未提交，切回 processing thread 又跳过 history reload，channel 虽有正文却没有 row consumer，形成“backend running、UI frozen”。

约束：修复必须遵守 render performance baseline，不能把每个 delta 重新 dispatch 到根 reducer；同时不能通过 durable history 修复未完成 turn 的实时投影。

## Goals / Non-Goals

**Goals:**

- 让 assistant shell identity 在 Shared thread inactive 时仍可靠建立。
- 让重新激活的 running Shared thread 从现有 live channel 恢复可见正文。
- 保证 terminal final 与 shell 使用同一 assistant item，且 settle idempotent。
- 用 focused regression test 固化 session switch race。

**Non-Goals:**

- 不改变 backend turn execution、Shared owner resolution、attempt reattach 或 durable terminal barrier。
- 不改变 canonical/legacy history merge、消息持久化格式或 engine protocol。
- 不扩大到 conversation canvas scroll ownership、通用 active canvas 重构或全部 Native Session navigation。
- 不新增 polling、全量 reload 或 per-delta reducer update。

## Decisions

### 1. 首个 assistant shell 作为 lifecycle-critical 结构更新

第一条可见 assistant delta 的 payload 仍写入 `liveAssistantTextChannel`，但建立 assistant item identity 的 reducer operation MUST 不受 inactive-thread background policy 延迟。它与 turn start/terminal 一样属于结构性事件，而不是正文增长事件。

替代方案是让所有 inactive delta urgent。该方案会扩大 root render 压力，因此拒绝；只有 first-shell transition 提升优先级。

### 2. Reconciliation 使用现有 identity 与 channel，不读取 history

重新激活 processing Shared thread 时，event owner 只 flush 该 canonical `shared:*` thread 尚未落地的 raw delta operation 与 pending normalized assistant snapshot；其它 thread 继续原 cadence。随后既有 `useSyncExternalStore` cold subscription 直接读取 live channel 当前 snapshot，不请求 canonical history，也不新增第二套 shell state。

替代方案是 active-thread change 后强制 history refresh。durable snapshot 在运行中不是实时 authority，且 reload 会扩大重复与排序风险，因此拒绝。

### 3. 保持三类写入边界

- Structural：first shell、turn lifecycle、activation handoff，允许 reducer update。
- Payload：subsequent assistant deltas，仅进入 bounded `liveAssistantTextChannel`。
- Durable terminal：完整 final 写回同一 reducer item，并清理 channel。

该边界避免以 correctness 修复为由恢复根链高频 setState。

### 4. 测试落在现有 thread event/runtime seam

测试使用现有事件 hook/store 测试模式，构造 Shared A、普通/其他会话 B 和 active-thread 变化。断言 focus 放在 shell cardinality、channel 正文、terminal convergence 与 reducer dispatch 次数边界，不挂载完整 AppShell。

## Risks / Trade-offs

- [Risk] first-shell urgent 可能增加一次 inactive thread reducer update → 只提升每个 assistant message 的首次结构写入，后续 delta 保持 row-local。
- [Risk] activation reconciliation 与已排队 first-shell operation 竞态导致重复 shell → 复用既有 assistant item id / reducer idempotency，不生成第二 identity。
- [Risk] 修复误触 Native Session → 以 Shared canonical identity 与 processing lifecycle 限定 activation fallback；通用 first-shell correctness 保持现有语义。
- [Risk] active canvas selector 仍可能存在独立 render-subscribe 窗口 → 本 change 不做 store 重构；测试若证明它是必要根因，再以最小 selector 修复纳入并更新 artifacts。

## Migration Plan

1. 先固化 first-shell 与 activation contract 的 focused test。
2. 最小修改现有 projection scheduling/handoff。
3. review 确认没有 per-delta root dispatch、history reload 或 owner binding 改动。
4. 本变更无数据迁移；回滚时撤销 frontend projection patch 与测试即可。

## Open Questions

无。若实现期证据显示缺口完全来自 `activeCanvasStore` subscribe race，而非 shell scheduling，则暂停实现并先更新本 design 的 ownership 边界。
