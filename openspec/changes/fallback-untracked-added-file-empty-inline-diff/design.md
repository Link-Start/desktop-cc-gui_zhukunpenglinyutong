## Context

`threadItemsFileChanges` 已能从 Codex `apply_patch` payload 拆出每个文件及对应 patch body。`GenericToolBlock` 也会把非空 `change.diff` 交给 `unifiedDiffToPreview`。断点位于最后一步：`parseDiff` 只有遇到 `@@` 才进入 hunk，而新增文件 patch 通常是 `*** Add File: path` 后直接跟 `+content`，因此 preview 只剩 header 或为空。

## Goals / Non-Goals

**Goals:**

- 恢复 `FileChangeRow` 原有点击与 lazy expansion contract。
- 复用 event-time `change.diff`，让 apply_patch added/deleted body 可被 inline renderer 消费。
- 保持 unified diff、modified patch、missing diff 与汇总卡行为不变。

**Non-Goals:**

- No disk snapshot synthesis, backend change, IPC change, or new Surface navigation.
- No binary/image/empty-file preview redesign.
- No eager parsing while rows are collapsed.

## Decisions

### Decision 1: 修复 adapter，不修改共享导航契约

兼容逻辑放在 `unifiedDiffToPreview`：先调用现有 `parseDiff`；若没有正文行，再识别 `*** Add File:` / `*** Delete File:` 后的 `+` / `-` body。这样所有 `FileChangeRow` 调用方共享修复，同时不扩大 `parseDiff` 的全局语义。

### Decision 2: 只消费事件已有内容

preview 只使用 `change.diff`。历史消息不会因当前 workspace 文件变化而漂移，也不需要 async disk I/O。

### Decision 3: Surface navigation 维持提交前行为

删除 `onOpenUnavailablePreview`。有非空 inline diff 的 row 只负责展开；只有原本就缺失 diff 且调用方明确提供 `onOpenDiffPath` 时，才保留既有 canonical fallback。

## Risks / Trade-offs

- [Risk] malformed apply_patch 只有 header、没有正文。→ 保持稳定展开语义，不隐式切换 Surface；本变更不伪造内容。
- [Risk] patch body 包含多个文件。→ upstream 已按文件拆分；adapter 遇到下一条 `***` metadata 即停止。
- [Trade-off] line number 对 apply_patch body 不可用。→ 当前 inline renderer 不展示 line number，因此不引入虚假编号。

## Migration Plan

1. 回退错误 navigation branch。
2. 扩展现有 preview adapter。
3. 更新 focused tests 与 behavior delta。
4. 执行 frontend/OpenSpec gates。

Rollback: revert adapter 与测试变更即可；无数据迁移。

## Open Questions

无。
