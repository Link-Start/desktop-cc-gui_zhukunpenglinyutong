## Context

`code_intel_lsp.rs` 已用 `SemanticProvider` descriptor 驱动 persistent stdio JSON-RPC、document sync、request cancel、workspace containment、session cap 与 idle eviction。`code_intel.rs` 已识别 Python/Go 并提供 definition/references fast-search，但 semantic provider mapping 只覆盖 Rust、Java、TS/JS，implementation 入口也只允许这三类语言。Frontend 已具备 typed metadata、prewarm、installation guidance 与 retry surface。

本变更只扩展 provider configuration 与 routing，不重建 runtime。Pyright 和 gopls 均作为用户安装的独立 executable；mossx 不分发其代码或 binary。

## Goals / Non-Goals

**Goals:**

- Python/Go definition、references、implementation 使用真实 LSP semantic result。
- 保持 semantic authoritative empty、15s soft deadline、fatal-only eviction 与可解释 fallback。
- 复用现有 prewarm、UI status、install hint 和 cross-platform executable discovery。
- 不改变 command payload/response contract，不新增 dependency、polling 或 persisted setting。

**Non-Goals:**

- 不选择、启动或修改 Python virtualenv/interpreter。
- 不配置 Go toolchain、GOPROXY、build tags 或非 `go` build system。
- 不提供 provider installer、bundling、automatic update。
- 不扩展 completion、diagnostics、rename、formatting、code action。

## Decisions

### 1. Provider descriptor extension only

新增 `Pyright` 与 `Gopls` enum variants，并在既有 descriptor methods 中声明 provider id、`languageId`、override env、default executable、launch args 与 lifecycle。session key 继续为 `(provider, canonical workspace root)`；所有 framing、pending request、cancel、eviction 与 containment 逻辑保持单份。

Alternative：复制两个 runtime。拒绝；会导致 lifecycle/failure behavior drift。

### 2. External executable contract

- Python：`MOSSX_PYRIGHT_LANGUAGE_SERVER_BIN` → `pyright-langserver --stdio`。
- Go：`MOSSX_GOPLS_BIN` → `gopls`。

override 仍是 executable path，不接受 shell command string。继续复用 existing GUI PATH discovery 与 Windows `.cmd/.bat` wrapper handling。不自动安装，不将外部代码链接进 mossx。

Alternative：引入 MCP/LSP bridge。拒绝；增加一跳且不能消除下游 license/runtime requirements。

### 3. Semantic routing and fallback semantics

`semantic_provider_for_language` 增加 Python/Go mapping。definition/references 沿用现有 contract：semantic `Ok(result)`（含空数组）直接返回；non-fatal request timeout 返回 semantic/degraded empty 并保留 session；fatal/provider-unavailable 才执行既有 bounded fast-search。

implementation 允许 Python/Go 进入 semantic query。若 provider unavailable/fatal，第一版返回 bounded fallback surface，但不新增语言专用 heuristic；只有现有 shared finder 能明确识别的 declaration 才允许返回，否则为空并保留 fallback metadata，禁止伪造 semantic certainty。

### 4. Lifecycle and prewarm

Pyright/gopls initialize success 后进入 `ready`；不复制 Java 的 long indexing lifecycle。`useFileNavigation` 的 750ms idle prewarm extension allowlist 加入 `.py/.pyi/.go`。prewarm 只调用 `code_intel_prepare`，不读取 document text、不进入 typing/hover handler、不新增 timer owner。

### 5. Installation guidance and license boundary

- Python：所有平台显示 `npm install -g pyright`。
- Go：所有平台显示 `go install golang.org/x/tools/gopls@latest`。

提示仅在 `provider-unavailable` 出现，不自动执行。Pyright MIT 与 gopls BSD-3-Clause 记录在 change/verification；当前 external-process 模式不增加 bundle manifest。未来若随安装包分发，必须另立 OpenSpec change 处理 notices、checksums、updates 与 package audit。

### 6. Compatibility and observability

provider id 使用稳定值 `pyright`、`gopls`；language 继续使用现有 public names `Python`、`Go`。不修改 frontend union 或 Tauri command signature。日志只记录 provider、workspace id 与 public reason code，不输出 source、environment secret 或完整 executable path。

## Risks / Trade-offs

- [Risk] Pyright environment resolution 与用户 terminal 不一致 → 首版遵循 workspace config/PATH，不隐式猜 virtualenv；明确 retry 与 external configuration boundary。
- [Risk] gopls 依赖 `go` toolchain 且可能下载 modules → mossx 不代理或自动触发安装；provider error 进入现有 degraded/fallback flow。
- [Risk] 新 provider 增加 process memory → 继续受 `MAX_SESSIONS`、idle eviction 与 workspace/provider reuse 控制。
- [Risk] Python/Go implementation fallback 不够完整 → semantic result authoritative；fallback 明确标记 heuristic，宁可空结果也不伪造。
- [Trade-off] external install 增加首次使用成本 → 换取 app size、升级、供应链与许可边界稳定。

## Migration Plan

1. 扩展 provider descriptor/mapping/tests，保持现有 provider test 全绿。
2. 开放 Python/Go implementation semantic routing并验证 response shape。
3. 扩展 prewarm/install hints/i18n/focused tests。
4. 运行 Rust/Vitest/typecheck/lint/runtime/OpenSpec gates。
5. 回滚时删除两个 provider variants、routing 和 hints；Python/Go definition/references恢复原 fast-search，无持久数据迁移。

## Open Questions

- 暂无。GUI executable picker、managed installation 与 interpreter/toolchain management 明确留给独立 change。
