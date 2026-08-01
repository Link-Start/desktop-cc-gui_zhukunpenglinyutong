## Why

Global Search 的 message provider 在每次 query 计算时都会重新遍历全部 thread items、装箱 `IndexedMessage[]` 并执行 `toLowerCase()`。连续输入会对同一 immutable snapshot 重复做相同工作，增加主线程计算和短生命周期内存分配。

## What Changes

- 为 message index 增加 snapshot-scoped cache：相同 `threadItemsByThread` snapshot 与 thread id 集合复用同一索引
- 在索引构建阶段保存 normalized lowercase text，query 阶段不再逐条重复转换
- 保持现有 substring matching、score、result identity、排序和 snippet 行为不变
- 用 focused tests 锁定 cache hit、snapshot invalidation 与搜索结果兼容性

## 目标与边界

- 目标：消除同一消息快照上的重复全量物化与 lowercase 分配
- 边界：只修改内存索引构建和 message provider，不新增持久化、不引入 dependency、不改变 SearchPalette UI
- 验收：相同 snapshot 重复构建返回同一索引引用；新 snapshot 自动重建；既有 provider tests 结果不变

## 非目标

- 不实现 trigram、inverted index、embedding 或 semantic search
- 不承诺 query scan 降为 O（命中数）；substring scan 仍遍历已索引消息
- 不修改其他 provider、frecency 或跨 workspace hydration

## 技术方案取舍

- **方案 A：immutable snapshot cache（采用）**：以 `threadItemsByThread` 对象引用作为 weak cache owner，并以稳定的 thread id key 区分 workspace slice。改动小，无显式 eviction，snapshot 不再被引用时可由 GC 回收
- **方案 B：持久化或全局 LRU index**：可跨 snapshot 复用 thread 分片，但需要 content version、eviction、容量预算和失效 contract。当前没有稳定 content version，复杂度超过本次目标

## Capabilities

### New Capabilities

- `message-search-index-caching`: 约束 message search 对 immutable snapshot 的索引复用、失效与结果兼容性

### Modified Capabilities

无。

## 验收标准

- 相同 snapshot + 相同 thread ids 的重复 index build 不重新遍历消息
- `threadItemsByThread` 引用变化后重建索引，新增、修改、删除消息不会返回旧结果
- normalized text 在 build 阶段生成，query 阶段直接复用
- focused Vitest、targeted ESLint、TypeScript typecheck 通过

## Impact

- `src/features/search/indexing/messageIndex.ts`
- `src/features/search/providers/messageProvider.ts`
- 对应 focused tests
- 无 API、持久化、backend 或 dependency 变化
