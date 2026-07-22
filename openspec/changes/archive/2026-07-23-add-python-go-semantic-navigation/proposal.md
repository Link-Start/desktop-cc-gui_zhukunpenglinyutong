## Why

Python 与 Go 已参与 file editor 的 bounded fast-search，但缺少 scope/type-aware semantic navigation；同名 symbol、import alias、interface implementation 与跨 module 引用因此容易误判。现有 generic LSP runtime 已稳定承载 Rust、Java 与 TS/JS，当前以最小增量接入用户安装的 Pyright 与 gopls，能用较低工程风险补齐高频语言体验。

## 目标与边界

- Python、Go 的 definition、references、implementation 优先走 workspace-scoped semantic provider。
- Python 使用外部 `pyright-langserver --stdio`（MIT）；Go 使用外部 `gopls`（BSD-3-Clause）。
- 复用既有 provider lifecycle、response metadata、installation guidance、retry 与 bounded fallback contract。
- provider 仅由用户独立安装；mossx 不下载、不更新、不打包第三方 executable。
- 保持现有 Tauri command signature、frontend response shape、Java/Rust/TS/JS 行为与文件编辑链路兼容。

## 非目标

- 不管理 Python interpreter、virtualenv、Conda、Poetry 或 uv environment。
- 不管理 Go toolchain、module download、GOPROXY 或 Bazel workspace。
- 不增加 completion、diagnostics、rename、formatting、code action 或 refactor。
- 不引入通用 LSP bridge/dependency，不复制 provider-specific runtime。
- 不为 provider unavailable 自动执行 `npm install` 或 `go install`。

## What Changes

- 扩展 `SemanticProvider` descriptor，新增 Pyright 与 gopls 的 provider id、language id、environment override、executable 与 launch args。
- 将 Python/Go definition、references、implementation 路由升级为 semantic-first，并保留可解释的 bounded fallback。
- Python/Go file open 后复用既有 idle prewarm；不新增 polling 或 root render state。
- provider missing 时展示 platform-safe installation guidance、license identity 与 explicit retry。
- 增加 provider mapping、launch、lifecycle、semantic response、fallback、prewarm、i18n 与 UI focused tests。

## 方案比较与取舍

1. **扩展现有 generic LSP runtime（选择）**：只增加 provider descriptor 与 language routing，复用已验证的 stdio、session、timeout、cancel、eviction 和 containment 边界，改动最小。
2. **为 Python/Go 各建独立 runtime（拒绝）**：会复制 JSON-RPC、process lifecycle 与 failure taxonomy，长期产生行为漂移。
3. **引入 MIT/Apache LSP bridge（拒绝）**：现有 runtime 已覆盖所需协议；wrapper 也不会改变下游 gopls 的 BSD-3-Clause 义务。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `file-view-code-intelligence-navigation`: Python 与 Go 从 fast-search-only 扩展为 semantic-first definition、references、implementation，并增加外部 provider 安装、失败降级与兼容 contract。

## Impact

- Rust backend：`src-tauri/src/code_intel_lsp.rs`、`src-tauri/src/code_intel.rs` 及 focused tests。
- Frontend：file navigation prewarm、installation guidance、i18n 与 focused component/utility tests。
- Runtime：新增最多两个 workspace-scoped external provider process，继续受全局 session cap 与 idle eviction 控制。
- Dependencies：不新增 npm/crate；不分发 Pyright/gopls binary。
- License：Pyright 为 MIT；gopls 为 BSD-3-Clause。若未来改变为 bundled distribution，必须另立变更并增加 third-party notice/package audit。

## 验收标准

- `.py/.pyi` 在 Pyright 可用时返回 semantic definition、references、implementation；`.go` 在 gopls 可用时行为等价。
- provider 正常返回空结果时保持 authoritative empty，不混入同名 fast-search。
- provider unavailable/fatal failure 时保持现有编辑能力，definition/references 可解释降级；implementation 不伪造不可信目标。
- timeout 保持 live session 可重试，不触发 workspace-wide fallback 或 cold-start loop。
- Python/Go prewarm 不进入 typing/hover 热路径，不新增 polling。
- focused Rust/Vitest、typecheck、lint、runtime contracts 与 OpenSpec strict validation 通过。
