# fix-streaming-conversation-jank

## 背景

用户在对话流式输出期间遭遇严重卡顿：React Scan 采样显示 FPS 掉到 5，单组件 render 耗时可达 225ms。此前多轮修复（Rust 事件批处理、shadow transcript 节流、client store 写入优化）均未根治。

本次排查（含 3 个并行 subagent 的独立探查）确认卡顿由四个叠加根因构成：

1. **per-delta 诊断写风暴（DEV 默认开启）**：`isStreamLatencyTraceEnabled()` 在 DEV 模式恒为 true，`appendAgentDelta` 每次 dispatch（约 80 次/秒）都会触发 `appendRendererDiagnostic` 的全量 read → merge（对 ~1900 条 entry 逐条 `JSON.stringify` 去重）→ sort → 全量 persist，主线程被持续阻塞。
2. **流式 Markdown 全量重渲染**：Claude 早期阶段（<260 chars）与 ReasoningRow live 内容恒走 full `react-markdown` 路径，每次 throttled 更新（48-220ms）全量重解析 + 同步 Prism 高亮，直接对应 225ms 组件耗时。ReasoningRow 即使折叠（`display: none`）也照常执行完整 markdown 解析。
3. **12ms delta flush 节奏过密**：`REALTIME_DELTA_BATCH_FLUSH_MS = 12` 导致顶层 `useReducer` 每秒最高 dispatch ~83 次，每次都触发 `app-shell` 大子树 re-render。
4. **持久化放大**（已由 fix-client-store-bloat-and-write-cost 部分处理，本 change 不再重复）。

## 目标

- `appendRendererDiagnostic` 改为内存 append + 节流合并落盘（leading + trailing throttle），高频 append 不再逐次触发全量 read-merge-stringify-write。
- stream-latency trace 在 DEV 下不再默认开启，改为显式 opt-in（localStorage flag 或 `VITE_ENABLE_PERF_BASELINE`）。
- staged streaming 引擎（claude / codex）的流式 assistant 消息从第一个 token 起统一走 lightweight markdown，settle 后切回 full markdown。
- ReasoningRow live 阶段改走 lightweight markdown。
- realtime delta flush 节奏从 12ms 调整为 32ms（~30 次/秒），降低顶层 reducer dispatch 频率。

## 非目标

- 不迁移顶层 `useReducer` 到 Zustand（改动面过大，作为后续 change）。
- 不改动 Rust 侧 `client_storage.rs` 序列化机制（由 fix-client-store-bloat-and-write-cost 覆盖）。
- 不改变 settle 后（非流式）消息的最终渲染效果。

## 影响

- `src/services/rendererDiagnostics.ts`：append 路径节流化；`exportRendererDiagnostics` / `clearRendererDiagnostics` / `flushRendererDiagnosticsBuffer` 与 pending buffer 保持一致性。
- `src/features/threads/utils/streamLatencyDiagnostics.ts`：trace 默认值调整。
- `src/features/messages/components/MessagesRows.tsx`：流式 lightweight 判定放宽至全部 staged streaming 文本；ReasoningRow live 走 lightweight。
- `src/features/threads/hooks/useThreadItemEvents.ts`：flush 间隔 12ms → 32ms。
- 相关测试同步更新。
