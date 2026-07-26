## 1. Runtime Boundary

- [x] 1.1 [P0][Depends:none] 输入 `useThreadActions` hydration option；输出 normal hydration 默认关闭 OpenCode native session probe；验证 focused thread action test 不调用 `getOpenCodeSessionList`。
- [x] 1.2 [P0][Depends:1.1] 输入 startup owner registry；输出移除 `opencode_session_list` owner；验证 owner tests 与 symbol scan 通过。

## 2. Regression Governance

- [x] 2.1 [P0][Depends:1.1,1.2] 输入现有 `check-opencode-retirement.mjs`；输出 default/owner structural guard；验证 `pnpm check:opencode-retirement` 退出码 0。
- [x] 2.2 [P1][Depends:2.1] 输入现有 hydration 测试模式；输出 normal default 与 explicit compatibility regression cases；验证 focused Vitest 通过。
- [x] 2.3 [P1][Depends:2.2] 输入 retired engine execution policy；输出清理 workspace/thread creation 的 stale OpenCode/Gemini assertions；验证相关 hook tests 通过。

## 3. Verification

- [x] 3.1 [P0][Depends:2.2] 输入全部改动；输出 focused tests、typecheck、retirement gate、OpenSpec strict validation 结果；验证全部退出码 0 且 `git diff --check` clean。
