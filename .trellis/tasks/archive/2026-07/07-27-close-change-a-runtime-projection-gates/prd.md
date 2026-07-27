# 收口 Change A Runtime 与 Projection Gates

## Goal

完成 `assemble-shared-canonical-facts` 与
`project-shared-canonical-conversation` 的 Phase 1 dark-launch 闭环：A2 消费
synthetic Runtime fixtures 与 V0 final-evidence read-only mirror，A3 消费隔离
Shadow Log 并与 Legacy dual-read 对比，不切换真实 Shared Send 写路径。

关联 OpenSpec changes：

- `assemble-shared-canonical-facts`
- `project-shared-canonical-conversation`

## Requirements

- V0 final evidence 只读镜像进入隔离 Shadow Canonical Log，不回写产品状态。
- 同 attempt 的 Usage 优先选择 `provider-report`，不得与 `runtime-final` 相加。
- 通过 Tauri command 暴露 Shared Projection read path。
- Shared Projection DataSource 仅在 feature flag 开启时读取 Shadow Projection，并保留 V0 fallback。
- Shared target 切换不 remount；后台 Binding 更新不得造成 AppShell/Canvas render storm。
- 真实 `turnRequested` / `run.settled` / V0→V2 写路径切换保持 Change B 范围。

## Acceptance Criteria

- [x] synthetic authoritative final snapshot 驱动 completed/failed/cancelled/replaced terminal commit。
- [x] 同一 terminal evidence 重试 100 次仅写入一条 `turnCommitted`。
- [x] dropped normal/delta lane 不影响 canonical final evidence。
- [x] V0 mirror 只读隔离，真实 snapshot 可投影。
- [x] Usage source precedence 测试覆盖 `provider-report > runtime-final`。
- [x] Shared Projection command、frontend mapping 与 Canvas feature flag 链路贯通。
- [x] Native history/live render 不回退；Shared target 切换不 remount。
- [x] 后台 Binding 更新无持续 AppShell/Canvas render storm。
- [x] A2/A3 定向测试、lint、typecheck、OpenSpec strict validation 通过。
- [x] Gate 2、Gate 3 与总任务清单仅在真实证据齐全后关闭。

## Contract

- Backend sink：
  `commit_turn(writer, session_id, logical_turn_id, attempt_id, input_entry_id, target, final_snapshot, committed_at) -> Result<AppendOutcome, CommitSinkError>`
- Projection read command：
  输入 `workspaceId + threadId`，返回 versioned `ProjectionItem[]`；非法 canonical payload fail closed。
- Frontend boundary：
  Tauri payload 在 service 层映射为 `SharedProjectionItem[]`，unknown enum/value 不进入 Canvas。
- Feature flag：
  flag 关闭保持当前 V0/Native DataSource；开启仅替换 Shared read source。

## Error Matrix

| 场景 | 期望 |
|---|---|
| V0 snapshot 不存在或损坏 | compare command 返回 typed error；Shadow mirror 不伪造数据 |
| Shadow canonical append 失败 | `shadowMirror.status=error` + backend log；Legacy V0 成功路径不回滚 |
| canonical payload 非法 | fail closed；checkpoint 不前移 |
| projection command 失败 | Shared read path 回退 V0；Native path 不受影响 |
| feature flag 关闭 | 不调用 Shared Projection command |
| target 只发生后台更新 | 不改 Canvas identity，不触发持续 render |

## Validation

- Rust：A2/A3 定向 integration tests。
- Frontend：Shared DataSource、Canvas source selection、no-remount/render-count tests。
- `npm run lint`
- `npm run typecheck`
- 两个 OpenSpec change strict validation。

## Rollback

保持 feature flag 默认关闭。代码 commit 可整体 revert；无 DB migration。若 Projection read path
异常，关闭 flag 即回到 V0/Native 路径。
