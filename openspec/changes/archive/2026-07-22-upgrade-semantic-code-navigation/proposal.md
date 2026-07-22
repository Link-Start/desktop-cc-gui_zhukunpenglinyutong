## Why

当前 file editor 的“跳转定义/查找引用”主要扫描全项目同名字符串：同名方法、局部变量、interface implementation 容易误判，且 Rust 完全不可用。现有 frontend 导航、缓存和候选 UI 已成熟，最高收益是替换 backend resolution 层，而不是重做编辑器。

## 目标与边界

- 建立 `semantic provider -> bounded heuristic fallback` 的统一导航链路。
- 首先通过本机 `rust-analyzer` 为 Rust 提供 definition、references、implementation 的真实 semantic resolution。
- 新增“跳转实现”命令与 UI 入口；无 semantic server 时，为 Java、TS/JS、Rust 提供保守且有界的 implementation fallback。
- 保留现有 YAML/Java special mapping、文件定位、候选面板、request timeout、cache 与错误呈现。
- 所有 executable/path/URI 处理兼容 macOS、Windows、Linux；language server 不可用时不得阻断编辑器。

## 非目标

- 不内置或自动下载 language server。
- 不在本 change 一次性接入 Java/Python/TS/Go 的完整 LSP 生命周期。
- 不实现 rename、completion、diagnostics 或 workspace-wide symbol index。
- 不绑定即将退役的 OpenCode/Gemini runtime。

## What Changes

- 新增独立的 Rust semantic navigation adapter，按 workspace 复用 `rust-analyzer` stdio session，并处理 initialize、didOpen/didChange、definition、references、implementation 与 timeout/restart。
- `code_intel_definition` / `code_intel_references` 对 Rust 优先使用 semantic result；server 缺失、启动失败或 request 失败时回退到 bounded scanner。
- 新增 `code_intel_implementations` Tauri command、frontend service、hook action、context menu 与共用候选列表。
- 扩展 scanner 的 Rust declaration/reference/implementation patterns，并保持 result cap、ignored directories、workspace containment 与 deterministic ranking。
- 增加 focused Rust/backend protocol tests 与 touched frontend tests；不运行全量 test suite。

## 方案对比

1. **推荐：独立 semantic adapter + fallback**。不依赖聊天 engine，Rust 获得真实 scope/type resolution；server 缺失仍可用。代价是需要维护一个小型 JSON-RPC/LSP lifecycle。
2. **继续增强 regex scanner**。改动小，但无法可靠理解变量 scope、trait dispatch 或同名 overload，无法解决根因。
3. **复用 OpenCode debug LSP**。接入快，但把编辑器核心能力绑到可选且正在退役的 engine，启动成本与可用性不可控，因此不采用。

## Capabilities

### New Capabilities

- `semantic-code-navigation-provider`: 定义 semantic server lifecycle、fallback、跨平台与失败隔离契约。

### Modified Capabilities

- `file-view-code-intelligence-navigation`: 增加 Rust semantic navigation 与 go-to-implementation 行为。

## Impact

- Backend: `src-tauri/src/code_intel.rs`、新增 semantic adapter、`AppState` lifecycle、command registry。
- Frontend: Tauri service、`useFileNavigation`、FileView context menu/navigation panel 与 i18n。
- Dependency: 复用现有 Tokio/Serde/process 能力，不新增 Rust crate；运行时可选使用用户 PATH 中的 `rust-analyzer`。
- IPC: 新增 additive `code_intel_implementations` command；既有 definition/references payload 保持兼容。

## 验收标准

- Rust 同名 symbol 场景由 `rust-analyzer` 返回唯一正确 definition，不返回无关同名声明。
- Rust trait method 可触发“跳转实现”并显示可导航 candidates。
- `rust-analyzer` 缺失、异常退出或超时时，command 有界返回 fallback result 或可解释错误，editor 不崩溃。
- Java/TS/JS/Rust implementation fallback 不扫描 ignored/oversized files，结果不超过既有 cap。
- touched Vitest、Rust focused tests、TypeScript typecheck、OpenSpec strict validation 通过；不运行全量测试。
