## 1. Spec & 契约对齐

- [x] 1.1 确认 `proposal.md` / `design.md` / delta specs 已通过人工审查（本 change 合入实现前 gate）
- [x] 1.2 锁定 Open Questions 默认：`turn:activity` 一等公民事件、P0 不做 hard safety cap、P0 不做 StatusPanel ids 展示、**grace full re-arm**、Codex/Grok out of scope
- [x] 1.3 `openspec validate fix-claude-background-shell-settlement --strict --no-interactive` 通过

## 2. 后端纯函数与状态机

- [x] 2.1 在 `claude_stream_helpers`（或等价模块）实现 `extract_background_task_id`：仅 structured 字段、trim、长度上限
- [x] 2.2 实现 terminal task-notification 解析（XML 块 + 若存在 structured 形态）：matching id + completed/failed/stopped
- [x] 2.3 实现 turn-scoped `active_background_task_ids` 与 id budget（set 上限）— helpers: `try_register` / `try_release`（读循环接入在 2.4+）
- [x] 2.4 改造 `claude.rs` 读循环 timeout 选择：`WaitBgTasks` vs `GraceWaitEof` vs 普通读（含 Windows coalesce 分支）
- [x] 2.5 `force_kill_process_group` 仅在 `can_force_kill_for_grace` 为真时由 grace 路径调用；Stop 路径保持强制终止
- [x] 2.6 blockers 清空后 re-arm grace；EOF 时带剩余 blockers 直接 Finalize
- [x] 2.7 active set 为 `send_message` 读循环局部状态，turn 结束自然丢弃（无需跨 turn 残留）

## 3. Realtime 投影

- [ ] 3.1 在 `EngineEvent` 增加 `turn:activity`（或 design 批准的等价契约），含 workspaceId、turnId、phase、activeCount/ids — **P1 后续**（本 commit 后端门闩优先）
- [ ] 3.2 WaitBgTasks 进入/set 变化/清理时低 churn emit — **P1**
- [ ] 3.3 事件序列化与 agent domain / forwarder 路径无破坏既有 critical events — **P1**

## 4. 前端

- [ ] 4.1–4.4 Waiting 文案投影 — **P1 后续**（TurnCompleted 延后时既有 WorkingIndicator 仍会转圈；专用文案另开）

## 5. 测试

- [x] 5.1 纯函数单测：id 抽取 / 终态判定 / grace gate 矩阵
- [x] 5.2 fake stream：无 blocker → grace settle（兼容既有 unix 测）
- [x] 5.3 fake stream：有 blocker → 5s 内不 grace-kill；matching release 后可收敛
- [x] 5.4 pure：mismatched / non-terminal 不释放
- [ ] 5.5 fake stream：Stop 在 WaitBgTasks 强制收敛 — 可选补强
- [ ] 5.6 FE reducer / WorkingIndicator 单测 — P1
- [x] 5.7 跑相关 claude settlement 测试

## 6. 平台验证与收尾

- [ ] 6.1 macOS 人工冒烟：Claude 后台 >5s shell，下一轮无误杀 completion 丢失
- [ ] 6.2 Windows 人工冒烟：同场景（issue #983 原 repro）
- [ ] 6.3 Linux 冒烟或与 CI unix 测试等价声明（若无实机，在 verification 记 waiver）
- [ ] 6.4 无后台普通 Claude turn：settlement 体感无回退 hang
- [ ] 6.5 可选：更新 `docs/perf/streaming-render-stall-design-2026-07-30.md` grace 注释补 blocker 例外
- [ ] 6.6 env 回滚开关文档化（若实现）
- [ ] 6.7 `openspec-verify-change` → sync main specs → archive（实现完成且验收后）
- [ ] 6.8 关联关闭 issue #983

## 依赖顺序

```
1.x → 2.x → 3.x → 4.x
         ↘ 5.x（可与 3/4 并行补测）
5.x + 6.1–6.4 → 6.7 archive
```

## 非任务（明确不做）

- 宿主 re-parent / 托管 Claude 后台 PID
- 文本关键词启发式
- 删除 grace 或仅调大数字
- Codex/其他引擎 settlement 改动
- Task Center 完整后台任务产品化
