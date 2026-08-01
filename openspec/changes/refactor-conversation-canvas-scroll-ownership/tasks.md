# Tasks: refactor-conversation-canvas-scroll-ownership

## 1. OpenSpec artifacts

- [x] 1.1 proposal / design / specs / tasks
- [x] 1.2 `openspec validate refactor-conversation-canvas-scroll-ownership --strict`

## 2. Pure authority core

- [x] 2.1 `scrollAuthorityConstants.ts` 字面量
- [x] 2.2 `scrollAuthorityTypes.ts` Mode/Intent/Geometry/Ticket
- [x] 2.3 `scrollWriteTicket.ts` 签发 / applied ring
- [x] 2.4 `scrollAuthorityMachine.ts` 仲裁 / 稳态 / 退役 / pin 决策
- [x] 2.5 单元测试 `scrollAuthorityMachine.test.ts`（15）

## 3. Controller integration

- [x] 3.1 `useMessagesScrollController` 持有 authority state
- [x] 3.2 turn-send / turn-settle 进入 forced（history-open 仍 legacy deadline 双跑）
- [x] 3.3 wheel 明确上滚打断 forced；噪声不打断
- [x] 3.4 RO 几何更新：forced/stick 追底；稳态/safety 退役；回底 re-arm
- [x] 3.5 ticket applied 记录与程序回声协同
- [x] 3.6 **pinCanvasToBottom 统一原语**（与 ScrollControl 同通道）：send/settle/history-open/history-restore/explicit/focus-rearm
- [x] 3.7 **continueBottomPinIfArmed**：Resize 只继续追，不 clearUserScrollIntent
- [x] 3.8 **Claude/Codex finalizing 收敛**：`isAssistantFinalizing` 起止 pin + `finalizingPresentationActive` 禁假稳退役
- [x] 3.9 **MIN_FORCED_HOLD** = max(SETTLE_REPIN, CODEX_FINALIZING 6s)，覆盖 Claude 320ms 与 Codex 6s
- [x] 3.10 deferred 条数增长 / 同 thread 虚拟化 remeasure 再 pin

## 4. Regression

- [x] 4.1 machine 单测绿（15）
- [x] 4.2 messagesScrollConvergence / messagesScrollEcho 绿
- [x] 4.3 Messages.live-behavior 绿（67）
- [x] 4.4 typecheck 绿

## 5. Self-review gates

- [x] 5.1 对照 DESIGN：A/F Owner、§3.4.1 仲裁、稳态/safety、ticket ring 已落；Phase3 未做完整 chrome/media pending 接线（machine 已支持 kind，RO 现映射 grow/shrink/measure-late）
- [x] 5.2 不 git commit（用户要求）

## 6. Human QA（完成后通知）

- [ ] 6.1 A：发送不飞顶
- [ ] 6.2 F：结束后贴真底（跟随开/关）
- [ ] 6.3 上滚释放 / 回底恢复
