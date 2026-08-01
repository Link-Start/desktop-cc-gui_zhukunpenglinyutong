## 1. Backend Lifecycle（P0）

- [x] 1.1 [P0, depends: none] 输入现有 `LspSession` request routing；输出 15 秒 timeout、`$/cancelRequest` 与 non-fatal timeout classification；验证 Rust unit tests 证明 timeout 后 session 仍 alive/pending 已清理。
- [x] 1.2 [P0, depends: 1.1] 输入 provider notifications；输出 generic lifecycle state 与 Java `language/status: ServiceReady` / progress handling；验证 notification tests 覆盖 starting/indexing/ready/degraded transitions。
- [x] 1.3 [P0, depends: 1.1,1.2] 输入 `SemanticNavigationRuntime::query`；输出 fatal-only eviction、provider-aware ready convergence 与 indexing/degraded typed outcome；验证同 session timeout 后可再次 query。

## 2. Prepare And Data Ownership（P0）

- [x] 2.1 [P0, depends: 1.2] 输入 workspace/provider；输出 idempotent `prepare` runtime API 与 `code_intel_prepare` Tauri command；验证 Java/TS/JS/Rust routing 和 command registry/service payload tests。
- [x] 2.2 [P0, depends: 1.2] 输入 app data root 与 build channel；输出 `development/release` cache namespace 和 JDT workspace OS owner lock；验证不同 channel path 与 duplicate owner rejection tests。
- [x] 2.3 [P1, depends: 1.3,2.1] 输入 lifecycle timings；输出 bounded spawn/initialize/query/timeout/ready/fatal logs；验证日志不包含 document text 或完整 payload。

## 3. Frontend Navigation Contract（P0）

- [x] 3.1 [P0, depends: 1.3] 输入 backend lifecycle metadata；输出 normalized TypeScript response/status types 与 indexing/degraded UI copy；验证 malformed/optional payload normalization 和 panel rendering tests。
- [x] 3.2 [P0, depends: 2.1,3.1] 输入 file/workspace/provider identity；输出 750ms cleanup-safe idle prewarm effect；验证 supported language、stale cleanup、unmount、unsupported file tests。
- [x] 3.3 [P0, depends: 3.1] 输入 request-timeout lifecycle response；输出不执行 automatic workspace fallback、保留 explicit retry 的 navigation flow；验证 Java 与 TS/JS focused component/hook cases。

## 4. Verification And Spec Closure（P0）

- [x] 4.1 [P0, depends: 1.*,2.*,3.*] 运行 `cargo test --manifest-path src-tauri/Cargo.toml code_intel_lsp::tests`、focused code-intel Rust tests、focused Vitest、`npm run typecheck`、targeted lint、runtime contracts 与 `git diff --check`。
- [x] 4.2 [P0, depends: 4.1] 执行 cross-layer review，核对 command registration、service mapping、Java/TS/JS parity、timeout constants、fallback sibling callers，无遗漏后修正。
- [x] 4.3 [P0, depends: 4.2] 执行 `openspec validate stabilize-semantic-navigation-lifecycle --strict --no-interactive` 与 implementation/artifact verify，记录自动化 evidence 和剩余 manual smoke。
