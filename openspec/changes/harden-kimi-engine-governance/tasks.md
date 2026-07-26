## 1. Regression Baseline

- [ ] 1.1 [P0][Depends: establish-logical-session-runtime-identity][Input: current Kimi promotion code/tests][Output: history-first/late-delta/terminal-after-promotion characterization fixtures][Verify: current intended behavior passes] 锁定 canonical baseline。
- [ ] 1.2 [P1][Depends: define-engine-adapter-protocol-registry][Input: engine registry/scanner][Output: registry-backed scanner including Kimi][Verify: injected Kimi literal branch fails] 补治理 gate。

## 2. Config And Provider Reliability

- [ ] 2.1 [P1][Depends: none][Input: Kimi config read/parse paths][Output: missing/loaded/malformed/io-error result][Verify: four Rust fixtures] 显式配置诊断。
- [ ] 2.2 [P1][Depends: 2.1][Input: provider cleanup paths][Output: typed success/partial-warning/error][Verify: read/parse/write/rename failures individually covered] 显式 cleanup 结果。
- [ ] 2.3 [P1][Depends: 2.2][Input: typed results][Output: frontend warning/error projection][Verify: partial success does not render full success] 接入 UI。

## 3. Contract Completion

- [ ] 3.1 [P1][Depends: 1.1,2.3][Input: archived Kimi proposal/design + current code][Output: runtime/history/lifecycle/provider contract evidence][Verify: main delta covers every path] 补齐 durable spec。
- [ ] 3.2 [P0][Depends: 1.1,3.1][Input: foundation identity/bus changes][Output: Kimi convergence integration tests][Verify: one canonical row and no processing residue] 验证消息幕布。
- [ ] 3.3 [P1][Depends: 1.2,2.3,3.2][Input: completed change][Output: verification report][Verify: scanner + focused Vitest/Rust + typecheck + strict OpenSpec pass] 完成闭环验证。
