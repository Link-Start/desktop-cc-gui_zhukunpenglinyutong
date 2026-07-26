## Context

持久化 thread ID 已广泛传播，不能破坏性改写；同时 pending alias、native session 和用户可见 logical session 必须解耦。

## Goals / Non-Goals

**Goals:** 稳定 identity types、单一 mapping owner、渐进 prefix migration、乱序收敛。

**Non-Goals:** 不迁移历史数据库，不实现 event bus。

## Decisions

1. `LogicalSessionIdentity` 是 UI/replay owner；`NativeSessionIdentity` 只用于 CLI resume/history；`PendingAlias` 仅在确认前存在。
2. `RunIdentity`、`TurnIdentity`、`ItemIdentity` 为 opaque string，由 runtime ingress 创建。
3. alias mapping 为有状态 registry；prefix parser 仅兼容旧输入，不参与 promotion 决策。
4. domain object 显式 engine field 优先，scanner 阻止新增业务层 literal inference。

## Risks / Trade-offs

- [双写期间 identity 分叉] → invariant tests 比较 legacy/new resolver。
- [迟到事件命中退休 alias] → mapping 保留 bounded tombstone，统一转发 canonical。
- [持久化 schema 扩展] → 新字段 optional，旧记录按 fallback 读取。

## Migration Plan

先引入 types/registry，再接 Kimi/Claude promotion，随后迁移 event/action/history/UI，最后依据 telemetry 收缩 prefix fallback。回滚不删除旧 ID。

## Open Questions

alias tombstone retention 采用 session lifetime 还是时间上限，由实现 spike 以内存证据确定。
