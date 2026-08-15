---
type: analysis
status: implemented
---

# PR #1092 性能复盘：根因、解法与防再犯

> **读者**：后续改对话流式、AppShell、冷启动、Markdown、长历史渲染的人（人或 AI）
> **来源 PR**：[zhukunpenglinyutong/desktop-cc-gui#1092](https://github.com/zhukunpenglinyutong/desktop-cc-gui/pull/1092)（分支 `fix/performance-optimization`，2026-08-14 ~ 08-15）
> **这份文档回答三件事**：性能问题为什么会发生、PR 里怎么拆开修的、以后怎样防止再犯。
> **事实边界**：行为以当前代码、OpenSpec main specs 与重新测量为准。文中数字是 PR 当时的实测或压测门禁，不是永久 KPI。
> **前置阅读**：`docs/perf/render-jank-knife-experiments-2026-07-08.md`（四层根因框架）；冷启动禁令见 `dev-guidelines/guides/windows-cold-start-click-freeze-pitfall.md`。

---

## 0. 怎么读这份文档

| 你想知道 | 先看 |
|---|---|
| 30 秒结论 | §1 |
| 用户体感对应哪一层病 | §2、§3 |
| 某条战线改了什么、证据在哪 | §4 |
| 改代码前不能碰的红线 | §6 |
| 出问题怎么回退 / 怎么查 | §6.4、§6.5 |
| 哪些事还没做完，别把旧数字当现测 | §7 |

PR #1092 不是「修一个卡顿 bug」。它把 2026-07-08 刀实验之后**仍会复发**的几条结构病一次收口：流式电报继续打根、Markdown 全量重解析、长历史 DOM 线性膨胀、AppShell 单次合法更新太贵、Windows 冷启一点就假死。

体量参考（PR 元数据）：约 **+28k / -45k**，覆盖 frontend streaming、Markdown、AppShell 分域、冷启动编排、若干 Windows / 后台放大器。

---

## 1. 一句话结论

**主因不是「引擎事件太多」或「IPC 太慢」。**

真正贵的是这条乘法：

```text
高频更新源（每 token / 每条日志 / 秒级轮询）
  × 打到 AppShell 根（或打到会扇出全树的大 bag）
  × 单次根更新端到端 100~350ms（2026-07-08 历史测量）
  = 主线程被吃掉，用户看到卡顿 / 假死
```

2026-07-08 已经证明并修掉了第一波（A1–A4）：debug 日志缓冲、任务 store 事件化、git 改回合级刷新、**正文** delta 走 `liveAssistantTextChannel`。

PR #1092 修的是第一波之后的漏网：

1. **思考 / 工具输出** 仍逐条打根（A4 二期）。
2. **Markdown** 仍按全文重解析（流式单帧成本随正文变长）。
3. **长历史** 仍全量进 DOM（500 条 ≈ 1.3 万节点）。
4. **层 4 单价**：根 hook 链 2400+ 行、690-key bag、Assembly 订全量 snapshot。
5. **冷启动**：第一次点击被当成「可以开重活」的启动器；Windows WebView2 hit-test 必须等最新 layout。

**解法的共同模式**：高频数据离开根 reducer；合法低频更新把扇出面收窄；冷路径禁止用 timeout / first-click 当修复。

---

## 2. 问题全景：不是一个 bug，是四层结构病

2026-07-08 删除法实验把「对话卡、关对话还在渲」拆成四层。PR #1092 **没有推翻这个模型**，而是把它用完。

| 层 | 病因 | 用户怎么感觉 | 07-08 修到哪 | PR #1092 补了什么 |
|---|---|---|---|---|
| 1 | 数组 append 型 setState 挂在根（debug 日志） | 前后台都卡，关对话也渲 | A1：面板关只缓冲 | 未再复发；红线保留 |
| 2 | 引擎事件换 reducer 引用 → 全树重渲 | 流式越快越卡 | A4：正文走 channel | **思考/工具也走 channel**；Markdown 增量排版 |
| 3 | 秒级轮询双胞胎 + 消息活动打 git | 后台 Agent 空转也卡 | A2/A3：事件 + 30s 兜底 | 隐藏窗口停 git 轮询；背压改低频 timeout |
| 4 | **单次合法更新太贵**（commit 只占 ~15%，其余在 effects / style / layout） | 回合开始/结束仍顿一下；长历史越来越钝 | 未做（当时目标 &lt;30ms） | AppShell S4 + Host 拆分 + 历史窗口 + 冷启动错峰 |

旁支放大器（不是根因，但会把同一窗口放大成 P0）：

- **react-scan** 放大 2~3x。正式测量必须关。
- **Windows WebView2**：hit-test 等最新 layout；最小化后 `rAF` 停发；主线程默认 1MB stack。
- **冷启脆弱窗** = 主线程忙 + 早期 pointer + 上述 hit-test。入口会换（叉号 / 权限 / 模型位），根因不变。

```text
引擎 stdout / app-server
        │
        ▼
  批处理 / 背压（40ms + critical bypass）
        │
        ├─ 正文 delta ──► liveAssistantTextChannel（48ms publish）──► 单行 MessageRow
        ├─ 思考/工具 ──► liveItemDeltaChannel（48ms，三 lane）──► ReasoningRow / ToolBlock
        └─ 回合级结构 ──► threads reducer ──► 根 / Host ──► AppShell 装配
                                                      │
                                                      ▼
                                            历史窗口只裁 DOM
                                            IncrementalMarkdown 只重排尾 2 块
```

**设计意图**：热路径永远停在「单行 + 通道」；根只处理建壳、settle、改名、删会话这类回合级事件。

---

## 3. 性能问题产生的主要原因

下面按**用户体感**写。每一条都同时写「机制」和「为什么当时会做成这样」。

### 3.1 流式对话卡：热数据还在打根

**体感**：token 在来，整页掉帧；长思考 / 工具刷屏时更明显；严重时「先卡住，结束再一次性喷出来」（stall-then-flush）。

**机制**：

1. A4 一期只把 **assistant 正文** 从根 reducer 拿走。`reasoningContent` / `reasoningSummary` / `toolOutput` 仍经 32ms 批量 `dispatch`。长思考回合实测密度约 **30 条/秒**，每一批都换 `threads` state 引用。
2. 根当时仍直接 `useThreads`。一次引用变化 = 整条 AppShell hook 链重跑 + 大 bag 浅比较 + layoutNodes 全域扇出。
3. 即便正文已经进 channel，早期实现是**每 token 同步 notify**。再叠 `useDeferredValue` + Markdown `startTransition`，background render 会被持续输入反复打断——数据到了，DOM 不前进。07-30 已用 48ms cadence 修过正文；思考/工具在 #1092 才对齐。
4. Markdown 侧：每次 published 文本变长，`FullMarkdownRuntime` **整篇 re-parse + Prism 同步高亮**。历史记录过对话页 **5 FPS / 单组件 225ms**。正文越长，单帧越贵，这是 O(正文长度) 而不是 O(本帧增量)。

**为什么会再犯**：第一刀只修了「看得见的正文」。思考和工具输出字段分散、消费点多，被标成「二期」。二期之前，任何长 reasoning 回合都会把 A4 的成果打回去。

### 3.2 长会话越聊越卡：DOM 随历史线性涨

**体感**：老会话一打开或一回合结束就钝；滚动、贴图、diff 同时出现时更明显。

**机制**（2026-08-14 定标，真实 Markdown 混合会话）：

| 口径 | 数字 |
|---|---|
| 单条均值 | ≈ 19.4 个 DOM 节点（混合正文 / 工具 / diff / 代码块时约 20~26） |
| 500 条全量 | **13004** 节点，线性增长 |
| 150 条窗口 | ≈ **4876** 节点，有界 |

产品曾经把 `VISIBLE_MESSAGE_WINDOW` 提到 **10000**，有意关掉闲时数量折叠，避免和 stick-to-bottom / 虚拟化抢策略。结果是：日常会话几乎全量进 DOM。流式尾窗 `STREAMING_VISIBLE_WINDOW` 又必须保持 **0**——流式结束若从尾窗切回全量，上方会突然插回历史，scrollTop 相对往上走，和丝滑贴底冲突。

所以不能靠「恢复尾窗」或「恢复时间线虚拟化」偷懒。必须做**表现层窗口**：数据层 items 全量保留，DOM 只留最近一段。

### 3.3 一次合法更新也贵：层 4 结构税

**体感**：即使流式已经不那么刷屏，回合开始/结束、切会话、改 git、打字贴图，仍会顿一下。后台任务结算有时打到聊天布局。

**机制**（S4 PR-A 盘点，2026-08-14，commit `3970a5bf4` 之后）：

| 指标 | 当时实测 |
|---|---|
| `useAppShellRootComposition.ts` | **2420** 行，约 57 个自定义 hook |
| 15 域 bag keys | **690**（composer 141 / settings 147 / layout 103） |
| `layoutNodes` 订阅 | **15/15 全域** |
| 根是否订 `useThreads` | **是**（`:800` 直订） |

浅比较 `reuseStableAppShellDomainContexts` 按**整域**换引用。composer 141 keys 意味着：改一个输入字段，141 个 key 都要比一遍，订了这个域的 consumer 全重渲。

更糟的后续形态（S4 之后又暴露）：根 composition 拆成 Host 子树后，Assembly 一度 `useHostSnapshot()` / `subscribe('*')`。**任意 Host 切片一写，整棵视图重跑**，包括 Assembly 根本没读的流式热字段（`lastAgentMessageByThread`、`threadsController`）。这等于把 channel 外部化的成果，从另一扇门又灌回根。

层 4 的成本构成（07-08 探针）：一次根更新端到端 100~350ms，其中 **react-commit 只占约 15%**，其余在 passive effects、style recalc、layout、paint。所以「再 memo 一下」不够，必须减少「谁被这次更新叫起来」。

### 3.4 冷启动一点就假死：第一次点击在帮倒忙

**体感**（Windows 升级几乎必现）：

1. 自动弹出版本记录，前几秒点叉号 / 遮罩 / Esc，整窗假死约一分钟。
2. 没有弹窗时，进页后立刻点「权限选择」或任意可见控件，同样假死。
3. 等大约一分钟再点就好。

**这不是两个无关 bug，也不是「解冻闹钟」。** 「一分钟」对应 full-catalog 的 60s freshness / cooldown settle，不是 click-unfreeze timer。

已证实模型：

```text
冷启脆弱窗
  = 主线程忙（first-paint list / restore / ComposerImpl / Markdown 591KB compile / CSS cascade）
  + 早期 pointerdown / keydown
  + WebView2 hit-test 必须等最新 layout
```

生产 `StartupGateOverlay` **默认不挂**。用户前几秒点到的是真界面。更糟的是，第一次点击曾被当成 hydrate 启动器：关弹窗 = 拆盾 + 卸双份 FullMarkdown + 灌 deferred stores / i18n / updater / ComposerImpl。

同窗还有几条独立撞车：

- post-first-paint Session Index 软重扫，gate-ready 后原来的 pointerdown 软取消失效，迟到的 `setThreads` 和首次点击撞车。
- catalog 落账批次之间没有「有待输入就让一拍」。
- 首条消息才去 lazy compile `FullMarkdownRuntime`（vendor-markdown ≈ 591KB），正好压在第一次点击上。
- Composer Light 泄漏永远 truthy 的 picker wrapper，ReadinessBar 仍开 ModelSelect + atomic catalog。
- `applyUiScale` identity 路径无 residual 仍写空 inline style，Blink 再 cascade。

Mac WKWebView 有时还能用 stale hit-test tree，所以同一点击在 Windows 上更像「死了」。

### 3.5 后台、隐藏窗口、平台税

这些单独看都不是主诉，但会在用户切走窗口或 Windows 上把 3.1~3.4 放大：

| 放大器 | 机制 |
|---|---|
| 隐藏窗口 `rAF` 停发 | `eventBackpressure` 默认用 `rAF`。Windows 最小化后 protected 事件（如 `terminal-output`，不可丢）在队列里无界积压；恢复可见时一次性吞掉，内存 + 渲染风暴。 |
| 隐藏时仍 15s git 轮询 | 结果用户看不见，还叠加 WebView2 后台节流。 |
| GitDiffViewer 逐行 `ResizeObserver` | virtual-core 已有共享 observer；组件再为每行 `new` 一个，行数线性放大注册/派发，resize 双测。 |
| 消息图同步 decode | 只有 `loading="lazy"`，decode 仍在主线程；长历史 + 流式期间大图会掉帧。 |
| Windows 主线程 1MB stack | macOS/Linux 默认 8MB。Tauri host 深 async/future 链可 `STATUS_STACK_OVERFLOW`。 |
| 打开搜索触发全仓库 scan | 过期关系快照接口名单把搜索变成同步重 IO。 |
| 会话列表整读 JSON | Claude/Gemini 历史预览为了一行摘要读整份会话文件。 |
| Composer 静态依赖 1110 张彩图 SVG | app-shell gzip 被图标全集拖到 904 KiB。 |

### 3.6 为什么这些问题会反复出现（流程根因）

代码层原因上面已经写了。工程上反复踩坑，是因为下面几条同时成立：

1. **只修用户点到的那一个按钮。** 冷启入口会换，脆弱窗不变。
2. **用固定 `setTimeout` 当「躲开 hydrate」的证据。** 2s 改 10s 不算修。
3. **用第一次点击当 idle 触发器。** 用户越急着点，主线程越忙。
4. **高频数据图省事进 reducer。** reducer 换引用最容易接 UI，也最容易打根。
5. **域 bag 当杂物抽屉。** 新状态先塞进 composer/settings/layout，域越大误伤越宽。
6. **测的时候开着 react-scan / 用宽时间窗口做归因。** 假相关会把刀下错层。
7. **假设 `StartupGateOverlay` 在挡用户。** 生产默认关，这个假设是假的。

---

## 4. PR #1092 如何解决

按战线写。每条都给：**做了什么、关键落点、怎么验收、怎么回退**。

### 4.1 A4 二期：思考 / 工具输出离开根 reducer

**目标**：三类电报不再逐条 `dispatch` 进根。生命周期对齐正文通道。

```text
首条 delta  ──► 仍 dispatch（建壳，1 次根更新）
后续 delta  ──► 只写 liveItemDeltaChannel，48ms throttle + trailing publish
settle      ──► drain 未落 reducer 的尾段，一次写回同一 item
```

三 lane 互不串：`reasoningContent` / `reasoningSummary` / `toolOutput`。按 `threadId` + `${itemId}:${lane}` 建模。纯内存，无持久化。

| 项 | 值 |
|---|---|
| Flag | `liveDeltaExternalization`，生产默认 **开**，测试默认关 |
| Publish cadence | `LIVE_ITEM_DELTA_PUBLISH_INTERVAL_MS = 48` |
| 回退 | `localStorage.setItem("ccgui.perf.liveDeltaExternalization", "0")` 后刷新 |
| 消费 | `useLiveItemDelta` → `ReasoningRow` / `ToolBlockRenderer` |

**证据**：

- 契约测试：225 条混合电报，flag 关根 dispatch **&gt;200**，flag 开 **≤20**（记录口径 263→9）。
- 压测门禁 `npm run perf:streaming:stress`：10 万思考 chunk（128 条/16ms），根 dispatch **有界 ≤50**，实测单 lane ≈ **3 次/回合**（建壳 + settle + ensureThread）；event-loop lag 中位约 45ms，严格 &lt;250ms。
- 反例验证（刻意关专线，已还原）：`rootDispatch=100391`，门禁立刻变红。

**关键文件**：

- `src/features/threads/utils/liveItemDeltaChannel.ts`
- `src/features/threads/hooks/useLiveItemDelta.ts`
- `src/features/threads/hooks/useThreadItemEvents.ts`
- `src/features/threads/utils/realtimePerfFlags.ts`
- `src/features/threads/stress/reasoning-chunks.stress.test.ts`

### 4.2 IncrementalMarkdown：单帧成本和正文长度脱钩

**目标**：流式 full 模式不再整篇 re-parse。

做法：完整累积文本 → `splitMarkdownBlocks` 切块 → 每块独立 `memo` 子组件。已冻结块文本保证不变；每来一截电报只重排 **尾部 ≤2 块**。React key 用源码绝对起始偏移，块跨过冻结边界是 reconcile 不是 remount。

流式期刻意降级（settle 后全量自愈）：

- 代码 fence 剥掉 language，Prism 同步高亮离开热路径。
- 不挂 rehype-katex，TeX 纯文本兜底。
- 跨块引用式链接 / 脚注按字面渲染。

全引擎统一走增量 full。lightweight 只留极端兜底：折叠阈值 **8k → 24k**。**不裁列表**（`STREAMING_VISIBLE_WINDOW` 仍为 0）。

组件静态依赖 `FullMarkdownRuntime`，必须像它一样由调用方 `lazy()` 引入，禁止在 `Markdown.tsx` 里静态 import。

**关键文件**：

- `src/markdown/incremental/IncrementalMarkdown.tsx`
- `src/markdown/incremental/splitMarkdownBlocks.ts`
- `src/markdown/components/Markdown.tsx`
- `src/markdown/incremental/__perf__/incrementalStreaming.perf.test.tsx`

### 4.3 会话内历史分页窗口

**目标**：DOM 有界，数据不丢，不和贴底抢 scrollTop。

| 规则 | 说明 |
|---|---|
| 只裁表现层 | `renderedItems` 窗口化；reducer items 始终全量 |
| 生产默认 | `ccgui.perf.historyWindowSize = 150` |
| 测试默认 | `0` = 关闭，保持旧用例确定 |
| `<=0` | 恢复全量 |
| pinned 例外 | 进行中的 turn 不裁；同一 turn 不切两半 |
| 上翻冻结 | 用户不在底部时冻结窗口（`isUserAtBottomRef`） |
| 展开 | 复用 collapsed-indicator chip，按页展开；先快照 `scrollHeight` 再按增量恢复 `scrollTop`，投影 key 稳定不 remount |
| 不灌回 | 窗口没有「流式/闲时」模式切换；settle 后收起段保持收起 |
| 硬兜底 | `VISIBLE_MESSAGE_WINDOW = 10000` 只防失控，不再承担日常裁剪 |

回退：`localStorage.setItem("ccgui.perf.historyWindowSize", "0")` 后刷新。

**关键文件**：

- `src/features/messages/orchestration/presentation/messagesHistoryWindow.ts`
- `src/features/messages/orchestration/hooks/useMessagesHistoryWindow.ts`
- `src/features/messages/components/Messages.history-window.test.tsx`

### 4.4 AppShell 层 4：先减税，再切开

这一条是 PR 里最大的结构手术，分两段看。

#### 4.4.1 S1：稳定布局节点身份

`AppLayout` 对 `ReactNode` props 做 `Object.is`。`useLayoutNodes` 每次返回新元素身份 → 子树就算 `memo` 了，DesktopLayout 仍整棵重跑。

补全：`sessionTabsNode` / `contextMenuNode` / `topbarSessionTabItems` / `globalRuntimeNoticeDockNode` 的 `useMemo`；`rewindWorkspaceGitState` 必须 memo（derive 每次新对象会打穿 composer 三条 memo 链）。

#### 4.4.2 S4 PR-A ~ PR-F：分域、归位、删 legacy flatten

施工底图：`docs/plans/2026-08-14-app-shell-s4-inventory.md`。

| PR | 主题 | 结果 |
|---|---|---|
| A | 只读盘点 | 2420 行 / 690 keys / 根仍订 threads；更新源矩阵证明热 delta 已不敲根 |
| B | 纯数据 host | 根 2420→2362；`ROOT_COMPOSITION_HARD_LINES` 2600→2400 |
| C | composer 输入面下沉 | composer **141→39**（硬预算咬 60）；render 退订 composer，打字/贴图不再扇出 render flatten |
| D | turn 级投影归 runtimeThread | 根 2362→2314；history/cursor 等更新不再打 settings → sections/render |
| E | settings/layout 瘦身 + git 按 appMode 冻结 | settings **124→36**，layout **95→48**；非 git 表面复用上一 bag 引用 |
| F | 删除 legacy flatten，freeze 咬实测 | 门面/adapt API 全删；新增 key **先出后进** |

S4 终态对照 PR-A：

| 指标 | PR-A | PR-F |
|---|---|---|
| 根 composition 行数 | 2420 | **2210** |
| 15 域 keys | 690 | **609** |
| composer / settings / layout | 141 / 147 / 103 | **41 / 36 / 48**（均 ≤60） |
| layoutNodes / sections / render 订阅域 | 15 / 11 / 12 | **14 / 11 / 11** |
| legacy flatten | 存在 | **删除，门禁禁止复活** |

部分域 keys 上涨是「归位」：误塞在巨域里的字段回到语义 owner。三巨域合计 391→125，跨域重叠为空。

#### 4.4.3 Host 子树 + zone flatten + Assembly 字段订阅

S4 之后继续砍「谁被叫起来」：

1. 根 composition 收成 facade，按 churn 迁到 Session / Git / Catalog / Runtime / Composer / Flows Host。非 git 表面与关闭的 search palette 跳过 IO。
2. `layoutNodes` 不再一次 flatten 13 域。canvas / chrome / git 独立 cache；`runtimeThread` 变时 chrome/git bag 引用保持稳定。探针：`docs/perf/app-shell-streaming-bag-probe.md`。
3. Assembly **禁止** `useHostSnapshot()`。改为 `useHostFields` + allowlist（`appShellAssemblyHostFields.ts`）。热且未读的 runtime 字段（含 `lastAgentMessageByThread`）不进名单。订阅面收窄：session 144(-18) / catalog 50(-14) / git 156(-6) / runtime 80(-24) / composer 66(-2) / flows 87(-10)。
4. Host bus：render-phase 静默 publish 进 `pendingNotify`，后续同引用或 equal-field publish 再 flush 并 clone snapshot，避免 layout-phase 重发布和 StrictMode 双渲染吞掉 settings / thread 更新。

**关键门禁**：`npm run check:app-shell:governance`。

### 4.5 冷启动：第一次点击只许让路

分两层。一层减「首屏在干什么」，一层禁止「点击启动重活」。

#### 4.5.1 错峰与让渡

| 改动 | 作用 |
|---|---|
| gate-ready 后 pointerdown 仍软取消在途列表水合 | 迟到 `setThreads` 变 no-op；连续软取消 3 次或累计 8s 强制执行一次，防止饿死 |
| `yieldIfInteractiveInputPending` | 仅当 `isInputPending()` 为真让出一个宏任务；安静时同步直通。catalog 早绘 / 引擎追补 dispatch 前先让渡，让渡后重查 `isLatestThreadListRequest()` |
| idle 预热 vendor-markdown | `subscribeStartupGateReady` 后 `requestIdleCallback`（5s timeout 兜底）`import(FullMarkdownRuntime)`，与 `Markdown.tsx` lazy 同一 specifier |
| 推迟非关键 store / deferred i18n | bootstrap 只等 layout/app + critical locale；其余 mount 后 idle 灌入；hydrate 时 dirty key 胜出磁盘 |
| Composer 瘦图标 | 切断 1110 张内联彩图 SVG；app-shell gzip **904 → 847 KiB** |
| 搜索不再自动全仓库 scan | 读路径按需 include；repair 截断；过期 backup 当缓存回收 |
| 会话列表 bounded peek | Claude/Gemini 只读文件头，不再整读会话 JSON |

#### 4.5.2 Windows 冷启点击假死（P0）

执行规范：`dev-guidelines/guides/windows-cold-start-click-freeze-pitfall.md`。分析：`docs/analysis/windows-cold-start-click-freeze-release-notes-and-composer-2026-08-14.md`。

| 入口 | 修法 |
|---|---|
| 版本记录 2s auto-open | `subscribeStartupGateReady` + `scheduleWhenInteractiveQuiet`；close bump generation，迟到 catalog 不能重开；changelog 走 `liveRenderMode="lightweight"`；去掉 backdrop-filter |
| ComposerGate | 必须 `startup-gate-ready` + Light 最短 6s + 输入后 1.8s quiet；idle-upgrade 8s。早期点击只推迟升级 |
| Light 模型位 | 没有 `onExecutionTargetChange` 就不传 picker、不开 atomic catalog |
| 任意第一次点击 | `scheduleAfterStartupGateReady`；**禁止** `scheduleIdleOrFirstInteraction` 灌 deferred stores / i18n / Tongji |
| identity uiScale | `applyUiScale` verify-before-write，无 residual 不写空 inline |
| updater | auto-check 等 gate-ready |

### 4.6 平台与局部放大器

| 改动 | 作用 |
|---|---|
| 隐藏窗口背压改 100ms timeout | 判定 `visibilityState === "hidden"`（jsdom `prerender` 不误伤）；可见路径仍走 rAF |
| 隐藏时跳过 `useGitStatus` 本轮 refresh | 只重排程，与 `useGitRepositories` 同一 idiom |
| 删除 GitDiffViewer 逐行 observer | 交给 virtual-core 共享 `ResizeObserver` |
| `LocalImage` 默认 `decoding="async"` | decode 离开主线程；调用方可覆盖 |
| Windows `/STACK:8388608` | `src-tauri/build.rs` 仅 Windows，主线程栈 reserve 提到 8MB（virtual reserve，不钉满物理内存） |

### 4.7 顺带减负（不是性能主刀，但减了根上的常驻面）

- 下线 dictation 原生链路与设置页。
- 删除 kanban / Task Center 功能面；Home 发送抽到 ComposerSend section。
- 第一梯队超大文件按职责拆模块（对外 import / command 名不变）。

这些降低了根 composition 上的常驻 hook 与 bag 面，但**不是**用「删功能」代替结构修复。性能主路径仍是 4.1~4.5。

---

## 5. 量化对照（PR 当时，须重测才能当现网 KPI）

| 指标 | 修前（PR 口径） | 修后（PR 口径） | 证据类型 |
|---|---|---|---|
| 长思考回合根 dispatch | 263 次 / 回合（flag 关 &gt;200） | **9** 次 / 回合（flag 开 ≤20） | vitest 计数 |
| 10 万思考 chunk 根 dispatch | 关专线 100391 | **3** / 回合，上界 50 | `perf:streaming:stress` |
| 10 万 chunk event-loop lag | — | 中位 ~45ms，硬顶 &lt;250ms | 同上（jsdom，无 layout/paint） |
| 500 条会话 DOM | 13004 节点，线性 | 窗口 150 ≈ 4876，有界 | history-window 定标 |
| 根 composition 行数 | 2420 | 2210 | wc + governance |
| 15 域 keys | 690 | 609 | `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` |
| composer / settings / layout | 141 / 147 / 103 | 41 / 36 / 48 | freeze 表 |
| app-shell gzip | 904 KiB | 847 KiB | Composer 瘦图标 |
| 正文 live 通道 | 已有，48ms | 保持 | 不得回退 |
| 思考/工具 live 通道 | 无 | 48ms 三 lane | 本 PR 新增 |

**还不是 GUI 30s Profiler 的根 commit 计数。** streaming bag probe 锁的是「runtimeThread 变不得扇出 chrome/git flatten」，不是 FPS。正式体感仍需关 react-scan 后重录。

---

## 6. 后续如何防止再犯

这一节是这份文档的执行部分。改相关代码前当 checklist 用。

### 6.1 硬红线（违反即视为回归）

来自 `AGENTS.md` Render Perf Baseline、Windows Cold-Start Gate，以及本 PR 新咬死的边界。

**流式 / 根链**

1. 高频 setState（每事件 / 每条日志 / 轮询级）**禁挂根 hook 链**。
2. 数组追加型 setState **禁入根链**（没有 same-value 守卫，每次必换引用）。
3. 根链 store：事件驱动 + **≥30s** 兜底轮询。禁止秒级轮询。
4. 流式正文走 `liveAssistantTextChannel`（`liveTextExternalization` 默认开）。禁止恢复逐 delta `dispatch` 进 reducer。
5. 思考 / 工具输出走 `liveItemDeltaChannel`（`liveDeltaExternalization` 默认开）。禁止把三类电报重新 enqueue 进根批量队列。
6. 禁止把 live 数据塞回 AppShell 根 bag。channel 边界是既定事实，`perf:streaming:stress` 会拦截回退。
7. Assembly **禁止**回到 `useHostSnapshot()` / `subscribe('*')`。只订自己读的字段。
8. 禁止重新引入 `flattenAppShellDomainContexts` / `adaptAppShellLegacyFlatContext` / `legacy/legacyFlatten.ts`。
9. 新 shell 状态必须有 owner domain。禁止无主塞 bag 尾。新增 domain key **先出后进**（freeze 零余量）。

**幕布产品约束（性能不能推翻产品）**

10. 禁止擅自恢复时间线虚拟化、`content-visibility: auto` 于 message 行、`STREAMING_VISIBLE_WINDOW > 0`、对话级 lightweight 摘要墙。这些和 stick-to-bottom 冲突，历史事故已锁。

**冷启动**

11. 禁止用固定 timeout 当冷启动修复。
12. 禁止用第一次 `pointerdown` / `keydown` 启动 deferred stores / 完整 i18n / updater / Markdown compile / full-catalog / `ComposerImpl`。第一次点击只许让路。
13. 禁止假设 `StartupGateOverlay` 在挡用户。生产默认关。
14. 禁止 Light Composer 走 atomic catalog / 可点 ModelSelect。
15. 禁止 `ComposerGate` 在 `startup-gate-ready` 之前升 full。
16. 禁止无 residual 仍写空 inline scale 样式。禁止恢复 native zoom / 可调 uiScale。
17. 禁止只修用户点到的那一个按钮。新出现「冷启点 X 卡死」先扫入口表。

**测量**

18. 正式测量关 react-scan。WKWebView 用 event-loop lag，不要指望 `longtask`。
19. 禁止把一次性采样回填进 historical baseline 冒充 current。

### 6.2 改这些路径之前先问的问题

把「再犯」挡在 review，而不是挡在用户投诉。

**若改 `useThreadItemEvents` / channel / MessageRow / Markdown streaming**

- 这条更新是「正文增长」还是「结构变化」？增长只能进 channel。
- 首条建壳、后续累计、settle drain、rename、evict、interrupt 是否闭环？
- `seenDelta` 有没有被当成跳过 terminal settlement 的理由？（会把首个 delta 永久写成 final。）
- 有没有新增 per-delta 根 dispatch？跑 `perf:streaming:stress` 和 `perf:realtime:boundary-guard`。

**若改 `src/app-shell/**` / Host / domain bag**

- 新状态的 owner domain 是谁？写进 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` 了吗？
- 这次更新会换哪个域的引用？sections / render / layoutNodes 会不会被误伤？
- Assembly 有没有误订未读热字段？
- 跑 `npm run check:app-shell:governance`。

**若改 bootstrap / Release Notes / ComposerGate / first-click / catalog 水合**

- 用户前 5 秒能点到真界面吗？点下去会不会启动重活？
- 自动弹层是否 gate-ready + quiet？close 是否 bump generation？
- Light 路径有没有泄漏 picker / catalog？
- 是否用 timeout 当「躲开 hydrate」？
- Windows WebView2 验收矩阵是否覆盖入口表？没机器必须写「未测」。

**若改长列表 / 滚动 / 虚拟化**

- 是在裁 DOM 还是在裁数据？数据层 items 丢了就是功能回归。
- 会不会在流式结束瞬间插回历史、打乱 scrollTop？
- 有没有重新引入 content-visibility 或 TanStack Virtual 抢 stick？

### 6.3 防回潮门禁（每条相关 PR 必跑）

```bash
# AppShell 分域 / Host / bag
npm run check:app-shell:governance

# 流式边界：三类电报不进根 dispatch
npm run perf:realtime:boundary-guard

# 10 万思考 chunk：根 dispatch 有界 + lag < 250ms
npm run perf:streaming:stress

# layoutNodes zone 隔离（runtime 变不得扇出 chrome/git）
npx vitest run \
  src/app-shell/assembly/appShellStreamingBagProbe.test.ts \
  src/app-shell/assembly/appShellRenderIsolation.test.ts

# 冷启动 / ComposerGate / 让渡
npx vitest run \
  src/bootstrapApp.test.tsx \
  src/utils/interactiveMainThread.test.ts \
  src/features/composer \
  src/features/update

# 历史窗口
npx vitest run src/features/messages/components/Messages.history-window.test.tsx
```

CI：`perf:streaming:stress` 已挂入 `test-js` / heavy 组。关专线会红，不要改测试阈值来「修」回归。

### 6.4 回退开关（出问题先关 flag，不要先拆结构）

模块加载时读一次 flag，改完必须**刷新**。

| Flag | Key | 默认 | 关掉会发生什么 |
|---|---|---|---|
| 正文外部化 | `ccgui.perf.liveTextExternalization=0` | 开 | 正文 delta 回到 reducer，根渲染回到每回合几十~上百次 |
| 思考/工具外部化 | `ccgui.perf.liveDeltaExternalization=0` | 开 | 三类电报重新打根；压测会红 |
| 历史窗口 | `ccgui.perf.historyWindowSize=0` | 生产 150 | DOM 恢复全量，长会话变钝 |
| 事件批处理 | `CCGUI_APP_SERVER_EVENT_BATCH=0` | 开 | 回到更细的事件投递（调试用，不是日常回退） |

删除对应 key 即恢复默认。**不要**为一次回退再新增第二个永久 flag。

### 6.5 再卡时怎么查（先分层，再下刀）

不要一卡就猜「再 memo 一下」或「再加个 debounce」。

1. **关 react-scan** 复现。开着测到的 FPS 会骗人。
2. 判断卡在哪一层：source（事件有没有到）→ publish（channel 有没有 48ms 发出去）→ render（哪棵子树 commit）→ paint（style/layout）。
3. 需要「谁 setState」时：按 `docs/perf/render-jank-knife-experiments-2026-07-08.md` §七装 React `memoizedUpdaters` stub。stub 必须在 `main.tsx` **最顶部**、React 加载前；改完必须**彻底重启 dev**，HMR 不够。
4. 归因窗口用 **100ms**，不要用 300ms（流式期间假相关）。
5. 跨会话对比计数：两次独立启动数字相同 → 启动一次性（如历史上 Tooltip×354）；随运行时长涨 → 持续源。
6. 改完频率的刀之后，所有「因为太密所以无害」的结论必须重审（07-08 教训：git 500ms trailing debounce 在密流下永不触发，疏流后每次都到期）。

### 6.6 Review / 自检清单（可直接贴 PR）

- [ ] 没有新增每事件 / 每日志 / 每秒的根 setState
- [ ] 没有数组 append 进根链
- [ ] 没有秒级轮询挂在根 store
- [ ] 流式正文 / 思考 / 工具仍走 channel，terminal 仍 drain 回同一 identity
- [ ] 没有把 live 文本写进根 bag
- [ ] Assembly 没有订全量 snapshot
- [ ] 新 bag key 有 owner，freeze 先出后进
- [ ] 没有复活 legacy flatten
- [ ] 没有用 timeout / first-click 当冷启修复
- [ ] Light Composer 没有泄漏 ModelSelect / atomic catalog
- [ ] 没有恢复尾窗 / 行级虚拟化 / content-visibility
- [ ] 跑过本节 §6.3 里对应的门禁
- [ ] 测量说明是否开过 react-scan；Windows 没测写「未测」

### 6.7 给后续 feature 的默认设计（怎么写才不会再犯）

新功能如果会在对话进行中更新 UI，默认按这个落点选，不要先写进 `useThreads` reducer：

| 更新性质 | 正确落点 | 错误落点 |
|---|---|---|
| 正在长高的文本（正文 / 思考 / 工具） | 现有 live channel，或同构的 per-row `useSyncExternalStore` | 根 reducer / 根 bag / Assembly snapshot |
| 回合开始、结束、改名、删会话 | reducer 一次结构性 dispatch | 每条 delta 夹带结构字段 |
| 输入框草稿 / 光标 / 高度 | composer 域或 module store（现有 draft 已不经 React state） | settings/layout bag |
| 后台任务进度 | 事件广播 + ≥30s 兜底；或独立 Host | 根上 2s `localStorage` 轮询 |
| 调试日志 | 面板关：内存缓冲；面板开：才写 state | 每条 stderr `setEntries([...prev, x])` |
| 启动后才需要的重模块 | `subscribeStartupGateReady` + idle / quiet | `setTimeout(2000)` 或 first-click |
| 长列表 | 表现层窗口 / 虚拟化（非幕布时间线） | 为了省 DOM 丢掉数据层 items |

Vercel React 规则里和本仓最相关的几条（skill `vercel-react-best-practices`）：

- `rerender-defer-reads`：只在 callback 里用的值不要订阅。
- `rerender-use-ref-transient-values`：高频瞬时值进 ref，不要进 state。
- `rerender-memo`：贵的子树拆出去；但 **memo 救不了错误的订阅面**。
- `bundle-dynamic-imports` / `bundle-conditional`：重面板、Markdown runtime、彩图全集不要静态进 AppShell。

---

## 7. 还没做完，避免误读

PR #1092 收口了很多，但下面这些**仍然为真**。后续工作不要假装它们已经消失。

| 遗留 | 含义 |
|---|---|
| 根仍持有 `useThreads` | turn 级 `threadStatusById` / `threadsByWorkspace` 等仍会扇出 sections/render。彻底解耦要 threads store 下移 Provider 子树，量级超过本 PR。 |
| gitSurface 105 keys | 唯一超 soft 80 的域，freeze 已咬死。再压需要 git 面板读侧改造或析子域。 |
| Assembly 仍合并 mega bag 进 `AppShellView` | 字段订阅已经收窄，但视图层仍宽。 |
| GUI 30s Profiler 未作为本 PR 的正式验收 | jsdom 压测锁的是 dispatch 次数和任务时长，不是 FPS。 |
| Windows 真机「新包前 5 秒连点入口表」 | 分析文档标明**未验证**。发版前仍需补。没机器必须写「未测」，不能默认通过。 |
| `STREAMING_VISIBLE_WINDOW = 0` | 产品选择性能换丝滑贴底。不要当漏改。 |
| 07-08 的 100~350ms | 有日期的历史测量。改完必须重测，不能当 current value 引用。 |
| kanban store 仍常驻 | 后台 scheduled / autoStart 任务在非看板视图也要跑。E 阶段有意不卸。 |

---

## 8. 相关文档与代码入口

### 文档

| 文档 | 用途 |
|---|---|
| `docs/perf/render-jank-knife-experiments-2026-07-08.md` | 四层根因、删除法、探针、测量纪律 |
| `docs/perf/a4-live-text-externalization-plan.md` | 正文通道合同；§2.3 预留的二期就是 4.1 |
| `docs/perf/streaming-render-stall-design-2026-07-30.md` | 48ms cadence、deferred 饥饿、terminal 因果序 |
| `docs/plans/2026-08-14-app-shell-s4-inventory.md` | S4 盘点与 PR-B~F 回写数字 |
| `docs/plans/2026-08-11-app-shell-cohesion-optimization.md` | AppShell 活计划 |
| `docs/perf/2026-08-10-react-best-practices-p0-followup-execution-plan.md` | S0–S4 backlog；本 PR 实际执行了 S1+S4 及更往后的 Host 拆分 |
| `docs/perf/app-shell-streaming-bag-probe.md` | zone flatten 回归探针 |
| `docs/analysis/windows-cold-start-click-freeze-release-notes-and-composer-2026-08-14.md` | 冷启 P0 因果 |
| `dev-guidelines/guides/windows-cold-start-click-freeze-pitfall.md` | 冷启执行禁令 |
| `dev-guidelines/frontend/messages-streaming-render-contract.md` | live snapshot + row override 合同 |
| `AGENTS.md` | Render Perf Baseline / AppShell Structure Gate / Cold-Start Gate |

### 代码（按问题域）

| 域 | 入口 |
|---|---|
| 正文通道 | `src/features/threads/utils/liveAssistantTextChannel.ts` |
| 思考/工具通道 | `src/features/threads/utils/liveItemDeltaChannel.ts` |
| Flag | `src/features/threads/utils/realtimePerfFlags.ts` |
| 写入改道 | `src/features/threads/hooks/useThreadItemEvents.ts` |
| 增量 Markdown | `src/markdown/incremental/IncrementalMarkdown.tsx` |
| 历史窗口 | `src/features/messages/orchestration/presentation/messagesHistoryWindow.ts` |
| Host bus | `src/app-shell/hosts/appShellHostBus.tsx` |
| Assembly 订阅 | `src/app-shell/hosts/useAppShellAssemblyHost.ts`、`appShellAssemblyHostFields.ts` |
| 冷启调度 | `src/bootstrapApp.tsx`、`src/utils/interactiveMainThread.ts` |
| ComposerGate | `src/features/composer/utils/composerGateUpgrade.ts` |

---

## 9. 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-16 | 初版：基于 PR #1092 提交序列、S4 inventory、07-08 四层框架、冷启采坑与压测门禁整理 |
