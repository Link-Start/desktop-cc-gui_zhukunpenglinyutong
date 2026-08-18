## 1. Progress model + curtain

- [x] 1.1 增加 Native `HistoryLoadingProgress` builder、DSH 页事件 → progress 映射、`sameHistoryLoadingProgress`、`yieldHistoryLoadingPaint`
- [x] 1.2 `setThreadHistoryLoadingProgress` 用 equality（含 `detailParams`）；抽测页号变化必更新
- [x] 1.3 `HistoryLoadingSurface`：`progress != null` 即画 spine；Native 短标签为 准备/快照/解析/组装；Shared 文案不变
- [x] 1.4 zh / en 补 Native 阶段 i18n

## 2. DSH page events

- [x] 2.1 `load_dsh_session` 增加可选页回调；无回调路径（`latest_assistant_text`）保持静默
- [x] 2.2 本地 `load_dsh_session` command emit `dsh-history-load-progress`（开始 + 每页）
- [x] 2.3 JS `subscribeDshHistoryLoadProgress` + events 单测

## 3. Resume wiring

- [x] 3.1 选中未加载 Native / DSH 线程时立刻写 prepare progress
- [x] 3.2 DSH resume：订阅页事件 → parse / hydrate / finalize；阶段之间 yield
- [x] 3.3 Grok / Kimi / Pi 走同一 JS 阶段（无页事件时停在 session 直到 IPC 返回）

## 4. Verify

- [x] 4.1 受影响 Vitest：surface / spine / progress / equality / events
  - 10 files / 110 tests 全绿（含 HistoryLoadingSurface、progress model、DSH subscribe、events、historyLoaders、sidebar-cache、hydration、lightweight）
- [x] 4.2 红线：虚拟化仍关；800/300/80 不变；Shared 现有 restore 单测仍绿
  - `shouldVirtualizeTimelineRows` 恒 false；`THREAD_ITEMS_FIRST_PAINT_COUNT=300` / `THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE=800` / `DEFAULT_HISTORY_WINDOW_SIZE=800` / `CLAUDE_UI_HISTORY_WINDOW=80`
  - virtualization + dispatch progressive + history window + Shared restore：5 files / 54 tests 全绿
- [ ] 4.3 本地超大会话手测：打开幕布能看到页号或阶段在动（手动）
