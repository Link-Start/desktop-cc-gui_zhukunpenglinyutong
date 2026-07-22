## Context

Frontend 已有 `useFileNavigation`、Tauri service、location cache、timeout、multi-target panel 和 open-at-location；backend `code_intel.rs` 则通过 regex 扫描 workspace。准确率问题来自 resolution provider，而不是 UI。Rust 尚未进入 `LanguageKind`，现有 OpenCode LSP command 又属于可选 engine，不适合作为 editor dependency。

## Goals / Non-Goals

**Goals:**

- 以最小独立 adapter 接入标准 LSP JSON-RPC，首个 provider 为 `rust-analyzer`。
- semantic result 优先；缺失或故障时 fallback 有界、可预测、可测试。
- 复用现有 navigation UI，新增 implementation query 但不复制 candidate surface。
- 保证 workspace containment、跨平台 child process、request timeout 与进程回收。

**Non-Goals:**

- 不做通用 IDE platform、server installer、settings UI 或所有语言 LSP 配置。
- 不让 fallback 冒充 semantic certainty；不改变已有 Java/YAML special mapping。
- 不把 query 放入 AppShell 高频状态，也不增加 polling。

## Decisions

### 1. AppState-owned Rust LSP runtime

在 `AppState` 持有 `RustAnalyzerRuntime`，按 canonical workspace path 缓存一个 session。session 使用 `tokio::process` 与 piped stdio；写入端 serialized，reader task 按 `Content-Length` frame 解析并通过 request id/oneshot 分发。

选择 persistent session 而非每次 spawn：`rust-analyzer` 初始化成本高，one-shot 会让跳转不可用。选择 AppState 而非 global static：生命周期、test isolation 与 shutdown ownership 更明确。

### 2. Semantic first, fallback only on infrastructure failure

Rust query 先执行 didOpen/didChange，再调用 `textDocument/definition`、`textDocument/references` 或 `textDocument/implementation`。response 支持 `Location`、`Location[]`、`LocationLink[]`，统一转换为既有 location shape。

server executable 缺失、spawn/init/request timeout 或 process exit 时进入 Rust bounded fallback。semantic server 正常返回空 result 时视为权威空结果，禁止再混入同名 heuristic candidates。response 增加非破坏性 `provider`/`fallbackReason` metadata，frontend 继续只消费 `result`。

### 3. Rust fallback and implementation fallback remain conservative

扩展 `LanguageKind::Rust`，只识别明确 declaration syntax：`struct/enum/trait/type/mod/const/static`、`fn`、`impl Trait for Type`/`impl Type`。implementation query 仅返回明确 `impl`/`implements`/`extends` declaration，不尝试推断动态 dispatch。

继续使用 WalkBuilder ignore rules、2 MB file cap、500 result cap、dedupe 与 deterministic sort。这样 fallback 有用但不会制造“已完全理解代码”的假象。

### 4. One reusable candidate panel

`useFileNavigation` 新增 implementation state/cache/action，FileView context menu 增加“Go to implementations”。definition 与 implementation 共用候选 location component，仅标题和 close handler不同；reference list 保持原样。

### 5. Cross-platform executable and URI handling

child process 统一通过现有 `utils::async_command`，避免 Windows console；启动参数固定 `rust-analyzer` stdio mode。URI 只接受 `file:` location，并在转换为 workspace-relative path 前 canonical containment 校验。Windows drive path 与 separator 在 boundary normalize。

## Risks / Trade-offs

- [Risk] 用户未安装 `rust-analyzer` → 立即 fallback，并在 response metadata 中说明；不弹重复错误。
- [Risk] server hang/异常退出导致 pending leak → 每个 request timeout，移除 pending；reader EOF fail 全部 pending，并从 runtime cache 淘汰 session。
- [Risk] unsaved editor content 与 disk 不一致 → command 接收可选 current document text，didChange 使用 monotonic version；缺省仍读取 disk 兼容旧调用。
- [Risk] 首次 initialize 较慢 → 独立 initialize timeout，后续复用 session；不在 app startup 预热。
- [Risk] fallback 同名误判仍可能存在 → semantic-first；fallback 只收窄明确 declarations，UI 保持 multi-target selection。
- [Trade-off] 本轮只接 Rust semantic provider → 先解决完全缺失且 server 协议成熟的一条语言链；adapter 为后续 language provider 留稳定边界，但不预建未使用配置系统。

## Migration Plan

1. 加入 protocol/session parser 与 isolated tests。
2. 接入 AppState，扩展 Rust fallback 与 definition/references。
3. 增加 implementation backend/frontend chain。
4. 运行 focused Rust/Vitest/typecheck/OpenSpec gates。
5. 回滚时移除 additive command/adapter；原 definition/references scanner 与 frontend open-location 行为仍可恢复，无数据迁移。

## Open Questions

- 后续是否在 Settings 暴露 language server executable override，留到第二语言接入时基于真实需求决定。
