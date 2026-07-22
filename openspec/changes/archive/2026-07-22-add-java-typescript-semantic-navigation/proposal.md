## Why

当前 file editor 只有 Rust 在 `rust-analyzer` 可用时获得真正的 semantic navigation；Java 与 TypeScript/JavaScript 仍依赖同名文本扫描，容易在 overload、scope、inheritance 和 interface implementation 场景跳错。下一步需要把现有 LSP adapter 扩展到用户最常用的 Java 与 TS/JS，同时明确告诉用户本次结果来自 semantic provider 还是 bounded heuristic fallback。

## 目标与边界

- Java、TypeScript/JavaScript 的 definition、references、implementation 优先走 workspace-scoped semantic provider。
- UI 显示最近一次查询的导航模式、语言、加载/降级原因，并提供 action-specific retry。
- language server 只在用户显式触发导航时 lazy start；禁止 on-type、hover、cursor movement 或 app startup 触发 backend 查询。
- mossx 可直接采用或链接的新增开源依赖最高为 Apache-2.0；EPL 等 provider 只能由用户独立安装并作为外部进程调用，不随客户端安装包分发。
- macOS、Windows、Linux 的 executable、wrapper、file URI、workspace containment 与 process lifecycle 必须有明确兼容边界。

## 非目标

- 不把 Eclipse JDT LS、TypeScript Language Server 或 Java runtime 打包进 mossx。
- 不建设自动下载/自动升级 language server 的 installer。
- 不增加 completion、diagnostics、rename、refactor 等完整 IDE 功能。
- 不移植 IntelliJ PSI/index platform，也不重写 Java/TypeScript type system。

## What Changes

- 将现有 Rust-only LSP runtime 泛化为按 language/provider 配置的 workspace-scoped semantic navigation runtime。
- 接入用户安装的 Java language server 与 TypeScript Language Server，支持 definition、references、implementation、unsaved document sync 与 authoritative empty result。
- 保留并明确标记 bounded heuristic fallback；provider 正常返回空结果时不得混入同名扫描结果。
- frontend bridge 将 `provider`、`mode`、`fallbackReasonCode` 与结果一并 normalize，cache 命中时保持同一模式事实。
- file editor 增加 compact navigation status、加载提示、降级说明、结果数量与 retry interaction。
- 增加 session cap、opportunistic idle eviction、timeout、process exit、URI containment 和 cross-platform launch tests。

## 方案比较与取舍

1. **泛化现有 LSP adapter（选择）**：复用 JSON-RPC framing、workspace session、timeout 与 URI boundary；新增代码少，semantic accuracy 由成熟 provider 提供，编辑器主线程只处理显式查询结果。
2. **复用 OpenCode LSP command（拒绝）**：依赖已退役/可关闭的 engine，每次执行 CLI debug command，无法稳定同步 unsaved document，也会把 editor capability 错绑到 AI engine。
3. **自研 PSI/type resolver（拒绝）**：许可可完全自控，但 Java/TS overload、generic、classpath 和 module resolution 成本远超本轮收益，短期结果仍会是假 semantic。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `semantic-code-navigation-provider`: 从 Rust-only provider 扩展到 Java 与 TypeScript/JavaScript，并增加 provider lifecycle、许可/分发和性能边界。
- `file-view-code-intelligence-navigation`: 增加导航模式可见、检索反馈、retry 与 semantic/fallback 一致性要求。

## Impact

- Rust backend：`src-tauri/src/code_intel_lsp.rs`、`src-tauri/src/code_intel.rs`、`src-tauri/src/state.rs` 及其 focused tests。
- Frontend bridge/state/UI：`src/services/tauri/openCode.ts`、`src/features/files/hooks/useFileNavigation.ts`、navigation utils/panel、i18n 与 file-view styles。
- Runtime：仅在显式导航时启动外部 language server；不新增 polling，不进入 AppShell/root render chain。
- Dependencies：默认不新增 package/crate；外部 provider 不随包分发。

## 验收标准

- Java 与 TS/JS 在 provider 可用时能正确区分至少一组同名/不同 scope definition，并能返回 interface implementation。
- provider 缺失、timeout 或退出时返回 `mode=fast-search`，UI 用当前语言解释降级且编辑器仍可编辑。
- semantic provider 正常返回空结果时保持权威空结果，不执行 heuristic scan。
- macOS/Linux executable、Windows `.cmd/.bat` wrapper、Windows drive/file URI 与 workspace escape 都有 focused tests。
- navigation 只由显式 action 触发；modifier hover 与 typing latency regression tests 证明无新增 backend query 或输入热路径工作。
- focused Vitest、focused Rust tests、typecheck、targeted lint、runtime contract 与单 change strict OpenSpec validation 通过；不运行全量测试。
