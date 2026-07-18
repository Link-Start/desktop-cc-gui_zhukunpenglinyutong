## Why

本地 `ccgui@0.7.5` 的 24 小时运行证据显示，客户端同时存在 conversation 可见输出停顿、Timeline/Markdown 主线程放大、fast Markdown Worker 访问 DOM 后崩溃、Codex model catalog refresh 超时风暴、history reopen 空白、Gemini child process 清理迟滞，以及全局错误日志被重复 `stderr` 淹没等问题。它们共同把“后台仍在工作”放大成“前台像卡死或数据丢失”，并削弱现场诊断能力，因此需要按同一条 runtime stability contract 一次修复。

## What Changes

- 修正 fast Markdown compile 的 Worker boundary：Worker build 精确选择 Markdown dependency 的 DOM-free conditional entries，precompute 结果回到 main thread 后再完成最终 sanitization；仅当前 document identity 仍有效时允许 file-preview local fallback，stale request 在 Worker success/error/timeout/unavailable 后都必须直接丢弃。
- 保持既有 `stable parent snapshot + live row override`，进一步隔离 Timeline list/active row 的等价重渲染与 overlay idempotent writes，保证 first delta 后可见文本持续增长。
- `codex-pending-*` optimistic thread 不再进入 history loader；真实 thread 的空结果增加 last-good readable surface、per-thread 一次有界 recovery、request generation 与明确失败分类，禁止把 degraded/failed empty 当作成功空历史，也禁止旧请求覆盖新结果。
- 将 Codex runtime 健康探针从 `model/list` 改为不触发 catalog refresh 的静态 RPC；保留现有 model owner 的 in-flight dedupe 与 fallback，不声称修复 Codex CLI 自身的周期 refresh worker。
- 将全局 `stderr` 按安全 signature 聚合、限频并脱敏；顶层 string payload 也执行 content-aware redaction，避免重复 raw diagnostics 淘汰真正错误。
- 将 Gemini execution 作为客户端 hard-disabled capability：frontend 的 Prompt Enhancer、Orchestration、Project Map、Checkpoint commit、commit-message、TaskRun Retry/Resume/Fork、thread messaging/session owner 与 Tauri service boundary 不再形成新执行，fresh/missing/legacy settings 都归一为 disabled；startup bulk/preferred discovery 不再 probe `gemini --version`，GUI/daemon 的 async 与 sync command boundary 均 fail closed 且不得 spawn。现有 Gemini history/diagnostic 读取能力保留，但历史 composer/queue 不得把输入静默改发给其他 Provider。
- 强化现有 Gemini process registry / `Drop` / interrupt 路径：prompt 统一走并发 stdin transport，owned process group 在 terminal、interrupt、workspace removal、GUI/daemon shutdown 与 drop 路径都执行 kill/reap；并发 launch/remove 受同一 session owner gate 约束，旧 `Arc` 不得在 teardown 后复活进程，cleanup failure 必须向 owner 传播且不得伪报成功，registry 与 OS-liveness 证据继续分离。
- 保持 performance diagnostics 为 opt-in；正式性能验收必须关闭 React Scan，以免把 2–3x instrumentation amplification 当成产品基线。
- 不引入新 dependency，不修改 conversation item identity、message ordering、terminal authority 或 final Markdown fidelity。

## 目标与边界

- 目标：优先消除“delta 已到但 UI 长时间不可见”、stale Worker fallback 主线程放大、空历史误呈现/旧请求覆盖、重复 model refresh/stderr 风暴，以及 disabled Gemini 被残留入口、startup detection 或 teardown race 启动。
- 目标：复用已有 `liveAssistantTextChannel`、stream latency diagnostics、fast renderer cache、client error log、model catalog refresh owner 与 engine process registry，只补缺失 guard/ownership。
- 边界：本 change 不重写 message renderer、engine manager、history storage 或 Codex CLI 内部 model manager；只在既有 manager 增加最小 ownership gate，不新增平行 process manager 或前端 model refresh owner。
- 边界：无法由客户端证明的 OS process liveness 继续标记为 unsupported/manual evidence，不从 registry empty 推断 OS process 已退出。

## 非目标

- 不通过全局 plain-text-only renderer、提高所有 throttle、禁用 Markdown rich semantics 或关闭 diagnostics 来掩盖卡顿。
- 不把 assistant message completion 当作 turn terminal authority，不改变 stop/retry/settlement 语义。
- 不自动删除用户历史、运行时目录或本机日志；不修改用户当前 React Scan/localStorage 设置。
- 不在本 change 内升级 Codex CLI；已确认的 upstream 周期 refresh 只记录版本边界并聚合错误，客户端仅移除自身额外的 `model/list` health probe。

## 方案取舍

1. **推荐：在既有边界上做最小修复。** Worker 只执行 DOM-free compile，Timeline 保留双轨 render contract，catalog/history/process/logging 各在现有 owner 加 guard。优点是 diff 小、行为兼容、能复用当前测试与 diagnostics；缺点是需要跨 frontend/Rust 多处验证。
2. **备选：统一重写 Markdown/render/runtime pipeline。** 可以一次重塑边界，但会同时触碰 message identity、history、worker、runtime lifecycle，回归面远超本次故障证据，违反 YAGNI。
3. **备选：仅 suppress 日志并提高 throttle。** 改动最小，但 Worker、空历史、process ownership 和 visible stall 根因仍在，且会损失诊断证据，因此拒绝。

## Capabilities

### New Capabilities

- 无；本次修复延续现有 renderer、Markdown preview、history、model catalog、process lifecycle 与 error-log capability。

### Modified Capabilities

- `client-renderer-stability-under-pressure`: 等价 Timeline/overlay 更新必须 no-op，并以真实 visible text growth 约束 first-delta 后可见性。
- `file-markdown-preview-render-architecture`: Worker-ready compile 必须具备 DOM-free import graph，dependency resolver 必须尊重 Worker entry，最终 DOM sanitizer 留在明确的 main-thread boundary；stale request 不得进入任何 main-thread fallback。
- `conversation-render-surface-stability`: reopen/hydrate degraded empty 必须保留 last-good readable surface并给出 per-thread 有界恢复结果，旧 generation 不得回写。
- `codex-model-catalog-coverage`: runtime health/readiness probe 禁止调用 `model/list`；显式 catalog refresh 继续由现有 single-flight owner 与 last-good/built-in fallback 承担。
- `client-global-error-log`: 重复 `stderr` 必须按安全 signature 聚合、限频，顶层字符串同样脱敏和限长。
- `client-storage-performance`: diagnostics retention 必须按类别保留 actionable evidence，重复低价值项不得挤掉 error/worker/render-stall 证据。
- `parallel-conversation-runtime-residuals`: Gemini execution 必须 frontend/backend 双层 hard-disable；prompt transport 与 owned child cleanup/reap 必须覆盖所有 terminal/teardown path。

## Impact

- Frontend：`src/features/messages/**`、`src/features/markdown/fastMarkdownRenderer/**`、`src/features/threads/hooks/**`、`src/features/composer/**`、`src/features/debug/**`、`src/services/rendererDiagnostics.ts`、Codex model catalog refresh owner。
- Backend：`src-tauri/src/engine/gemini.rs`、`manager.rs`、GUI/daemon shutdown owner、engine process diagnostics/termination helpers；保持现有 bridge payload contract。
- Specs/tests：新增 focused Vitest、真实 Worker smoke test、Rust process-argument/lifecycle tests，并运行 runtime contract、typecheck、lint、OpenSpec strict validation。
- 依赖：无新增 package；daemon graceful shutdown 仅启用既有 Tokio dependency 的 `signal` feature。

## 验收标准

- production-like Worker smoke test 中不再出现 `document/window` ReferenceError；正常 fast Markdown 不触发 main-thread fallback，stale request 的 success/error/timeout/unavailable 都不触发 main-thread compile，sanitization/XSS fixtures 继续通过。
- 关闭 React Scan 后，三场景复测中 frame-gap p95 目标 `<30ms`；first-visible p95 目标 `<160ms`，不得再出现 first delta 后 `>700ms` 的 visible-output stall。
- pending thread 不调用 history backend；degraded/failed history reopen 不把 last-good transcript 替换为空；自动 recovery budget 在同一 canonical thread 上只消费一次，旧 generation 不得覆盖新结果，显式 Retry 才能重新武装。
- runtime ensure/reuse 的健康探针不发送 `model/list`；用户显式 catalog refresh 仍保持现有 in-flight dedupe 与 last-good/built-in fallback。
- 相同 `stderr` 在时间窗内形成一条聚合记录，包含 `count/firstSeen/lastSeen`，不得保存 raw prompt/output/secret；actionable error 不被低价值重复项淘汰。
- Gemini execution 默认值、legacy setting、Prompt Enhancer、Orchestration、Project Map、Checkpoint commit、commit-message、TaskRun recovery 与 GUI/daemon async/sync command 均保持 disabled；bulk/preferred engine discovery 不得 probe Gemini，fake CLI spawn marker 不得产生。已有 owned process 的 prompt 不出现在 argv；大 prompt 写入与 stdout/stderr drain 不互相阻塞；owned process group 在 session/host teardown 后进入 kill/reap 路径，TERM-resistant descendant 也不得残留。stale session/turn 不得越过 workspace removal、interrupt 或 global shutdown gate；cleanup failure 必须显式返回，OS liveness 以 measured/manual/unsupported 明确标注。
