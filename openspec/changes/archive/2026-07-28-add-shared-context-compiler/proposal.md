## Why

Change B 已建立可靠的 Execution Target、Binding 与 typed ACK/terminal 边界，但跨 Target
上下文仍依赖临时的 8 Turn / 4000 字符文本前缀。长会话、Tool Exchange、Artifact、
Provider-private block 与崩溃恢复无法被可靠表达，因此 Gate 4 之后必须引入可审计、
capability-driven 的 Context Package V1。

## 目标与边界

- 以 Shared Canonical Log 为事实源，生成 versioned `ContextPackage` 与
  `ProjectionManifest`，Model Projection 不反向写回事实源。
- 按 Runtime capability 固定选择
  `native-delta > native-history-import > native-history-clone >
  portable-transcript > checkpoint`。
- 建立 Compatibility Transformer、Atomic Tool Exchange、Artifact Reference、
  progressive retrieval、two-phase cursor 与 durable pending delivery。
- 按已完成 S1/S2/S3 证据实现 Codex structured import、Claude echo ACK，以及
  Kimi ACP/weak-ACK 的显式能力边界。
- 保持 Shared Session strictly linear；任何 lossy projection 必须先向用户展示
  omissions 并获得确认。

## What Changes

- 新增 `ContextPackage schemaVersion: 1`、`ProjectionManifest`、
  `ContextCompressionReport`、typed omission/disposition。
- 新增纯 Rust `ContextCompiler` 与 capability predicate，不按 Engine 名硬编码 mode。
- 新增 Thinking、Tool ID/Result、Image、aborted/error block 的确定性 Compatibility
  Transformer 与 source × target matrix。
- 新增 Codex `thread/inject_items` context import Adapter；Claude transcript/checkpoint
  使用 checksum echo ACK；Kimi 无强能力时显式标记 weak/unsupported。
- 扩展 Binding cursor 为 accepted/committed 两阶段，并持久化 `pendingDelivery`
  phase；compile/accept/commit 分别推进自己的边界。
- 新增原子 Artifact Store 与 workspace/session-scoped progressive retrieval command。
- 将 Shared V2 send 的临时 bounded-delta prepare 接到 ContextCompiler；保留 feature
  flag 与旧路径作为回滚边界。

## 技术方案取舍

1. **推荐：Rust domain compiler + thin frontend orchestration。**
   Canonical Log、cursor、checksum、artifact 与 Adapter ACK 都在唯一 Rust writer
   边界内，前端只展示 degraded decision 和发送状态。可保持事务、权限与恢复一致。
2. **备选：TypeScript compiler + Rust storage commands。**
   UI 开发快，但会把 canonical payload、token/compression、checksum 与 cursor
   truth 分散到 Renderer，违反 SQLite single-writer 和 Presentation 不可反写事实源。

采用方案 1。复用现有 `SharedEventWriter`、Shared V2 commands、Codex app-server client
与 `SharedSendStatusBar`，不新增依赖、不新建第二套 Event Bus。

## Capabilities

### New Capabilities

- `shared-context-package`: ContextPackage、ProjectionManifest、compression report 与
  deterministic checksum/prefix contract。
- `shared-context-compiler`: capability-driven mode selection、Compatibility Transformer、
  Atomic Tool Exchange 与 checkpoint contract。
- `shared-context-delivery`: Runtime Adapter context ACK、two-phase cursor、
  pending delivery recovery 与 exactly-once boundary。
- `shared-context-artifact-retrieval`: atomic Artifact Store、retrievable reference、
  permission-scoped Host retrieval。

### Modified Capabilities

- `shared-send-pipeline`: Shared V2 send 在 prompt 前加入 compile/prepare/context ACK，
  并按 context accepted 与 canonical committed 分别推进 cursor。

## Impact

- Backend：`src-tauri/src/shared_context/**`、`shared_session_v2.rs`、
  `shared_event_log/**`、Codex/Claude runtime bridge、command registry/daemon parity。
- Frontend：Shared services/types、V2 send orchestration、degraded-context UI。
- Storage：复用 `shared_binding_state`，扩展 cursor/pending JSON；新增 app-data
  Artifact Store 文件，不引入数据库或第三方依赖。
- Tests：Rust compiler/delivery/artifact matrix、Codex/Claude Adapter contract、
  Shared Vitest 与 runtime contract 增量门禁。

## 非目标

- 不实现 Native Provider Continuation 或 NativeHistoryReader（属于 Change D）。
- 不修改 vendor history file，不宣称 Native CLI 支持 lossless replay。
- 不实现 ML 压缩、自动 Prompt 路由、Provider fallback 或 mid-turn target switch。
- 不迁移 Native Conversation 到 Shared Canonical Pipeline。

## 验收标准

- 长会话切换不依赖固定 8 Turn；所有 transformation/omission 有 Manifest 证据。
- Tool Call/Result 成对保留或成对省略；private reasoning 不泄露到不兼容 Target。
- 同 Binding 只注入缺失 delta，且排除其原生拥有的 Entries。
- compile/accept/commit 任一失败不错误推进 cursor；ACK 后 Run 失败不重复投递 package。
- checkpoint omission 不在后续 delta 自动补发，只能通过授权 retrieval 获取。
- 同 Binding 连续 package 的稳定前缀字节级一致；压缩报告记录实际 before/after。
- Change C 增量测试、strict OpenSpec validation、review 与 Gate 5 evidence 全部通过。
