# Tasks: fix-messages-scroll-echo-follow-loss

> 1~4 节记录第一版实现与当时证据；review 发现其 causal ownership 未闭环后，
> 当前 authoritative corrective work 位于第 6 节。历史 checkbox 保留审计轨迹，
> 不表示旧设计仍是最终 contract。

## 1. 回声判定核心

- [x] 1.1 新增 `orchestration/scrolling/messagesScrollEcho.ts`：`isProgrammaticScrollEcho`（活跃 run 或写入后 350ms grace 内命中指纹环）+ `resolveClampTargetScrollTop`
- [x] 1.2 `useMessagesScrollController.ts`：`lastProgrammaticScrollWriteAtRef` 在 convergence `onFrameObservation` 打点；切会话时清零时间戳并清空指纹环（review finding 修复）

## 2. MessagesCore 接线

- [x] 2.1 `updateAutoScroll` 改用 grace 感知回声判定；回声落底部（near-bottom）时武装跟随
- [x] 2.2 ResizeObserver 回调预录钳位目标值进指纹环
- [x] 2.3 已知残余面（grace 内键盘/触屏命中中间帧指纹）在代码注释显式承认

## 3. 测试

- [x] 3.1 新增 `messagesScrollEcho.test.ts`：8 个单测（grace ±1ms 边界、tolerance ±1px、零写入基线、钳位目标计算）
- [x] 3.2 新增组件回归 `keeps following when a fingerprinted echo arrives after the convergence run completes`（旧实现必失败）
- [x] 3.3 既有测试全量回归：`src/features/messages` 72 文件 / 641 用例通过（review 重跑校准）
- [x] 3.4 新增组件回归 `clears echo fingerprints on thread switch so stale positions are not exempted`（第二轮 review major：跨会话清理的 discriminating 测试）

## 4. 质量门禁与审查

- [x] 4.1 `npm run typecheck` 通过；改动文件 ESLint 零告警
- [x] 4.2 独立 review 一轮：1 minor（指纹环跨会话残留，已修）+ 2 nit（时序裕度注释、分支覆盖注释，已处理）
- [x] 4.3 独立 review 二轮：1 major（跨会话清理缺测试，已补 3.4）+ 指纹环容量 16→32 全环去重（防 RO 预录 churn 挤出中间帧指纹）+ 时序间隙/后台节流注释与 design 风险记录
- [x] 4.4 语义收窄：否决"收尾 repin 仅 wheel 上滚守卫"方案（会破坏裸 scroll 事件上滚语义），回退后 diff 仅保留根因修复

## 5. 人工验收（待用户执行）

- [ ] 5.1 实机验证：长会话（>48 行）发送消息，流式期间视口保持贴底不跳顶
- [ ] 5.2 实机验证：流式期 wheel 上滚后跟随释放、滚回底部恢复跟随（回归旧语义）
- [ ] 5.3 实机验证：shared 会话（compaction 进行中）同样不跳顶

## 6. Review corrective implementation（完整修复）

- [x] 6.1 修订 proposal/design/spec：以 per-entry causal fingerprint、geometry-proven clamp 与 user-intent precedence 替代全局 grace 猜测
- [x] 6.2 `messagesScrollEcho.ts`：fingerprint 携带独立 timestamp/source；新证据不得续活旧 fingerprint；no-op observation 不生成 post-write grace
- [x] 6.3 `useMessagesScrollController.ts` / `MessagesCore.tsx`：只记录 actual write；基于前后 geometry 识别真实 clamp；scope switch 清理全部 transient ownership
- [x] 6.4 `MessagesCore.tsx`：wheel、scrolling-key、touch、pointer/scrollbar user-intent lease 优先于 echo heuristic，并保持 near-bottom re-arm
- [x] 6.5 deterministic tests：actual write → run complete → delayed echo；no-op、stale fingerprint、user intent、clamp Good/Base/Bad 与 thread switch
- [x] 6.6 增量自动门禁：4 个相关 test files / 87 tests、typecheck、改动文件 ESLint、OpenSpec strict validation 全部通过；按用户明确授权不跑 messages 全量测试

## 7. Adaptive rendering containment（product owner 复验纠偏）

- [x] 7.1 更新 proposal/design/spec：记录 static → virtual 默认 `initialOffset=0` 的执行顺序根因，以及 correctness-first hard-disable 决策
- [x] 7.2 以 single authoritative kill switch 禁用 row-count/render-weight/streaming virtualization，所有 timeline rows 统一 static rendering
- [x] 7.3 禁用 suggested/oversized/manual lightweight policy，隐藏 prompt 并禁止 heavy-row summary hydration
- [x] 7.4 补充 full-detail + static anchor jump 回归，证明重型对话所有 anchor 均挂载且跳转不经过 `scrollToIndex`
- [x] 7.5 只执行相关增量 tests（7 files / 122 passed）、typecheck、改动文件 ESLint 与 OpenSpec strict validation；不跑全量测试
