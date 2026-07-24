# P0 治理清单 · 重定义优先级与决策看板

> 日期:2026-07-24(当日晚已更新执行记录,见第〇节)
> 基线:分支 `feature/v-078` @ `a9c479d57`(执行后 HEAD 已推进,见第〇节)
> 来源:对原 P0-1 ~ P0-10 清单(出自 `client-aux-modules-optimization-report-2026-07-24.md`)逐项代码核查后的修订版
> 用途:**给决策者看**。每项任务写清楚:解决什么问题、UI 表现是什么、做了得到什么、不做会失去什么。你看完可以直接勾"做 / 不做 / 缓一缓"。

---

## 〇、执行记录(2026-07-24 晚 · 已闭环)

**P0 四项 + 顺手两件已全部执行完毕并通过独立 review。** 本文第三、四节保留作为决策依据存档,最新状态以本节为准。

### 已交付(按 OpenSpec 闭环:proposal → 实现 → verify → sync → archive)

| 项 | 状态 | Change(已归档) | 关键提交 |
|---|---|---|---|
| P0-1 settings 静默修复 | ✅ 完成 | `2026-07-24-preserve-corrupted-app-settings-on-load` | `a1dd0795b`(前端 toast)+ `c3d472a34`(Rust quarantine) |
| P0-2 引擎二元假设 + isValidModelId | ✅ 完成 | `2026-07-24-fix-engine-attribution-and-model-id-validation` | `38e139b37` + `bfb61b9e2` |
| P0-3 SettingsView 摘 nocheck + 死分支 | ✅ 完成 | `2026-07-24-remove-settings-view-ts-nocheck-and-skills-dead-branch` | `29ef72543` / `37d545f4f` / `b1a2ea4a5` |
| P0-4 specs 索引补登 | ✅ 完成 | (docs 校准单 commit,按惯例不走提案) | `0a723b7ec` |
| Review 修复①:quarantine 打通前端通知 | ✅ 完成 | `2026-07-24-notify-settings-recovery-after-corruption` | `ae0927a17` + `615733516` |
| Review 修复②:openspec 索引终态校准 | ✅ 完成 | (docs 校准单 commit) | `6bb5fc5f0` |

### 独立 review 结论(6 视角并行审查)

- **代码全绿**:1717 前端用例 + 1550+ Rust 用例、eslint、typecheck、openspec strict(434/434)、两道治理门全部通过;15+ 提交卫生审计零互相误带。
- **review 抓到并已修复的两个真问题**:
  1. P0-1 初版 toast 在主场景不触发(后端启动期 quarantine 后 `get_app_settings` 恒返回 Ok)——已由 `notify-settings-recovery-after-corruption` 补齐:quarantine 时记录 notice,前端经新命令 `take_settings_recovery_notice`(take 语义,只弹一次)拉取并提示,zh/en locale 已补 key。
  2. 并行归档把 openspec 索引再次搞漂移(幽灵 capability 死链、2 个新 spec 漏登、Archived 计数三处矛盾 717/719/720)——已由 `6bb5fc5f0` 终态校准:索引=文件系统=430 specs / 721 archived / 4 active,另补登了 45 条预存漏登归档、修正 07 月月度计数(142→188)。
- **预存问题(非本批引入,留待后续)**:`read_workspaces` 对 workspaces.json 有同类静默回退风险;2 个 daemon 进程组测试在本机沙箱确定性失败;约 120 个 spec.md 的 Purpose 残留归档模板 TBD。

### 遗留跟进项(从 review 派生,未排期)

- `Composer.tsx:674` 第三个 `useStatusPanelData` 调用点未传 `activeEngine`(当前无可见影响,潜伏残留)
- unknown→claude fallback 静默无日志;vendors 侧存量非法 model id 被静默过滤(低概率)
- `daemon_state.rs` 3320 行,越 3000 行红线;`GitHistoryPanelImpl.tsx` 2803 行越 2800 档且该档 gate 未生效(原清单 #20)

---

---

## 一、先看结论:原清单已有 3 项完成,不用再决策

| 原清单项 | 状态 | 兑现方式 |
|---|---|---|
| P0-2 开通 orchestration dispatch | ✅ 已闭环 | 走了"或明确删除"分支:整个编排中心(~4940 行)已删除并归档(`2026-07-24-remove-project-map-orchestration-center`) |
| P0-6③ intent-canvas 自动保存+原子写 | ✅ 已落地 | 原子写(tmp+rename)+ 每次变更立即持久化均已实现(`020ebee85` 起) |
| P0-3③ search 索引层 | ✅ 已结案 | 按"删除"路径处理,~780 行已删(`d1a90dddd`) |
| P0-8 前半"19 个游离提案" | ✅ 已归档 | `af472a2c4` 一次性归档 19 个并同步主 specs |

**剩下需要决策的是 14 项任务**,按新优先级分三档:

---

## 二、新优先级总览

> 状态更新(2026-07-24 晚):P0 四项已 ✅ 完成(详见第〇节);P1-12 的"索引校验脚本"仍未做,当晚索引再次漂移的事实进一步证明了它的必要性。

| 新优先级 | # | 任务 | 一句话代价(不做会怎样) | 用户能直接感知? |
|---|---|---|---|---|
| **P0 立即做** | 1 ✅ | settings 加载失败静默修复 | 设置文件损坏一次 → 全部设置被默认值覆盖,不可逆丢失 | 出问题时感知极强 |
| | 2 ✅ | 引擎二元假设 bug 修复(2 处) | kimi/opencode 用户的状态面板输出被错标成 "Claude" | 多引擎用户可见 |
| | 3 ✅ | SettingsView 摘 @ts-nocheck + 删 skills 死分支 | 设置页藏着一段永远渲染不出来的死代码 | 无直接感知 |
| | 4 ✅ | specs 索引补登 26 项 | spec 索引与代码事实源漂移,AI 协作者被误导 | 无直接感知 |
| **P1 高 ROI** | 5 | aiReview 生产者接线 | 已建好的 AI 评审展示位永远空着 | 有(git 语义评审面板) |
| | 6 | browser 动作管线:接通或删除 | 后端完整实现的动作执行能力零调用方,纯负债 | 有(浏览器自动化) |
| | 7 | 死代码大扫除收尾(6 小项) | 死代码持续误导后来者与 AI 协作者 | 无直接感知 |
| | 8 | 任务回写批量事务化 | 批量勾选任务时 N 次整文件读写,慢且有中途失败风险 | 有(Spec Hub 批量操作变快) |
| | 9 | 语音后处理(initial_prompt + LLM 清洗) | 语音输入无术语纠正、口语原文直插输入框 | 有(语音输入质量) |
| | 10 | AI 日志/错误分析入口 | 报错时只能自己读原始日志 | 有(Debug 面板多一个按钮) |
| | 11 | 拆 kanban 执行根 hook(1432 行) | 看板"AI 停止说话即完成"误判持续存在;违反渲染红线 | 有(看板状态误判减少) |
| | 12 | openspec 索引一致性校验脚本 | 索引漂移会再次发生,且无机制拦截 | 无直接感知 |
| **P2 需先决策** | 13 | 记忆语义检索 | 需先决策 embedding 方案,不是"差一步" | 有(记忆召回质量) |
| | 14 | 引擎 registry 单一事实源 | 大重构,10+ 处显示名/数百处前缀推断 | 间接(后续 bug 减少) |
| | 15 | SpecHub de-minify 重做 | AI 无法维护 113KB 单行 minified 文件 | 无直接感知 |
| | 16 | GitHub URL / rebrand 决策 | About 页指向原作者仓库;updater 同源 | 有(About 页链接) |
| | 17 | 任务 AI 验收判定 | 依赖的 reviewTask 机制已被删除,需重建 | 有(任务验收自动化) |
| | 18 | GitHistoryPanelImpl 类型化(扩 scope) | 上游 4 个文件全是 nocheck,~150 字段 any 透传 | 无直接感知 |
| **顺手修** | 19 | dock streaming 死分支清理 | 原 P0-6① 已证实不是 bug,是死代码 | 无 |
| | 20 | large-file gate 2800 档未生效 | GitHistoryPanelImpl 2803 行已破红线但 gate 没拦 | 无 |

---

## 三、逐项决策卡片

### P0-1 · settings 加载失败静默修复

**解决什么问题**
设置文件(JSON)一旦损坏,前后端两层都无声回退默认值:前端 `useAppSettings.ts:581-583` 是空 catch;后端 `state.rs:99` 和 `daemon_state.rs:166` 都是 `unwrap_or_default()`。**更危险的是**:回退后任意一次保存设置,会把默认值覆盖写回磁盘——用户原来的设置即使能手动修复,也已经被冲掉了,不可逆。

**UI 表现**
- 现在:设置文件坏了 → 用户看到所有设置"神秘重置",无任何提示,且再也找不回来。
- 做之后:设置加载失败 → 用户看到明确提示(如"设置文件损坏,已备份为 xxx.bak 并回退默认值"),损坏文件被隔离备份而不是被覆盖。

**做的收益**:消除一个确定性的用户数据丢失路径;修复成本低(前端 catch 加 log+提示,后端 parse 失败时先备份再回退)。
**不做的代价**:任何一次磁盘/并发写事故都可能让用户全部设置不可逆丢失,且无法归因(静默)。对比:project-map 已有 quarantine 机制,settings 链路没有。
**工作量/风险**:小 / 低。半天级。
**证据**:`useAppSettings.ts:581-583`、`src-tauri/src/state.rs:99`、`src-tauri/src/bin/cc_gui_daemon/daemon_state.rs:166`、`src-tauri/src/storage.rs:257`。

---

### P0-2 · 引擎二元假设 bug 修复

**解决什么问题**
代码里两处"非 codex 即 claude"的二元假设,在已有 5 个引擎(claude/codex/gemini/kimi/opencode)的现实下是确定性 bug:
- `useStatusPanelData.ts:245`:`engine: isCodexEngine ? "codex" : "claude"`
- `engineTaskOutputProjection.ts:84`:同样的三元写法,且类型 `EngineTaskOutputEngine = "claude" | "codex"` 本身就是二元的。

**UI 表现**
- 现在:用 kimi / opencode / gemini 引擎跑任务时,状态面板的 subagent 输出**全部被错误标注为 "Claude"**。
- 做之后:状态面板显示真实引擎名。

**做的收益**:修掉确定性 mislabel;顺带统一 `isValidModelId` 双源(vendors 版不校验格式、composer 版校验,两处正则还不一样),消除"同一个 model id 在 A 对话框合法、在 B 对话框非法"的不一致。
**不做的代价**:多引擎用户看到错误信息且无法自知;`isValidModelId` 不一致是随时会爆的校验 bug 源。
**工作量/风险**:小 / 低。注意":84 一行修复"实际需要同步放宽 `EngineTaskOutputEngine` 类型与调用方契约,仍是小改。
**证据**:`useStatusPanelData.ts:245`、`engineTaskOutputProjection.ts:84`、`engine-task-output/types.ts:3`、`vendors/types.ts:24-29` vs `composer/types/provider.ts:14-19`。

---

### P0-3 · SettingsView 摘 @ts-nocheck + 删 skills 死分支

**解决什么问题**
`SettingsView.tsx`(2687 行)第 1 行仍是 `// @ts-nocheck`。实测摘掉后只有 **6 个 error**,其中混着一个真问题:`SettingsView.tsx:2460` 的 `activeSection === "skills"` 分支恒为 false(section union 里根本没有 `"skills"`,curated skills 已迁到 MCP 的 skills subtab)——一段永远渲染不出来的死 JSX,被 nocheck 掩盖至今。

**UI 表现**
- 现在:无用户可见异常(死分支本来就走不到)。
- 做之后:无 UI 变化,但设置页重新获得类型保护,今后改设置页时 tsc 能拦住真错误。

**做的收益**:6 个 error 一次清完,顺手删掉一处确定死代码;该文件的叶子 section(`settings-view/` 子目录)早已全部 typed,只剩壳子。
**不做的代价**:设置页每加功能都在无类型保护下叠加,2687 行继续膨胀。
**工作量/风险**:小 / 低。同仓库已有成功先例(app-shell 系的 shrink-first 模式)。
**证据**:`SettingsView.tsx:1`、`:2460`;`settings-view/settingsViewAppearance.ts:4-20`;实测 tsc 摘 nocheck 仅 6 error。

---

### P0-4 · specs 索引补登 26 项

**解决什么问题**
`openspec/specs/README.md` 自称覆盖 **403** 个 capability,实际目录有 **429** 个——07-24 归档批次同步进来 26 个 spec 没登索引(`kimi-engine-runtime`、`curated-agent-catalog`、`pr-ai-content-generation` 等)。`config.yaml` 的统计数字同样陈旧。

**UI 表现**:无 UI。影响的是人和 AI 协作者查 spec 时的可信度。
**做的收益**:纯文档修复,立刻消除"spec truth 落后代码"的漂移;是后续一切 openspec 治理的基础。
**不做的代价**:索引与事实源持续不符,下次基于索引做的任何治理决策都建立在错数上。
**工作量/风险**:极小 / 零风险。一小时内。
**证据**:`openspec/specs/README.md`(403)vs `ls openspec/specs/`(429);diff 清单已在核查中列出。

---

### P1-5 · aiReview 生产者接线

**解决什么问题**
git 语义评审的 schema(`TurnSemanticReview.aiReview`)和消费端 UI 展示逻辑都建好了,但唯一的生产调用点 `WorkspaceSessionActivityPanel.tsx:622-628` 调用时**不传 aiReview 参数**——展示位永远空着。全仓没有任何代码构造 aiReview。

**UI 表现**
- 现在:Session Activity 面板的语义 diff 评审区,永远只有基础事实,没有 AI 评审结论。
- 做之后:每个 turn 的 diff 会附带 AI 生成的语义评审(改了什么、风险点),直接显示在已有 UI 位上。

**做的收益**:真"差一步"——schema、消费端、展示位全齐,只差生产者调用一次引擎。复用已有引擎通道,改动面小。
**不做的代价**:一套完整的智能化资产空转,占着代码与认知负担。
**工作量/风险**:小-中 / 低。
**证据**:`semanticDiffSummary.ts:50-66`(schema)、`:778`(消费端 `addAiReviewFacts`)、`WorkspaceSessionActivityPanel.tsx:622-628`(不传参的调用点)。

---

### P1-6 · browser 动作管线:接通或删除

**解决什么问题**
browser-agent 的"动作执行"段:后端命令 `run_browser_agent_action` 已注册且实现完整(含 gate/audit/确认逻辑,`browser_agent/mod.rs:2046`),前端 invoke wrapper 和确认门也齐了,但**没有任何 UI/管线调用方**。死的只是动作执行段;只读部分(快照采集等)是活的。

**UI 表现**
- 现在:用户无法让 AI 在浏览器里执行任何动作(点按钮、填表单),能力不存在于 UI。
- 做之后(接通):浏览器 agent 从"只能看"变成"能操作",动作前有确认预览门。
- 做之后(删除):代码清零,负债消除。

**做的收益**:二选一都有收益。接通 = 解锁一个差异化能力;删除 = 去掉一批永远走不到的代码路径。
**不做的代价**:Rust 侧一大段含安全 gate 的复杂代码无人调用,维护与安全审计都把它当活代码对待,纯负债。
**工作量/风险**:中 / 中(接通需设计动作入口 UI;删除为纯减法)。
**证据**:`command_registry.rs:48`、`browser_agent/mod.rs:2046`、`services/tauri/browserAgent.ts:172`、`browserActionExecution.ts:10`;grep 确认零生产调用方。

---

### P1-7 · 死代码大扫除收尾(6 小项)

**解决什么问题**
原 P0-1 已完成 2/3(composer 死实现 ~2500 行、parallel 模块已删),剩 6 个已验证的小项:
1. **bridge no-op 桩**(73 行,`composer/utils/bridge.ts`)+ providers 里的死链调用点——前序提案明确许诺了 `remove-jcef-bridge-noop-stubs` 提案但没落地;
2. `refreshCodexModelConfig.ts` 8 行纯透传层(活链路上的冗余抽象,应内联);
3. `latestAgentRuns` 死链(`Home.tsx:23-25` 下划线弃用,`app-shell.tsx:1052` 仍计算下传);
4. 响应式布局死分支(`useLayoutMode.ts` 硬编码 `"desktop"`,Phone/TabletLayout 永远走不到仍参与打包);
5. SkillsSection 迁移到 Fast 管线后删 legacy `FileMarkdownPreview`(1581 行双管线并存);
6. SettingsView 5 个 `SHOW_*_ENTRY = false` 死开关连死 JSX 分支。
外加 P0-2 删除案残留的 `orchestrationTaskId` 等死字段(已无生产方)。

**UI 表现**:无(全是减法)。唯一间接效果:删掉 Phone/Tablet 分支可减小打包体积。
**做的收益**:死代码是 AI 协作者和后继开发者的主要误导源(本次调研即被腐化的 ARCHITECTURE.md 误导);全部单项几十到几百行,纯减法零风险。
**不做的代价**:误导持续累积;每次大调研都要重新为这些死代码付一次"甄别税"。
**工作量/风险**:小 / 极低。建议拆 3 个小提案执行(bridge / latestAgentRuns+布局 / FileMarkdownPreview+透传层+死开关)。
**证据**:各项行号已在核查中逐一确认未漂移。

---

### P1-8 · 任务回写批量事务化

**解决什么问题**
Spec Hub 批量勾选任务完成状态时,`useSpecHub.ts:1368-1387` 对任务**逐条 for 循环**调用 `updateSpecTaskChecklist`,底层每次都独立执行「读 tasks.md → 改一行 → 写整个文件」:N 个任务 = N 次读 + N 次整文件写 + N 次 IPC。失败回滚是 best-effort 逐条反向 toggle,不是事务。

**UI 表现**
- 现在:批量勾选多个任务时,面板逐条转圈,数量多时明显变慢;中途失败可能留下"改了一半"的 tasks.md。
- 做之后:批量操作一次完成,要么全成要么全回滚。

**做的收益**:`spec-core/runtime.ts` 增加单次 read-modify-write 的 batch API,一次 IPC 写回全部——工作量小、风险低,可与 de-minify 解耦单独先做。
**不做的代价**:批量场景慢;极端情况(进程崩溃在两次写之间)留下不一致的任务状态。
**工作量/风险**:小 / 低。
**证据**:`useSpecHub.ts:1349-1435`、`src/lib/spec-core/runtime.ts:1037-1096`;grep 确认 runtime 无任何 batch API。

---

### P1-9 · 语音后处理(initial_prompt + LLM 清洗)

**解决什么问题**
两件事:(a) Whisper 转写没有注入 `initial_prompt`(工作区术语词表),`real.rs:1395` 甚至设了 `no_context(true)`;(b) 转写文本经 `computeDictationInsertion`(只处理英文词边界空格)后**原文直插输入框**,无任何 LLM 清洗(去口头禅、修正识别错的专业术语)。

**UI 表现**
- 现在:语音输入说"用 react 的 use effect",出来可能是"用 react 的 use effective"或中英混杂的口语原文,用户要手动改。
- 做之后:项目术语(API 名、库名)识别准确率显著提升;插入输入框前可经 LLM 清洗成通顺的技术表述。

**做的收益**:复用现成资产——prompt enhancer 已提供"用当前引擎跑一次 LLM"的通道(`sessionPurpose: 'prompt-enhancer'`),只差接到 dictation 链路上。用户感知最强的一类改动。
**不做的代价**:语音输入功能停留在"能转字"水平,专业场景不可用。
**工作量/风险**:小-中 / 低。`initial_prompt` 是 whisper 一行参数的事;LLM 清洗复用已有通道。
**证据**:`src-tauri/src/dictation/real.rs:1388-1423`、`Composer.tsx:1661-1688`、`utils/dictation.ts`、`usePromptEnhancer.ts`。

---

### P1-10 · AI 日志/错误分析入口

**解决什么问题**
日志基础设施齐全(采集、脱敏、持久化、diagnostics bundle 都有),但三个出口(runtime-log / Debug 面板 / terminal)全是**原文搬运**。Debug 面板只有 copy / clear 两个按钮,没有"用 AI 分析这段日志"入口。

**UI 表现**
- 现在:报错 → 用户打开 Debug 面板 → 面对一屏原始日志自己读,或复制出来贴给 AI。
- 做之后:Debug 面板多一个"AI 分析"按钮 → 一键把当前错误上下文发给引擎 → 面板内显示归因分析与修复建议。

**做的收益**:纯前端接线(数据都在后端),复用引擎通道;是用户卡顿时最高频的求助路径。
**不做的代价**:错误诊断完全靠用户自己,工具已有的日志资产价值没兑现。
**工作量/风险**:小 / 低。注意:进行中的 `stabilize-client-runtime-and-diagnostics` 提案只做日志聚合/脱敏,不含 AI 分析,不冲突。
**证据**:`DebugPanel.tsx:108-113`、`clientErrorLog.ts`、`src-tauri/src/diagnostics_bundle.rs`。

---

### P1-11 · 拆 kanban 执行根 hook(1432 行)

**解决什么问题**
`useAppShellKanbanExecutionSection.ts`(原 1614 行,编排派发部分已随删除案移除,现 1432 行)仍整体挂在 AppShell 根 hook 链:内含 ~15 个 useCallback + 9 个 useEffect,包括 20s `setInterval` 轮询调度器、执行锁、thread 对账、telemetry 回写。这直接触碰 AGENTS.md 渲染红线(根链禁秒级轮询、高频 setState 禁挂根 hook)。**同时它是看板 bug 源头**:任务完成判定是"AI 停止输出"启发式(`:1082-1095`),AI 中途停顿就会被误判完成、卡片自动从 inprogress 挪到 testing。

**UI 表现**
- 现在:看板卡片偶尔"自己跑到 testing 列";长任务执行中 UI 有周期性卡顿风险(根链轮询触发重渲染)。
- 做之后:逻辑迁入 `features/kanban/execution/` 独立模块,根 hook 只剩薄接线;为后续修复完成误判(接入真实验收信号)铺平道路。

**做的收益**:前置工作已就绪——调度/串联/快照纯函数已下沉到 `features/kanban/utils/`,TaskRun 生命周期在 `features/tasks/utils/`。剩余是把 4 个 effect 族迁出。这是 P2-17(任务 AI 验收)和一切看板智能化的前提。
**不做的代价**:误判 bug 持续;每次改看板都要在 1432 行根 hook 里动刀,渲染风险与冲突风险双高。
**工作量/风险**:中 / 中。拆分时保持行为不变,有现成纯函数层兜底。
**证据**:`useAppShellKanbanExecutionSection.ts:51`(轮询)、`:1082-1095`(完成启发式)、`:1421-1431`(9 个 handler);`features/kanban/execution/` 目录尚不存在。

---

### P1-12 · openspec 索引一致性校验脚本

**解决什么问题**
07-24 的索引收敛是手工做的,做完当天 specs 索引就漂移了 26 项(见 P0-4)——没有任何机制拦截。CI 里 5 个 workflow 无一涉及 openspec;`package.json` 也没有校验脚本。

**UI 表现**:无。
**做的收益**:一个脚本(对比 `openspec list` ↔ changes/README.md、specs 目录 ↔ specs/README.md),挂进 CI 或 pre-commit,索引漂移从此无法入库。
**不做的代价**:每次治理收敛都是一次性的,漂移必然复发。
**工作量/风险**:小 / 零风险。
**证据**:`.github/workflows/` 全目录 grep openspec 零命中。

---

### P2-13 · 记忆语义检索

**解决什么问题**
544 行向量索引(`projectMemorySemanticRetrieval.ts`)和语义分支(`memoryScout.ts:262-286`)都在,但生产调用点不传 `semanticProvider`,永远走词法回退。**更关键的是:`ProjectMemoryEmbeddingProvider` 全仓只有接口,没有任何生产实现**——具体 provider 只存在于测试工厂里。

**UI 表现**
- 现在:记忆召回只靠关键词匹配,"部署"召不回"上线"相关的记忆。
- 做之后:语义相近的记忆都能召回,跨会话上下文质量显著提升。

**做的收益 / 不做的代价**:做好了是记忆系统的质变;但**这不是"差一步",是"差一个 embedding 方案 + 实现 + 接线"**。不做的代价是 544 行骨架继续空转。
**决策点(你需要先定的)**:embedding 方案——本地小模型(隐私好、体积大)还是复用引擎通道(依赖引擎、零本地成本)?定了方案才能估工作量。
**建议**:单独立项,先出方案决策,不要按原清单"差一步接通"估算。
**证据**:`projectMemorySemanticRetrieval.ts`(544 行)、`memoryScout.ts:262-286`、`useThreadMessaging.ts:536-541`(不传 provider 的调用点)。

---

### P2-14 · 引擎 registry 单一事实源

**解决什么问题**
P0-2 修的是两处二元假设 bug,那只是冰山一角:全仓有 **7 个独立的 engine 前缀推断函数** + 数百处内联 `startsWith("claude:")` 判断 + **10+ 处显示名映射**,且取值互不一致("Claude Code"/"Claude"/"Claude CLI" 并存)。Rust 侧还有自己的 `infer_engine_label`。

**UI 表现**
- 现在:同一个引擎在不同界面显示不同名字(顶栏 "Claude"、对话框 "Claude Code"、通知里又是另一个写法)。
- 做之后:全端统一,新增引擎只需在 registry 加一行。

**做的收益**:这是"加第 6 个引擎"的前置条件;消除一整类确定性 bug 源。
**不做的代价**:每加一个引擎要在 10+ 处手改,漏一处就是一个新 bug;显示名不一致持续存在。
**决策点**:大重构,建议作为独立 change 排在 P0-2 bug 修复之后,不要和 bug 修复混在一起。
**证据**:推断函数 7 处(`useThreadTurnEvents.ts:42`、`sharedRealtimeAdapter.ts:407`、`sidebarInternals.ts:110` 等);显示名映射 10+ 处(完整清单在核查报告中)。

---

### P2-15 · SpecHub de-minify 重做

**解决什么问题**
`SpecHubPresentationalImpl.tsx` 是 **25 行、113KB 的 minified bundle**——人和 AI 都无法维护,整个 Spec Hub 的 AI 资产(任务回写、分析等)都挂在它上面。5 月的 de-minify 成果(`b2736ba9b`,6111 行展开版)只在 upstream 旧分支,基底已漂移两个月,不能直接合入。

**UI 表现**:无直接 UI 变化。
**做的收益**:**对 HEAD 当前 bundle 重新 prettier 展开**(复用旧分支的 helpers 拆分结构与 eslint/baseline 配套),让 Spec Hub 从"改不动"变成"可维护";这是治理层智能化的前置条件。
**不做的代价**:Spec Hub 任何 UI 改动都要在 minified 代码上做,实际上等于冻结;AI 协作者对该文件完全无能为力。
**决策点**:不要试图合入旧分支;重做展开即可。工作量中,风险中(需对齐 `980db5f9a` 之后的那行 import 改动)。
**证据**:`b2736ba9b` 存在于 `upstream/refactor/migrate-css-to-coss-ui`;`git merge-base --is-ancestor` 确认未合入 HEAD;HEAD 版本 md5 已不同。

---

### P2-16 · GitHub URL / rebrand 决策

**解决什么问题**
About 页 `GITHUB_URL` 指向原作者仓库(`zhukunpenglinyutong/desktop-cc-gui`),而本仓库是 `chenxiangning/codemoss`。同源 URL 还散在 updater endpoint、release.yml、bundle identifier(`com.zhukunpenglinyutong.ccgui`)里,且有测试**锁死** updater 指向上游。

**UI 表现**
- 现在:用户点 About 页 "GitHub" → 跳到原作者仓库,不是这个 fork。
- 做之后:指向哪里取决于你的决策。

**决策点(你需要先定的)**:这是"署名上游"的有意选择还是笔误?如果要改,不能只改 About——updater、release 流程、bundle id 是一体的 rebrand 工程,需整体评估(改了 updater 指向,自动更新链路就变了)。
**建议**:先只做决策,工程另议。
**证据**:`AboutView.tsx:7`、`tauri.conf.json:5,73`、`updateReleaseConfig.test.ts:10-24`(锁死上游的测试)。

---

### P2-17 · 任务 AI 验收判定

**解决什么问题**
原清单说"复用已有 follow-up 机制",但那个机制(`reviewTask.ts`)**已随编排中心删除案被一并移除**——前提不存在了。当前完成判定仍是"AI 停止输出"启发式(见 P1-11)。

**UI 表现**
- 现在:任务跑完(或 AI 中途停顿)→ 卡片自动进 testing,无人核对 acceptance criteria。
- 做之后:AI 停止后,派发一个轻量 reviewer turn 对照任务验收标准给出 pass/fail,fail 则留在原列并附原因。

**做的收益**:看板从"自动化流转"升级为"自动化把关",是"驾驭 AI"闭环的核心一环。
**不做的代价**:误判与漏检持续,testing 列的可信度靠人补。
**决策点**:成本需按"新建轻量 reviewer-turn 派发"重新评估;建议排在 P1-11(拆分)之后做。
**证据**:`reviewTask.ts` 已删(归档提案 design.md:22);`acceptanceCriteria`/`request_changes` 全仓零命中。

---

### P2-18 · GitHistoryPanelImpl 类型化(扩 scope)

**解决什么问题**
`GitHistoryPanelImpl.tsx`(2803 行,已破 2800 红线)摘 nocheck 后有 21 个 error,但**收益有限**:上游 `useGitHistoryPanelInteractions.tsx` 等 4 个文件也全是 nocheck,~150 个字段通过 `any` scope 串行透传。新功能已经只能靠 `ponytail:` 注释硬挂,债务在增长。

**UI 表现**:无。
**做的收益**:复用 app-shell 的 shrink-first 模式,先把 ~150 字段 scope 类型化,再逐文件摘 nocheck——git-history 这个高频 surface 重获类型保护。
**不做的代价**:该 surface 每加功能(最近还在加 PR AI 生成、多页签)都在无保护下叠加,2803 行继续涨。
**决策点**:工程量明显大于 SettingsView,建议降级为 P2 或明确扩 scope 立项。
**证据**:实测 21 error;`useGitHistoryPanelInteractions.tsx:1` 等 4 个 nocheck;`GitHistoryPanelImpl.tsx:2586`(7199 字符的巨型 destructuring)。

---

### 顺手修 · 两件

**19. dock streaming 死分支清理**:原 P0-6① 经核查**不是 bug**(`c585cc147` 有意简化为只显示 error),"streaming" 状态永不可达但类型/组件分支/i18n 键/spec 都还在。纯死代码清理,可并入 P1-7。

**20. large-file gate 2800 档未生效**:`check-large-files.policy.json` 的 `feature-hotpath` 组 failThreshold=2800,`GitHistoryPanelImpl.tsx` 2803 行已越过,但 `check-large-files.mjs` 实测 exit=0——红线写了但没通电。修 gate 脚本本身,一行级问题,但它解释了为什么文件能悄悄涨破红线。

---

## 四、决策分组建议

**A. 不用犹豫,直接做(P0 四项 + 顺手两件)**
P0-1 settings 静默、P0-2 二元假设、P0-3 SettingsView nocheck、P0-4 specs 索引补登、#19 dock 死分支、#20 gate 修复。
共同点:全是确定性 bug 或纯减法,工作量都在半天内,无一需要产品决策。
**状态(2026-07-24 晚):P0 四项已 ✅ 完成;#19 / #20 未做,可并入 P1-7 死代码收尾一并处理。**

**B. 值得做,排进迭代(P1 八项)**
P1-5 aiReview、P1-7 死代码收尾、P1-8 批量事务化、P1-9 语音后处理、P1-10 日志 AI 分析、P1-12 索引校验脚本是**小步快跑**型;
P1-6 browser 管线需你先选一个方向(接通 or 删除);
P1-11 kanban 拆分是**其他智能化的地基**,建议作为 P1 里最先启动的大件。

**C. 需要你先做决策,再谈排期(P2 六项)**
- P2-13:embedding 方案(本地 vs 引擎通道)
- P2-16:GitHub 指向(fork or 上游)+ 是否启动 rebrand
- P2-17:是否值得重建验收机制(建议排在 P1-11 后)
- P2-14 / P2-15 / P2-18:三项大工程,各自独立立项,不与其他项捆绑

---

## 附:证据文件索引

- 原始清单:`docs/reports/client-aux-modules-optimization-report-2026-07-24.md:408-417`
- 逐项核查证据(行号/commit/提案 id):见本文各卡片"证据"行,均已在 2026-07-24 当天代码上核实,未漂移处已注明
- 已归档提案:`openspec/changes/archive/2026-07-24-*/`
