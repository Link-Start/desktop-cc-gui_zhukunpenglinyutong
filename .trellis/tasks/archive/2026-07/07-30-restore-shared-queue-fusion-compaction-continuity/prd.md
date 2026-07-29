# 恢复 Shared Queue/Fusion 与 Compaction 连续性

## OpenSpec

- Change: `restore-shared-queue-fusion-compaction-continuity`
- Source of truth: `openspec/changes/restore-shared-queue-fusion-compaction-continuity/`

## 目标

1. Shared `running` / `settling` 允许冻结目标的 queued follow-up。
2. `compat-input` Fusion 使用 interrupt / settle / successor cutover，不伪装 native steer。
3. Codex compaction 与 prompt dispatch 在 native thread 上严格串行；processing high-watermark 不丢失。
4. Shared manual compact 按 durable CLI/Provider/Binding 路由。
5. Shared Composer 展示真实 compaction lifecycle。

## 验收

- OpenSpec tasks 与 delta specs 为唯一验收口径。
- 只运行受影响 Vitest、Rust tests、typecheck、format/check 与 strict validation。
- 不改用户已有 `CHANGELOG.md`，不运行全量测试。
