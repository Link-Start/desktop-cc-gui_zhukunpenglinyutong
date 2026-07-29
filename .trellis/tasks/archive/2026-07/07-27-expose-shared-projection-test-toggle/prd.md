# Expose Shared Projection Test Toggle

OpenSpec: `expose-shared-projection-test-toggle`

## Goal

让测试者无需 DevTools 即可开启或关闭 Change A Shared Projection read path，并把
多 CLI × 多 Provider 总任务清单改成可快速理解的认知地图。

## Requirements

- 在 `设置 → 其他设置` 增加默认关闭的 Shared Projection 测试开关。
- 复用 `mossx.sharedProjection` localStorage flag，变化后自动 reload。
- 保持 V0 fallback 与真实 Shared Send 路径不变。
- Wave 0–6 每个任务补充大白话说明、改变点与 UI 变化。

## Acceptance Criteria

- [x] 开关可发现、可持久化、可关闭并自动刷新。
- [x] focused frontend tests、typecheck、scoped lint 通过。
- [x] OpenSpec strict validation 通过。
- [x] Markdown 表格列数一致，本地链接有效。

## Technical Notes

不扩展 `AppSettings` 或 Rust persistence；测试 control 直接复用现有 DataSource
flag contract。
