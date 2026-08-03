## Context

本 change 基于 `2026-07-17 05:20:55 +0800` 至 `2026-07-18 05:20:55 +0800` 的本地 evidence：

- append-only error log 共 1,545 条，其中 1,542 条为 `stderr`，398 条为同一 `codex_models_manager` refresh timeout，只有 3 条 `history-hydrate-empty` actionable error。
- rolling renderer diagnostics 保留 979 条 `perf.frame-drop`，p95 163ms、最大 798ms；37 个 first-visible 样本中 6 个超过 30 秒，最大 156.545 秒。
- fast Markdown Worker 在 production asset 中访问 `document` 后失败并退回 main thread。
- process snapshot 与本轮复查都观察到同一组已运行约 8 天、`PPID=1` 的 Gemini parent/child chain，且 argv 含原始 prompt；这证明至少存在一条确定的 orphan/隐私泄漏路径，但本 change 仍只清理 registry-owned handle，不按进程名扫描或误杀用户手工启动的 CLI。

当前代码已经具备 `liveAssistantTextChannel`、stable timeline snapshot、live row override、stream latency diagnostics、fast Markdown cache、client error JSONL、model catalog fallback、engine `active_processes` registry 与 Gemini `Drop`。设计必须复用这些能力，而不是建立平行 pipeline。

## Goals / Non-Goals

**Goals:**

- 让 fast Markdown Worker 的 module graph 在 Worker global scope 可执行，精确纠正 browser/worker conditional export 解析，并保留 main-thread sanitization/XSS boundary。
- 阻止语义等价的 Timeline/overlay state 把 streaming live row 拖回整条父级重渲染。
- 将 history degraded empty、model health probe、stderr persistence 与 Gemini child teardown 收敛为有界、可诊断、可测试的 owner contract。
- 让 performance/logging diagnostics 提供 evidence，而不是成为新的 hot-path pressure。

**Non-Goals:**

- 不重写 React message renderer、history storage、runtime manager 或 Codex CLI 内部 model manager。
- 不改变 turn terminal authority、message identity/order、final Markdown rich semantics。
- 不增加新 dependency，不自动修改用户 localStorage 或删除已有日志。

## Decisions

### 1. Fast Markdown 采用精确 Worker entry 与两阶段 compile boundary

Worker 只执行 serializable、DOM-free 的 parse/normalize/outline/heavy-block/HTML precompute，返回明确标记为 sanitizer-ready/unsafe 的 result。`workerAdapter` 在 main thread 复用现有 `sanitizeFastMarkdownHtml` 完成最终 trusted HTML；rich interaction islands 继续由 main thread hydration。

当前直接启动崩溃来自两条 conditional export：`decode-named-character-reference` 的 browser entry 顶层执行 `document.createElement`，`hast-util-from-html-isomorphic` 的 browser entry 使用 DOM parser；两者都已提供纯 `worker/default` entry。`vite.config.ts` 只对这两个已确认 package 的 Worker resolution 精确选择 DOM-free entry，不全局改变所有依赖的 export condition。

Worker module 及其 transitive imports 禁止在 module evaluation 或 compile path 访问 `window/document`。若后续 rich plugin 无法满足该约束，则按内容 feature 分类回到 main-thread rich compile，而不是在 Worker 内 shim DOM。

`workerAdapter` 同时拥有 request timeout 与 pending registry cleanup：每个请求都有 bounded timer，timeout/invalid response/identity mismatch/postMessage/runtime error 都在 adapter 内移除 pending owner，并只写 rate-limited safe reason。调用方的 document identity guard 必须在 Worker success、error、timeout 与 unavailable 后统一检查；一旦 stale，既不 finalization，也不进入主线程 compile fallback。`messageMarkdownPrecompute` 传入自己的 timeout budget；外层 Promise race 只兼容测试/替换实现，不再是 production pending cleanup owner。

**Alternatives:** 直接给 Worker 注入 fake `document` 会掩盖更多 DOM dependency 且破坏 sanitizer threat model；完全取消 Worker 会把已确认的主线程压力永久化，均不采用。

### 2. Streaming 修复保留双轨，只阻断等价父级工作

继续以 `timelinePresentationItems` 驱动 grouping/anchors/boundaries，以 latest `liveAssistantItem/liveReasoningItem` 覆盖 active tail。修复只允许：

- 对等价 outline/overlay/measurement/scroll state 返回 previous reference；
- 稳定跨 delta callback 与 derived collections；
- 让 Timeline/row memo boundary 忽略与本 row 无关的引用抖动；
- 在已存在 visible-stall evidence 时使用现有 recovery profile。

禁止把 full timeline 重新绑定到每个 delta，也禁止把所有 engine 统一降级为 plain text。

**Alternatives:** 单纯增大 throttle 能降低 render 次数但会直接恶化 first-visible；全面 virtualize streaming timeline 会改变 bottom-follow/measurement contract，本 change 不采用。

### 3. History empty 必须先判 authority

history resume 结果分为：

- `optimistic-pending`：`codex-pending-*` 本地草稿，只保留 local state并直接标记已加载，不调用 backend history loader；
- `authoritative-empty`：backend/disk 明确证明真实空历史；
- `degraded-empty`：snapshot/local/reopen 暂时都为空或失败；
- `readable`：当前或 last-good surface 可用。

`optimistic-pending` 不产生 `history-hydrate-empty`。仅 `authoritative-empty` 可以替换成 empty-thread UI。当前 runtime loader 对“真实空”没有独立 authority proof，因此真实 thread 的首次空结果最多执行一次现有 reopen/refresh recovery；该 automatic recovery budget 以 canonical thread 为 owner，切换 selection 或再次调用 resume 不得隐式重置。仍为空时保留 last-good surface并记录稳定 reason code。没有 last-good 时显示明确 degraded state与重试入口，不写 `restoredAt`、不标记成功 loaded，也不伪装成成功空历史。只有用户显式 Retry 才能重新武装一次 budget。

每个 canonical thread 同时维护单调 request generation。所有 loader/reopen await 后的 `loaded/failed` 写入、alias/replacement、snapshot dispatch 与 queue hydration 都必须再次核对 generation；旧请求只允许结束自己的 Promise，不得覆盖较新的 readable surface。

### 4. Runtime 健康探针不得借用 Model catalog refresh

当前 frontend `useModels` 与 startup orchestrator 已具备 workspace in-flight dedupe 和 fallback，不再新增一套 cooldown/owner。真正额外触发 refresh 的本地路径是 `WorkspaceSession::probe_health()`：每次 ensure/reuse runtime 都发送 `model/list`。

健康探针改用项目已正式支持、只读取静态 presets 的 `collaborationMode/list`。显式 model catalog 请求仍走原有 `model/list` owner。Codex CLI `0.144.1` 每个 app-server 自带约三分钟一次的 upstream refresh worker，客户端无法 cross-process single-flight；其失败由 stderr signature aggregation 保留证据，不伪造“已修复 upstream child exit”。

### 5. `stderr` 先分类脱敏，再时间窗聚合

`DebugEntry` 进入持久化前先映射为 privacy-safe signature：

- 已知安全错误使用稳定 code，例如 `codex-model-refresh-child-exit-timeout`；
- 未知 raw string 只保留长度、source/label 与 redacted marker，不写原文；
- 结构化 correlation ids 继续经过现有 bounded sanitizer。

相同 `source + label + safe reason` 在窗口内由 renderer 侧聚合，workspace/thread/turn scope 仅以 bounded id/count metadata 汇入 summary，写出 `count/firstSeen/lastSeen`。actionable error 立即写；低价值 `stderr` 延迟合并。renderer diagnostics retention 为 error/stability/stream-latency 保留类别预算，frame samples 继续有界。

所有 renderer diagnostic 在 append 与 restart load 两条路径都执行同一份 bounded sanitizer；`length/count` 只有 finite number、`hash` 只有 bounded base36 token 才能绕过 content-field redaction，避免 malformed legacy payload 通过 type confusion 留下 raw content。`pagehide` 与 hidden `visibilitychange` 会在追加 lifecycle entry 后使用 client-store immediate write，绕过底层 300ms debounce。

**Alternatives:** Rust 侧重写每日 JSONL 做就地聚合会破坏 append-only/atomic simplicity；只丢弃全部 stderr 会损失 upstream evidence，均不采用。

### 6. Gemini hard-disable 与 process registry teardown 共用一条 owner contract

Gemini execution 在本客户端中 hard-disabled。保留 engine enum、历史读取和诊断兼容代码，但 frontend 的 Prompt Enhancer、Orchestration dispatch、Project Map generation、Checkpoint commit、commit-message generation、TaskRun Retry/Resume/Fork、thread messaging/session owner 与 Tauri service boundary 都必须隐藏、归一或 fail closed；settings 的 fresh/missing/legacy `geminiEnabled` 必须归一为 `false`。历史 Gemini thread 只读：composer 发送、queued auto-flush 与 direct-thread send 必须在任何 mismatch/new-thread fallback 之前拒绝，不能把原输入静默发给当前 Claude/Codex/OpenCode。GUI/daemon local/remote 的 async 与 sync command boundary 都必须在取得或创建 session 之前 fail closed。这样既不做高风险的整模块删除，也不允许隐藏一个 engine selector 后又被旁路入口或直接 IPC 绕过。

engine discovery 也属于 capability boundary。hard-disable 时，bulk detection 与 preferred-engine selection 必须直接合成 disabled status 或跳过候选，不得把缺失的 binary override 解释为“使用 PATH 默认值”后运行 `gemini --version`；legacy workspace/default engine 若为 `gemini`，只允许按 shared frontend/backend policy 归一到可执行 fallback，不能重新选中 Gemini。remote GUI 对 `engine=None` 保持原样转发，由 daemon 的 authoritative active engine 解析；只有显式 `Some("gemini")` 在 GUI 侧提前拒绝，daemon 仍保留自己的最终 gate。

所有支持 stdin prompt 的 Gemini launch 统一从 stdin 传用户 prompt；argv 只保留 bounded control args。现有 `active_processes` 仍是 owner source：

- session launch 与 retire/interrupt 共享同一 gate；teardown 先标记 retired/cancelled，再检查或终止 child；
- spawn 成功后立即注册；
- stdin writer 与 stdout/stderr reader 并发启动，避免大 prompt 与 CLI 早期输出互相占满 pipe；
- normal terminal 在 wait/reap 完成前不释放 registry ownership，timeout/interrupt 始终能找到 child；
- process group 先收敛 `SIGTERM`，grace 后仍清理忽略 TERM 的 descendant，再 wait/reap root；
- manager 首次 create、workspace removal 与 global shutdown 经过同一 ownership gate；已取得的 stale session owner 也必须在 session launch gate 上被拒绝；
- GUI `ExitRequested`、daemon signal shutdown、workspace/worktree removal 都 drain 对应 owned sessions；
- cleanup failure 保留 session/process ownership并显式返回，caller 不得把 remove/shutdown 伪报为成功；
- `Drop` 继续 best-effort `start_kill`，但 lock contention 必须留下可诊断 cleanup-skipped evidence；
- 不按 process name 扫描或误杀外部 Gemini。

registry diagnostics 与 OS liveness 继续分开。自动 stale kill 不在本 change 扩张；只有明确 owned handle 的 teardown 才执行清理。

## Data Flow

```text
Markdown source
  -> worker-safe precompute
  -> sanitizer-ready result
  -> main-thread DOMPurify
  -> cached trusted HTML + local hydration

realtime delta
  -> liveAssistantTextChannel
  -> latest live row override
  -> stable parent timeline snapshot
  -> idempotent overlay/measurement state

DebugEntry(stderr)
  -> classify/redact
  -> signature window aggregate
  -> bounded appendClientErrorLog summary
```

## Risks / Trade-offs

- [Worker plugin 仍有隐藏 DOM import] → production build 后实例化真实 Worker smoke test；失败时按 feature 回到 main-thread rich path，不引入 DOM shim。
- [memo comparator 漏掉真实视觉变化] → comparator 只基于现有 render contract字段，并补 live text/final-state/anchor change regression。
- [history last-good 掩盖真实删除] → authoritative-empty 独立判定；last-good 仅用于 degraded/failure；per-thread generation 丢弃旧请求写回。
- [stderr 延迟聚合导致退出前丢一小段低价值证据] → actionable error immediate flush；生命周期结束 best-effort flush，窗口保持短且有上限。
- [process kill 误伤外部 CLI] → 只处理 registry-owned `Child` handle，不按名称/PID猜 ownership。
- [并发 create 或 stale `Arc` 越过 remove/shutdown] → manager gate 与 session launch gate 双层串行化；teardown 先持久标记 retired，再 drain child。
- [cleanup failure 被误报成功] → manager/host caller 显式传播聚合错误并保留 owner，禁止删除 registry 后继续返回 success。
- [大 stdin 与早期 stdout/stderr 互堵] → writer/readers 并发推进；writer 失败继续从 registry owner 进入 process-group cleanup。
- [静态 health RPC 在旧 Codex 版本不可用] → 该 RPC 已是当前受支持 bridge capability；probe failure继续按现有 unhealthy/restart contract处理，不回退到 `model/list`。

## Migration Plan

1. 先落地 Worker boundary 与 focused tests；保留现有 main-thread fallback作为 rollback。
2. 落地 Timeline/history guards，沿用现有 feature flags/diagnostics，不新增持久化 schema。
3. 落地 non-model health probe、stderr aggregation 与 diagnostics retention；旧 JSONL 不迁移、不删除。
4. 落地 Gemini frontend/backend hard-disable 与 stdin/teardown；保持现有 Tauri command payload不变。
5. 关闭 React Scan执行 idle/background/foreground streaming 三场景验证。

Rollback 时可逐层恢复 adapter/guard实现；不需要数据 migration。任何回滚都不得恢复 raw prompt argv 或 unsanitized HTML mount。

## Open Questions

- Codex CLI 后续版本是否修复 `codex_models_manager` 周期 refresh timeout；本 change 只记录当前 `0.144.1` 边界，不自动升级用户 CLI。
- macOS production Worker通过后，Windows WebView2/Linux WebKitGTK仍需用户或 CI smoke evidence。
