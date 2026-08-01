## Context

A4 `liveTextExternalization` 把 assistant 正文拆成两条轨道：

```text
首 delta -> root reducer durable shell
后续 delta -> liveAssistantTextChannel
terminal final -> root reducer canonical final（设计承诺）
```

Shared Session snapshot effect 只观察 reducer items，因此第三步是 durability boundary。当前事件层把 `seenDelta` 当成“已经完成”，导致 `turn/completed.result.text` 不进入 `onAgentMessageCompleted`，最终只持久化 durable shell。

## Goals / Non-Goals

**Goals:**

- terminal final 在 Shared Turn 上成为一次强制的 durable settlement。
- final 使用同一个 streaming item identity，避免 Shared reducer 新增第二条 assistant message。
- history overlay 保持正文完整度单调递增。
- 已截断数据通过 append-only snapshot 恢复，保留原日志用于回滚。

**Non-Goals:**

- 不改变每 delta 的 render/performance 路径。
- 不让 Shared history 常态访问 Native files。
- 不修改 provider runtime transcript。

## Decisions

### 1. Shared terminal final 优先于 `seenDelta`

`seenDelta` 只能说明实时正文出现过，不能证明 durable final 已完成。Shared bridge 上只要存在 `textFromResult` 且没有 `seenCompleted`，就必须触发 completion。

替代方案是在 `onTurnCompleted` drain live channel。拒绝原因：live channel 不是 provider authoritative final，无法覆盖 provider 的最终改写。

### 2. 跟踪最后 assistant item identity

复用现有 `threadAgentSnapshotSeenRef`，把它从“Codex snapshot 去重集合”扩展为按插入顺序记录 assistant item ID。Shared terminal fallback 读取最后 ID，使 `flushAgentCompletedBatch` 原位完成现有壳消息。

替代方案是使用 `turnId` 作为 completion item ID。Shared reducer 对 Shared thread 不启用 Codex assistant dedup，会生成第二条 assistant final，因此拒绝。

### 3. metadata overlay 不拥有较短正文

`mergeHistoryProjectionItems` 在 canonical assistant 与 Turn 内 Legacy assistant 可按正文前缀对应时，先选择信息量更大的正文，再复用 assembler 合并其他字段。canonical execution target 仍 authoritative。

### 4. 恢复采用备份 + append-only snapshot

从 Shared `meta.json` 的 Claude binding 定位 Native transcript，只恢复 Shared 文本是 Native final 严格前缀的已知受影响 Turn。先复制原 `log.jsonl` 作为带时间戳备份，再追加 corrected snapshot；不覆盖历史行，不修改 Native transcript。

## Risks / Trade-offs

- [Risk] `turn/completed` 与真正 `item/completed` 都到达 → `seenCompleted` tracker 保证单次 completion。
- [Risk] 多段 assistant/tool turn 的最后 item 选择错误 → tracker 只在 assistant delta/snapshot 时更新，并由同 Turn regression test 锁定。
- [Risk] canonical 与 Legacy 文本语义不同 → 只对严格 normalized prefix 关系应用“保长”，不同正文继续保持 assembler 既有行为。
- [Risk] 数据恢复映射错误 → 限定单一已知 session、严格 user prompt 对齐、操作前备份、追加而非重写。

## Migration Plan

1. 上线 realtime 和 merge guard。
2. 运行 focused regression tests。
3. 备份当前受影响 Shared log。
4. 追加 corrected snapshot 并验证最新 snapshot 正文长度/内容。
5. 如需回滚，删除新增最后一行并恢复备份；代码回滚不影响 Native transcript。

## Open Questions

无。当前 Native binding、受影响 Turn 和完整 final 均已通过只读证据确认。
