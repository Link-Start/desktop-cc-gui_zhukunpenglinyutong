# Proposal: project-shared-canonical-conversation

## 2026-07-27 Implementation Calibration

Rust projector、incremental checkpoint/rebuild、真实 V0 `log.jsonl` reader、Shadow
comparator、Tauri commands 与 feature-flagged frontend DataSource 已闭环。target
switch no-remount 与 background binding no-render-storm 均有定向 regression gate。

## Why

Wave 1（A1）与 Wave 2（A2）已经建成 SQLite WAL Canonical Event Storage 与 Canonical Fact 装配/Commit Sink，但 Shared Session V2 仍是“只进不出”：Canonical Fact 只存在于 `shared_event_log` 表中，没有从 fact 到 UI 的投影、没有 checkpoint、没有 rebuild、没有 Legacy dual-read、没有 Canvas 防回归。本 change 把 A2 产出的 canonical fact 投影为幕布兼容的 `ConversationItem`，并建立 Shared/Native 双 DataSource 隔离，为 Wave 4 真实流量切换提供可信、可重建、可回滚的 Presentation 层。

按 dark-launch 纪律，本 change 不接入真实 Send 路径；Shared 产品行为保持 V0，Shadow Canonical Log 只用于与 Legacy dual-read 对比。

## 目标与边界

- 实现 UI Projection：把 `shared_event_log` 中的 Canonical Fact 单向映射为幕布兼容的 `ConversationItem`（Rust 侧读取 + 序列化，Frontend 侧渲染）。
- 实现 Projection checkpoint + rebuild：使用 `shared_projection_checkpoint` 表记录 `projectionVersion + throughSequence`；删除 Projection 后能从 Event Log 完全重建，且 item count/order/type/checksum 一致。
- 实现 Legacy snapshot dual-read reader：旧 Shared 会话以 `fidelity = "presentation-only"` 读取，不伪造 Tool ID/Signature/Target，旧文件不改写。
- 实现 Shadow Projection vs Legacy dual-read 对比器：只记录 mismatch，不反向写。
- 实现 Canvas 防回归门禁：Native/Shared Projection 隔离 + golden fixtures 回归，覆盖 §17.6 矩阵与 4 条硬门禁。
- 复用已有 `rusqlite`、`serde_json` 与前端 `ConversationItem` 类型，不新增依赖。

## 非目标

- 不接入真实 Shared 流量（Wave 4 B 才做 V0→V2 切换）。
- 不修改 `threadItems.ts`、不恢复逐 delta 根 dispatch。
- 不实现 ContextCompiler（Wave 5 C）。
- 不实现 NativeHistoryReader / Provider Continuation（Wave 6 D）。
- 不修改任何现有 Native Session 的 History/Event/Projection 链路。

## What Changes

- 新增 Rust 模块 `src-tauri/src/shared_projection/`：Canonical Fact → `ConversationItem` 投影器、checkpoint 管理、rebuild、Legacy dual-read、Shadow 对比。
- 扩展 `SharedEventWriter`：新增只读查询 `events_for_session` 的 projection 适配入口，以及 checkpoint upsert/read API。
- 新增 `#[tauri::command]`（受 feature flag / dev build 隔离）：读取 Shared Projection、重建 Projection、Shadow 对比报告。
- 新增前端 `src/features/messages/presentation/sharedProjection/`：Shared 会话的 DataSource 与 Presentation 适配，与 Native DataSource 隔离。
- 新增 golden fixtures 回归测试：Native/Shared Canvas 渲染行为不变。
- 新增能力 spec `shared-canonical-projection`。

## Capabilities

### New Capabilities

- `shared-canonical-projection`: Shared Session V2 的 Canonical Fact 到 UI 的投影——单向映射、checkpoint/rebuild、Legacy dual-read、Shadow 对比、Canvas 防回归。

### Modified Capabilities

- `shared-event-storage`: 只读查询与 checkpoint API 扩展；存储结构不变。
- `shared-session-thread`: 只读投影入口；Shared logical thread 语义不变。

## Impact

- Backend: `src-tauri/src/shared_projection/`（新增）、`src-tauri/src/shared_event_log/writer.rs`（新增只读/checkpoint API）、`src-tauri/src/lib.rs`（新 Tauri command 注册）。
- Frontend: `src/features/messages/presentation/sharedProjection/`（新增）、`src/features/messages/Messages.tsx`（可选 Shared DataSource 注入点）。
- 产品行为：零变化（dark launch；Shared 真实流量仍在 V0）。
- 依赖：零新增。

## 验收标准

- 删除 Projection 后重建，item count/order/type/checksum 与 Commit 前一致。
- Legacy snapshot 以 presentation-only fidelity 读取，不伪造缺失协议事实，旧文件不改写。
- Shadow Projection vs Legacy dual-read 对比器产出 mismatch 报告，不反向写。
- Native Canvas golden fixtures 与 render regression 通过（§17.6 矩阵 + 4 条硬门禁）。
- `cargo test --manifest-path src-tauri/Cargo.toml` 通过相关新增/修改测试；`npm run test` 通过 Shared Projection 相关测试；`openspec validate project-shared-canonical-conversation --strict --no-interactive` 通过。
