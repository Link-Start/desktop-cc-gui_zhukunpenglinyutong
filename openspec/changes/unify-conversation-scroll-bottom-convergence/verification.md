## Verification

### 通过项

- Late-render/focus-follow focused Vitest: 2 files passed, 52 tests passed.
- Expanded scroll/Codex/Claude focused Vitest: 8 files passed, 76 tests passed, 5 skipped.
- Focused Vitest: 6 files passed, 61 tests passed, 5 skipped.
- Codex / Claude shared-surface focused tests: 5 files passed, 23 tests passed.
- `npm run typecheck`: passed.
- Changed-file ESLint: passed.
- `git diff --check`: passed.
- `openspec validate --all --strict --no-interactive`: 404 passed, 0 failed.
- `npm run check:large-files`: report mode completed without新增本变更违规。

### Late-render / focus-follow closure

- History-open checkpoints: immediate + 100ms + 300ms + 1000ms + 2000ms，独立于 focus follow preference。
- Live/turn-settle checkpoints: 受 focus follow、`autoScrollRef` 与 bounded deadline guard 约束。
- Cancel contract: focus-off、manual scroll-away、top navigation、thread switch 同时清理 timer 与 RAF。
- Final typecheck、changed-file ESLint、`git diff --check` 与 OpenSpec strict validation 均通过。

### Render-loop hardening

- Root cause risk: stable checkpoints previously assigned the same `scrollTop` repeatedly, allowing `scroll -> anchor state -> timeline measure -> scroll intent` feedback under real WebView timing.
- Stable edge now produces zero DOM writes; duplicate same-intent requests are coalesced only while already at the requested edge. Geometry growth still triggers an immediate new run.
- Messages/helper focused tests: 54 passed.
- Expanded messages/AppShell/router tests: 80 passed, 5 skipped; standalone AppShell/router startup tests: 13 passed.
- Typecheck、changed-file ESLint 与 `git diff --check` passed.

### Active-first / 2s final calibration follow-up

- active-first history placement 不再等待 working/thinking 结束；scope 首次落位后，用户 scroll-away 在 settle 阶段保持有效。
- Automatic bottom intents 保留 immediate feedback，并追加 2000ms final checkpoint；history/settle lifecycle window 使用 2400ms，避免 timer jitter 提前击穿 guard。
- Checkpoint regressions 使用 controlled timers，覆盖 2s late growth、focus-follow cancel 与 active-first settle scroll-away。
- Helper / Messages / ScrollControl focused Vitest: 3 files passed, 61 tests passed。
- Codex / Claude shared surface、history loading、AppShell startup、router expanded Vitest: 8 files passed, 84 tests passed。
- `npm run typecheck`、changed-file ESLint、`git diff --check`: passed。
- `npm run check:large-files`: report mode completed；列出的 5 个既有超限文件均不属于本变更。
- `openspec validate --all --strict --no-interactive`: 404 passed, 0 failed。

### Same-thread reopen / multi-turn settlement follow-up

- Persistent canvas lifecycle: scope transition now clears one-time history placement, covering `thread A -> null -> thread A` without requiring component remount or history loading。
- Settlement ordering: `isThinking: true -> false` is captured in layout phase so back-fill geometry cannot preempt the unified bottom request。
- Lightweight parity: oversized automatic lightweight presentation reopens at true bottom while retaining its render-budget UI and hydration policy。
- Focused reopen/settle/virtualization Vitest: 3 files passed, 62 tests passed, 5 skipped。
- Expanded Codex/Claude/history/lightweight/AppShell/router Vitest: 9 files passed, 91 tests passed, 5 skipped。
- `npm run typecheck`、changed-file ESLint、`git diff --check`: passed。
- `npm run check:large-files`: report mode completed；列出的 5 个既有超限文件均不属于本变更。
- `openspec validate --all --strict --no-interactive`: 404 passed, 0 failed。

### 非本变更 blocker

- Full `npm run test` 在 `src/features/app/components/Sidebar.test.tsx` 稳定出现 3 个既有断言失败；单文件复跑结果一致（44 passed, 3 failed）。失败集中于 bottom action order 与 `menuitem` / `menuitemradio` role contract，不涉及 messages scroll 代码。
- Large-file report 仍列出仓库已有文件；本变更新增 helper 与 tests 未进入违规清单。

### 人工验收

- Vite dev server 已启动：`http://127.0.0.1:1420/`。
- 待人工验证 history-open、turn-settle、manual scroll-away、floating top/bottom control。

### Send-time layout-shock / programmatic-echo follow-up

- 根因：发送消息翻转 isWorking 时虚拟化门槛 48→16 以空缓存翻开（或 live 尾窗裁剪），总高度塌缩→钳位→回填；异步派发的程序化 scroll 事件在回填后送达，被 near-bottom 判定误判为用户上滚，解除跟随并取消收敛 run，视口滞留半空。
- 修复：程序化 scrollTop 指纹环（收敛帧/请求合流/内容高度回调吸收），活跃 instant 收敛期间仅指纹命中按回声豁免；`resolveVirtualizedTimelineScopeReset` 新增 `shouldPinBottomWhenArmed`，虚拟化 OFF↔ON 翻转按 armed 落位（history-open 契约，独立于焦点跟随开关）。
- Regression: `keeps following when a programmatic-echo scroll event lands after late geometry growth`（live-behavior）；resolver flip-on/flip-off 落位用例（virtualization helper）。
- Focused Vitest: live-behavior 51 passed; scroll/virtualization/history/jump 扩展面 9 files, 125 passed, 5 skipped。
- `npm run typecheck`、changed-file ESLint: passed。

### Flip-open remeasure rAF lifecycle follow-up

- 症状：发送第二条消息后，新用户气泡与 working 计时器叠在上一条长回复正文中间，首个 delta 到达后自愈（数秒）。
- 根因：scope-reset effect 的翻开重测 rAF 挂在 per-run cleanup 上；发送瞬间 isThinking/isWorking/scope key 同帧连续变化，cleanup 在 rAF 执行前吊销它，而 resolver 首翻信号已消费、工作态分支拒绝重排——重测丢失，行保持估高摆放直到 liveRowRemeasure。
- 修复：rAF 句柄迁移到 `scopeResetRemeasureRafRef`（与 hydration/liveRow 重测同惯用法），新调度替换旧调度，仅在切会话与卸载时取消。
- Regression: `keeps the flip-open remeasure alive across same-frame dependency churn`（virtualized-jump；已验证恢复旧 cleanup 时该测试失败）。
- Focused Vitest: 8 files, 117 passed, 5 skipped；`npm run typecheck`、changed-file ESLint: passed。
