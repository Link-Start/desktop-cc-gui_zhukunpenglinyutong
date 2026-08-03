## 1. Implementation

- [x] 1.1 [P0] 实现 `collectTurnProcessItemsForFinalAssistant`（turn-final ownership、
      跳过 mid-assistant 正文、Claude dual-id 排除）。
- [x] 1.2 [P0] `resolveCollapsedTimelineItems` 改用 turn-final 收集；保留 hard-unmount /
      shell filter / `count <= 1` skip。
- [x] 1.3 [P1] 更新 `ProcessPhaseCollapse` 类型注释为 turn-final 语义。

## 2. Tests

- [x] 2.1 [P0] 孤儿 reasoning 跨 mid-assistant plan 吸收 + expand remount。
- [x] 2.2 [P0] 多段 assistant 过程合并到 turn-final；trailing live tool 仍展开。
- [x] 2.3 [P0] 既有 shell hide / file-IO / single-step / empty assistant 用例保持通过。
- [x] 2.4 [P0] `pnpm exec vitest run` focused：
      `messagesViewModel.collapseMiddleSteps.test.ts`、
      `Messages.live-behavior.test.tsx`（collapse/process 过滤）。

## 3. OpenSpec / 收口

- [x] 3.1 [P0] 编写 proposal / design / tasks / delta spec / verification。
- [x] 3.2 [P0] `openspec validate fix-native-process-phase-orphan-reasoning --strict`。
- [x] 3.3 [P0] 同步 main capability spec、归档 change、更新 changes/archive 索引。
- [x] 3.4 [P0] 仅 stage 本 change 相关文件并 commit（隔离无关 working tree）。
