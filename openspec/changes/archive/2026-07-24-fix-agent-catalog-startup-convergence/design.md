## Context

`useSelectedAgentSession` 同时维护 active selection、thread-scoped React cache、同步 ref 与 client storage。当前 `reloadSelectedAgent` 读取 `selectedAgentBySessionKey`，又通过 `writeSelectedAgentForSessionKey` 写回该 state；最终 reload effect 订阅 callback identity，因此 cache write 会成为下一轮 reload 的 trigger。

引入 built-in agent catalog 后，冷启动新增了 `catalog pending -> ready`、persisted built-in selection resolution、失效 selection cleanup 与 pending-to-canonical thread migration。AppShell 还在两个 mount effects 中调用 `reloadAgentCatalog()`。这些阶段叠加时，原本潜伏的自反馈 dependency graph 可能无法有限收敛，production ErrorBoundary 最终捕获 React #185。

同仓库的 `useSelectedComposerSession` 已通过同步 cache ref、统一 equality gate 和有序 migration 修复同类问题，本 change 复用该已验证模式。

## Goals / Non-Goals

**Goals:**

- reload effect 的 dependency graph 不包含它自己写入的 React cache state。
- ref、React state 与 storage 只在 logical value 真实变化时更新。
- persisted built-in agent 在 catalog readiness 与 thread identity migration 并发时稳定收敛。
- 每个 AppShell cold-start mount window 只有一个 catalog reload owner。
- 用 StrictMode 与 write-count assertions 锁定有限收敛边界。

**Non-Goals:**

- 不重构 Agent domain 为 reducer 或 external store。
- 不改变 agent catalog RPC、storage schema、prompt resolution 或发送链。
- 不清理用户历史 persisted selection。
- 不修改 composer startup selection。

## Decisions

### Decision 1: 使用同步 cache ref 切断 reload 自反馈

新增 `selectedAgentBySessionKeyRef` 作为 orchestration 层的 latest snapshot。所有 cache mutation 先比较 logical equality，再同步 ref，并仅在真实变化时更新 React state。`reloadSelectedAgent` 和 migration 从 ref 读取，因此 callback 不再依赖自身写入的 React state。

Alternatives:

- last-run key guard：会错误跳过同 key 在 catalog ready 后的合法 resolution。
- 删除 React cache state：会改变 `resolveAgentForThread` 的 rerender 通知语义。

### Decision 2: 单一 helper 管理 ref/state/storage 一致性

新增 memory-cache helper，负责 ref/state equality gate；现有 storage writer 复用该 helper，并独立判断 persisted value 是否等价。hydration 只需注入 memory cache 时调用 helper，选择变更、migration 或失效清理调用 storage writer。

这样 seed、draft carry、catalog resolution 和 identity migration 不再各自拥有不同的引用更新规则。

### Decision 3: AppShell mount 只保留一个 catalog reload

保留 settings lifecycle effect 作为 catalog refresh owner：冷启动 `settingsOpen === false` 时加载一次，Settings 从 open 变为 closed 时继续刷新。删除额外的 unconditional mount effect，避免同一 mount window 发起重复 request。

不把 dedup 逻辑塞进 service 或 promise cache，因为这里是明确的 ownership duplication，不需要增加新的缓存实体。

### Decision 4: 回归测试覆盖真实阶段组合

hook 测试使用 React StrictMode，模拟 persisted built-in selection、deferred catalog resolve、重复 rerender 与 pending-to-canonical migration；断言 selection 连续、storage write 有界。AppShell startup test 断言冷启动自动 catalog reload 只有一次并且没有 maximum-depth error。

## Risks / Trade-offs

- [Risk] ref 与 React state 发生漂移。→ 所有 mutation 只允许经过单一 helper，并用 resolver/rerender 测试验证两者一致。
- [Risk] 删除 unconditional effect 后 Settings 刷新语义退化。→ 保留现有 `settingsOpen` lifecycle effect，并覆盖 initial closed 与 close-after-open 两个场景。
- [Risk] StrictMode effect replay 仍会调用 async service 两次。→ owner 数量收敛并不等于绕过 React development replay；测试分别验证 production-style ownership 和 StrictMode 下的幂等结果。
- [Trade-off] 继续保留 React cache state用于通知 consumers，而不是彻底移除。→ diff 更小，维持现有 hook contract；ref 是 orchestration snapshot，state 是 render notification。

## Migration Plan

1. 先补 hook/AppShell 组合回归测试，证明旧 dependency graph 与重复 reload 入口。
2. 引入 cache ref/helper，迁移 reload 与 identity migration 的读取路径。
3. 删除 AppShell duplicate mount reload。
4. 运行 focused tests、typecheck、lint 和 strict OpenSpec validation。

Rollback：回退本 change 的 frontend 与 spec 文件即可；没有 backend、dependency 或 storage migration。

## Open Questions

- 无。若修复后 production 仍出现 React #185，应以新 diagnostics updater/component stack 建立独立 change，不继续扩张本 hotfix。
