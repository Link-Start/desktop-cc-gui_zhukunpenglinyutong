## 1. UI 行为修复

- [x] 1.1 [P0, depends: none] 输入 `provider-unavailable` navigation status；调整 `FileViewNavigationPanel`，输出单一 installation guidance warning，移除同场景 generic fallback copy；以 focused component test 验证。
- [x] 1.2 [P1, depends: 1.1] 输入新增 missing-provider copy；同步所有 locale 与既有 footer style，输出可读的 language/platform/command/retry 布局；以 typecheck 验证 key 与 JSX。

## 2. 回归与验证

- [x] 2.1 [P0, depends: 1.1] 输入 Java/macOS fallback fixture；补充 focused assertions，验证 `brew install jdtls` 可见、旧提示消失、retry handler 被调用。
- [x] 2.2 [P1, depends: 1.2, 2.1] 运行 focused Vitest、focused Rust tests、targeted lint、typecheck、runtime contract 与 strict change validation；不构建 App、不运行全量测试，记录输出结果。

## 3. 提交前 Review 修复

- [x] 3.1 [P0, depends: none] 过滤 bare provider executable 的 empty parent，避免 child `PATH` 注入 current working directory；focused Rust test 锁定 empty component 不存在。
- [x] 3.2 [P0, depends: none] 将 semantic session initialization 改为 `(provider, workspace)` scoped coordination，确保 global sessions mutex 不跨 spawn/kill await；focused Rust test 锁定 initializer scope。
- [x] 3.3 [P1, depends: 1.1] missing-provider 单结果 definition/implementation 保持 warning 与 clickable fallback result 可见；focused Vitest 覆盖两种 action。
- [x] 3.4 [P1, depends: 3.1, 3.2, 3.3] 同步 main specs、Trellis task 与历史验证证据，删除未执行的 App build 声明。
