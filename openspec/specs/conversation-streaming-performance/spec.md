# conversation-streaming-performance Specification

## Purpose
TBD - created by archiving change fix-streaming-conversation-jank. Update Purpose after archive.
## Requirements
### Requirement: 诊断持久化不得阻塞流式主线程

高频 renderer diagnostics append MUST NOT 在每次调用时执行全量 read-merge-stringify-write。诊断条目 MUST 先进入内存 pending buffer，并以不低于 2s 的间隔合并落盘（leading + trailing throttle）。

#### Scenario: 流式期间高频 append

- **GIVEN** 一个 turn 正在流式输出，`appendRendererDiagnostic` 每秒被调用数十次
- **WHEN** append 发生在上一次落盘后的 2s 节流窗口内
- **THEN** 条目仅进入内存 pending buffer，不触发 client store 写入
- **AND** 节流窗口结束后 pending 条目一次性合并落盘

#### Scenario: 页面隐藏或卸载

- **WHEN** `pagehide` 或 `visibilitychange` 切到 hidden
- **THEN** pending buffer 立即冲刷落盘，诊断现场不丢失

#### Scenario: 只读导出

- **WHEN** 调用 `exportRendererDiagnostics`
- **THEN** 返回值包含尚未落盘的 pending 条目

### Requirement: stream-latency trace 默认关闭

`isStreamLatencyTraceEnabled` MUST NOT 仅因 DEV 模式而返回 true。启用途径仅限显式 localStorage flag `ccgui.debug.streamLatencyTrace` 或 `VITE_ENABLE_PERF_BASELINE=1`。

#### Scenario: DEV 模式默认

- **GIVEN** DEV 模式且未设置任何 debug flag
- **WHEN** 流式 delta 到达
- **THEN** per-delta 的 `stream-latency/reducer-work`、`stream-latency/app-server-event` 等 trace 级诊断不再产生

### Requirement: 流式 assistant 消息统一走 lightweight markdown

staged streaming 引擎（claude / codex 或 presentationProfile 显式开启）的流式 assistant 消息，自首个非空 token 起 MUST 使用 lightweight markdown 渲染；settle（isStreaming=false）后 MUST 切回 full markdown 渲染最终内容。

#### Scenario: 早期阶段短文本

- **GIVEN** claude 流式回复当前长度 < 260 chars
- **WHEN** 文本更新触发 live row render
- **THEN** 使用 lightweight markdown（不做 react-markdown 全量重解析与 Prism 同步高亮）

#### Scenario: settle 后

- **WHEN** turn 完成、isStreaming 变为 false
- **THEN** 消息以 full markdown 渲染，最终视觉效果不变

### Requirement: ReasoningRow live 阶段使用 lightweight markdown

reasoning 内容在 live（流式）阶段 MUST 使用 lightweight markdown；settle 后 MUST 使用 full markdown。

#### Scenario: live reasoning 持续增量

- **GIVEN** thinking block 正在流式输出（无论展开或折叠）
- **WHEN** reasoning delta 更新
- **THEN** 渲染路径为 lightweight markdown，不执行 full react-markdown 重解析

### Requirement: realtime delta flush 节奏不高于 ~30 次/秒

realtime delta 批处理 flush 间隔 MUST 为 32ms，顶层 thread reducer 的流式 dispatch 频率不得超过 ~31 次/秒。

#### Scenario: 高频 delta 到达

- **GIVEN** 上游每秒推送 80+ 个 delta 事件
- **WHEN** 事件进入 realtime delta 批处理队列
- **THEN** 同一 32ms 窗口内的 delta 合并为一次 reducer flush

