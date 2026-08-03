## Context

cc gui 的 session catalog 已把 backend summary title 用于显示；frontend 随后再应用 GUI custom title / mapped title。缺口有两层：backend scanner 没有读取 runtime 自己的 rename metadata，而且普通 `title` 无法让 frontend 区分原生 rename 与 first-message/generic fallback。Codex 0.145 把 `/rename` 追加到每个 `CODEX_HOME/session_index.jsonl`，Claude Code 把 rename 追加为 session JSONL 顶层 `custom-title` record。

约束包括：Codex 同时扫描 default home、workspace override home 与 managed provider homes；Claude source facts 有 fingerprint cache；rename metadata 损坏不能使会话消失；不得为每个 session 新增 I/O。

## Goals / Non-Goals

**Goals:**

- 让 backend catalog title 对 Codex / Claude 原生 rename 收敛。
- 保持每个 Codex home 的 title namespace 隔离，并把 index I/O 限制为每个 home 每次 scan 一次。
- 以 additive optional `nativeTitle` 保留 title source，并保持既有 custom/mapped precedence。
- 通过 focused regression tests 固化 latest-valid-wins 与 fallback。

**Non-Goals:**

- 不双向同步 GUI 与 runtime title stores。
- 不修改 session membership、dedupe、排序、attribution 或 archive semantics。
- 不引入 watcher、database migration、frontend state 或新 IPC command。

## Decisions

### 1. Codex 在 root scan 阶段按 home overlay title

`sessions_roots` 的成员是 `<codex-home>/sessions` 或 `<codex-home>/archived_sessions`。scanner 将：

1. 由 root 的 basename 识别所属 `codex-home`；
2. 用 scan-local map 缓存该 home 的 `session_index.jsonl`；
3. 顺序读取 index，忽略空行、malformed record、空 id 和空 `thread_name`，同 UUID 的最后一个有效 record 胜出；
4. `parse_codex_session_summary` 返回后，仅使用当前 root 所属 home 的 map 覆盖 `summary.summary`，再进入现有 UUID dedupe。

这样覆盖 default、workspace override、managed provider home 与 archived roots，不产生 N+1 I/O。备选方案是收集完所有 rollout 后用全局 UUID map overlay，但同 UUID 可能存在于不同 home，会破坏 provider scope，因此不采用。

### 2. Claude 在现有单次 transcript scan 中收集 `custom-title`

`scan_session_source_file` 对每条已成功解析的 JSON value 检查 `type == "custom-title"`，读取 trim 后非空的 `customTitle`；后续有效 record 覆盖前值。最终把该值写入独立 `native_title`，并保留 `first_real_user_message` 的原语义。

title 提取发生在 generic history classification 之前，避免 control-plane visibility 分类把 rename metadata 丢掉；原有 message count、cwd、timestamp、attribution 与 malformed diagnostics 逻辑保持不变。

### 3. 用 optional `nativeTitle` 保留跨层来源

`LocalUsageSessionSummary`、`ClaudeSessionSourceFact` / `ClaudeSessionSummary` 与 `WorkspaceSessionCatalogEntry` 增加 optional `nativeTitle`。frontend boundary 先 trim/narrow，再由中央 `sessionDisplayProjection` 应用：

1. GUI custom title；
2. mapped title；
3. runtime native title；
4. 既有 previous-vs-fallback strength heuristic。

因此合法原生标题即使长得像 `Agent 12`、generic session name 或短 hex，也不会被误判为 fallback；旧 backend 缺少 optional field 时保持现有行为。

### 4. 递增 Claude scanner version

`CLAUDE_SOURCE_FACT_SCANNER_VERSION` 递增，使旧 fingerprint cache 不会继续返回 first-message title。schema version 不变，因为 cache envelope 未改变。

### 5. Failure policy 保持 non-fatal

索引不存在、文件不可读、单行 malformed 或 title 空白时均忽略该 rename record，并保留现有 summary fallback。不会因为辅助 title metadata 降级或删除 session。

## Risks / Trade-offs

- [Codex index 在扫描过程中继续 append，当前 scan 可能看到旧值] → 与 rollout scan 本身一致，下一次 refresh 收敛；不引入锁或 watcher。
- [同 UUID 的 rollout 跨 home 最终仍由既有 dedupe 选择一个 entry] → title 只在各自 home 内 overlay，不改变 dedupe；测试覆盖不串用另一 home 的 index。
- [新增跨层 payload field] → 仅增加 optional `nativeTitle`，不新增 command 或 state；frontend boundary 对缺失值保持现有 fallback。
- [非常大的 index line] → 延续 rollout scanner 的 bounded-line 策略，忽略异常超长记录并保留 fallback。

## Migration Plan

无需数据 migration。发布后首次 Claude scan 因 scanner version 更新重建 cache；Codex 下次 catalog refresh 即读取 index。rollback 只需回退 backend code，runtime 原始 metadata 未被修改。

## Open Questions

无；本地 Codex 0.145 与 Claude Code 2.1.218 的持久化格式已经由实际文件和对应源码验证。
