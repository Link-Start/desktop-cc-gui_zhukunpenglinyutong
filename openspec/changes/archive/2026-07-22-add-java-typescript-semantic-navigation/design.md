## Context

现有 `code_intel_lsp.rs` 已实现 persistent stdio JSON-RPC、request routing、document sync、timeout、process exit settlement 与 workspace-contained location normalization，但 runtime、`languageId`、启动命令和日志标签写死为 `rust-analyzer`。Java 与 TS/JS command 仍在 `code_intel.rs` 进入 heuristic scanner。Frontend response type 又只声明 `result`，因此 backend 已返回的 provider/fallback metadata 在 UI 和 cache 中丢失。

约束包括：不进入 editor typing/hover 热路径；不随客户端打包 language server；新增直接依赖只接受 MIT/Apache-2.0；EPL provider 只能作为用户安装的独立 process；macOS/Windows/Linux 的 PATH/wrapper/URI 必须安全；不运行全量测试。

## Goals / Non-Goals

**Goals:**

- 用一个 generic LSP runtime 支持 Rust、Java、TypeScript/JavaScript semantic navigation。
- provider 正常响应（包括空结果）具有权威性；只有 infrastructure failure 才进入 heuristic fallback。
- UI 对 loading、semantic、fast-search、empty、error、retry 给出 compact、localized feedback。
- explicit-query-only、bounded sessions、no polling，保护 CodeMirror 输入性能。

**Non-Goals:**

- 不实现 installer、completion、diagnostics、rename、formatting 或 refactor。
- 不新增 language server settings UI；本轮使用 environment override + PATH，避免把小功能扩成 settings 系统。后续若真实用户需要 GUI path picker，再单独立项。
- 不复用 OpenCode engine LSP command，不打包 JDT LS/TypeScript Language Server。

## Decisions

### 1. Generic provider descriptor over separate runtime copies

将 `RustAnalyzerRuntime` 收敛为 `SemanticNavigationRuntime`。provider descriptor 负责：provider id、language id、executable override env、default executable、args、initialize options、cold-start timeout 与 log label。`LspSession`、framing、pending map、document sync 和 location normalization只保留一份。

Alternative：复制 Java/TS runtime。拒绝，三套 parser/lifecycle 会产生 timeout、URI 与 cleanup drift。

### 2. User-installed external providers

- Rust：`MOSSX_RUST_ANALYZER_BIN` → `rust-analyzer`。
- Java：`MOSSX_JAVA_LANGUAGE_SERVER_BIN` → `jdtls`。JDT LS 由用户独立安装；mossx 不分发 EPL artifact。
- TS/JS：`MOSSX_TYPESCRIPT_LANGUAGE_SERVER_BIN` → `typescript-language-server --stdio`。虽然 provider/TypeScript 为 Apache-2.0，本轮仍不打包，保持客户端体积和升级边界稳定。

override 必须是单一 executable path，不接受任意 shell command string。macOS/Linux 直接 spawn；Windows `.cmd/.bat` 通过 existing shell-wrapper pattern 构造 `cmd /D /S /C`，其它 executable 使用 `CREATE_NO_WINDOW`。这避免 command injection 和闪烁 console。

Alternative：自动下载。拒绝，因为需要 checksum/signature、release selection、proxy、升级与卸载 contract。

### 3. Session key and bounded lifecycle

session key 为 `(provider, canonical workspace root)`。只在显式导航 query 时创建。runtime 记录 last-used；每次获取 session 时机会式移除超时 idle session，并在超过全局 cap 时淘汰最旧 idle session，不创建 polling timer。

同一 workspace/provider 初始化串行复用，避免并发双 spawn。initialize cold-start timeout 对 Java 更宽，普通 request 保持有界。任何 query error 淘汰失败 session，pending caller 完成后才允许后续 retry 重建。

### 4. Typed navigation response and fallback taxonomy

command response 保持 `result` shape，新增稳定 metadata：

- `mode`: `semantic | fast-search`
- `provider`: `rust-analyzer | eclipse-jdt-ls | typescript-language-server | heuristic`
- `fallbackReasonCode`: `provider-unavailable | initialize-timeout | request-timeout | provider-exited | invalid-response | null`
- `language`

backend raw error 仅用于 bounded debug log，不直接进入 UI。Frontend service 做 runtime guard/sanitize，hook cache 保存完整 normalized response。semantic `Ok([])` 直接返回空；只有 `Err` 才 fallback。

### 5. Explicit-query-only UI state

`useFileNavigation` 增加 local discriminated status：idle/loading/success/fallback/error，携带 action、language、provider、result count。触发 query 时可根据 file extension显示“正在准备 …”；response 后显示 semantic/fast-search mode。状态不进入 AppShell/store，不订阅 editor change。

`FileViewNavigationPanel` 复用现有 surface：header 显示 action + count + mode chip；fallback 是 warning tone，不是 error；error/timeout 提供 retry。单结果继续直接跳转，同时 footer 显示最近一次 mode，避免新增确认弹窗。

### 6. Performance contract

- modifier hover 继续只读 CodeMirror syntax tree；不得调用 Tauri。
- `documentText` 只在显式 query 时 materialize。
- 不增加 on-change effect、polling、root state 或 AppShell render dependency。
- session cleanup、scan、process IO 全在 Rust async runtime；frontend 只接收 capped locations。
- existing debounce/cache 保留，cache entry 扩展 metadata 而不是增加查询。

## Risks / Trade-offs

- [Risk] JDT LS 冷启动可能超过普通导航 timeout → Java 使用独立 initialize timeout，UI 显示首次准备提示；编辑器保持可操作。
- [Risk] GUI app PATH 与 terminal 不一致 → 支持 explicit environment override；fallback message 给出 provider id，不暴露 raw path。GUI path picker 留到后续基于真实反馈决定。
- [Risk] Windows npm wrapper 无法直接 spawn → launch spec 对 `.cmd/.bat` 单独构造并加 unit tests。
- [Risk] persistent servers 占用内存 → lazy start、session cap、opportunistic idle eviction；不后台预热。
- [Risk] heuristic 仍会误判 → UI 明确 `fast-search`，不把降级结果伪装成 semantic certainty。
- [Trade-off] external install 增加用户准备成本 → 保证客户端不膨胀、不承担第三方 runtime 分发和许可义务。

## Migration Plan

1. 先泛化 runtime，保持 Rust focused tests 通过。
2. 接 Java/TS provider routing 与 response metadata，保留原 heuristic branch。
3. 接 frontend normalize/cache/status/retry UI。
4. 运行 focused Rust/Vitest/typecheck/lint/runtime-contract/perf/OpenSpec gates。
5. 回滚时移除 Java/TS routing 与 UI metadata消费；原 heuristic command/result shape仍可工作，无持久数据迁移。

## Open Questions

- GUI language server path picker 是否值得加入 Settings，等待用户安装反馈后单独立项。
- JDT LS direct launcher directory（非 `jdtls` wrapper）是否需要 first-class 支持，等待 Windows/Linux 真机样本决定。
