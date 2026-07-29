## Why

Change A–D 已形成 Shared/Native Session 基石，但生产代码复核发现 artifact 完整性、Context Package identity、Native History 隐私过滤、跨平台原子写、历史文件资源边界、runtime capability 与 degraded confirmation 仍存在 contract 缺口。若不校准，可能出现缓存错包、篡改未检出、Provider-private 内容泄漏、Windows 发布失败、超大 JSONL 阻塞以及 macOS 无法确认降级续接。

## 目标与边界

- 以既有设计文档、总任务清单和主 specs 为准，校准 Change A–D 的生产实现。
- 修复安全、正确性、macOS/Windows/Linux 兼容、性能和交互缺陷。
- 为每个根因增加 focused automated regression test，并运行相关整体测试。

## What Changes

- Context Package identity 纳入 compiler、destination、runtime capabilities 与 budget，避免不同编译结果复用同一 artifact。
- Context Artifact Store 对 package payload 计算并复核 checksum，采用跨平台、并发安全的原子发布。
- Native History Reader 增加文件大小上限和 typed error，过滤 Provider-private reasoning/signature，未知 block 显式记入 omissions。
- Provider Continuation 在目标 side effect 前执行真实 Codex method probe；不支持时降级，不再按 Engine 或前端常量猜测 capability。
- degraded confirmation 改用项目已有 Tauri Dialog，避免 macOS WKWebView 的 `window.confirm` 失效。
- 同步 A–D 总任务清单、影响报告和自动化验收证据。

## 非目标

- 不新增 CLI Provider。
- 不改写 vendor history file。
- 不承诺任意 Provider 间 lossless replay。
- 不引入新依赖，不运行与 A–D 无关的全量测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-context-package`: Context Package identity 必须覆盖所有影响编译产物的输入。
- `shared-context-artifact-retrieval`: Artifact payload 必须可校验，原子发布必须兼容 macOS、Windows、Linux 和并发写。
- `native-history-reader`: Native History 必须有资源上限，并在进入 portable package 前隔离 private/unknown blocks。
- `native-provider-continuation`: Runtime capability 必须由无副作用 probe 得到，degraded confirmation 必须在 Desktop shell 可用。

## Impact

- Backend: `shared_context`、`native_history`、`native_continuation`、Codex App Server adapter。
- Frontend: Sidebar Provider Continuation action。
- Persistence: 旧的、缺少 package payload checksum 证明的未发布本地 artifact 将 fail closed，并由 recovery flow 重新准备；不修改 vendor history。
- Dependencies: 无新增依赖。

## 方案对比

1. **修复共享 contract（采用）**：在 compiler、artifact store、reader、capability probe 的唯一责任点修根因，所有调用方自动受益。改动集中、可测试。
2. **调用点打补丁（拒绝）**：在 Change D continuation 单一路径校验/过滤。会遗漏 Shared Session、artifact retrieval 和后续调用方，继续产生 contract 分叉。

## 验收标准

- 篡改 Context Package payload 后读取必须失败。
- destination/capability/budget 任一变化时 package id 必须变化；同输入保持 deterministic。
- private reasoning/signature 不进入 prompt/import items，且 omissions 可审计。
- 超限 Native History 在分配大内存前返回 typed error。
- 原子发布在并发竞争时只接受完整、校验通过的 artifact；Windows 不依赖目录 `fsync`。
- Codex 不支持 `thread/inject_items` 时必须在创建目标 Thread 前降级。
- degraded continuation 在 macOS/Windows/Linux Desktop shell 均能确认或取消。
- focused Rust/Vitest、typecheck、OpenSpec strict validation 通过。
