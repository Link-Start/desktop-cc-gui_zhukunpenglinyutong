## Context

当前 `SemanticNavigationRuntime` 已按 `(provider, canonical workspace)` 复用 stdio LSP process，但把任何 query error 都视为 session fatal。Java `initialize` 通常很快返回，Maven/Gradle import 与 indexing 则继续后台运行；6 秒 definition deadline 因而会杀掉仍健康的 JDT LS。TypeScript Language Server 也可能在首次 project graph load 时出现同类 request timeout。Frontend 只知道 loading/semantic/fallback，无法区分 indexing 与 provider failure。

## Goals / Non-Goals

**Goals:**

- Java、TS/JS、Rust 共用明确 lifecycle：`starting | indexing | ready | degraded`。
- 15 秒 query timeout 仅 cancel request；process 仍存活时保留 session。
- JDT LS `language/status: ServiceReady` 作为 Java ready signal；标准/custom progress 作为 activity/indexing evidence。
- indexing/request-timeout 返回 typed metadata，不进入 workspace-wide heuristic fallback。
- 首次打开 semantic-capable 文件后 idle prewarm，并保持 typing/hover 零 backend query。
- dev/release 使用不同 persistent cache namespace；同 namespace/workspace 用 OS file lock 阻止双 owner。

**Non-Goals:**

- 不实现 provider installer、自动下载、completion/diagnostics/refactor。
- 不引入 polling、root store 或新的第三方 dependency。
- 不承诺大型 workspace 的固定 indexing 完成时间；只保证 UI 与 process lifecycle 有界、可解释。

## Decisions

### 1. Request health 与 process health 分离

`LspSession` 保存 atomic lifecycle。`send_request_with_timeout` 在 15 秒后移除 pending request 并发送 `$/cancelRequest`，返回 timeout error，但不改变 `alive`。Runtime 只在 child EOF/exit、stdio write failure、initialize failure等 fatal signal 时 evict；server cancellation、timeout 与单次 invalid location 都只终止当前请求。TS/JS、Rust 的成功 query 可收敛到 `ready`；Java 只接受 `ServiceReady` 作为 ready signal。

Alternative：timeout 后立即 kill。拒绝，因为 indexing-heavy provider 永远无法 warm。

### 2. Provider-aware readiness，generic state contract

所有 provider 暴露相同 lifecycle。Java initialize 后进入 `indexing`，消费 `language/status` 的 `ServiceReady` 与 `language/progressReport`；TS/JS、Rust initialize 后进入 `ready`，首次 query timeout 可进入 `degraded` 但保留 process。`$/progress` 只提供 activity evidence，不允许普通 background task 把既有 `ready` 永久降回 indexing。

Alternative：仅根据 initialize response 判 ready。拒绝，JDT LS project import 在 initialize 后继续执行。

### 3. Typed busy response，不自动全工程 fallback

Backend command response新增 `lifecycle`。request timeout 且 child alive 时返回 `mode=semantic`、empty result、`fallbackReasonCode=request-timeout` 与 `lifecycle=indexing|degraded`。只有 provider unavailable、fatal exit 或 invalid response 才运行 bounded heuristic scanner。这样避免 provider import 与 scanner 同时争用 IO/CPU。

### 4. Idle prewarm 复用既有 file hook

新增 narrow `code_intel_prepare` command/service。`useFileNavigation` 在 supported file/workspace 变化后设置一次 750ms timer；cleanup 取消旧 timer，request 只执行 provider spawn/initialize，不 materialize document text、不发 definition。后台失败只记录 bounded diagnostic，显式 navigation 仍负责用户可见 recovery。

Alternative：workspace 打开即启动全部 providers。拒绝，会为未使用语言制造 JVM/Node memory cost。

### 5. Persistent channel namespace + OS owner lock

AppState cache root 使用 `language-servers/development` 或 `language-servers/release`，避免 dev/release 共用 JDT `-data`。每个 JDT workspace data directory 持有 `std::fs::File::try_lock()` owner lock；锁失败时不启动第二个 process。lock handle 与 `LspSession` 同生命周期，无新 dependency，异常退出由 OS 自动释放。

### 6. 可观测性

记录 provider/workspace identity 的 bounded lifecycle log：spawn、initialize duration、query duration/timeout、ready notification、fatal eviction；不打印 source text 或完整私密路径。

## Risks / Trade-offs

- [Risk] 某些 JDT LS 版本不发送 `ServiceReady` → UI 保持 indexing 并允许 retry；后续若出现真实版本差异，再补 provider-specific adapter，不用普通 query success 伪造 ready。
- [Risk] 15 秒 timeout 后 server 仍计算旧请求 → 发送标准 `$/cancelRequest`，但接受 provider 可选择忽略 cancellation。
- [Risk] prewarm 增加首次 Java/TS 文件打开后的 JVM/Node memory → 750ms idle、按 provider/workspace 去重、沿用 session cap/idle eviction。
- [Risk] dev/release cache 分离会各保存一份索引 → 换取并行安全与可复现实验；同 channel 继续复用 persistent cache。
- [Trade-off] indexing 时不自动 fallback 可能暂时无跳转结果 → UI 明确状态并保留显式 retry，避免破坏最终 warm convergence。

## Migration Plan

1. Additive 扩展 response lifecycle field 与 prepare command；旧 result/mode/provider 字段保持兼容。
2. 将 cache root 切到 channel 子目录；旧 cache 保留但不再使用，可由后续卫生任务清理。
3. focused tests 与实际 Java/TS probe 验证后发布。
4. 回滚时移除 prepare/lifecycle consumption并恢复旧 cache root；无业务数据 migration。

## Open Questions

无。若真实 workspace 证明 JDT LS status notification 存在版本差异，再增加 provider-version-specific adapter，不在本次预设复杂兼容层。
