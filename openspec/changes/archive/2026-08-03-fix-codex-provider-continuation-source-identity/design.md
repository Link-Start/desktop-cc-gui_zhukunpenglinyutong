## Context

`useSidebarMenus` 使用当前 `ThreadSummary.id` 作为 `source.sessionId`，并把 Engine prefix 去掉后作为 `source.nativeSessionId`；若 thread id 本来无 prefix，则两者相同。该 mapping 与当前 catalog 行为一致：Codex history/catalog 可以保留 raw thread id，而 Claude/Kimi logical id 使用 Engine prefix。

`validate_provider_continuation_shape` 当前对所有 Engine 统一要求：

```text
sessionId == "<engine>:" + nativeSessionId
```

因此 raw Codex catalog row 在任何 source read、Token estimate 或 progress event 之前失败。Provider binding lookup 已支持 Codex raw 与 prefixed compatibility key，故缺口只在 shared continuation shape validator。

## Goals / Non-Goals

**Goals:**

- 在 continuation trust boundary 明确表达 Codex 的两种合法 logical identity。
- 继续拒绝 logical/native id 不一致的 request。
- 让 prepare、create、discard 三个 caller 通过同一 shared validation 自动获得修复。
- 保留原始 `sessionId`，确保 lineage、catalog row 与来源导航使用同一 logical identity。

**Non-Goals:**

- 不改变 request/response DTO。
- 不迁移或 canonicalize 已有 Codex thread/catalog id。
- 不改变 Provider binding lookup、history reader、target execution 或 UI state machine。
- 不为一次条件分支引入新的 shared identity 模块。

## Decisions

### 1. 在 shared shape validator 使用 Engine-aware 等价判断

校验逻辑：

```text
logical = trim(source.sessionId)
native = trim(source.nativeSessionId)
canonical = engine + ":" + native

if engine == Codex:
    valid = logical == native OR logical == canonical
else:
    valid = logical == canonical

if not valid:
    return existing identity mismatch error
```

只复用现有 `engine_name()` 与 `NativeHistoryEngine`，不新增抽象。这样 prepare/create/discard 都在进入 side effect 前使用同一 guard。

替代方案是 frontend 强制 prefix；不采用，因为它会改写 persisted lineage source id，并遗漏非 sidebar caller。删除一致性校验也不采用，因为会允许读取与 UI logical identity 无关的 native history。

### 2. 不重写合法 Codex logical identity

Validator 只判断等价性，不修改 `source.session_id`。后续 request checksum、materialization、catalog lookup 与 source navigation 继续看到 caller 的 exact logical id。

这符合当前 binding contract：Engine 由显式字段提供，raw id 不用于猜 Engine；lookup 可以使用 raw/canonical compatibility keys。

### 3. 用 backend truth-table 与 frontend raw fixture 双层回归

Rust unit tests直接锁定 trust-boundary truth table：

- raw Codex：通过；
- canonical Codex：通过；
- mismatched Codex：拒绝；
- raw Claude/Kimi：拒绝，canonical 继续通过。

Frontend hook test 使用真实 catalog 形态的 raw Codex id，断言 request 同时保留 raw `sessionId` 与相同 `nativeSessionId`。生产 frontend mapping 无需修改。

## Risks / Trade-offs

- [Risk] 放宽 Codex 校验可能误接收其他 Engine 的裸 id → 仅当显式 `engine=codex` 且 logical/native 完全相等时接受；Provider binding 仍按显式 Engine 校验。
- [Risk] canonical 与 raw Codex 产生不同 request checksum → 这是既有 logical identity 差异；不在本修复中合并 operation identity，避免隐藏 caller 漂移。
- [Risk] Trellis contract 与代码再次漂移 → 同步写明 Engine-aware truth table，并由 Rust tests 锁定。

## Migration Plan

1. 增加 backend regression tests并修改 shared validator。
2. 将 frontend Codex continuation fixture改为 raw catalog id。
3. 同步 Trellis executable contract。
4. 执行 focused Rust/Vitest、typecheck、runtime contract 与 OpenSpec strict validation。

无需数据迁移。回滚时恢复 validator 条件和对应 tests/spec；未产生新数据格式。

## Open Questions

无。raw Codex logical id 是当前代码与 catalog tests 已确认的兼容契约。
