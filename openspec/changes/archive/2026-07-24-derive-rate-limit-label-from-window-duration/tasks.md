## 1. Shared Label Mapping

- [x] 1.1 [P0, 无依赖] 新增 `windowDurationMins` pure formatter；输入为 nullable duration，输出为 duration-derived title，并用 focused unit test 验证 300/10080/小时/天/分钟/fallback。

## 2. UI Integration

- [x] 2.1 [P0, 依赖 1.1] 在 `RateLimitWindowInfo` 补齐现有 `windowDurationMins` contract，并让 `ConfigSelect` 的 legacy/shadcn Usage paths 使用 formatter；通过 component test 验证 primary weekly window 不再显示 `5h limit`。
- [x] 2.2 [P0, 依赖 1.1] 让 legacy `ComposerInput` Usage surface 与本地 `/status` fallback 使用同一 formatter；通过 `/status` focused test 验证动态标题。

## 3. Verification

- [x] 3.1 [P0, 依赖 1.x/2.x] 运行 affected Vitest suites、`npm run lint`、`npm run typecheck`、large-file sentry 与 `openspec validate --all --strict --no-interactive`。
- [x] 3.2 [P1, 依赖 3.1] 执行 OpenSpec implementation verification，确认 tasks、delta spec、design 与代码证据一致。
