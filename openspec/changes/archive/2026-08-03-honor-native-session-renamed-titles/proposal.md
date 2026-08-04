## Why

用户在 Codex 中执行 `/rename`，或在 Claude Code / VS Code 插件中重命名会话后，cc gui 仍显示第一条消息；会话其实还在，但用户很容易误以为它没有被加载。当前扫描器没有读取两种 runtime 已持久化的原生标题，因此需要补齐 title truth。

## 目标与边界

- Codex：从每个 `CODEX_HOME/session_index.jsonl` 读取 session id 对应的最新 `thread_name`，仅覆盖同一 home 扫描出的 summary。
- Claude：从单个 session JSONL 中读取最后一条 `type = "custom-title"` 的 `customTitle`。
- 原生标题通过 additive optional `nativeTitle` 保留来源，并继续作为 catalog `title` 使用；已有 GUI custom title / mapped title 的更高 precedence 保持不变。
- 无有效原生标题、索引缺失或单行损坏时，保持当前首条用户消息 fallback。

## What Changes

- Claude source-fact scanner 在现有单次 JSONL 扫描中收集最后一个非空 `customTitle`，并提升 scanner version 使旧 cache 失效。
- Codex scanner 按 sessions root 所属 home 分组；每个 home 最多读取一次 `session_index.jsonl`，再按 UUID overlay 该 home 的 session summaries，避免逐会话 I/O 与跨 home 串名。
- 增加 Rust / Vitest regression tests，覆盖 title precedence、最后记录胜出、fallback、弱标题名称与多 home 隔离。

## 技术方案选项与取舍

### 选项 A：在现有 backend summary 扫描阶段合并原生标题（采用）

复用当前 catalog `title` 投影，并增加 backward-compatible optional `nativeTitle` 标记标题来源。Claude 与 transcript 同扫；Codex 每个 home 只读一次小型 name index。frontend 仅在中央 title projection 中加入 native precedence，GUI 既有 custom/mapped precedence 保持不变。

### 选项 B：frontend 为每个会话额外查询原生标题

需要新增 Tauri command、payload 和合并状态，并可能形成 N+1 IPC / I/O；同一刷新中的 title 与 summary 还可能来自不同时刻。收益不足以覆盖额外复杂度，故不采用。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `codex-session-sidebar-state-parity`：Codex sidebar MUST 优先显示当前 `CODEX_HOME` 中为 UUID 持久化的原生重命名标题。
- `claude-session-sidebar-state-parity`：Claude sidebar MUST 优先显示 session JSONL 中最后一个有效的原生 custom title。

## 非目标

- 不把原生标题回写到 cc gui 的 title store，也不修改 Codex / Claude 的文件。
- 不修改 GUI 内 rename、auto-name、mapped title 的 precedence。
- 不新增 frontend 状态、Tauri command 或通用 title-source 枚举。
- 不改变 session membership、排序、workspace attribution 或跨 home dedupe 规则。

## 验收标准

- Codex 原生 rename 后，cc gui 显示 `session_index.jsonl` 中该 UUID 的最后一个非空 `thread_name`；不同 `CODEX_HOME` 的同 UUID 不互相污染。
- Claude 原生 rename 后，cc gui 显示 session JSONL 中最后一个非空 `customTitle`。
- `Agent 12`、`Codex Session` / `Claude Session`、短十六进制串等合法原生 rename 也必须显示，不能被 weak-title heuristic 丢弃。
- GUI custom/mapped title 仍高于 backend catalog title。
- 缺失、空白或损坏的 rename metadata 不影响原有 first-message fallback。
- focused Rust tests、format、OpenSpec strict validation 与项目要求的相关 quality gates 通过。

## Impact

- Backend：Codex / Claude scanners 与 workspace session catalog additive `nativeTitle` projection。
- Frontend：Tauri response types、catalog normalizer 与 centralized session title projection。
- Tests：focused Rust tests 与 title/catalog Vitest。
- Specs：`codex-session-sidebar-state-parity`、`claude-session-sidebar-state-parity`。
- 无新 dependency、无 migration；`nativeTitle?: string` 是 backward-compatible response field。
