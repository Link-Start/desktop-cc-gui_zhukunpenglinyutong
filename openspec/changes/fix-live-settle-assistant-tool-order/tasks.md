## 1. Reducer settlement lookup（P0 · 阶段1 校准完成 · 待人工 review）

- [x] 1.1 新增 `findAssistantMessageIndexForLiveSettlement`（`append` / `complete` 双 mode）
- [x] 1.2 `appendAgentDelta` + `applyCompleteAgentMessageToState`（含 `completeAgentMessage` / `flushAgentCompletedBatch` 共用）接入 settlement lookup
- [x] 1.3 单测：helper + late complete after `resetAgentSegment` 不并回 pre-tool bare id
- [x] 1.4 对抗 review 修复：append 缺失 `-seg-N` 时 return -1 建壳（禁止回落裸 base）
- [x] 1.5 阶段1 校准：去掉 `useThreadsReducer` 未使用的 `findAssistantMessageIndexByPrefix` import
- [x] 1.6 阶段1 校准：补 late `appendAgentDelta` after reset + `flushAgentCompletedBatch` after reset 回归

## 2. Late tool 插入 / rebalance（P0b · 针对 Grok 手测复现）

- [x] 2.0 `upsertItem`：新 tool 在 trailing **final** assistant 前插入（不打断 non-final preamble）
- [x] 2.0b `rebalanceTrailingToolsBeforeFinalAssistants`：complete / markLatestFinal 后把尾部 tools 拉回结论前
- [x] 2.0c 单测：late tools before final、mid-stream 不抢 preamble、rebalance 多 tool 尾

## 2b. 事件层 / channel（P1 增强 · 可选）

- [ ] 2.1 （可选）channel 记 `durableItemId` / `segmentAtBind`
- [x] 2.2 保持 tool start：`drain` → `incrementAgentSegment`；既有 `liveTextSegment` 回归绿
- [ ] 2.3 （可选）complete clear 前若 channel 更长则 drain 同目标
- [ ] 2.4 （可选）thread 级 `lastBoundDurableAssistantId`

## 3. Turn settlement 时序

- [x] 3.1 现有 `onTurnCompleted` 已是 drain → … → `resetAgentSegment`（H1 不依赖改序即可止血）
- [ ] 3.2 Shared alias 手测确认双侧不交叉错挂
- [ ] 3.3 （可选）bounded diagnostics

## 4. 测试

- [x] 4.1 `threadReducerCoreHelpers.liveSettlement.test.ts`
- [x] 4.2 `useThreadsReducer.completed-duplicate` late complete / late append / flushBatch after reset
- [x] 4.3 focused：liveTextSegment + claude/completed fast-path + completed-duplicate + flush-batch 全绿（45）
- [ ] 4.4 （可选）complete 短 + channel 长 drain 用例

## 5. 文档与门禁

- [x] 5.1 分析文链到 OpenSpec change
- [x] 5.2 design/specs 按对抗 review 修正（lookup 为主，channel 为增强）
- [x] 5.3 `openspec validate fix-live-settle-assistant-tool-order --strict`
- [ ] 5.4 P0 手测：Shared Claude + Native Claude

## 6. 非目标自检

- [x] 6.1 未恢复 per-delta 根 reducer
- [x] 6.2 未把 history reload 当主路径
- [x] 6.3 未改 Grok jsonl 桥
