## 1. Frontend Target 与 Catalog

- [x] 1.1 [P0，依赖：无] 输入：现有 `SharedSessionSupportedEngine` 与 target guards；输出：Claude/Codex/Kimi/Grok/OpenCode 五 CLI 的 resolved Shared/create target contract，Gemini 继续 fail closed；验证：target store 与 shared engine focused Vitest。
- [x] 1.2 [P0，依赖：1.1] 输入：Atomic Provider catalog；输出：并行加载五 CLI Profiles、canonical local sentinel 与 binding-scoped Models，Native owner 保持不变；验证：`useProviderTargetCatalogOwners.test.tsx`。
- [x] 1.3 [P0，依赖：1.2] 输入：Shared/Home 双栏 picker；输出：五 CLI enabled、右栏正确切换、完整 target 回调与 Home creation target；验证：`ModelSelect`、`Composer`、`useLayoutNodes` focused Vitest。

## 2. Rust Shared Engine Contract

- [x] 2.1 [P0，依赖：1.1] 输入：Rust Shared engine allowlist 与 target validation；输出：五 CLI 可创建/持久化/重载，Gemini 拒绝；验证：`shared_sessions` 与 target matrix focused Rust tests。
- [x] 2.2 [P0，依赖：2.1] 输入：新增 CLI provider adapters；输出：provider runtime key、local sentinel、binding materialization 与 strict dispatch receipt；验证：`shared_session_v2` provider/model matrix tests。
- [x] 2.3 [P0，依赖：2.2] 输入：Context capability matrix；输出：Kimi/Grok/OpenCode 使用 weak user-channel transcript delivery，不宣称 structured import；验证：context capability focused Rust tests。

## 3. Runtime Event 与 Terminal

- [x] 3.1 [P0，依赖：2.2] 输入：Kimi/Grok/OpenCode `EngineEvent` forwarders；输出：共享 helper 先 ingest coordinator 再 fan-out，Native no-owner payload 不变；验证：engine forwarder/coordinator focused Rust tests。
- [x] 3.2 [P0，依赖：3.1] 输入：Shared V2 dispatch；输出：新增 CLI exact runtime turn/native identity bind、accepted receipt、terminal await 与 exactly-once commit；验证：`shared_session_v2` integration/target matrix tests。
- [x] 3.3 [P1，依赖：3.2] 输入：interrupt/rebuild/probe owner routing；输出：新增 CLI 只按 durable Attempt/Binding 路由；验证：interrupt/recovery focused Rust tests。

## 4. 增量验证与分批提交

- [x] 4.1 [P0，依赖：1.*] 运行 frontend picker/target/Home focused Vitest、targeted ESLint、`tsc --noEmit` 与 `check:runtime-contracts`，通过后提交 frontend/spec 批次。
- [x] 4.2 [P0，依赖：2.*,3.*] 运行 Shared Session Rust focused tests、`cargo check --lib --bins` 与 `git diff --check`，通过后提交 backend/runtime 批次。
- [x] 4.3 [P0，依赖：4.1,4.2] 运行 `openspec validate extend-shared-session-cli-targets --strict --no-interactive`、能力符号哨兵与最终增量回归；不运行全量 test。
- [x] 4.4 [P0，依赖：4.3] 每次 `git commit` 后执行 Trellis session record，并记录未执行全量测试的用户授权与剩余手测项。

## 5. 验收回归修复

- [x] 5.1 [P0，依赖：1.3] 输入：Grok/OpenCode local Provider Model 点击；输出：local sentinel 在 Atomic 双栏 Target 中归一为 `providerProfileId=null + source=disk`，完整 Target 可跨过 resolved gate；验证：`ModelSelect.test.tsx` focused Vitest。
- [x] 5.2 [P0，依赖：5.1] 运行 targeted ESLint、`tsc --noEmit`、`check:runtime-contracts`、OpenSpec strict validation 与 `git diff --check`；不运行全量 test。

## 6. Shared 创建链路 Catalog 补全

- [x] 6.1 [P0，依赖：2.1] 输入：Kimi/Grok/OpenCode canonical local Target；输出：Shared create、selected target persistence 与 V2 turn revalidation 使用对应 CLI 的本地权威 Model catalog，不再只覆盖 Claude/Codex；验证：`engine::status`、`shared_sessions`、`shared_session_v2` focused Rust tests。
- [x] 6.2 [P0，依赖：6.1] 输入：五 CLI execution target snapshot；输出：Shared projection 对 Claude/Codex/Kimi/Grok/OpenCode 统一计算 managed Provider availability，missing catalog fail closed；验证：`shared_projection::commands` focused Rust tests。
- [x] 6.3 [P0，依赖：6.1,6.2] 将 capability propagation checklist 写入 Provider-scoped Model Catalog contract，同步 OpenSpec spec，运行 focused Rust tests、OpenSpec strict validation 与 `git diff --check`；不运行全量 test。
