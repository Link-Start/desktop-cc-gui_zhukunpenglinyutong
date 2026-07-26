## 1. Retirement Policy

- [ ] 1.1 [P1][Depends: none][Input: OpenCode settings/policy/entry callers][Output: reachable-surface and compatibility inventory][Verify: every production import/start/send path classified] 摸清残余。
- [ ] 1.2 [P1][Depends: 1.1][Input: frontend/backend policies + legacy config][Output: authoritative soft-retirement normalization][Verify: legacy enabled cannot activate frontend/backend] 锁死 policy。
- [ ] 1.3 [P1][Depends: 1.2][Input: stale execution callers][Output: fail-closed start/send/control guards][Verify: no process spawn after rejection] 收紧 backend。

## 2. Root And Dead UI Cleanup

- [ ] 2.1 [P1][Depends: 1.2][Input: AppShell OpenCode wiring][Output: removed root selection/runtime hook][Verify: AppShell startup tests and no OpenCode timer/listener] 清理根链。
- [ ] 2.2 [P1][Depends: 2.1][Input: OpenCode CSS imports/selectors][Output: removed OpenCode-only global CSS][Verify: bundle/import scan and visual smoke of shared surfaces] 清理样式。
- [ ] 2.3 [P1][Depends: 2.1][Input: OpenCode panel/hooks/helpers callers][Output: deleted or production-excluded unreachable UI][Verify: `rg` shows no production import; build passes] 清理面板。
- [ ] 2.4 [P1][Depends: 1.3,2.3][Input: Rust/parser compatibility callers][Output: minimal retained compatibility adapter + residual list][Verify: dead handlers removed; history/diagnostics fixtures pass] 裁剪 runtime。

## 3. Verification

- [ ] 3.1 [P1][Depends: 2.2,2.4][Input: production bundle/runtime][Output: retirement verification report][Verify: no entry/root hook/CSS/process spawn; compatibility tests pass] 验证边界。
- [ ] 3.2 [P1][Depends: 3.1][Input: completed change][Output: OpenSpec closure evidence][Verify: focused tests + typecheck + Rust + strict OpenSpec pass] 完成闭环验证。
