## Context

Change A–D 把 Shared Event Log、Context Compiler、Artifact Store、Native History Reader 与 Provider Continuation 串成闭环。复核发现错误集中在共享边界：identity 未覆盖全部输入、package payload 未参与 checksum、reader 把未知 vendor JSON 当可移植内容、文件读取无上限、原子发布依赖 Unix 目录语义、Codex capability 由前端常量声明、确认交互依赖 WKWebView 不可靠 API。

## Goals / Non-Goals

**Goals:**

- 所有 durable artifact 可证明 payload 未被替换。
- Context Package content-addressed identity 与实际编译输入一一对应。
- Native History 读取有明确资源边界，portable output 不泄漏 Provider-private block。
- capability probe 发生在目标 side effect 前，unsupported 自动降级。
- Desktop degraded confirmation 在 macOS、Windows、Linux 可工作。

**Non-Goals:**

- 不做 native history streaming parser 重构。
- 不新增跨 Provider lossless transformer。
- 不改变 Shared Event schema 或 vendor history。

## Decisions

### 1. Package checksum 绑定 deterministic package payload

采用 `deterministic_json_bytes(ContextPackage)` 后 SHA-256，存入 artifact record 并在每次读取时重算。artifact id 继续由 package id 派生，二者分别表达“compiler identity”和“持久化 payload integrity”。

备选：继续使用 `manifest.source_checksum`。拒绝，因为它只证明 source range，不证明 destination、mode、delta、prompt 与 omissions。

### 2. Package identity 覆盖所有编译决定输入

identity 纳入 `compilerVersion`、destination、capabilities、effective budget、source checksum、range 与 binding。stable prefix contract 不变；同输入仍 deterministic。

备选：artifact 写入时比较旧/new payload，冲突时报错。拒绝，因为 package id 本身仍撒谎，且会把合法的不同编译结果误判为 corruption。

### 3. 原子发布使用 create-new temp + sync file + rename，平台分支只处理 OS 语义

Unix 发布后同步 parent directory；非 Unix 不打开目录。并发 writer 遇到 destination 已存在时清理 temp，再由 caller 读取并校验 winner。任何失败都 best-effort 清理 temp。

备选：复用通用 `storage::write_bytes_atomically`。拒绝，因为该 helper 在 Windows 先删除 destination，不满足 content-addressed artifact 的并发不可覆盖 contract。

### 4. Reader allowlist portable blocks

普通 text 保留；Codex `function_call/function_call_output` 保留为结构化 native block；reasoning/signature/encrypted/redacted/unknown blocks 不复制，写入 typed omission。文件 metadata 超过固定上限时，在 allocation 前返回 `source-too-large`。

备选：在 Context Compiler 最后过滤。拒绝，因为 normalized history artifact 仍会保存 private data，扩大泄漏面。

### 5. Codex method capability 由 App Server 无副作用 probe 得到

先确保 destination Provider 的 App Server session，向不存在的 probe thread 发送空 `thread/inject_items`。`-32601`/method-not-found 表示 unsupported；其它 JSON-RPC response 证明 method 存在。probe 只影响编译 mode，不创建目标 Thread。

备选：按 CLI version 或 Engine 常量判断。拒绝，custom binary、fork 和版本能力不保证一致。

### 6. 使用现有 Tauri Dialog

Sidebar action 使用 `@tauri-apps/plugin-dialog` 的 async `ask`，不新增 React state/组件，也不依赖 WebView `window.confirm`。

备选：新增 app-owned ConfirmDialog state。可访问性更可控，但会扩大 Sidebar 状态和渲染链；当前项目已广泛使用 Tauri Dialog，最小改动即可覆盖三平台 Desktop。

## Risks / Trade-offs

- [旧 package artifact 的 checksum 语义不同] → fail closed 进入 recovery，由 immutable source 重新 prepare；不静默兼容不可验证数据。
- [固定 Native History 上限会拒绝超长会话] → 返回 typed error，后续可演进 streaming reader；当前优先防 OOM/卡死。
- [method probe 依赖已启动 App Server] → probe 前只建立 runtime connection，不创建目标 Thread；连接失败保持显式错误。
- [未知 vendor block 被省略] → omission manifest 保留原因；宁可声明 lossy，不伪造 portability。

## Migration Plan

1. 先落 compiler/artifact/reader contract 与 regression tests。
2. 再接 capability probe 和 Desktop Dialog。
3. 运行 focused Rust/Vitest/typecheck/OpenSpec validation。
4. 同步主 specs 与 A–D 文档，提交 review evidence。

回滚：代码提交可整体 revert；新 artifact checksum 不修改 vendor data。回滚后新记录只会因 checksum 不匹配而 fail closed，不会损坏历史。

## Open Questions

无。更大规模 native history streaming 属于后续独立 change。
