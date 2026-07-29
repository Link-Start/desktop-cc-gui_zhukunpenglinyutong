## 1. Target Model Identity

- [x] 1.1 [P0][deps: none][input: `ModelInfo` + provider target picker][output: target 同时冻结 catalog entry id 与 runtime model][verify: focused `ModelSelect` Vitest] 修复 frontend selection boundary。
- [x] 1.2 [P0][deps: 1.1][input: continuation DTO + `ExecutionTargetInput`][output: additive `modelCatalogEntryId` 跨 IPC/operation 持久化][verify: TypeScript typecheck + Rust serde test] 贯通 target identity。
- [x] 1.3 [P0][deps: 1.2][input: provider-scoped catalog][output: target side effect 前 runtime model validation，UI-only id typed reject][verify: focused Rust unit tests] 增加 backend trust-boundary guard。

## 2. Claude Acceptance Evidence

- [x] 2.1 [P0][deps: none][input: Claude target JSONL][output: Missing/Accepted/Rejected 三态 parser，structured API rejection 强负优先][verify: focused Rust parser tests] 重构 recovery evidence。
- [x] 2.2 [P0][deps: 2.1][input: first execution error + recovery retry][output: 首次与 retry 复用 probe；rejection 为 `target-provider-rejected`，不转 ready][verify: focused Rust continuation tests] 接入错误优先级。

## 3. Contract And Focused Verification

- [x] 3.1 [P1][deps: 1.3,2.2][input: OpenSpec delta + implementation][output: Trellis executable contract 同步][verify: contract text search] 更新长期工程契约。
- [x] 3.2 [P0][deps: 3.1][input: touched frontend/backend/OpenSpec files][output: focused Vitest、focused Rust tests、typecheck、runtime-contracts、strict validate 通过][verify: command exit 0] 执行非全量闭环检查。
