## 1. Shared Convergence Primitive

- [x] 1.1 [P0, 无依赖] 新增 feature-local scroll convergence helper；输入为 container/edge/motion，输出为唯一 cancel handle，并用 focused test 验证动态 target、连续稳定帧、timeout 与 cancel。

## 2. Scroll Ownership Wiring

- [x] 2.1 [P0, 依赖 1.1] 在 `Messages` 建立唯一 active convergence owner；输出为 history-open、live effect、ResizeObserver、turn-settle 与 auto-follow re-enable 全部调用统一 bottom request，wheel-up 可同步取消。
- [x] 2.2 [P0, 依赖 2.1] 保留 `MessagesTimeline` scope reset/remeasure 触发点并改为 callback intent；输出为 timeline 不再直接写 bottom scroll，focused virtualization behavior 通过。
- [x] 2.3 [P0, 依赖 2.1] 保留 `ScrollControl` icon、direction、visibility 与 accessibility contract并改为 owner callback；输出为 top/bottom 用户命令复用统一 convergence。

## 3. Regression Coverage

- [x] 3.1 [P0, 依赖 2.1-2.3] 增加 bottom write 后 virtualizer correction、迟到 scrollHeight growth、manual scroll-away cancel 与 explicit re-arm tests；输出为旧实现会失败、新实现通过的 focused assertions。
- [x] 3.2 [P1, 依赖 3.1] 核对 Codex/Claude 共用 surface 的 completion/history props，无 engine-specific scroll writer；输出为 shared behavior tests 与静态 symbol audit 通过。

## 4. Verification

- [x] 4.1 [P0, 依赖 3.1] 运行 focused Vitest、`npm run typecheck`、相关 lint/large-file gate 与 `openspec validate --all --strict --no-interactive`；输出为全部通过或记录非本变更 blocker。
- [x] 4.2 [P1, 依赖 4.1] 启动本地 dev server 供 history-open、turn-settle、manual scroll-away、floating top/bottom control 人工验收；输出为可访问 URL，不执行 Git commit。

## 5. Late Render And Focus Follow Closure

- [x] 5.1 [P0, 依赖 2.1] 扩展 shared convergence primitive，由同一 cancel handle 管理立即 run、100/300/1000ms checkpoints 与 guard；输出为迟到高度变化可追底、取消后不再写入。
- [x] 5.2 [P0, 依赖 5.1] 建立 history/live/settle/explicit intent policy；输出为 history 独立于焦点跟随，live/settle 受开关和用户位置约束，显式浮标不修改持久化 preference。
- [x] 5.3 [P0, 依赖 5.2] 补充 focus-off、manual scroll-away、late history measurement、focus re-enable regression tests；输出为真实延迟无需手工触发 ResizeObserver 仍可闭环。
- [x] 5.4 [P1, 依赖 5.3] 运行 focused Vitest、typecheck、changed-file ESLint、diff check 与 OpenSpec strict validation；输出为通过结果或明确非本变更 blocker，不执行 Git commit。

## 6. Render Loop Hardening

- [x] 6.1 [P0, 依赖 5.1] stable edge 不再重复写 `scrollTop`，同 edge/motion/intent 且已到位的 active request 不重启；输出为切断 scroll/anchor/measure 反馈环，同时允许 geometry 增长后立即追底。
- [x] 6.2 [P0, 依赖 6.1] 增加 zero-write 与 duplicate resize regression，并运行 Messages/AppShell focused tests、typecheck、ESLint、diff check；输出为无 Maximum update depth 回归，不执行 Git commit。

## 7. Active-first And Two-second Final Calibration

- [x] 7.1 [P0, 依赖 6.2] 修复 active-first 初始落位生命周期；输出为 working/thinking 首次打开仍只执行一次 history placement，用户随后 scroll-away 后 turn settle 不再误触发初始化钉底。
- [x] 7.2 [P0, 依赖 7.1] 在既有 immediate/100/300/1000ms 序列后增加 2000ms final checkpoint，并为 history/settle guard 保留 timer jitter 余量；输出为迟到测高可追底且取消语义不变。
- [x] 7.3 [P0, 依赖 7.2] 将 checkpoint regression 改为 controlled timers，补齐 active-first、2s late growth 与 cancel coverage；输出为 deterministic focused tests。
- [x] 7.4 [P1, 依赖 7.3] 运行 focused Vitest、typecheck、changed-file ESLint、diff check 与 OpenSpec strict validation；输出为通过结果或明确非本变更 blocker，不执行 Git commit。

## 8. Same-thread Reopen And Multi-turn Settlement

- [x] 8.1 [P0, 依赖 7.1] 在 conversation scope transition 时重置 one-time history placement；输出为 `thread A -> null -> thread A` 再次打开仍启动统一 bottom convergence。
- [x] 8.2 [P0, 依赖 8.1] 将 turn settlement intent 前移到 layout phase；输出为 timeline back-fill 造成的 geometry scroll event 不能抢先解除 follow，manual scroll-away 语义保持。
- [x] 8.3 [P0, 依赖 8.1-8.2] 增加 same-thread reopen、oversized/lightweight reopen、multi-turn settle 与 manual release regression；输出为 Codex/Claude shared surface 行为一致。
- [x] 8.4 [P1, 依赖 8.3] 运行 focused Vitest、AppShell/router、typecheck、changed-file ESLint、diff check 与 OpenSpec strict validation；输出为通过结果或明确非本变更 blocker，不执行 Git commit。
