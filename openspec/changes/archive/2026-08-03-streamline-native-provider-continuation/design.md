## Context

当前 frontend 在第一次点击后调用 `create_native_provider_continuation(confirm_degraded=false)`。Backend 先冻结 history 并编译 `ContextPackage`；若 package degraded，返回 `confirmation-required`，frontend 再展示 mode、omissions 与 token estimate，第二次点击才以 `confirm_degraded=true` 创建 target。

这同时产生三个问题：

1. Token 只有第一次点击后才可见，无法在第一次确认中提供真实决策信息。
2. 本地 preparation 与 Claude CLI bootstrap 都落在点击后的 loading。
3. Claude bootstrap 复用普通 turn command surface，历史测量中即使 prompt 很小也会加载大量 tools、MCP、skills、agents 与 slash commands。

现有 durable operation、artifact checksum、target identity 与 recovery 逻辑正确，必须复用，不能为 UI 简化破坏 idempotency。

## Goals / Non-Goals

**Goals:**

- 将 state machine 收敛为 `preparing -> confirm -> running -> ready | error`。
- 弹窗确认前展示 backend 编译得到的真实 source/package estimated tokens。
- 一次“继续”同时确认 target 与可能的 lossy projection。
- 用 operation-scoped 真实阶段事件驱动三阶段 UI 与 progress bar。
- 仅为 Claude Provider continuation bootstrap 缩小 CLI surface。

**Non-Goals:**

- 不改变普通 Claude/Codex turn。
- 不绕过 Provider/API rejection、artifact integrity 或 recovery probe。
- 不把 elapsed time 伪装成百分比，不增加 polling。
- 不改变 Context Package projection algorithm。

## Decisions

### 1. 拆分 prepare、execute 与 discard command

新增：

```text
prepare_native_provider_continuation(request) -> prepared preview
discard_prepared_native_provider_continuation(request) -> discarded boolean
create_native_provider_continuation(request, confirm_degraded) -> existing execution result
```

`prepare` 与 `create` 复用现有 validation、`request_checksum`、`prepare(...)` 和 artifact store。Preview 返回：

- `status = "prepared"`
- `fidelity`
- `sourceEstimatedTokens`
- `packageEstimatedTokens`
- operation phase

Backend 可继续保留 omissions 等 diagnostics，但 product dialog 不渲染这些字段。

`discard` 必须重新计算 request checksum，并只允许删除 checksum 匹配、`phase=prepared`、`result_session_id IS NULL` 的 operation。Content-addressed artifacts 视为可复用 cache，不删除共享 artifact 文件；target Session、source history 与 catalog 均不得变化。

替代方案：给 `create` 增加 `prepareOnly` boolean。拒绝原因是 command 同时承担 preview 与 target mutation，调用语义更难审计，DTO 也更易误用。

### 2. Dialog 自动 preview，单次 confirmed execute

Provider 目标选定后立即生成 operation id，打开 `preparing` dialog，并异步调用 prepare command。Preview 成功后进入 `confirm`，展示可读 source title、source/target identity 与真实 Token。

用户点击“继续”时总是使用同一 request 调用：

```text
create_native_provider_continuation(confirm_degraded=true)
```

这次点击是对 target 与 frozen package fidelity 的统一授权，因此不再进入 `confirm-degraded`。Backend 仍保留 `confirmation-required` fallback，防止其他 caller 未 preview 且未确认时绕过 safety contract。

取消 preview：

- frontend 立即关闭；
- 调用 guarded discard；
- 若 Tauri invoke 尚未完成，completion handler 再执行一次 idempotent discard；
- stale completion 不得重新打开 dialog。

替代方案：点击后直接 `confirm_degraded=true`。拒绝原因是点击前没有真实 Token，且 preparation latency 仍位于 loading。

### 3. 低频真实阶段事件

新增 `native-provider-continuation-progress`：

```ts
type NativeProviderContinuationProgressEvent = {
  workspaceId: string;
  operationId: string;
  phase:
    | "reading-source"
    | "compiling-context"
    | "prepared"
    | "starting-target"
    | "delivering-context"
    | "verifying-target"
    | "finalizing"
    | "ready";
  percent: number;
};
```

百分比是 phase milestone，不随时间增长：

- preparation：8 / 22 / 32
- target delivery：45 / 68
- verification：86 / 96 / 100

Frontend 通过已有 `createEventHub` 订阅，只在 `operationId` 匹配当前 dialog 时更新局部 state。每个 operation 最多约八个 event，不进入 AppShell 根 reducer，不使用 timer/polling。

三阶段 UI 映射：

1. `reading-source | compiling-context | prepared` → 准备上下文
2. `starting-target | delivering-context` → 启动 Provider
3. `verifying-target | finalizing | ready` → 校验并完成

### 4. Claude continuation 使用内部 minimal command profile

不扩展通用 `SendMessageParams`，避免让普通 turn、daemon mirror 与数十个构造点承担 continuation-only flag。Claude engine 内部新增 private `ClaudeCommandProfile::{Standard, ContextBootstrap}`；所有现有 public send path 固定使用 `Standard`，仅 `execute_claude` 调用专用 `send_context_bootstrap_with_provider_env`，并同时 `disable_thinking=true`。

Command builder 在 `ContextBootstrap` profile 下：

- 使用 Claude CLI `--safe-mode`，禁用 hooks、LSP、plugins、auto-memory、CLAUDE.md、MCP、agents 等 customization，同时保留 auth 与 model selection；
- 使用 `--tools ""` 禁用 built-in tools；
- 使用 `--disable-slash-commands`；
- 使用 `--prompt-suggestions false`；
- 使用最小 `--system-prompt`，只声明 context import / acceptance 责任；
- 跳过 curated skill append、Windows activation hint 与 AskUser MCP wiring。

Provider routing env、explicit model、stable `--session-id`、stream-json、user-message replay、durable history evidence 与 structured API rejection probe 保持不变。

替代方案：`--bare`。拒绝原因是它禁用 OAuth/keychain，可能破坏普通 CLI 本地登录；`--safe-mode` 的 auth boundary 更符合现有 Provider profile。

### 5. UI 采用方案 C，不新增样式依赖

复用 Lucide icon、现有 AlertDialog 与 `components/ui/progress`：

- header：Provider switch icon + 单一标题；
- summary card：可读 source title、完整 source → destination、`预计上下文 Token A → B`；
- stage strip：三个短阶段；
- footer：取消 / 继续或 retry；
- bottom edge：Progress。

使用 `isWeakSessionDisplayTitle` 过滤 protocol/weak title，fallback 到 i18n “未命名会话”。Omissions、projection mode、adapter drop 与 raw protocol marker 不进入正常 UI；error technical detail 仍保持折叠。

## Risks / Trade-offs

- [Risk] 用户频繁打开后取消会留下 content-addressed artifact cache → guarded discard 删除 operation record；artifact 由既有 content-addressed reuse/后续 GC 管理，禁止误删其他 operation 共享文件。
- [Risk] prepare invoke 完成晚于取消 → 使用 canceled operation set + completion-time second discard，阻止 stale dialog reopen。
- [Risk] `safe-mode` 在旧 Claude CLI 不受支持 → command test 固定当前 CLI contract；运行时保留明确错误与同 target recovery，不 silent fallback 到创建第二个 target。
- [Risk] 第三方 Provider 响应仍慢 → progress 停留在真实 `delivering-context`，不虚构增长；结构化 rejection 仍优先。
- [Risk] global Tauri event 被无关 operation 接收 → frontend 严格按 workspaceId + operationId 过滤。

## Migration Plan

1. 先增加 backend prepare/discard/progress 与 Claude minimal flag，保持旧 `create` fallback。
2. 再切换 frontend state machine 和方案 C UI。
3. 更新 Vitest、Rust tests、OpenSpec delta 与 Trellis contract。
4. focused tests 与 typecheck 通过后执行 strict OpenSpec validation。
5. Desktop 手工验证 Claude → Codex 与 Codex → Claude；记录 prepare 与 bootstrap elapsed time。

## Rollback

- Frontend 可回退到旧 `confirm / confirm-degraded` state machine；backend 新 command 与 default-false flag 对旧 caller 无行为影响。
- 若 minimal bootstrap 与特定 Claude CLI/Provider 不兼容，仅回退 continuation caller 的 internal profile；durable operation 与 recovery data 无需迁移。

## Open Questions

- 无阻塞问题。真实端到端耗时改善只在 Desktop smoke test 中记录，不用未经测量的固定 SLA 作为发布承诺。
