## 1. Persistence Contract

- [x] 1.1 [P0][depends: none][input: frontend `AppSettings` shortcut fields][output: mirrored Rust serde/default fields][verify: Rust compile + defaults test] 补齐现有缺失 shortcut persistence contract。
- [x] 1.2 [P0][depends: 1.1][input: custom and null shortcut JSON][output: regression coverage][verify: focused Rust round-trip test] 验证 save/echo 不再丢弃快捷键字段。

## 2. Common Module Metadata And UI

- [x] 2.1 [P1][depends: none][input: 12 specified common modules][output: featured metadata projection and top group][verify: SettingsView focused test] 增加置顶“常用模块”分组并复用单一 setting keys。
- [x] 2.2 [P1][depends: 2.1][input: seven missing module actions][output: TypeScript/Rust settings fields and i18n labels][verify: typecheck + metadata assertions] 增加默认 `null` 的 configurable module shortcuts。

## 3. Action Wiring

- [x] 3.1 [P1][depends: 2.2][input: existing AppShell view callbacks][output: shared dispatcher-based module shortcut hook][verify: hook happy/editable/null tests] 接入 Git Graph、Notes、Intent Canvas、Radar、Project Map、Browser Dock、File Compare。
- [x] 3.2 [P1][depends: 3.1][input: module hook][output: AppShell integration][verify: focused AppShell/layout test] 确保快捷键复用现有 view transitions 且不产生重复状态。

## 4. Verification And Spec Closure

- [x] 4.1 [P0][depends: 1.2,2.2,3.2][input: completed implementation][output: passing focused tests][verify: Vitest + cargo test] 完成 frontend/backend 回归验证。
- [x] 4.2 [P0][depends: 4.1][input: changed code/spec][output: quality gate evidence][verify: typecheck + lint + runtime contracts + strict OpenSpec validation] 执行质量门禁并完成 change verify。
