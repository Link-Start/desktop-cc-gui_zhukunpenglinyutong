## 1. Contract Inventory

- [x] 1.1 [P0][Depends: none][Input: Rust/daemon/TypeScript EngineFeatures + matrix fixture][Output: field/key parity inventory][Verify: every current field and engine has an owner] 校准 capability 事实。
- [x] 1.2 [P0][Depends: 1.1][Input: inventory][Output: unified DTO and runtime status types][Verify: TypeScript/Rust schema tests compile] 定义跨层类型。

## 2. Artifact And Projection

- [x] 2.1 [P0][Depends: 1.2][Input: spec matrix][Output: production artifact generator][Verify: deterministic generation twice has zero diff] 实现生成器。
- [x] 2.2 [P0][Depends: 2.1][Input: generated artifact][Output: Rust/daemon/TypeScript projections][Verify: reasoning/tool/session fields parity tests] 接通 runtime projection。
- [x] 2.3 [P0][Depends: 2.2][Input: runtime evidence][Output: stance/policy/availability/reason lookup][Verify: missing field remains unknown with reason] 替换 legacy truthy projection。

## 3. Foundation Keys And Gates

- [x] 3.1 [P0][Depends: 2.3][Input: engine runtime evidence][Output: input/session/RPC capability cells][Verify: Kimi mid-turn unsupported and supported engines calibrated] 补 foundation keys。
- [x] 3.2 [P0][Depends: 3.1][Input: all projections][Output: expanded parity command/CI gate][Verify: injected one-cell drift fails with location] 加强治理检查。
- [x] 3.3 [P0][Depends: 3.2][Input: completed change][Output: verification evidence][Verify: capability check + focused tests + typecheck + strict OpenSpec pass] 完成闭环验证。
