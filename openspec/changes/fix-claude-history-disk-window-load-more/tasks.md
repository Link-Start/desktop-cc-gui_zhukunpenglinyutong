# Tasks: fix-claude-history-disk-window-load-more

## 1. 基线与索引

- [x] 1.1 [P0] 跑 P0 基线测试并记下既有失败。Input: plan §6.3 命令。Output: 失败集记录（避免回归归因混淆）。Validation: 命令跑完，失败列表写入会话/Progress Log。
- [x] 1.2 [P0] 在 `openspec/changes/README.md` 登记本 change。Input: 本目录 artifacts。Output: active 表新增一行。Validation: 链接可点。

## 2. 芯片可见（磁盘 hasMore）

- [x] 2.1 [P0][depends:1.1] 芯片可见条件纳入 `historyWindowByThread.hasMore`。Input: `MessagesCore.tsx` L1745–1746、`MessagesTimeline.tsx` L580–586。Output: 仅磁盘 hasMore 时芯片仍出现；本地 N>0 保持 `showEarlierMessages`。Validation: 新增/更新 Messages 历史窗测试。
- [x] 2.2 [P0][depends:2.1] 仅 hasMore 时用存在性文案，不编造剩余 N。Input: 各 locale `messages.ts`。Output: 新 i18n key（如 `messages.loadEarlierMessages`），生产路径无硬编码中文。Validation: 中英至少两份 locale + 芯片渲染断言。

## 3. Requester：pending 优先，然后磁盘 before

- [x] 3.1 [P0][depends:1.1] 升级 `setOlderHistoryRequester`：pending 空且 hasMore+cursor 时受理磁盘页。Input: `useThreadActionsResumeThread.ts` L160–178、`olderHistoryRequestBridge.ts`。Output: 同步返回 boolean 表示受理；内部 async `loadClaudeSession({ limit: 80, before })` → prepend + `setThreadHistoryWindow`。Validation: requester 单测（pending 优先 / 打 before / 去重）。
- [x] 3.2 [P0][depends:3.1] in-flight 锁 + generation 取消 + 失败可重试。Input: 已有 `resumeRequestGenerationByScopeRef`。Output: 同 cursor 不双载；切会话丢弃迟到页；失败不改 hasMore。Validation: 单测覆盖连点、切会话、失败重试。
- [x] 3.3 [P0][depends:3.1] `tryLoadOlderHistoryPage` 去掉「必须 memory pending」早退。Input: `MessagesCore.tsx` L550–568。Output: pending 或 disk hasMore 即可拍 snapshot 并 `requestOlderHistory`。Validation: 80+hasMore 点击能受理。

## 4. 滑顶同一路径 + 视口恢复

- [x] 4.1 [P0][depends:3.3] **已回写（2026-08-18）**：`handleCanvasScroll` 不再因接近顶部自动翻页。Input: `MessagesCore.tsx` scroll handler。Output: 上翻只更新锚点；芯片 / All 才走 `tryLoadOlderHistoryPage`；回顶按钮仍只 `scrollTo(0)`。Validation: 生产路径无 `shouldRequestOlderHistoryNearTop`；`isNewTailUserMessage` 单测覆盖 prepend 不吸底。
- [x] 4.2 [P0][depends:3.1] 磁盘页 prepend 复用 expansion snapshot，禁止吸底。Input: `readHistoryExpansionScrollSnapshot` / `restoreHistoryExpansionScrollPosition`。Output: 磁盘完成前/后按同一套恢复；先 `pauseFollow`。Validation: 现有 history-expansion 测试不回退；补磁盘页 restore 用例。

## 5. 回归与手测

- [x] 5.1 [P0][depends:2.2,3.2,4.2] 跑 plan §6.3 P0 测试 + 本 change 新增测试。Input: 同基线命令 + 新文件。Output: 失败集不扩大。Validation: vitest 退出码 0 或仅记录既有红。
- [x] 5.2 [P0][depends:5.1] 回写 plan Progress Log / Todo（T0–T4）。Input: 本 change 证据。Output: `docs/plans/2026-08-18-conversation-curtain-history-missing-and-order.md` 勾选 T0–T4。Validation: 文档与 tasks checkbox 一致。
- [ ] 5.3 [P1] 真机手测一条 >80 的 Claude Native 会话。Input: plan T5 / 验收 §6.1。Output: 顶是尾窗起点 → 芯片或滑顶能继续往前 → 翻到头芯片消失。Validation: 用户手滑；本环境未测前保持未勾选。

## 明确不做

- 不改 `CLAUDE_UI_HISTORY_WINDOW` 为全量。
- 不修 Bug B（另开 `fix-canvas-user-bubble-stack-and-merge-order`）。
- 不 commit（plan §0）。
