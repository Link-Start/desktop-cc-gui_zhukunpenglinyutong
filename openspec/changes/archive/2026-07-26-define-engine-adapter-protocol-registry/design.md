## Context

Engine-specific modules同时拥有 process 与 domain semantics。需要在不破坏 built-in Rust 类型安全的前提下，为未来 external/plugin engine 留注册边界。

## Goals / Non-Goals

**Goals:** adapter/protocol composition、extensible `EngineId`、provenance、runtime handle lifecycle。

**Non-Goals:** 不加载第三方代码，不实现 marketplace。

## Decisions

1. `BuiltInEngine` enum 与 opaque `EngineId` 并存；builtin 可无损转换，external 只能走 schema-validated registration。
2. protocol trait 只处理 executable/process/wire；adapter trait 处理 capability/identity/session/delivery。
3. registry entry immutable，runtime availability 单独更新，避免静态 metadata 被状态写污染。
4. `RuntimeManager` 独占 live handle；replacement 增加 generation，旧 handle 操作返回 stale error。
5. source info 至少包含 builtin/plugin、registration id、version 和 trust origin。

## Risks / Trade-offs

- [trait 过大] → 用最小必需方法，从现有 engine adapters 提炼，不设计未使用扩展点。
- [builtin/external 分支扩散] → 统一 `EngineId` 查询，只有构造与 privileged dispatch 区分。
- [lifecycle 迁移中 orphan] → process registry reconciliation 与 Drop/abort tests。

## Migration Plan

先实现 registry DTO 与 traits，再适配一个 one-shot engine 和 Codex persistent runtime，验证后迁移其余 built-ins。保留旧 module facade 直到 parity 完成。

## Open Questions

external protocol 首版是否只允许 host-provided process adapter，由未来 plugin runtime change 决定；本 change 只固定 registration boundary。
