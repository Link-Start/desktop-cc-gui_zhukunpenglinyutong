## Context

Kimi runtime 已上线，改动需以最小兼容补强为主，尤其不能破坏 pending promotion 与 live text channel。

## Goals / Non-Goals

**Goals:** scanner coverage、typed config diagnostics、cleanup warning、main spec completeness、promotion regression。

**Non-Goals:** 不改 Kimi wire protocol，不增加 mid-turn input。

## Decisions

1. scanner 的 built-in engine set 从 registry artifact 读取。
2. config loader 返回 `missing/loaded/malformed/io-error`；只有 missing 可无 notice fallback。
3. provider delete result 分为 durable ccgui deletion 与 external config cleanup，后者失败返回 warning。
4. promotion 继续复用现有 mapping，但纳入 logical identity invariant tests。

## Risks / Trade-offs

- [旧损坏配置开始显示错误] → 提供 actionable path，仍允许用户选择 builtin fallback。
- [cleanup warning 被误解为全失败] → typed partial-success 文案明确残留位置。
- [scanner 噪声] → allowlist 只允许 boundary adapter。

## Migration Plan

先补 tests/spec，再改 scanner/config result，最后接 UI warning。每一步保留现有成功路径。

## Open Questions

无。
