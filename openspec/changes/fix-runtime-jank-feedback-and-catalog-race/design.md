## Context

运行时证据显示三个共享前端问题：

1. thread selection 先提交 `activeThreadId`，再异步切换 global `activeEngine`；catalog effect 因而可能组合新 thread provider 与旧 engine。
2. renderer diagnostics 每次 flush 都重读 persisted entries、重新 normalize，并以逐项 `JSON.stringify` 去重；诊断自身造成的 frame drop 又进入下一轮 diagnostics。
3. `liveAssistantTextChannel` 已承担正文 delta，但 growing `agentMessage` snapshot 仍可能把全文写回 root reducer，使稳定 Timeline presentation model 失效。

约束：保留 last-good catalog、诊断导出/重启恢复、结构事件顺序、terminal settlement 与 final Markdown convergence；不增加 dependency。

## Goals / Non-Goals

**Goals:**

- 消除跨 engine thread selection 的 catalog torn state。
- 让 diagnostics flush 成本由新增记录数决定，而非历史总量决定。
- 让纯 live assistant 正文增长停留在 row-local channel。
- 为每条根因建立可运行的 regression guard。

**Non-Goals:**

- 不重构 engine controller 的全部 selection transaction。
- 不修改 Rust client store persistence protocol。
- 不改变消息 virtualization、Markdown 策略或 terminal lifecycle。
- 不关闭或采样掉关键 diagnostics。

## Decisions

### 1. Catalog scope 由 active thread 原子派生

Catalog sync 使用同一个 thread snapshot 的 `engineSource` 与 `providerProfileId`，不再将 thread-local provider 与异步 global engine 拼接。请求结果仍通过现有 engine model state 进入 UI；提交前做 semantic equality guard。

备选方案是等待 `setActiveEngine()` 完成后再设置 active thread。该方案会扩大 navigation latency，且所有 selection caller 都必须遵守顺序，容易出现 sibling regression，因此不采用。

### 2. Diagnostics 使用 module-local canonical snapshot

首次需要 persisted diagnostics 时读取并 normalize 一次，保存在 module-local canonical snapshot。后续 flush 将 buffered entries 增量合并、按现有 retention rule trim，再写入 client store；清空/reset 同步更新 cache。保留 entry identity dedupe，但只对增量边界执行。

备选方案是延长 throttle 或降低 retention。它只能降低频率，单次 O(history) 成本和自激反馈仍存在，因此不采用。

### 3. Growing assistant snapshot 复用 transient live-text channel

当 snapshot 属于 active non-terminal assistant item，且变化仅为正文增长时：

- 保持 durable item identity shell；
- 最新正文写入 `liveAssistantTextChannel`；
- 不为纯正文增长 dispatch root reducer update。

结构字段变化、item identity 变化、tool/reasoning boundary、terminal/final snapshot 仍走 durable path。completion 继续执行 channel drain/convergence，确保 history 与 final Markdown 完整。

备选方案是 memoize `MessagesTimeline` 更多 props。snapshot 已改变根 items/presentation input，组件级 memo 只能推迟而不能消除错误所有权，故不采用。

### 4. 测量语义保持 exclusive/non-exclusive 清晰

`timeline-list-render` 与 `timeline-active-row-render` 是同一 commit 的嵌套归因，不累加为总 CPU。验收以触发次数、commit duration 和 stable input identity 为准。

## Risks / Trade-offs

- [Risk] diagnostics cache 与外部 store 写入失步 → cache 仅治理本模块 owner 的写路径；reload/reset 时显式重建，测试覆盖 external preload 与 clear。
- [Risk] snapshot 携带非文本结构变化被错误旁路 → fast path 必须使用窄 predicate，只接受同 item 的正文单调增长；其他变化回退 durable dispatch。
- [Risk] provider profile 缺失或 legacy thread 无 engine source → 使用现有 engine fallback，但 mismatch guard 阻止已知跨 engine profile 请求，并保留 last-good catalog。
- [Trade-off] module-local diagnostics cache 增加少量内存 → retention 本就有界，换取消除周期性 O(history) 主线程工作。

## Migration Plan

1. 先落地 focused tests，锁定 provider scope、diagnostics incremental merge、snapshot predicate。
2. 分别实现三条独立变更并运行目标 suites。
3. 运行 typecheck、lint、runtime contracts 与 OpenSpec strict validation。
4. 无 storage migration；应用 reload 时从现有 diagnostics store 初始化 cache。

回滚时可按三条链路分别撤销。diagnostics 回滚不会损坏 persisted JSON；streaming 回滚恢复原 reducer path；catalog 回滚恢复原 effect scope。

## Open Questions

- 人工复测时记录 diagnostics flush p95 与 Timeline text-only commit count，作为本次 current baseline，不把历史设备数值固化为永久阈值。
