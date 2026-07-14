## Context

当前 message surface 由多个触发点直接写滚动位置：`Messages` live effect、content `ResizeObserver`、`MessagesTimeline` scope reset，以及 `ScrollControl` 私有的逐帧动画。单次 `scrollTop`/`scrollIntoView` 写入无法覆盖 TanStack Virtualizer 的迟到测高和 content-visibility 布局；任何后写入者都可能把 viewport 推离 true bottom。约束是保留全部触发语义、用户 scroll-away 与 top navigation，同时不把高频 delta 带回 React root state。

## Goals / Non-Goals

**Goals:**

- 一个 feature-local primitive 统一解析 top/bottom target、逐帧追踪与 stable-frame completion。
- `Messages` 成为 scroll convergence 的唯一 owner，集中持有 cancel handle；其他组件只发出 intent callback。
- auto-follow 使用 instant motion，用户 icon 使用 smooth motion，但共享 target 与 completion contract。
- virtualizer 在首次写底后修正 `scrollTop` 时，仍能被同一 convergence run 追回。
- 保留 wheel-up/manual scroll-away 的即时取消语义。

**Non-Goals:**

- 不改变 ScrollControl UI、anchor rail、history expansion 或 virtualizer threshold。
- 不引入 external dependency、global store 或 engine-specific branch。
- 不把滚动帧进度写入 React state。

## Decisions

### Decision 1: 提取 DOM-level convergence primitive，而非模拟 UI click

新增纯 DOM helper，输入 container、edge、motion 和 completion callback，返回 cancel function。每帧重新读取 `scrollHeight/clientHeight/scrollTop`；bottom target 始终为 `scrollHeight - clientHeight`，连续稳定帧后结束。

替代方案是从 `Messages` 触发隐藏 button click。拒绝，因为 button 可能未挂载、direction 可能为 top，且 UI state 不是稳定 API。

### Decision 2: Messages 持有唯一 active convergence run

`Messages` 用 ref 保存当前 cancel handle。任何新 intent 先取消旧 run，再启动新 run。`ScrollControl` 与 `MessagesTimeline` 通过 callback 请求，不再各自创建动画或直接写 `scrollTop`。

替代方案是让每个组件共享 helper 但各自运行。拒绝，因为多个 rAF loop 仍可能互相覆盖，不能解决 ownership。

### Decision 3: 保留触发点，统一执行路径

- history loaded：instant bottom convergence，并保留 initial follow window。
- live/working/finalizing：instant bottom convergence。
- rendered height resize：在 follow armed/window 内请求 instant bottom convergence。
- turn settle：保留 settle window，迟到 resize 继续请求统一 convergence。
- timeline scope reset：remeasure 前后发出同一 bottom intent。
- floating control：top/bottom 均请求统一 convergence；bottom re-arm、top release。

这避免删掉现有修复积累下来的触发能力，只消除重复执行算法。

### Decision 4: 用户输入优先于自动 convergence

wheel-up 在滚动实际发生前同步 release follow，并取消 active convergence；普通 scroll event继续按 near-bottom 判定 re-arm/release。显式 bottom command 可以重新武装，top command 必须解除。

### Decision 5: 生命周期 intent 决定延迟复查的权限边界

统一 owner 区分 `history-open`、`live-follow`、`turn-settle` 与 `explicit-control`。历史初始化属于页面落位，不受“焦点跟随”开关约束；live 与 settle 属于持续跟随，只在开关启用且用户仍停留底部时运行；显式浮标始终执行一次，但不修改持久化跟随开关。

history-open、live-follow、turn-settle 与工作中重新开启焦点跟随使用同一 convergence primitive 的延迟复查能力，在立即写入后于 100ms、300ms、1000ms、2000ms 重新解析 true bottom。history 与 settle lifecycle window 为最终 checkpoint 保留 timer jitter 余量，避免 deadline 与 timer 同为 2000ms 时因实际回调稍晚而提前失效。延迟任务、逐帧 run 和 completion 共享一个 cancel handle，切会话、手动上滚、top navigation 或关闭焦点跟随时按 intent 取消，避免迟到任务夺回用户控制权。

### Decision 6: 到位状态零写入，同 intent 不重启

convergence 每帧仍读取最新 geometry，但只有距离目标超过 tolerance 时才写 `scrollTop`。已经到位的 stable frame 只计数，不产生 `scroll` event。同一 edge/motion/intent 已由 owner 管理时，来自 Timeline effect 或 ResizeObserver 的重复请求直接复用当前 run，不取消并重建 checkpoint 序列，避免 `scroll -> anchor state -> timeline measure -> scroll intent` 形成更新环。

### Decision 7: active-first 初始化只认 scope，不等待 turn settle

history content 首次可用时立即登记 scope 并执行一次 initial placement，即使该会话当时仍处于 working/thinking。初始化不能推迟到 thinking 下降沿，否则用户在 active turn 中主动 scroll-away 后，settle render 会被误判为“历史尚未落位”并重新开启 auto-follow。后续 turn settle 只服从 focus-follow 与当前 parked-at-bottom 状态，不再承担补做 history initialization 的职责。

### Decision 8: scope transition 重置 history placement，settle intent 在 layout phase 锁定

`Messages` 在 AppShell 中持续挂载，关闭并重开同一会话实际是 `thread A -> null -> thread A`，不是 component remount。因此 conversation scope transition 必须同时取消旧 convergence 并清空 `initialBottomPinScopeRef`；只比较 `workspaceId + threadId` 会把第二次 A 误判为已完成初始化。

turn settlement 使用 `useLayoutEffect` 捕获 `isThinking: true -> false`。完整 timeline back-fill、virtualizer correction 与 lightweight/heavy-row hydration 可能在 passive effect 前改变 geometry；settle intent 必须先于这些异步 scroll/resize signals 启动，避免把布局造成的离底误判为用户 scroll-away。真实 wheel-up、top navigation、anchor jump 与 focus-follow disable 仍走既有 cancel contract。

### Decision 9: 程序化滚动回声指纹环，虚拟化 OFF↔ON 翻转按落位处理

发送消息使 `isWorking` 翻真时，虚拟化门槛从 48 降到 16、live 尾窗裁剪同时生效：timeline 总高度先塌缩到估高之和（长回复估高封顶 260px，真实常上千），浏览器钳位 `scrollTop`，随后重测回填真实高度。WebKit 的 scroll 事件异步派发，钳位/收敛写入产生的事件可能在几何回填之后才送达——此刻按 near-bottom 判定会把程序化回声误判成用户上滚，解除跟随并杀掉收敛 run，视口滞留半空（表现为发送第二条消息后跳顶，幅度随估高误差不定）。

处理：`Messages` 维护跨 run 的程序化 scrollTop 指纹环，收敛帧读/写、请求合流读取、内容高度回调都吸收当前位置；活跃 instant 收敛期间，事件位置命中指纹按回声豁免（保持武装），未命中才是真实用户滚动（拖滚动条/触摸/翻页键），沿用既有释放语义。wheel 的同步释放契约不变。同时虚拟化 OFF↔ON 翻转视作一次布局落位：scope-reset resolver 增加 `shouldPinBottomWhenArmed`，翻转时若用户仍 parked 在底部（`autoScrollRef`），通过 `history-open` 契约（不受焦点跟随开关约束）请求一次统一收敛并重新武装 lifecycle window。

替代方案是活跃 run 期间无差别豁免所有 scroll 事件。拒绝，因为流式期 run 几乎持续活跃，滚动条拖拽/触摸将无法逃逸（重蹈「滚不走」）。

## Risks / Trade-offs

- [Risk] 每帧读写 scroll geometry 可能增加 layout cost → 只在 active convergence 窗口运行，连续稳定 3 帧即停止；auto mode 直接落位，不做长 smooth animation。
- [Risk] ResizeObserver 高频触发反复重启预算 → owner 先取消旧 run，始终只有一个 rAF；稳定判定基于最新 geometry。
- [Risk] Timeline callback identity 变化导致 effect 重跑 → callback 使用 `useCallback` 保持稳定，并纳入 effect dependencies。
- [Risk] 程序化 scroll event 被误判为用户离开 → near-bottom 判定保持现有语义，wheel-up 才是同步的明确 release signal。
- [Risk] 固定延迟复查可能在用户离开后迟到执行 → 每个 checkpoint 执行前重新检查 scope、焦点跟随和 `autoScrollRef`，并由同一 cancel handle 清理 timer/RAF。
- [Risk] 2s checkpoint 与 2s lifecycle deadline 同值时 timer jitter 会使 guard 先过期 → lifecycle window 使用 2400ms，给最终 checkpoint 留出 bounded 余量。
- [Risk] Persistent `Messages` instance 会保留同 thread 的 one-shot ref → scope transition 主动清空 placement ref，并以 `A -> null -> A` regression 锁定。
- [Risk] settle passive effect 晚于 back-fill geometry signals → 使用 layout effect 在 commit 后、paint/async scroll event 前启动统一 convergence，不新增第二个 scroll writer。

## Migration Plan

1. 先增加 convergence helper 与 unit coverage。
2. 将 `ScrollControl` 私有动画替换为 intent callback，保持 DOM/CSS/i18n 不变。
3. 在 `Messages` 建立唯一 owner，并逐个迁移既有触发点。
4. 将 `MessagesTimeline` 的直接 bottom write 替换为 owner callback。
5. 运行 focused tests、typecheck、OpenSpec strict validation，再启动本地 dev server 供人工测试。

Rollback 可整体回退本 change 的 helper/callback wiring；无 data migration 或 backend rollback。

## Open Questions

无。真实 WebView 上若仍有超过 convergence budget 的媒体迟到布局，应基于 runtime evidence 单独调整 quiet/max budget，而不是恢复多 owner。
