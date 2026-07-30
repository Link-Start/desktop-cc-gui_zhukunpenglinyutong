# Proposal: fix-messages-scroll-echo-follow-loss

## Why

会话流式输出期间视口偶发"跳到最开头"，用户需手动拉回底部。根因：内容高度塌缩（发送消息触发虚拟化 48→16 门槛翻开 / live 尾窗裁剪）→ 浏览器钳位 `scrollTop` → WKWebView 异步派发的钳位/收敛写入回声 scroll 事件被 `updateAutoScroll` 误判为"用户主动上滚"→ `autoScrollRef` 翻 false 且收敛 run 被杀 → 跟随永久解除，视口滞留在塌缩位置。

现有回声豁免只在收敛 run 活跃期生效（`activeProgrammaticEdge != null`），run 结束/被杀后迟到的回声事件 100% 误判；且浏览器钳位目标值（塌缩后的新 max scrollTop）可能从未被任何观察/写入记录，钳位事件直接逃出指纹环。

## What Changes

- `messagesScrollEcho.ts`：把 number-only 指纹升级为带独立 `recordedAt` 与 `source` 的 bounded fingerprint ring；回声判定只接受同一条未过期指纹，禁止用全局时间戳续活整环旧值。
- `useMessagesScrollController.ts`：只有 convergence 实际改变 `scrollTop` 时才记录 `write` fingerprint；no-op frame observation 不得开启 post-write grace；切换 `renderScopeKey` 时清空 fingerprint 与输入租约。
- `MessagesCore.tsx`：ResizeObserver 通过前后 geometry snapshot 识别真实 height-collapse clamp，只在 `maxScrollTop` 收缩且旧位置越界时记录 `clamp` fingerprint；wheel、keyboard、touch 与 pointer/scrollbar 产生的近期 user intent 优先于 echo heuristic。
- corrective containment：product owner 复验确认 render-weight threshold 仍会触发 static → virtual coordinate handoff，并在 TanStack virtualizer attach 时把既有位置重置为默认 `initialOffset=0`。在该 transition contract 被独立修复前，硬禁用 adaptive timeline rendering：不显示 lightweight prompt、不生成 summary row、不启用 row-count/render-weight virtualization，所有消息行统一走 static full-detail rendering。
- 测试：使用 fake clock / deterministic rAF 明确证明“实际 write → run complete → grace 内迟到 echo”；补 no-op observation、旧指纹续活、keyboard/touch/pointer 用户意图优先和 scope 清理反例。
- 非功能约束：不改流式期“用户上滚即解除跟随”语义；fingerprint 只是程序化来源证据，不能覆盖已观察到的 user intent。

## 目标与边界

- 目标：以 causal fingerprint + user-intent precedence 消除“收敛 run 完成后迟到回声误杀跟随”与“钳位事件逃出指纹环”两条路径；在 adaptive rendering coordinate handoff 未修复前，以 single authoritative kill switch 保证画布不再切换坐标系。
- 边界：改动限定在 messages feature；不删除 virtualization/lightweight 历史实现，不调整 threshold 数值，而是在行为入口 fail closed 到 static full-detail rendering。

## 非目标

- 不修补或调参 `messagesTimelineVirtualization.ts` 的阈值/滞回/remeasure 算法；本次直接关闭其 runtime enablement。
- 不依赖 `scrollend` 作为正确性前提；当前 WebView 缺少稳定 `scrollend` 时仍由明确输入事件租约保护用户控制权。
- 不处理 Shared Session 侧的数据源问题（shared projection 的 item churn 是独立变更 `restore-shared-queue-fusion-compaction-continuity` 的范围）；本修复经共享渲染管线同时惠及 native 与 shared。

## 方案取舍

- **选项 A（采用）**：causal fingerprint（per-entry timestamp/source）+ geometry clamp detection + user-intent precedence。优点：同时关闭迟到 echo false negative 与真实用户滚动 false positive，不依赖全局 grace 猜来源；缺点：比 number-only ring 多维护一个小型输入租约与 geometry snapshot。
- **选项 B（已否决）**：收尾 repin 守卫改用"仅 wheel 上滚"的显式用户意图 ref。缺点：裸 scroll 事件（键盘 PageUp/触屏拖拽/滚动条）上滚的用户会在回合结束时被强制拽回底部，是用一个 bug 换另一个 bug；既有测试 `does not re-pin on settle back-fill when the user has scrolled up` 编码的语义会被破坏。
- **选项 C（corrective containment 采用）**：硬禁用 adaptive timeline rendering，统一 static full-detail。优点：彻底消除 static ↔ virtual coordinate handoff 与 summary hydration 引发的锚点漂移；缺点：超长/重型对话重新承担完整 DOM、Markdown 与 layout 成本。该取舍已获 product owner 明确授权。

## 验收标准

- 新增组件回归必须先制造实际 `scrollTop` write、显式确认 convergence complete，再在 per-entry grace 内派发迟到 echo；旧实现必失败、新实现通过。
- no-op convergence 不得生成 post-write grace；一次新 write 不得续活环内旧 fingerprint。
- grace 内的 keyboard/touch/pointer/scrollbar user intent 必须覆盖 fingerprint match 并释放跟随。
- 任意 row count/render weight、streaming/idle、manual/oversized 状态都不得启用 virtualization 或 lightweight summary；prompt 不得出现，所有 message anchor 必须存在于 static DOM，并由既有 geometry-based anchor jump 直接定位。
- 相关增量测试覆盖 helper、convergence、ScrollControl 与 Messages live behavior，特别是 wheel-up 释放、流式期上滚释放、活跃/run 后回声、clamp、输入租约与切会话清理；按 product owner 授权不执行 messages 全量测试。
- `npm run typecheck` 与改动文件 ESLint 零告警。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `conversation-live-message-canvas-rendering`: 流式期底部跟随的存活契约增强——程序化滚动回声（含收敛 run 完成后 grace 窗口内的迟到事件与浏览器钳位事件）MUST NOT 被判定为用户上滚而解除跟随。

## Impact

- 代码：`src/features/messages/orchestration/scrolling/messagesScrollEcho.ts`、`src/features/messages/orchestration/hooks/useMessagesScrollController.ts`、`src/features/messages/components/MessagesCore.tsx`、`messagesTimelineVirtualization.ts`、`messagesConversationLightweightMode.ts`。
- 测试：`messagesScrollEcho.test.ts`（新增）、`Messages.live-behavior.test.tsx`、`Messages.virtualized-jump.test.tsx` 与相关 policy/helper tests。
- 渲染面：native 与 shared 会话共用同一 Messages/MessagesCore 渲染管线，两者同时受益。
- 无 API / 存储 / 依赖变更；无 BREAKING。性能影响：重型历史采用 eager full-detail rendering，后续重新启用前必须先建立 coordinate handoff regression。
