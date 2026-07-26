## Context

Claude provider 管理跨 localStorage、frontend hook 与 Rust commands。迁移必须避免覆盖较新 canonical 值。

## Goals / Non-Goals

**Goals:** canonical-only write、幂等迁移、typed errors、rollback。

**Non-Goals:** 不改 provider config 业务 schema，不重做 UI。

## Decisions

1. canonical key 是唯一 write target；legacy keys 只在 migration reader 内可见。
2. canonical 存在时永远优先；legacy 仅填补缺失值，成功持久化后 best-effort 删除并记录 failure。
3. action 返回 discriminated union；unexpected failure 保留 cause/context。
4. optimistic UI 仅在能 rollback 的操作使用，失败重载 durable state。

## Risks / Trade-offs

- [localStorage 不可用] → in-memory fallback + visible diagnostics。
- [legacy cleanup 失败] → 不回滚 canonical success，但保留 warning。
- [调用方仍忽略 result] → typed API 与 lint/test 强制处理。

## Migration Plan

先引入 migration helper 与 tests，再切 canonical-only write，最后迁移 action result/UI。兼容窗口结束另开 change 删除 legacy read。

## Open Questions

legacy read 退出日期需基于版本遥测或明确 release window 决定。
