## Context

Capability facts currently cross OpenSpec fixture、Rust `EngineFeatures`、daemon mirror 与 TypeScript legacy DTO。字段错位与 production 直接 import governance fixture 使 runtime lookup 不可靠。

## Goals / Non-Goals

**Goals:** 单一 schema、生成 artifact、四层状态解释、跨层 parity。

**Non-Goals:** 不实现 capability 对应功能，不动态生成 Rust enum。

## Decisions

1. Matrix 继续保存 `supported/compat-input/unsupported/unknown` spec stance；runtime query 额外返回 `policyEnabled`、`runtimeAvailable`、`reason`，不把多维信息压成新枚举。
2. 由 script 从 spec fixture 生成 frontend/Rust-friendly artifact；CI 负责 no-diff/parity。
3. 新 domain 先加入 `input` 与 `rpc`，session 继续沿用既有 domain。
4. 缺失 runtime evidence 返回 `unknown + reason`，不 truthy-cast 为 `unsupported`。

## Risks / Trade-offs

- [生成 artifact 漂移] → CI 重新生成并要求 clean diff。
- [旧 consumer 依赖 boolean] → 提供 compatibility projection，逐调用方迁移。
- [capability 数量膨胀] → 新 key 必须 OpenSpec delta。

## Migration Plan

先扩 DTO 和 generator，再双读校验，随后切 production import，最后删除 legacy projection。回滚时恢复旧 projection，但保留新增 parity tests。

## Open Questions

无阻塞项；具体 engine cell 值在 inventory task 中以代码与 adapter tests 校准。
