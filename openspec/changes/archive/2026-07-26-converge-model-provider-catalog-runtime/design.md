## Context

各 engine 已有不同程度 runtime discovery，但 fallback、cache、provider metadata 与 refresh failure policy 不统一。

## Goals / Non-Goals

**Goals:** source pipeline、稳定 precedence、last-good cache、provider/protocol 正交、provenance。

**Non-Goals:** 不要求所有 CLI 提供 discovery，不删除 custom model。

## Decisions

1. catalog entry key 为 engine + provider + model id；protocol 是独立字段，不从 model prefix 推断。
2. merge precedence 固定 `runtime > configured > cached > generated fallback`，同层 first-owner 规则 deterministic。
3. refresh transaction 成功才替换 cache；失败返回 last-good + stale/error。
4. generated fallback 在 Rust/TS 只保留一个 owner，由 build artifact 投影。
5. dynamic source 记录 observedAt；curated source 记录 lastVerifiedAt/lifecycle。

## Risks / Trade-offs

- [现有模型排序改变] → fixture 锁定各 engine precedence/order。
- [cache 陈旧] → UI 标记 stale，不伪装 fresh。
- [provider metadata 缺失] → legacy bare ID 使用单一 fallback classifier 并记录 provenance。

## Migration Plan

先扩 DTO 并保持旧字段，接 Codex/Kimi runtime source，再迁移 Claude merge，最后删除双重 fallback/prefix inference。

## Open Questions

cache TTL 只用于 freshness 提示还是自动 refresh，由实测 CLI 成本决定；失败时永不清空 last-good。
