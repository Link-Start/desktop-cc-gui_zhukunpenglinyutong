# 客户端辅助功能模块优化与重设计评估报告

**日期**:2026-07-24
**对象**:ccgui v0.7.8(Tauri + React/TypeScript 多引擎 AI 客户端)
**目标**:评估除画布/幕布渲染外所有辅助功能模块的优化与重设计空间,回答"如何让客户端更智能、更能驾驭 AI"。

> 💬 **大白话(全报告导读)**:这份报告回答一个问题——"这个客户端除了主画布以外,输入框、看板、设置、搜索、Git、语音、记忆……这些你每天点的功能,哪些做得糙、哪些做了一半、哪些能加 AI 让你更省事"。核心结论一句话:**不是缺 AI 功能,而是垃圾没扔、半成品没接电、AI 输出靠猜**。阅读时每个章节下的 💬 块都是给非代码视角的人看的导读。

## 调研范围与方法

- 方法:11 组并行源码调研(子代理逐文件实读 + grep 交叉验证),全部结论带文件路径与行号证据。
- 覆盖:`composer/prompts/commands/skills/curated-skills`、`agent-orchestration/agent-catalog/parallel/tasks/kanban/plan`、`engine/codex/opencode/models/vendors`、`context-ledger/project-memory/session-activity/threads/messages/shared-session`、`files/git/git-history/terminal/live-edit-preview/code-annotations/markdown`、`search/quick-switcher/project-map/workspaces`、`settings/notifications/status-panel/runtime-log/debug/update/startup-orchestration`、`dictation/browser-agent/computer-use/collaboration`、`governance/operation-facts/spec/engine-task-output`、`home/layout/theme/about/client-documentation/client-ui-visibility/note-cards/intent-canvas`,外加 `openspec/` 规划一致性专项。
- 排除:live-canvas / 幕布渲染管线(按要求);project-map 与 intent-canvas 仅评估数据与交互设计,未做渲染性能评估。
- 时效说明:调研快照对应工作树状态;当前分支有 63 个 dirty 文件、3 个 openspec 提案在途未入库,个别结论可能与最新提交存在时间差。

> 💬 **大白话**:做法相当于派了 11 个"调研员"分头把客户端代码翻了个底朝天,每个结论都标注了"证据在哪:哪个文件第几行"。你平时在界面上点的所有东西——输入框、看板、设置页、Cmd+K 搜索、Git 面板、语音输入按钮、项目地图、Spec Hub——都被查了一遍,只有画布渲染没查(按要求排除)。注意一个前提:查的时候你本地还有 63 个未提交的改动和 3 个进行中的提案,所以个别结论现在可能已经过时,动手前要再核对。

---

## 执行摘要

1. **最大的改进空间不是"缺 AI",而是"减法没做完"。** 输入子系统背着一次未完成的 JCEF→Tauri 迁移的全部残骸(composer 约 3600+ 行死代码、no-op bridge 桩、三套输入历史双写),加上改名遗留(mossx→codemoss)的双命名空间与三处遗留 key 迁移。先清死代码与双实现(纯删除、零风险),再谈 AI 增强。

  > 💬 **大白话**:问题不是 AI 功能太少,是垃圾没扔。你每天打字的输入框(Composer)背后躺着 3600 多行**没人用的废弃代码**——这是早先从旧桌面技术(JCEF)迁移到 Tauri 时没打扫的战场,还有项目改名(mossx→codemoss)留下的双份命名。死代码最坏的后果:AI 助手帮你改代码时经常改到死的那份,白改。先扔垃圾,再谈加新功能。

2. **"建成但锁死/未接线"的半成品遍布全仓,接通它们比新建功能 ROI 高得多。** 代表性案例:orchestration 派发被 `TASK_MODULE_ENTRYPOINTS_ENABLED = false` 硬编码锁死(~350 行可用派发逻辑不可达);browser-agent 的 `run_browser_agent_action` 前后端都写好了却零调用方;project-memory 的语义检索基础设施(544 行向量索引)生产从未接线、永远走词法回退;search 的增量索引层是死代码;git 的 `aiReview` schema/UI 已就绪但没有生产者。这些都是"差一步接通"的智能化资产。

  > 💬 **大白话**:很多功能其实**已经做好了,但被锁在柜子里**。最典型的:编排中心的"派发任务"整套界面和 350 行逻辑都写完了,被一行 `= false` 的开关永久禁用,你在界面上永远看不到;浏览器自动操作的前后端代码都齐了,却没有任何地方调用它;记忆的"按意思检索"建了 544 行,从来没接过电,你实际用的是"逐字匹配"笨办法。接通这些,比从零做新功能划算得多。

3. **引擎非结构化输出倒逼前端堆出大量脆弱逆向工程。** threadId 前缀推断引擎(9+ 处重复)、`operationFacts.ts` 1026 行字符串猜测、checkpoint 摘要靠正则抠 `## Summary`、`<browser_context_v2>` 手写文本协议 786 行格式化/解析对、opencode CLI 文案正则"屏幕抓取"。治本是把结构化契约下沉到 engine/后端,前端启发式降级为兜底。

  > 💬 **大白话**:AI 引擎(Claude/Codex 等)吐出来的是**没有固定格式的纯文本**,前端只能靠"猜"来理解——比如"会话 ID 以 claude: 开头就认为是 Claude"(9 个地方各猜各的)、用 1026 行代码靠关键词匹配猜"AI 改了哪些文件"、用正则抠标题当摘要。这就像靠听写整理会议纪要,特别容易猜错,而且每接一个新引擎就要再写一遍猜测逻辑。治本:让引擎直接给结构化数据,猜测逻辑降级为备胎。

4. **AI 集成最深的三处各有一个致命工程问题。** project-map(28.9k 行,AI 生成管线)的引擎响应解析是 8 层递归嗅探 + JSON 修复重试双倍 token;Spec Hub(AI 集成最深)的全部 UI 和 7 个 AI prompt 构建器埋在 113KB 混淆 + `@ts-nocheck` 文件里(de-minify 分支 `b2736ba9b` 烂尾未合入);git 的 AI commit message 藏在两级右键菜单后、无流式。

  > 💬 **大白话**:AI 用得最深的三个功能各有各的病。**项目地图**:解析 AI 的回复要递归猜 8 层,猜错了把 5 万字 prompt 原样重发——双倍 token 双倍钱。**Spec Hub**:全部界面代码被压缩混淆过(变量名都被搅乱)还关了类型检查,7 个 AI 提示词构建器埋在里面,没人能审、没人敢改;有人做过"反混淆"分支但烂尾没合并。**AI 生成 commit message**:藏在"右键→选引擎→选语言"两级菜单后,99% 的用户根本找不到。

5. **轮询与高频 setState 多处触碰仓库自己的渲染红线。** `CuratedSkillIndicator` 2s 轮询、通知 dock 5s 轮询、engine-task-output 5s 读文件、kanban 20s 纯前端调度、文件外部变更 2s 轮询、dictation 电平 33ms 一事件。红线要求"事件驱动 + ≥30s 兜底",这批模块普遍未达标。

  > 💬 **大白话**:很多界面靠"每隔几秒问一次后台:有新东西吗?"来刷新(这叫轮询),而不是"有新东西时后台主动通知我"。就像你每 2 秒看一次手机有没有新微信——费电、界面偶尔卡一下。仓库自己定的规矩是"事件驱动 + 30 秒兜底",这批模块都没遵守:技能指示器 2 秒一问、通知栏 5 秒一问、语音电平每秒 30 次刷新界面。

6. **god hook/巨型组件集中在根链与高频路径,阻塞一切迭代。** `useAppShellKanbanExecutionSection.ts` 1614 行(看板全部执行逻辑外泄到 AppShell 根)、`useLayoutNodes.tsx` 2666 行、threads hooks 层四个 2500+ 行巨石、`SettingsView.tsx` 2687 行整文件 `@ts-nocheck`、`GitHistoryPanelImpl.tsx` 2803 行首行 `@ts-nocheck` + 77 个 useState。

  > 💬 **大白话**:一批"谁都不敢拆的楼"堵在主干道上。`@ts-nocheck` 的意思是**主动关掉了 TypeScript 类型检查这个安全网**——设置页 2687 行整页关着,Git 历史面板 2803 行里有 77 个状态开关也关着。你日常用没问题,但开发侧每改一处都可能碰炸别处——这就是"小 bug 修了又犯"的结构性根源,也是新功能加不进去的原因:地基不敢动。

7. **openspec 治理闭环已追不上 AI 辅助的实现速度。** 磁盘实际 25 个活跃提案、索引只登记 6 个,19 个实现完未 sync/archive(18 个缺 verification.md),三处 specs 计数全部漂移。本报告已剔除已在规划中的方向(AI PR 生成、Agent Catalog、note-capture 重构等),避免重复立项。

  > 💬 **大白话**:openspec 是这个仓库"提案→实现→验证→归档"的**项目管理账本**。现状是账实不符:账本说 6 个提案进行中,磁盘上实际 25 个;19 个功能代码都写完合并了,账本上还没销账。靠人工记账已经追不上 AI 写代码的速度,越拖越乱,后面的人(和 AI)会照着一个过期的账本做决策。

8. **最快见效的"驾驭 AI"闭环是 P0 三件套**:① 打开 orchestration dispatch 并接通 AI 验收判定(候选→派发→运行→审核闭环);② 接通已建成半成品(aiReview 生产者、记忆语义检索、browser action、语音后处理);③ 死代码大扫除 + 引擎标识单一事实源。三者都主要依赖已有基础设施,不需要新建 AI 通道(后端 `generateThreadTitle` 已验证隐藏 session 通道可复用)。

  > 💬 **大白话**:见效最快的三件事,都不需要新造 AI 通道,现有的就够:①把编排中心的派发开关打开,让"AI 派活→AI 干活→AI 验收"跑通闭环;②把柜子里锁着的半成品接上电;③大扫除 + 统一"怎么识别当前是哪个引擎"(现在 9 个地方各猜各的,还会把 Gemini/Kimi 错标成 Claude)。

---

## 全局横切发现

> 💬 **大白话**:前面摘要是"结论",这一节是"病因归类"——11 组调研发现的問題反复指向 7 种通病。看懂这 7 个主题,后面 11 个模块的细节就不用逐条记了:它们基本都是这 7 种病在不同功能上的发作。

### 主题一:死代码与双实现并行(涉及 10/11 组)

同一功能两套实现并存、一套已死但未删,是本次调研出现频率最高的模式:

| 代表证据 | 说明 |
|---|---|
| `src/features/composer/ComposerInput.tsx`(1641 行)+ ~2000 行测试 | 无任何非测试引用;`ChatInputBoxAdapter.tsx:5` 注释自述替换已完成 |
| `composer/providers/slashCommandProvider.ts:244` / `promptProvider.ts` | JCEF bridge no-op 死链路,`window.updateSlashCommands` 永远不会被调用,合计 ~700 行 |
| `composer/hooks/useComposerAutocompleteState.ts`(980 行) | 输出大部分被下划线弃用,真正补全由 ChatInputBox 内 7 个 dropdown 独立完成——两套补全引擎同时跑 |
| `src/features/parallel/`(204 行) | 孤儿模块,仅自身测试引用 |
| `project-memory/utils/projectMemorySemanticRetrieval.ts`(544 行) | 语义检索建成未接线,`useThreadMessaging.ts:535-539` 从不传 `semanticProvider` |
| `search/indexing/` | `buildWorkspaceIndex` 无生产消费,生产路径仍线性扫描 |
| `git/semanticDiffSummary.ts` 的 `aiReview`/`TurnSemanticReview` schema | 全仓无生产者,实际摘要靠 943 行手写规则 |
| `browser-agent` 动作执行管线 | `run_browser_agent_action`(`mod.rs:2046-2227`)+ 前端 preview/gate 全套,零调用方 |
| `home` 的 `latestAgentRuns` | `Home.tsx:23-25` 三个 props 下划线弃用,但 `app-shell.tsx:1052` 仍在计算 |
| `layout/useLayoutMode.ts:3-6` 硬编码 `return "desktop"` | `PhoneLayout/TabletLayout` 永远走不到仍参与打包 |
| `models/refreshCodexModelConfig.ts` | 9 行透传死抽象 |
| `files/FileMarkdownPreview.tsx`(1581 行) | 仅剩 `SkillsSection.tsx:39` 一处 import,与 Fast 管线双维护 |

> 💬 **大白话**:同一个功能有两份代码,一份在用、一份已死但没删。你打字用的输入框就有**两套**(旧的那套 1641 行没人用),自动补全也是**两套引擎同时在跑**(一套的输出全被丢弃)。对你的影响:安装包更大、搜历史结果口径不一;对开发/AI 助手的影响更糟:经常改到死的那份代码上——白忙一场,还看不懂为什么改了没效果。

### 主题二:轮询滥用与高频 setState(触碰 AGENTS.md 渲染红线)

- `CuratedSkillIndicator.tsx:32` 2s 轮询,每 tick 两次 IPC 拉取不变静态数据(红线③);
- `useGlobalRuntimeNoticeDock.ts:23` 5s 轮询 runtime 池(池本身已有事件通道);
- `useEngineTaskOutputSnapshot.ts:8` 5s 轮询读子代理产物文件;
- `useAppShellKanbanExecutionSection.ts:60` 20s `setInterval` 调度器挂在根 hook 上,应用关闭即失效;
- `fileViewPanelShared.ts:25` 文件外部变更 2s 轮询而非 fs 事件;
- `dictation/real.rs:1245-1251` 电平 30fps 直推前端 setState;
- `MemoryPanel.tsx:7/:62` 每 10s `no-cors` 探活硬编码 localhost:37777;
- `useLocalUsage.ts:17` 5 分钟轮询不随窗口可见性暂停。

> 💬 **大白话**:你感知到的现象是:界面偶尔莫名卡一下、笔记本放着不动也微微发热。原因是界面上的一批小部件在"定时自问自答":右上角技能指示器每 2 秒问一次后端"技能变了吗"(几乎从不变)、右下角通知栏每 5 秒问一次、文件面板每 2 秒检查一次文件有没有被外部改动、语音输入的音量条每秒 30 次刷新整个界面。正确姿势是"有事再叫我"(事件驱动),仓库红线也是这么定的。

### 主题三:启发式/字符串猜测代替结构化契约

- **引擎身份推断散弹枪**:`threadId.startsWith("claude:")` 前缀判断至少 9 处(`SettingsView.tsx:259-272`、`selectedComposerSession.ts:16`、`manualThreadRecovery.ts:68`、`taskRunTelemetry.ts:102` 等);引擎显示名映射 7+ 处;`useStatusPanelData.ts:245` 二元假设 `isCodexEngine ? "codex" : "claude"`(gemini/kimi/opencode 全被标错);`engineTaskOutputProjection.ts:84` 同样二选一硬编码。
- **从文本反推结构**:`operationFacts.ts`(1026 行)靠 tool 名 `includes` 黑名单猜文件变更;`checkpoint.ts:301` 正则抠 `## Summary` 标题当 AI 摘要;`agentTaskNotification.ts` 解析 `<task-notification>` XML-in-text 且 3 次 entity 解码;`status-panel` 用正则从 collab 输出猜 subagent 状态。
- **模型/供应商靠名字猜**:`modelMetadata.ts:15-35` 用 `nano/mini→Fast` 子串规则展示速度/成本徽章(伪信息);`OpenCodeControlPanel` 与 `useOpenCodeControlPanel.ts` 两套不一致的前缀 if 链推断 provider;`claudeContextWindow.ts:17-24` 除 haiku 外一律 1M。
- **错误契约=文案匹配**:`gitErrorI18n.ts`、`useWorktreePrompt.ts:109-217`、`isMissingCommandError`(runtime-log)全靠 `includes` 解析后端错误文本。

> 💬 **大白话**:前端到处在"猜"而不是"读"。猜引擎:"会话 ID 以 claude: 开头就是 Claude"——至少 9 个地方各猜各的;状态面板更粗暴:"不是 Codex?那就是 Claude"——于是你用 Gemini/Kimi/OpenCode 时,**状态栏上全被错标成 Claude**。猜模型:名字里带 "mini/nano" 就贴"快/便宜"徽章——你看到的徽章是编的。猜错误:后端报错文案里包含某个英文单词就当成某类错误,后端改个措辞前端就瞎。

### 主题四:AI 能力缺席或半成品化

- 全仓真正接通的 LLM 增强点屈指可数:`generateThreadTitle`(后端通道,`useThreads.ts:1363-1381`)、AI commit message(`useGitCommitController.ts`)、prompt enhancer(`usePromptEnhancer.ts`)、project-map 生成管线、Spec Hub prompts、PR 内容生成(`generatePullRequestContent`)。
- 已有 AI 的通病:prompt enhancer 错误分类靠 `'auth'/'model'/'network'` 子串匹配(`usePromptEnhancer.ts:141-155`)、阻塞弹窗 60s 干等、英文硬编码不走 i18n;AI commit 要两级右键菜单(`GitDiffPanel.tsx:2150-2248`);checkpoint"AI 摘要"实为正则截取;project-map 的 JSON 修复重试把 52k 证据 prompt 完整重发(`projectMapGenerationWorker.ts:1695-1707`)。

> 💬 **大白话**:整个客户端真正接上 AI 的地方一只手数得过来:自动起会话标题、AI 生成 commit message、提示词润色、项目地图、Spec Hub、PR 内容生成。而且已有的也糙:你点"提示词润色"会弹一个**最多 60 秒的阻塞弹窗干等**,发给 AI 的指令是硬编码英文(你界面是中文);checkpoint 的所谓"AI 摘要"其实是正则抠标题,不是 AI 写的;项目地图解析失败就把 5 万字证据原样重发给 AI,双倍 token 双倍钱。

### 主题五:巨型组件 / god hook 集中带

| 文件 | 规模 | 备注 |
|---|---|---|
| `app-shell-parts/useAppShellKanbanExecutionSection.ts` | 1614 行 | 看板全部执行逻辑外泄到根 hook |
| `useLayoutNodes.tsx` + `layoutNodesTypes.ts` | 2666 + 1323 行 | 外壳最大单文件债 |
| `Composer.tsx` / `ChatInputBoxAdapter.tsx` / `ChatInputBox.tsx` | 2592 / 2205 / 1782 行 | ~190 props 上帝组件 |
| threads hooks 四巨石 | 各 2500–3000 行 | `useThreads.ts` 3041 行聚合 ~20 个子 hook |
| `FileViewPanel.tsx` / `GitDiffPanel.tsx` | 3092 / 3125 行 | 25 useEffect / 35 useCallback |
| `GitHistoryPanelImpl.tsx` | 2803 行 | 首行 `@ts-nocheck` + 77 个 useState |
| `SettingsView.tsx` | 2687 行 | 整文件 `@ts-nocheck`,40+ props |
| `SpecHubPresentationalImpl.tsx` | 113KB 混淆 | `@ts-nocheck`,变量名 mangled,埋着 7 个 AI prompt 构建器 |
| `ProjectMapPanel.tsx` | 2001 行 | 38 个 useState |
| `WorkspaceSessionActivityPanel.tsx` / `ProjectMemoryPanel.tsx` | 2640 / 1785 行 | 面板巨石 |

> 💬 **大白话**:这些是"谁都不敢拆的楼"。对照你的界面:设置页一个文件 2687 行且整页关掉类型检查;Git 历史面板 2803 行里塞了 77 个状态开关;输入框组件要接收约 190 个参数。你在界面上感觉不到,但开发侧每改一处都像在雷区走路——很多功能"不敢加"、很多 bug"修了又犯",根源都在这张表里。

### 主题六:存储与持久化策略割裂

- 预算/成本历史存 localStorage(`budgetStore.ts:41`、`costHistoryStore.ts:25`),project-memory 走后端 command,session-radar 走 clientStorage+localStorage 混合,opencode 收藏手写 localStorage key——四种策略并存。
- kanban/orchestration/taskRun 共写单一 app store,`useKanbanStore.ts:60` 注释自承 base64 图片曾把 app.json 撑到 ~24MB。
- 跨模块通信用 localStorage 自定义事件总线(`localStorageChange` 至少 5 处收发)+ `ccgui:*` 事件 + sessionStorage 传参,无单一事实源。
- shared-session 绑定状态前端内存 Map 与后端双写无 reconcile(`sharedSessionBridge.ts:16`);intent-canvas 保存两步非原子(`intentCanvasStorage.ts:713-735`)。

> 💬 **大白话**:"数据存哪"全仓有四种答案:有的存浏览器 localStorage、有的走后端数据库、有的混着来。后果很具体:看板卡片里贴张图片,配置文件 app.json 曾膨胀到 24MB;共享会话的绑定状态前端后端各记一份、对不上时就出现"明明显示已绑定却找不到会话";意图画布存盘分两步写,中途崩了索引就和内容对不上。

### 主题七:硬编码模型/供应商/目录,发版才能跟进

`codexModelCatalog.ts:16-52`(gpt-5.6 系列)、`GEMINI_PRESET_MODEL_IDS`(含未发布预览模型)、`CLAUDE_PROVIDER_PRESETS`(glm-4.7/kimi-k2.5 等写死)、dictation 五个 Whisper 模型 URL/sha256(`real.rs:121-152`)、context-ledger 定价 fixture(`pricing/fixtures/claude.ts:11-27`)、curated-skills 全套重型基础设施只服务 2 个条目。

> 💬 **大白话**:设置里看到的模型清单、供应商列表、价格、语音模型下载地址,全部**写死在代码里**。厂商出了新模型?你得等客户端发新版才能选。价格调了?界面还显示旧价。更离谱的是 Gemini 预设里还有"未发布的预览模型"——意味着列表是抄的而不是探测的。curated-skills 建了一整套带锁文件校验的重型基础设施,结果只服务 2 个技能条目,属于"为两辆自行车修了座立交桥"。

---

## 分模块详述

### ① 输入与提示词体系(composer / prompts / commands / skills / curated-skills)

**现状**:功能最全但债务最重——两套并行输入实现、~190 props 上帝组件、no-op 遗留 bridge、约 3600 行疑似死代码;提示词/命令/技能全手动无 AI。

> 💬 **大白话**:就是你每天打字发消息的那个输入框,以及 `/命令`、提示词库、技能面板。它的背后:输入框代码有**新旧两套**并存(旧的 1641 行纯死代码)、输入历史**记了三份**(所以你搜历史时各入口结果口径不一致)、自动补全**两套引擎同时在跑**(一套算完就被丢弃)。提示词/命令/技能管理全是手工活:技能调用本质是把 `/skill名` 当普通文本拼进消息发给 AI,没有任何结构化参数。唯一沾 AI 的"提示词润色":弹 60 秒阻塞弹窗、错误判断靠猜英文关键词、发给 AI 的系统指令是硬编码英文——中文用户体验打折。

**关键问题**:
- `ComposerInput.tsx` 1641 行死实现 + 死 bridge 链路(`providers/slashCommandProvider.ts:244` 永远 false 的 `sendBridgeEvent`);`ARCHITECTURE.md:243-244` 文档已腐化,与实际 `engineSendMessageSync` 实现不符。
- 三套输入历史并存且发送时双写(`Composer.tsx:1447-1465` `recordHistory` + `recordInputHistory`),历史/补全/搜索三处口径不一致。
- `useCustomCommands.ts:120-166` 空结果 15s 冷却重试 + 全局兜底启发式补丁,会把别的 workspace 不可用的命令展示给用户;失败静默,加文件无 fs 感知。
- 技能调用 = `/skill-name` 文本拼接(`promptAssembler.ts:42-55`),无结构化传递;`SkillsSection.tsx` 1289 行纯文件管理器。
- prompt enhancer 是范围内唯一 AI 功能但设计粗糙:子串匹配错误分类(`:141-155`)、60s 阻塞弹窗、英文硬编码 system prompt(`:36-49`)、每次新建隐藏 session 无缓存。
- curated-skills 全套锁文件/build.rs 校验基础设施只服务 2 个条目;指示器 2s 轮询(`CuratedSkillIndicator.tsx:32`)。

**智能化机会**:prompt/命令/技能语义检索与推荐(目前全是 `includes`);"对话→prompt/skill"一键沉淀(AI 提炼模板与 `$ARGUMENTS`);主动式上下文建议(@文件、curated skill、engine 切换);enhancer 升级为流式+就地 diff+发送前自动润色。

**建议**:P0 删死代码三件套(ComposerInput+bridge 死链路、砍 `useComposerAutocompleteState` 980 行、统一输入历史单一实现);P1 AppSettings 事件驱动消灭 2s 轮询、commands/skills fs watch、enhancer 改造;P2 "对话→prompt/skill"沉淀、技能契约结构化、composer 按职责拆分。

### ② 多代理编排与任务管理(agent-orchestration / agent-catalog / parallel / tasks / kanban / plan)

**现状**:编排骨架(provider 候选、TaskRun 底座、chaining/调度纯函数)质量不差,但派发被 flag 锁死、执行引擎外泄成 1614 行根 hook、所有"判断"环节都是启发式。

> 💬 **大白话**:编排中心(Orchestration Center)和看板(Kanban)。最离谱的一点:**"派发任务"功能整套都做好了**——按钮、配置面板、350 行派发逻辑——但被代码里一行 `= false` 永久锁死,你在界面上根本看不到它。看板判断"任务完成"的标准是"**AI 停止说话了**"——AI 报错停了也算完成;任务摘要是机械截取前 280 个字;周期任务靠"复制卡片+比对标题文字"识别,你改个标题它就断链重来。候选任务标题是模板拼的(`Review xxx`),没有排序没有去重。

**关键问题**:
- `OrchestrationCenterView.tsx:21` `TASK_MODULE_ENTRYPOINTS_ENABLED = false`:dispatch 按钮、配置面板、`dispatchTask.ts`(172 行)、app-shell 侧 ~170 行真实派发逻辑全部建成不可达;`onCreateManualTask` 死 prop(`:453`)两侧白接。
- 引擎约束硬编码三处(`OrchestrationCenterView.tsx:17`、`useAppShellKanbanExecutionSection.ts:209`、类型层);四套状态模型(9/8/8/4 值)互相有损映射,`review_needed`/`review`/`testing` 语义模糊。
- 执行逻辑全部外泄:`useAppShellKanbanExecutionSection.ts` 1614 行含 20s 轮询调度、执行锁、thread 对账、telemetry 回写;完成检测 = "AI 停止输出"(`:1263-1271`),AI 报错停输出也算完成;`latestOutputSummary` 是 280 字符截断(`taskRunTelemetry.ts:33-61`)。
- 周期任务靠"卡片克隆 + 字符串签名匹配"(`:1279-1403`),改标题即断链。
- 候选任务全是模板字符串拼接(`projectMapProvider.ts:266` `Review ${node.title}`),无排序无去重。
- `parallel` 204 行死代码;`PlanPanel.tsx` 93 行只读,计划不能转任务;agent-catalog 与任务系统零集成(`KanbanTask` 无 agentId 字段)。

**智能化机会**:完成后自动派 reviewer turn 对照 acceptance 判定(`reviewTask.ts` follow-up 机制已存在);候选队列 LLM 去重/排序/人话标题;任务创建 AI 预填;run 结束 AI 结构化总结与失败归因;TurnPlan 一键转任务链;catalog agent 语义推荐接入任务。

**建议**:P0 决策 dispatch 去留(推荐开通)、拆 1614 行根 hook、AI 验收判定替代启发式完成;P1 删/复活 parallel、统一状态模型、运行总结 AI 化、任务创建预填;P2 catalog 接入、计划转任务链、存储按 workspace 分 key。

### ③ 引擎与模型接入层(engine / codex / opencode / models / vendors)

**现状**:`useEngineController` 1008 行 god hook + capability matrix 半成品;模型/供应商全靠硬编码与字符串启发式,几乎零 AI 参与。

> 💬 **大白话**:管理"用哪个引擎、哪个模型、哪家供应商"的那一层(设置页里的引擎/模型/供应商面板)。你看到的模型列表是**写死的**——厂商发新模型你得等客户端发版;模型旁边的"快/便宜"徽章是**按名字猜的**(名字带 mini 就标快),属于误导信息。一个实际 bug 温床:同一个模型 ID,从不同入口进来校验规则不一样(一边限 128 字符且查格式,一边 256 字符不查)——同一串字符在 A 入口合法、B 入口非法。claude 供应商配置的错误还被大面积静默吞掉——配置失败了你可能毫无知觉。

**关键问题**:
- 引擎枚举 3 处硬编码(`useEngineController.ts:133`、`isSupportedEngineType`、`engineAvailability.ts:4-10`);capability matrix 三项能力永远 "unknown"(`engineCapabilityMatrix.ts:61-63`),且运行时 import openspec fixture(`:2`),规范归档会破坏构建。
- codex 模块名存实亡(仅 27 行常量);模型目录硬编码(`codexModelCatalog.ts:16-52`、`GEMINI_PRESET_MODEL_IDS`);claude 模型映射要读 3 个 localStorage key、写 3 份(`constants.ts:89-140`),改名迁移代码写了 3 遍。
- opencode 面板 1011 行塞满启发式:`inferModelProvider` 20+ 前缀 if 链与 hook 层 `inferProviderFromModel` 两套不一致;`sanitizeProviderOptions` 正则"屏幕抓取"CLI 交互文案(`useOpenCodeControlPanel.ts:89-127`);`modelMetadata.ts` 名字猜速度/成本徽章会误导用户。
- 三套 provider 管理 hook ~850 行同构复制;`isValidModelId` 双源不一致(vendors 版 256 字符无正则 vs composer 版 128 字符有正则,`vendors/types.ts:24-29` vs `composer/types/provider.ts:12-19`)——同一模型 id 不同入口校验结果不同,是实际 bug 温床;claude 版错误大面积静默吞掉(`useProviderManagement.ts:138-139` 等)。

**智能化机会**:统一模型元数据注册表 + 未知模型 AI 一次性推断缓存(替代全部名字猜测);按任务类型推荐模型/effort;供应商配置 AI 引导(key→自动探测模型→自动填映射);doctor 输出 AI 生成可执行修复指引;预设列表 AI 保鲜。

**建议**:P0 模型元数据注册表、统一 STORAGE_KEYS/校验、模型目录动态化(后端探测优先+内置兜底);P1 provider hook 工厂化、拆 `useEngineController`/`VendorSettingsPanel`/opencode 面板、统一状态层替代 localStorage 事件总线、补 capability 探测并解除 openspec fixture 依赖;P2 doctor 泛化+AI 诊断、模型智能推荐、opencode 会话语义化。

### ④ 上下文、记忆与会话管理(context-ledger / project-memory / session-activity / threads / messages / shared-session)

**现状**:记忆链路完整但语义检索建成未接线、摘要分类是正则规则引擎;threads 是全域最大技术债(115k 行/290 文件,hooks 层四个 2500+ 行巨石)。

> 💬 **大白话**:记忆(Memory)、会话列表、上下文账本这些功能。本区最大发现:一套 544 行的"**按意思找记忆**"(语义检索)基础设施已经建好,但生产环境**从来没接上线**——你现在用的永远是笨办法"按关键词逐字匹配",而且匹配权重(0.62/0.24)是拍脑袋定的。记忆入库也靠机械规则:正则洗一洗、截取前三句话就冒充"AI 提炼",分类靠硬编码关键词打分。会话(threads)是全仓最大的债:11.5 万行、四个 2500+ 行的巨型 hook,每接入一个新引擎要复制几千行代码——好消息是这块测试覆盖好,重构有安全网。

**关键问题**:
- 本范围最大发现:`projectMemorySemanticRetrieval.ts` 544 行向量索引 + 混合打分,生产调用点(`useThreadMessaging.ts:535-539`)从不传 `semanticProvider`,`memoryScout.ts:256,262` 语义分支永远跳过,`retrievalMode` 永远 `"lexical"`;`SEMANTIC_WEIGHTS`(0.62/0.24)是拍脑袋权重。
- 记忆入库质量被机械规则卡死:`outputDigest.ts:38-60` 正则清洗+前 3 句截断冒充"提炼";`memoryKindClassifier.ts:20-80` 硬编码关键词打分;`IDENTITY_RECALL_PHRASES`(`memoryContextInjection.ts:74-80`)枚举中文句式。
- 定价 fixture 硬编码(`pricing/fixtures/claude.ts:11-27`);预算/成本历史 localStorage,与后端持久化体系不一致。
- threads hooks 四巨石 + 每引擎 loader/adapter 成对重复(如 `claudeHistoryLoader.ts` 2378 行),新增引擎要复制数千行;邮件驱动续聊等边缘功能耦合在核心链;积极面是 realtime 回放/parity 测试体系质量高,重构有安全网。
- shared-session 绑定双写源(内存 Map + 后端,无 reconcile),pending id 靠前缀字符串识别。
- 检索超时硬编码 1.5s(`messageRuntimeController.ts:6`),大记忆库词法全扫易超时静默降级。

**智能化机会**:记忆摘要/分类 LLM 化(后端 `generateThreadTitle` 通道现成);接通语义检索;context-ledger 超预算一键瘦身建议;会话活动 AI 摘要卡片与卡住检测;对话内语义搜索;composer 输入时记忆推荐 chip。

**建议**:P0 记忆入库 AI 化、语义检索接线或删除、ledger 智能瘦身建议;P1 threads 巨石拆分、定价远端可更新+预算迁后端、session-activity AI 摘要+三处 tool 语义解析收敛、shared-session 以后端为单一事实源;P2 loader/adapter 泛化、对话内语义搜索、注入预算按模型窗口动态化。

### ⑤ 工程工具链(files / git / git-history / terminal / live-edit-preview / code-annotations / markdown)

**现状**:功能面广但巨型组件与重复代码最集中;AI diff review 闭环只差生产者;terminal 停留在裸 PTY。

> 💬 **大白话**:Git 面板、文件查看器、终端、代码批注这些工程工具。Git 历史面板是**全场最危险的文件**:2803 行、关了类型检查、77 个状态开关——而删除分支、reset、rebase 这些不可逆高危操作就在里面裸奔,一次误改就是事故。"AI 审查本次改动"的界面和数据格式**都做好了,唯独没有生产数据的人**——界面永远等不到内容。AI 生成 commit message 要"右键→选引擎→选语言"两级菜单,藏得太深;worktree 面板又把同样功能重写了一遍,两套平行演化。终端就是个裸命令行:没有搜索、没有链接识别,也没有"把报错发给 AI"的按钮。

**关键问题**:
- `GitHistoryPanelImpl.tsx` 2803 行首行 `@ts-nocheck` + 77 个 useState——本次调研最严重的单体债,git 高危操作(删除分支/reset/rebase)无类型保护。
- `fileViewPanelShared.ts` / `fileViewPanelInternals.ts` 约 400 行同名同实现重复;文件外部变更 2s 轮询;`FileMarkdownPreview.tsx` 1581 行单消费者死代码,markdown 双管线并存。
- `semanticDiffSummary.ts` 定义了完整 AI 审查 schema(`TurnSemanticReview`/`aiReview`,`:50-66`)但全仓无生产者;实际摘要靠 943 行手写规则(扩展名集合、HTTP 状态码表)。
- AI commit message 要两级右键菜单(引擎→语言,`GitDiffPanel.tsx:2150-2248`),无默认一键无流式;`GitHistoryWorktreePanel.tsx`(1159 行)重新实现 stage/commit/AI-commit,与 GitDiffPanel 平行演化。
- terminal 零 addon(search/serialize/web-links grep 零引用),`terminalRuntime.ts` 已有 runtimeLog 后端通道但无"报错→问 AI"链路。
- code-annotations 批注只带行号不带内容快照(`codeAnnotations.ts:94-99`),行号漂移即失效。
- stale mock:`app-shell.startup.test.tsx:1172` mock 路径与实际模块不符,测试在跑真实 hook。
- diff/compare 组件族 6+ 个平行演化(4000+ 行),边界模糊。

**智能化机会**:接通 aiReview 生产者(turn 结束 engine 产出 facts,规则版降级 fallback);AI commit 一键+流式+自动分组建议;terminal"发送错误给 AI";批注锚点快照+漂移 AI 重定位;blame+LSP+history 合成问答("这段代码为什么存在");git-history 上下文感知解释与冲突建议。

**建议**:P0 拆 GitHistoryPanelImpl 去 `@ts-nocheck`、合并 fileViewPanel 双份纯函数、接通 aiReview、收敛 worktree/diff 重复逻辑;P1 AI commit 交互简化、terminal 能力补齐、批注锚点健壮化、外部变更事件驱动;P2 下线 legacy markdown 预览、diff 组件族重切分、live-edit-preview 升级改动导览、workspace 语义搜索。

### ⑥ 检索与导航(search / quick-switcher / project-map / workspaces)

**现状**:搜索纯词法且增量索引层未接线;三个搜索入口各自为政;project-map 是 AI 集成最深的模块(28.9k 行)但巨型文件扎堆、引擎响应解析脆弱。

> 💬 **大白话**:Cmd+K 搜索、快速切换器、项目地图(Project Map)。搜索是**纯关键词匹配**:你搜"登录逻辑"搜不到叫 auth 的文件;而且**每敲一个字都把全部消息索引重建一遍**——消息越多越卡。三个搜索入口(搜索面板/快速切换/会话内)各算各的分,同一条内容在不同入口排名不一样。项目地图是 AI 用得最深的功能(2.89 万行代码),但它给 AI 看的"证据"是**硬编码的 15 个文件名清单**——AI 只能看到有偏见的一小部分项目;解析 AI 回复要递归猜 8 层,猜错就 5 万字 prompt 原样重发(双倍 token)。建 worktree 的默认分支名是 `codex/日期-随机4位`,没有任何语义。

**关键问题**:
- `search/indexing/` 死代码;`messageProvider.ts:25-28` 每次击键全量重建消息索引;`ranking/score.ts:40-43` kind 优先级短路碾压匹配质量;recency 快照 mount 时加载一次,当前会话不生效(`useUnifiedSearch.ts:116`);三套独立打分实现口径不一。
- QuickSwitcher 无查询输入、硬上限 30 条(`types.ts:1`),与 SearchPalette 职责重叠;导航 contract 双层拦截靠注释维系(`useAppShellQuickSwitcherSection.ts:205-219` 一批显式 no-op);`isPlausibleAiRecentFilePath` 打地鼠正则黑名单(`recentFiles.ts:33-54`)。
- project-map:`ProjectMapPanel.tsx` 2001 行/38 useState;证据选取硬编码 15 个清单文件名+前缀规则,上限 24 文件/52k 字符(`projectMapGenerationWorker.ts:527-558`),AI 只能看到有偏切片;引擎响应 8 层递归嗅探解析(`:218-319`);进度日志每 10s 整库落盘(`useProjectMapDataset.ts:937-948`);JSON 修复重试双倍 token(`:1695-1707`);面板直接 import orchestration 存储跨层直写(`ProjectMapPanel.tsx:18-22`)。
- workspaces:`useWorkspaces.ts` 1009 行 god hook;错误契约=字符串模式匹配(`useWorktreePrompt.ts:109-217`);worktree 默认分支名硬编码 `codex/{date}-{random4}` 无语义;`useWorkspaceAgentMd.ts`/`useWorkspaceClaudeMd.ts` 90 行逐行复制;文件列表 30s 全量轮询。

**智能化机会**:语义搜索(复用 project-memory embedding 抽象,差距最大);三入口合一+搜索意图路由("上周 AI 改过的文件");project-map 证据检索 RAG 化(ROI 最高单点);worktree 智能创建(语义分支名/baseRef/setup script);QuickSwitcher frecency 排序。

**建议**:P0 project-map 生成管线契约化(structured output、落盘节流、修复重试瘦身)、统一搜索入口、search 索引层接线或删除+排序修复;P1 语义搜索接入、workspaces 错误契约结构化、worktree 智能创建、证据 RAG 化;P2 拆巨型文件、AI 活动流结构化上报、fs watcher 替代轮询。

### ⑦ 系统与运维面(settings / notifications / status-panel / runtime-log / debug / update / startup-orchestration)

**现状**:骨架扎实(startup-orchestrator、debug 聚合、runtime-log 事件流)但出口全是原始文本搬运;settings 是债务最重模块(2687 行 `@ts-nocheck`)。

> 💬 **大白话**:设置页、右下角通知、状态栏、运行日志、自动更新。有一个**真实 bug**:任何普通通知都会显示成红色错误样式——正确的判断函数其实写好了,就是没接线。设置页一个文件 2687 行且整页关了类型检查。checkpoint 的"AI 摘要"其实是用正则抠 `## Summary` 标题——AI 不写这个标题就没摘要;验证命令是写死的 8 套,根本不读你项目实际的 scripts。**最需要你人工确认的一条**:自动更新的下载源疑似指向了别人的仓库(上游原版 `zhukunpenglinyutong/desktop-cc-gui`,而你的 remote 是 `chenxiangning/codemoss`)——存在更新串线、拉到别人版本的风险。

**关键问题**:
- `SettingsView.tsx:1` 整文件 `@ts-nocheck`,40+ props、30+ useState;`SessionManagementSection.tsx` 2547 行等新巨型文件——拆分只是搬家;5 个 `SHOW_*_ENTRY = false` 隐藏半成品入口(`settingsViewConstants.ts:4-8`)。
- 真实 bug:`useGlobalRuntimeNoticeDock.ts:535-537` 任何 info 通知都显示为错误态,而正确的 `resolveGlobalRuntimeNoticeDockStatus`(`:423-437`)写好了没接线;`useStatusPanelData.ts:245` 二元引擎假设把非 codex 全标成 claude。
- checkpoint 摘要靠正则抠 `## Summary`(`checkpoint.ts:301-351`),模型不写标题就没摘要;验证 profile 硬编码 8 套命令(`:42-115`),不读项目实际 scripts。
- runtime-log 内嵌 140 行手写 shell/batch fallback 脚本仅支持 Java;退出码靠刮 `__EXIT__:N` 日志标记。
- update:`AUTO_UPDATE_ENABLED` 是编译期常量(`useUpdater.ts:41`);release notes 绑死手写 CHANGELOG 正则格式;**更新源指向疑似错误上游**(`tauri.conf.json:73` 指向 `zhukunpenglinyutong/desktop-cc-gui`,当前 remote 是 `chenxiangning/codemoss` fork——需确认发版策略,存在版本串线风险)。
- startup-orchestration 的 owner 注册表手工维护 17 条(7 条仍 legacy-hook),迁移做了一半;trace 耗时数据已采集但零利用。

**智能化机会**:runtime-log/debug/diagnostics 三处加"AI 分析此日志/错误"入口(tail+退出码+上下文→当前引擎,最高性价比);checkpoint 摘要 turn 结束主动生成;通知降噪+可执行修复动作;设置语义搜索(百项开关,复用 `initialHighlightTarget`);doctor/CLI 安装结果 AI 解读;release notes AI 生成;启动编排自适应调优。

**建议**:P0 修 dock status 判定、消 `SettingsView` `@ts-nocheck`、AI 日志分析入口、引擎标识收敛单一 util;P1 checkpoint 摘要主动化+默认引擎跟随活跃引擎、通知事件化+修复动作、验证 profile 探测实际脚本、设置语义搜索;P2 清理设置死代码与隐藏半成品、release notes 管线、startup trace 归因面板、debug 黑白名单外置。

### ⑧ 多模态与自动化(dictation / browser-agent / computer-use / collaboration)

**现状**:语音管线完整但纯机械转写;browser-agent 与 computer-use 名不副实——实为"上下文供给+诊断"设施,距真 agent 各差"接通已有半成品"一步。

> 💬 **大白话**:语音输入(麦克风按钮)、浏览器助手、电脑操作。语音现在是"**傻瓜转写**":说完话原文直接插进输入框,口语碎句、口误、错字全保留——而明明一行配置(`initial_prompt`)就能让 Whisper 认识你项目的术语,就是没用上;说完还得自己手改一遍。浏览器助手名不副实:前后端代码都写完了但**没人调用**,点击/输入动作被前后端**双重硬编码永久禁用**——它现在只能"看"不能"动"。computer-use 埋在设置页深处,用完结果就丢、和会话零集成。这三块都是"零件已齐、差一步接通"的典型。

**关键问题**:
- dictation:`real.rs` 1467 行 god-module;模型目录硬编码、大模型下载不可续传(`real.rs:701-702` 取消即删 `.partial`);无 VAD 无流式,120s 上限整段转写;**转写原文直插输入框零后处理**(`Composer.tsx:1664-1678`);`set_no_context(true)` 且未设 `initial_prompt`(`real.rs:1395`)——工作区术语注入唾手可得却没用;电平 30fps 直推 setState。
- browser-agent:`run_browser_agent_action` 完整实现(`mod.rs:2046-2227`)+ 前端 preview/gate 全套,**零调用方**;click/type 被前后端双重硬编码永久禁用(`browserActionPreview.ts:89,97`、`mod.rs:2079-2081`);gate 逻辑前后端重复且语义漂移;`<browser_context_v2>` 手写文本协议 786 行,section 顺序靠硬编码 nextKeys 耦合(`attachment.ts:466-771`);OCR 管线空壳(`ocrTextSupplements: []` 恒空);code candidates 产出 `src/**` 伪路径,仓库有 `code_intel` 却没用;正则脱敏只认英文关键词且对邮箱电话一刀切。
- computer-use:埋在设置页深处(`CodexSection.tsx:999`),与会话零集成;broker 阻塞式 600s 无流式无取消(`broker.rs:16`);结果卸载即丢无审计;沙箱固定 read-only;与 activation 共用一把锁互阻。
- collaboration:名不副实(实为 plan/code 模式选择器);硬编码白名单丢弃服务端能力(`useCollaborationModes.ts:86-90`);归一化逻辑双份;选择不持久化。

**智能化机会**:语音三层增强(Whisper `initial_prompt` 注入工作区词汇→LLM 清洗→语音命令识别),价值最高且成本极低;浏览器从手动 Dock 到真 agent(零件已齐,只差确认 UI 与会话接入);code candidates 接 code_intel 语义定位;computer-use 变会话可调用工具;协作模式意图推荐;三模块联动("语音说→附加浏览器快照→agent 请求动作")。

**建议**:P0 语音转写后处理、browser 动作管线接通或删除决策、废弃 `<browser_context_v2>` 改 JSON;P1 computer-use 会话化(流式/取消/审计)、code candidates 接 code_intel、dictation 续传+VAD+流式、gate 单一真源;P2 拆巨型文件、collaboration 重命名+持久化、脱敏升级、工程卫生项。

### ⑨ 治理与事实层(governance / operation-facts / spec / engine-task-output)

**现状**:governance 架构干净但只读静态;spec(Spec Hub)AI 集成最深、价值最高,但被 113KB 混淆文件卡住全部演进空间。

> 💬 **大白话**:Spec Hub(规格中心)是全仓 **AI 集成最深、价值最高**的功能——但它全部 UI 代码被压成一个 113KB 的混淆文件(变量名被搅乱成乱码)且关了类型检查,7 个 AI 提示词构建器埋在里面:**没人能 review、没人敢改、bug 无法定位**。有人做过"反混淆"分支(展开成 6111 行)但烂尾没合并。这是全仓最突出的技术债,也是治理层一切智能化的前置条件——想给 Spec Hub 加任何 AI 能力,都得先把这个文件"解压"回人话。

**关键问题**:
- **全仓最突出技术债**:`SpecHubPresentationalImpl.tsx` 113,565 字节混淆 + `@ts-nocheck`,7 个 AI prompt 构建器埋在里面无法 review;de-minify 提交 `b2736ba9b`(6111 行展开)在另一分支烂尾未合入;`useSpecHub.ts` 与混淆 Impl 存在双份实现(`extractThreadIdFromRpc`、apply prompt 构建),必然漂移。
- apply 结果契约脆弱:3 层 JSON 兜底解析(`useSpecHub.ts:197-238`)、兼容 4 种键名 3 种索引映射;任务回写逐条全量读写 tasks.md(`:1365-1419`),无事务,中途失败留半勾选状态。
- governance:同一组 gate 定义硬编码 4 处(`projectGovernanceProfile.ts:63-123, 278-308`、`gateArtifactEvidenceReader.ts:320-339`);`REPO_PATH_ANCHORS` 写死本仓库目录结构却用于任意工作区(`governanceEvidence.ts:8-18`);证据无刷新机制;3 个 adapter API 已导出无消费者(`harnessEvidenceAdapters.ts:104-187`)。
- operation-facts:1026 行启发式猜测汤;`computeLineDelta`(L857-877)对同行数重写返回 +1/-1,50 行重写显示成 1 行变更;与 `threadItemsFileChanges.ts`、`toolSemantics.ts` 三层猜测叠加。
- engine-task-output:引擎硬编码二选一,opencode 被静默标成 claude(`engineTaskOutputProjection.ts:84`);5s 轮询读产物文件;XML-in-text 契约+正则状态推断。
- spec-kit 支持是 stub:所有 action 映射到 `specify xxx --help`(`runtime.ts:1278-1294`)。

**智能化机会**:de-minify 后释放的现成资产(7 个 prompt 构建器、"AI 生成项目上下文");verify 失败语义诊断(定位到具体 requirement);apply 后 AI 对账(git diff vs checklist,不信任 agent 自报 index);治理证据 AI 解读+一键修复;子代理输出自动摘要。

**建议**:P0 合入/重做 de-minify(第一刀,前置条件)、消双份实现、任务回写批量事务化;P1 gate 定义集中化、半成品接线补齐或删除、证据闭环(刷新+运行检查动作)、引擎类型修正、轮询改事件驱动;P2 operation-facts 契约下沉+真实 diff 算法、timeline 持久化、spec-kit 补齐或隐藏、智能化增强(全部依赖 P0)。

### ⑩ 外壳与杂项(home / layout / theme / about / client-documentation / client-ui-visibility / note-cards / intent-canvas)

**现状**:layout 是全仓最重外壳层(2666 行 god hook);intent-canvas 数据/交互认真但无自动保存;多数模块完全静态零智能。

> 💬 **大白话**:首页、布局、便签(note-cards)、意图画布(Intent Canvas)。**最要命的一条:意图画布没有自动保存、退出时也不提示"有未保存修改"**,存盘还是两步非原子写——你画了一半的图,应用崩一下就丢。便签注入 AI 上下文时按"你勾选的顺序+字数硬截断",完全不考虑哪张便签和当前对话更相关。首页其实算了"最近的 agent 运行"数据但代码里用下划线标记弃用、不展示给你——现成的"继续上次工作"卡片素材在浪费。About 页的 GitHub 链接疑似还指着旧仓库。

**关键问题**:
- **数据丢失风险**:intent-canvas 无 autosave、返回无 dirty 确认(`IntentCanvasManager.tsx:507-519, 1379-1382`);存储两步非原子(`intentCanvasStorage.ts:713-735`),崩溃即索引漂移。
- `useLayoutNodes.tsx` 2666 行 god hook + `layoutNodesTypes.ts` 1323 行 prop 类型;响应式布局死代码(`useLayoutMode.ts:3-6` 硬编码 desktop);`DesktopLayout.tsx` 大量命令式 DOM 操作。
- home:`latestAgentRuns` 半成品(算出但 `Home.tsx:23-25` 下划线弃用不渲染);`TokenIndicator percentage={null}` 永久占位符(`HomeChat.tsx:237-241`)。
- about:GitHub 链接疑似过期(`AboutView.tsx:7` 指向旧个人仓库,当前 remote 已是 codemoss)。
- client-documentation:881 行纯中文硬编码文档树,无 i18n(应用本身有 4 套 locale)、无搜索;控件 ID 清单与 client-ui-visibility 双份维护(`clientUiVisibility.ts:18-39` vs `clientDocumentationData.ts:30-51`)。
- note-cards:1323 行单体面板;注入=勾选顺序+字符截断(`noteCardContextInjection.ts:3-12`),无相关性排序;`noteCardsFacade` 纯透传层可删。
- intent-canvas:链接全靠手敲 textarea;节点配色按英文 role 子串匹配(`scene.ts:271-288`),中文 role 全落灰;AI 只出站不进站(transmission context 协议完整但 AI 无法回写画布)。
- `MemoryPanel.tsx:6` 硬编码 `http://localhost:37777/` + 10s no-cors 探活。

**智能化机会**:home"继续上次工作"卡片(latestAgentRuns 数据现成);intent-canvas AI 生成画布/自动关联建议;note-cards 智能注入排序+摘要压缩;文档问答(sourceEvidence 路径作 citation);布局预设(专注/评审模式);会话 tab AI 一句话标题替代 7 字符截断。

**建议**:P0 intent-canvas 自动保存+原子写、latestAgentRuns 二选一、修 About URL、拆 `useLayoutNodes`;P1 note-cards 拆分+智能注入、canvas 链接自动建议、控件 ID 单一事实源+布局预设、响应式死代码二选一、MemoryPanel 可配置化;P2 文档 i18n/搜索/问答、主题运行时导入、引擎标签 util 收敛、删 noteCardsFacade。

### ⑪ openspec 规划一致性

**现状**:规划文档质量上乘(分层清晰、提案深、烂尾处置诚实),但治理闭环全靠人工,已追不上 AI 辅助的实现速度。

> 💬 **大白话**:openspec 是仓库的"项目管理账本":每个功能从提案→实现→验证→归档都要登记。现状是**账实不符**:索引说 6 个提案进行中,磁盘上实际 25 个;19 个功能代码已写完合并,账上还挂着"进行中";项目简介里的版本号还停在 0.7.5(实际 0.7.8)。为什么重要:你和 AI 助手都会照这个账本判断"哪些做完了、哪些还没做",账本过期就会导致重复立项或漏做。根因:记账全靠人工,而 AI 写码速度远超人记账速度。

**关键问题**:
- 索引漂移系统性:`changes/README.md:6` 声称 active=6,实测 25;archive 声称 648 实测 691;specs 计数 403/406/421 三个版本;`project.md` 停留在 2026-07-18、版本号还写 0.7.5(实际 0.7.8)。
- 19 个游离提案实现已落地(抽查 `src-tauri/src/engine/kimi.rs`、`pullRequestContent.ts` 均存在)但未 sync specs、18 个缺 verification.md——mainline spec truth 落后代码。
- 3 个索引内提案卡人工 trace gate 悬置 6 天+(既有 waiver 先例未用)。
- 烂尾教训:`2026-06-24-retire-opencode-and-gemini-cli` 48-task 大删除提案整体强制归档,留下"大颗粒删除型提案必须分片"的明确教训。
- **已在规划/已完成方向白名单**(本报告已避开):AI PR 标题/正文生成(`add-pr-ai-title-body-generator`)、prompt enhancer 入口(`add-composer-prompt-enhancer-entry`)、内置 Agent Catalog(`add-agency-agent-catalog`,248 角色)、source-aware 便签捕获(`unify-source-aware-note-capture-workbench`)、Quick Switcher 活动中心化(`enhance-quick-switcher-hub`)、记忆自动注入(已实现)。

**建议**:P0 收敛 19 个游离提案、索引成员资格 CI 检查+计数脚本化、处置 3 个悬置提案(waiver 或补 trace);P1 治理对账自动化(可做定时任务)、archive 强制 verification.md、Kimi 引擎收尾(pricing/扫描脚本);P2 phase2-roadmap 大扫除、delta 锚点 AI 预校准、提案模板加颗粒度闸门。

---

## "驾驭 AI" 智能化机会专题清单

> 💬 **大白话**:前面都在讲"病",从这里开始讲"药"。这一节把 28 个可以加 AI 的机会按"AI 替你干活"的程度分三档:Tier 1 是 AI 直接替你做判断(闭环,你点都不用点);Tier 2 是 AI 打下手、你确认;Tier 3 是让 AI 管项目管理本身。★=替你干,☆=帮你干。

按"AI 替代/增强用户操作"的程度排序(★=替代用户判断/操作,☆=增强体验):

### Tier 1:AI 直接替代用户的判断与操作(闭环级)

> 💬 **大白话**:这 10 件事做成后,AI 直接替你"做判断",形成闭环:任务做完 AI 自动验收、不合格自动打回(#1);diff 改完 AI 自动告诉你"这次改了什么、有没有问题"(#3);报错出现一键让 AI 诊断而不是自己读 `exit code 127`(#7);语音说完自动变成通顺的文字而不是口语碎句(#6)。共同特点:依赖的通道都已存在,主要是"接线"不是"发明"。

| # | 机会 | 替代的用户操作 | 现状证据 | 依赖 |
|---|---|---|---|---|
| 1 | ★ 任务验收自动判定:完成后派 reviewer turn 对照 acceptance,失败自动 request_changes | 人工逐条审查任务产出 | 完成检测="AI 停止说话"(`useAppShellKanbanExecutionSection.ts:1263-1271`);`reviewTask.ts` follow-up 已存在 | 打通 dispatch(P0) |
| 2 | ★ 接通 orchestration 派发闭环:候选→派发→运行→审核 | 手工把候选任务誊抄成会话 | flag 锁死 ~350 行已建成派发逻辑(`OrchestrationCenterView.tsx:21`) | 产品决策(推荐开通) |
| 3 | ★ AI diff review:turn 结束 engine 产出 `TurnSemanticReview` | 人工读 diff 判断改了什么 | schema/UI 就绪无生产者(`semanticDiffSummary.ts:50-66`) | 后端一个调用 |
| 4 | ★ 记忆摘要/分类 LLM 化 + 语义检索接线 | 机械规则决定记忆质量 | `outputDigest.ts:38-60` 正则截取;语义检索 544 行未接线 | 复用 `generateThreadTitle` 通道 |
| 5 | ★ AI 运行总结与失败归因(TaskCenter/看板卡片) | 人工翻 run 日志找结论 | 摘要=280 字符截断(`taskRunTelemetry.ts:33-61`) | 同通道 |
| 6 | ★ 语音→智能输入:`initial_prompt` 词汇注入 + LLM 清洗转写 | 用户手改口语碎句与错字 | `real.rs:1395` no_context;`Composer.tsx:1664-1678` 原文直插 | 极低 |
| 7 | ★ AI 日志/错误诊断(runtime-log/debug/terminal 三处共用) | 人工读 `exit code 127` 等原文 | 三处出口都是原文搬运;runtimeLog 数据已在后端 | 极低,纯前端接线 |
| 8 | ★ 浏览器真 agent:接通动作确认 UI + 会话 agent 发起 navigate/click | 用户手动操作浏览器 Dock | `run_browser_agent_action` 零调用方(`mod.rs:2046-2227`) | 确认 UI + gate 统一 |
| 9 | ★ 模型/effort 智能推荐 + 元数据注册表 AI 推断 | 手动下拉选模型、被伪徽章误导 | `modelMetadata.ts:15-35` 子串猜速度/成本 | P0 注册表 |
| 10 | ★ context-ledger 超预算一键瘦身建议 | 手动逐块 keep/exclude | 治理动作已枚举(`contextLedgerGovernance.ts:49-73`) | 推荐层 |

### Tier 2:AI 显著增强手动流程

> 💬 **大白话**:这 15 件是"AI 打下手、你拍板":建任务时 AI 帮你预填 797 行的大表单(#11);搜索从"逐字匹配"升级成"按意思搜"——搜"登录"能找到 auth(#12);checkpoint 摘要自动生成(#13);建 worktree 自动起个有意义的分支名(#14);在设置里用大白话搜"怎么关掉提示音"就能定位开关(#19)。仍需你确认,但省掉大量手工誊抄和翻找。

| # | 机会 | 证据/现状 |
|---|---|---|
| 11 | ☆ 任务创建 AI 预填(engine/model/调度/验收草稿) | 797 行手填表单 `TaskCreateModal.tsx`;标题双实现并存 |
| 12 | ☆ 语义搜索(messages/files/会话,复用 embedding 抽象) | 三入口全词法;`projectMemorySemanticRetrieval.ts` 抽象现成 |
| 13 | ☆ checkpoint 摘要 turn 结束主动生成 + 验证命令项目探测 | 正则抠 `## Summary`(`checkpoint.ts:301`);8 套硬编码 profile |
| 14 | ☆ worktree 智能创建(语义分支名/baseRef/setup script) | 默认名 `codex/{date}-{random4}`(`useWorktreePrompt.ts:355-357`) |
| 15 | ☆ 候选队列 LLM 整理(去重/合并/人话标题/排序) | `projectMapProvider.ts:266` 模板字符串 `Review ${node.title}` |
| 16 | ☆ "对话→prompt/skill"一键沉淀(AI 提炼模板/参数位) | enhancer 隐藏 session 通道已验证可行 |
| 17 | ☆ intent-canvas AI 生成画布 + 自动关联建议 | 链接全手敲;transmission 协议只出站不进站 |
| 18 | ☆ note-cards 相关性排序注入 + 摘要压缩替代字符截断 | `noteCardContextInjection.ts:3-12` slice 截断 |
| 19 | ☆ 设置语义搜索("怎么关掉提示音"→定位) | 30+ 子页上百开关;`initialHighlightTarget` 机制现成 |
| 20 | ☆ project-map 证据检索 RAG 化 | `filePriority` 15 个硬编码文件名(`:527-558`) |
| 21 | ☆ 供应商配置 AI 引导(key→探测模型→自动填映射) | `KimiProviderDialog` fetch-models 雏形已存在 |
| 22 | ☆ 协作模式(plan/code)意图推荐 + per-workspace 记忆 | 快捷键机械循环(`useComposerShortcuts.ts:94-103`) |
| 23 | ☆ computer-use 变会话内工具(agent 自动建议 GUI 操作) | 埋在设置页,600s 阻塞(`broker.rs:16`) |
| 24 | ☆ 通知降噪 + 可执行修复动作 | toast 只搬运事件(`useGlobalRuntimeNoticeDock.ts:249-301`) |
| 25 | ☆ 文档问答 + blame/LSP/history 合成问答 | 三个数据源前端可达,只差合成层 |

### Tier 3:AI 增强工程治理自身

> 💬 **大白话**:这 3 件是让 AI 管"项目管理本身":自动对账 openspec(提案和代码谁漂移了一目了然,#26)、发版说明从 commit 记录自动生成(#27)、根据已采集的启动耗时数据自动调优启动顺序(#28)。受益者是维护者,普通用户无感。

| # | 机会 | 证据 |
|---|---|---|
| 26 | ☆ openspec 治理对账自动化(漂移检测/archive 批次建议) | 三处计数全部漂移;2026-07-15 人工审计不可持续 |
| 27 | ☆ release notes 从 conventional commits AI 生成 | 仓库已是中文 Conventional Commits 规范 |
| 28 | ☆ 启动编排基于 trace 耗时自适应调优 | `startupTrace.ts:33-63` 数据已采集零利用 |

---

## 优先级路线图

> 💬 **大白话**:这是"先做什么后做什么"的总表。读法:P0 = 立即做(删垃圾、接电、修小 bug,几乎零风险);P1 = 本季度做(价值高但要动大手术);P2 = 地基级重构,有前置依赖,择机做不用急。

### P0:高价值低成本,立即做

> 💬 **大白话**:P0 的共同特点是**不需要新技术**:要么纯删垃圾(零风险)、要么把做好的东西接上电(比如"开通派发"核心就是改一行 `false`、修通知 bug 是把写好的函数接上)、要么是一行级的 bug 修复。建议从这批开始——见效快、风险低,而且是后面 P1/P2 的前置(不清死代码就重构,等于在错误的地基上盖楼)。

| # | 事项 | 理由 | 涉及模块 |
|---|---|---|---|
| P0-1 | **死代码大扫除**(分片小提案执行):composer 死实现与 bridge 死链路(~3600 行)、`parallel` 模块、`refreshCodexModelConfig.ts`、`latestAgentRuns` 死链、响应式布局死分支、legacy `FileMarkdownPreview`(先迁移 SkillsSection)、SettingsView 死开关字段 | 纯减法零风险;死代码持续误导后来者与 AI 协作者(本次调研即被腐化的 ARCHITECTURE.md 误导) | ①②③⑤⑦⑨⑩ |
| P0-2 | **开通 orchestration dispatch**(或明确删除):打开 `TASK_MODULE_ENTRYPOINTS_ENABLED`,补齐手动建任务表单 | "驾驭 AI"核心闭环已建成只差开锁;开锁成本远低于现状认知负担 | ② |
| P0-3 | **接通已建成半成品四件**:aiReview 生产者接线、记忆语义检索接线或删除、search 索引层接线或删除、browser 动作管线接通或删除 | 全是"差一步"的智能化资产;不接就是纯负债 | ②④⑤⑥⑧ |
| P0-4 | **AI 快速赢三件**:语音后处理(`initial_prompt`+LLM 清洗)、AI 日志/错误分析入口、任务 AI 验收判定 | 复用已有引擎通道,改动面小、用户感知最强 | ②⑦⑧ |
| P0-5 | **引擎标识/显示名/校验收敛单一事实源**,顺带修 `useStatusPanelData.ts:245` 二元假设与 `engineTaskOutputProjection.ts:84` 硬编码 | 9+ 处前缀推断 + 7+ 处显示名 + 双源 `isValidModelId` 不一致是确定性 bug 源;一行级修复混在其中 | ③⑦⑨⑩ |
| P0-6 | **已知真实 bug 修复批次**:通知 dock status 判定(`useGlobalRuntimeNoticeDock.ts:535-537`)、About GitHub URL、intent-canvas 自动保存+原子写(防数据丢失)、settings 加载失败静默 | 成本极低,用户可见 | ⑦⑩ |
| P0-7 | **SpecHub de-minify 合入**(基于已有 `b2736ba9b` 分支成果)+ 任务回写批量事务化 | 解锁 Spec Hub 全部 AI 资产的可维护性;是整个治理层智能化的前置条件 | ⑨ |
| P0-8 | **openspec 治理收敛**:19 个游离提案 sync/archive、索引 CI 检查、悬置提案 waiver 或补 trace | 低成本机械动作;spec truth 落后代码会产生冲突 delta | ⑪ |
| P0-9 | **拆 `useAppShellKanbanExecutionSection.ts`**(1614 行)为 `features/kanban/execution/*` 独立模块 | 看板执行逻辑挂根 hook 违反渲染红线精神,是 kanban bug 与渲染风险共同源头;拆分是②一切后续智能化的前提 | ② |
| P0-10 | **消 `GitHistoryPanelImpl.tsx` 与 `SettingsView.tsx` 的 `@ts-nocheck`**(可分 section 渐进) | git 高危操作与设置主组件无类型保护,回归事故温床 | ⑤⑦ |

### P1:高价值高成本或中价值低成本,本季度

> 💬 **大白话**:P1 是本季度的活,价值同样高但要动手术:统一模型元数据注册表(消灭所有"按名字猜"的徽章和推断)、把所有秒级轮询改成事件驱动、拆第二批巨型文件(threads 四巨石、布局、项目地图面板)、上语义搜索。之所以排在 P0 之后:先扔完垃圾再动刀,手术面才清晰。

| # | 事项 | 理由 | 涉及模块 |
|---|---|---|---|
| P1-1 | 统一模型元数据注册表,消灭全部字符串启发式;模型目录动态化(后端探测优先+内置兜底) | 一处维护 window/价格/速度/品牌;伪徽章误导用户;模型迭代不再要发版 | ③ |
| P1-2 | 事件驱动改造批次:AppSettings 订阅化、通知 dock/runtime 池、engine-task-output、文件外部变更 fs watch、commands/skills 目录 watch | 系统性触碰渲染红线;一处改多处受益 | ①⑤⑦⑨ |
| P1-3 | god hook/巨石拆分第二波:`useEngineController`(1008)、threads 四巨石(回放测试作安全网)、`useLayoutNodes`(2666)、`ProjectMapPanel`(2001)、session-activity/memory 面板 | 阻塞各自领域一切迭代;成本高故排 P0 减法之后 | ③④⑥⑩ |
| P1-4 | 统一搜索入口 + 语义搜索接入(复用 embedding 抽象)+ 排序修复 | 智能化差距最大项之一;基础设施已存在 | ⑥ |
| P1-5 | 任务创建 AI 预填 + 标题双实现统一 + 运行总结 AI 化 + 状态模型收敛(三套状态→一个 run 状态机+视图投影) | 797 行表单是任务系统最大摩擦;状态有损映射让每加一环智能都要再翻译一次 | ② |
| P1-6 | computer-use 会话化(流式/取消/审计)+ code candidates 接 code_intel + browser gate 单一真源 + `<browser_context_v2>` 已改 JSON 后接 OCR/截图确认 | 把"上下文供给设施"升级为差异化能力 | ⑧ |
| P1-7 | checkpoint 摘要主动生成 + 验证 profile 探测项目实际脚本 + 通知修复动作 + 设置语义搜索 | 摘要可用性从看运气变确定;设置已过百项 | ⑦ |
| P1-8 | 工程工具链增强:AI commit 一键+流式、terminal addon+错误入口、批注锚点快照+漂移重定位、worktree/diff 重复逻辑收敛 | 通道已通,纯前端改造 | ⑤ |
| P1-9 | note-cards 智能注入 + intent-canvas 链接自动建议 + 控件 ID 单一事实源+布局预设 + MemoryPanel 可配置 | 便签/画布是 AI 上下文调度天然入口 | ⑩ |
| P1-10 | project-map 证据 RAG 化 + 质量反馈环 + 生成管线落盘节流(若 P0 未含) | 地图质量上限的决定因素 | ⑥ |
| P1-11 | openspec 治理自动化(对账脚本+周报)+ archive 强制 verification.md + Kimi 引擎收尾 | AI 实现速度 >> 人工闭环速度的结构性矛盾 | ⑪ |
| P1-12 | worktree 智能创建 + workspaces 错误契约结构化(需后端配合) | 高频手动流程 AI 化;消除前后端脆性耦合 | ⑥ |

### P2:重构级,择机

> 💬 **大白话**:P2 是地基级重构,全部有前置依赖:比如拆输入框必须先清死代码(P0-1)、给 Spec Hub 加 AI 必须先做反混淆(P0-7)、语义搜索依赖记忆语义检索先接电(P0-3)。没到那个前置条件就做,等于把新代码堆进垃圾堆。择机即可,不用急。

| # | 事项 | 理由 | 涉及模块 |
|---|---|---|---|
| P2-1 | 引擎 loader/adapter 泛化:抽统一事件 schema,五套数千行复制收敛 | 新引擎接入成本;现有测试覆盖好,不急 | ④ |
| P2-2 | operation-facts 等启发式治本:engine/后端落结构化 file-change/task-notification 契约,前端启发式降级兜底 | 1026 行猜测汤维护成本随引擎数线性增长;涉及双端协议 | ⑤⑥⑨ |
| P2-3 | 技能调用契约结构化(替代 `/token` 文本拼接)+ "对话→prompt/skill"沉淀 + curated-skills 扩容或降级决策 | 牵涉 engine 双端协议与产品决策 | ① |
| P2-4 | Composer(2592 行/~190 props)按职责拆分,`ChatInputBoxAdapter` 随之消解 | 必须在 P0 死代码清理之后做,否则在错误基础上重构 | ① |
| P2-5 | Spec Hub 智能化增强:verify 语义诊断、apply 后 AI 对账、子代理输出摘要、治理证据 AI 解读 | 全部依赖 P0-7 de-minify,过早做会把新代码堆进混淆文件 | ⑨ |
| P2-6 | workspace 全文语义搜索 + 对话内语义搜索/Q&A | 全新能力,依赖索引基础设施 | ④⑤⑥ |
| P2-7 | 外壳层收尾:文档 i18n/搜索/问答、主题运行时导入 VS Code JSON、协作模式重命名+持久化、存储 key 集中化 | 用户触达率或风险较低 | ⑧⑩ |
| P2-8 | 存储层统一:kanban/orchestration/taskRun 按 workspace 分 key、localStorage 事件总线迁 clientStorage/后端单一事实源 | 防 app.json 再膨胀;改动面广 | ②③④ |
| P2-9 | 引擎诊断泛化(全引擎 doctor)+ AI 修复建议 + 模型智能推荐 + OpenCode 会话语义化 | 依赖 P1-1 注册表与 capability matrix 补全 | ③ |
| P2-10 | openspec 远期:phase2-roadmap 大扫除、delta 锚点 AI 预校准、提案颗粒度闸门入模板 | 吸取 48-task 烂尾提案教训 | ⑪ |

---

## 风险与注意事项

> 💬 **大白话**:这是"别踩坑"清单,对维护者最重要的四条:①有些方向项目里**已经立项了**(AI PR 生成、Agent Catalog、便签重构等),别照本报告重复做;②大扫除必须拆成多个小提案——历史上 48 个任务的大删除提案整体烂尾过,教训已记录;③**更新源指向疑似错误仓库、About 页链接过期**这两条要先人工确认再动,涉及发版安全;④执行前先 `git status`——你本地有 63 个未提交改动,别和在途工作打架。

1. **避免与在途规划重复投入。** openspec 已立项/已完成:AI PR 标题正文生成(`add-pr-ai-title-body-generator`)、prompt enhancer 入口(`add-composer-prompt-enhancer-entry`)、Agent Catalog(`add-agency-agent-catalog`,248 角色)、source-aware 便签捕获(`unify-source-aware-note-capture-workbench`)、Quick Switcher 活动中心化(`enhance-quick-switcher-hub`)、Kimi 引擎(`add-kimi-engine`,36/36 tasks 完成但 pricing/扫描脚本未收尾)、记忆自动注入(已实现)。本报告相关条目(如①的 enhancer 改造、⑩的 note-cards)应设计为与其衔接而非另起炉灶。

2. **大重构的前置依赖链**:
   - Spec Hub 任何改动 → 先 P0-7 de-minify,否则在混淆文件上赌博;
   - Composer 拆分 → 先 P0-1 死代码清理;
   - 语义搜索/证据 RAG → 依赖 P0-3 记忆语义检索接线(共用 embedding 基础设施);
   - 模型智能推荐 → 依赖 P1-1 元数据注册表与 capability matrix 补全;
   - operation-facts/活动流结构化 → 依赖 engine 事件协议演进(双端改动,成本最高)。

3. **大颗粒删除型提案是烂尾重灾区。** `2026-06-24-retire-opencode-and-gemini-cli`(48 tasks)整体强制归档的教训已被官方记录:"未来应新建小型、按 capability 分片的 change"。P0-1 死代码大扫除必须拆成多个小提案执行,禁止打包成一个大重构提案。

4. **疑似/需验证项**(子代理证据充分但建议独立复核):
   - 更新源指向:`tauri.conf.json:73` 端点为上游 `zhukunpenglinyutong/desktop-cc-gui` 而当前 remote 是 `chenxiangning/codemoss`,fork 发版存在版本串线风险——需确认发版策略后处置;
   - `AboutView.tsx:7` GitHub 链接疑似过期,同需确认;
   - `usePromptHistory` 面板发送不累计热度为"未查见调用点"的负面证据,建议落手前再验证一次。

5. **在途工作与本报告快照的时间差。** 当前分支 63 个 dirty 文件 + 3 个未入库提案(`enhance-quick-switcher-hub` 等)说明部分模块正在被改;执行 P0 前建议先 `git status` 核对目标文件是否有在途改动,避免与在途工作冲突。

6. **轮询改造需遵守仓库红线而非另立标准。** AGENTS.md 明确"事件驱动 + ≥30s 兜底轮询,禁秒级轮询";P1-2 批次应按此标准逐项核对,且渲染风暴排查方法以 `docs/perf/render-jank-knife-experiments-2026-07-08.md` 为准,改动前重新测量。

7. **范围声明。** 画布/幕布渲染管线、project-map 图形渲染性能未在本次评估范围;本报告所有问题陈述均可追溯到 11 组子代理源码调研的文件路径证据,未引入外部信息。

---

*报告完。证据基础:11 组并行源码调研子代理报告(2026-07-24),覆盖除画布渲染外全部辅助功能模块。*
