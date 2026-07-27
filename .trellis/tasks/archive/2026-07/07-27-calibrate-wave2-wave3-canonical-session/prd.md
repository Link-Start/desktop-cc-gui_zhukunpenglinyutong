# 校准 Wave 2–3 Canonical Session 实现

## Goal

修复 Wave 2/3 review 发现的契约偏移、数据丢失和虚假 Gate 证据，使现有 dark-launch substrate 可被后续 Wave 安全复用。

关联 OpenSpec changes：

- `assemble-shared-canonical-facts`
- `project-shared-canonical-conversation`

## Requirements

- Rust canonical fact 序列化与 Wave 0 `shared-canonical-entry.schema.json` 一致。
- Canonical append 使用调用方提供的真实 occurrence timestamp，不伪造业务时间。
- Projection 遇到非法 canonical payload 时 fail closed，不推进 checkpoint。
- Projection checkpoint 支持增量读取、版本不匹配全量 rebuild，并保存可合并 cache。
- Legacy reader 读取真实 V0 `log.jsonl` 最新 snapshot 的 `items`。
- Shadow comparator 使用稳定业务相关键，不依赖两侧不可能相同的内部 item id。
- 非图片 artifact 不投影成 `GeneratedImage`。
- 未实际接入 `run.settled` / Canvas 的任务保持未完成，不再伪造 Gate 2/3 closure。

## Acceptance Criteria

- [x] Canonical fact serialization 通过 Wave 0 schema cross-validation。
- [x] 同一 terminal snapshot 重试仍幂等，`committedAt` 为真实调用方时间。
- [x] 非法 projection event 返回 typed error，checkpoint 不前移。
- [x] 增量 projection 只读取 checkpoint 后事件；version mismatch 可重建。
- [x] 多行 V0 `log.jsonl` 返回最后一个有效 snapshot 的 `items`，损坏尾行 fail closed。
- [x] Shadow/legacy 等价消息可匹配；差异可分类。
- [x] 定向 Rust/Vitest 与 OpenSpec strict validation 通过。
- [x] OpenSpec tasks 与 master checklist 只勾选有真实证据的项目。

## Error Matrix

| 场景 | 期望 |
|---|---|
| canonical payload 与 Rust 类型不匹配 | `StoreError::ValidationFailed` / projection typed error |
| checkpoint cache JSON 损坏 | 忽略损坏 cache，从 canonical source 全量 rebuild 后覆盖 checkpoint |
| projection version 不匹配 | 忽略旧 cache，全量 rebuild |
| V0 JSONL 任一非空行损坏 | typed JSON error，不返回部分数据 |
| SQLite append 失败 | sink 返回错误，调用方不得推进 settlement |

## Rollback

单一修复 commit 可整体 revert。未做 DB migration；checkpoint payload 仍为 JSON，旧 `{}` checkpoint 会触发安全全量 rebuild。
