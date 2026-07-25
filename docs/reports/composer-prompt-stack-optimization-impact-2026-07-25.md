# 输入与提示词体系优化项 · 逐项影响明细

> **日期**：2026-07-25
> **基线**：分支 `feature/v-799` @ `c75922dec`
> **来源**：从 `client-aux-modules-governance-report-2026-07-25.md` 摘出你选定的 9 项，逐项展开"现状 → 影响 → 处理后影响 → UI 变化"
> **核对方法**：逐项对照当前 HEAD 源码与生产 caller；你贴的清单里有两项状态已过时，本文按当前事实修正并显式标注
> **行号声明**：行号为 `c75922dec` 快照，后续提交请按 symbol 搜索

---

## 总览

| # | 优化项 | 优先级 | 真实状态（已按 HEAD 修正） | UI 变化 |
|---|---|---|---|---|
| 1 | `ComposerInput.tsx` 死实现 | P0 | 🔶 **主体已删**，仅剩注释/命名残留 | 无 |
| 2 | 输入历史三套并存、发送时双写 | P0 | ❌ 未做 | 无（行为一致性修复） |
| 3 | 自动补全两套引擎同时跑 | P0 | ❌ 未做 | 无（纯性能/维护） |
| 4 | slash/prompt bridge no-op 死链路 | P0 | ✅ **已清** | 无 |
| 5 | 自定义命令 15s 冷却 + 全局兜底 | P1 | ❌ 未做 | **有**（命令列表更准确） |
| 6 | 技能调用纯文本拼接 | P1 | 🔶 部分变化（Skills UI 已迁 Skills Hub） | **有**（参数面板可选） |
| 7 | prompt enhancer 粗糙 | P1 | ❌ 未做 | **有**（最大 UI 变化项） |
| 8 | curated-skills 重型基础设施 | P1 | 🔶 半修复（轮询已门控未消除） | 基本无 |
| 9 | 对话→prompt/skill 一键沉淀 | P2 | ❌ 未做 | **有**（新增入口） |

---

## 1. `ComposerInput.tsx` 1641 行死实现未删

**状态修正**：原清单写"未做"，但当前 `src/` 下该文件**已删除**（治理报告 07-25 复核亦确认 ✅）。残留物只有两个：

- `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx:5` 注释仍自述 *"enabling drop-in replacement of ComposerInput"* —— 迁移叙事残留，会误导后来者以为还有个被替换对象存在。
- `src/features/composer/components/ComposerInputResponsiveness.guard.test.ts` 测试夹具仍沿用旧命名。

### 现状

旧 JCEF 时代的输入框实现本体已不进产物、不进打包。剩下的只是"考古线索"级别的命名残留。

### 影响什么

- ~~安装包更大~~ —— 已不成立，文件已删。
- AI 协作者/新维护者读到 adapter 注释，仍可能去搜一个不存在的目标文件，浪费定位时间。

### 处理后的影响

- 删掉/改写 adapter 头部注释，重命名 guard test。纯文档级清理，**零行为变化、零回归风险**。

### UI 变化

**无**。用户不可见。

### 建议降级

从 P0 降为 **P3 清理**，可随手做掉，不值得单独立项。

---

## 2. 输入历史三套并存、发送时双写

**状态**：❌ 未做（当前 HEAD 已核实双写仍在）。

### 现状（证据）

- `src/features/composer/components/Composer.tsx:39` 同时 import 两套历史实现：`usePromptHistory` 的 `recordHistory` 和 `useInputHistoryStore` 的 `recordHistory`（别名 `recordInputHistory`）。
- `Composer.tsx:1447-1448` 与 `:1464-1465` 发送时**连续调用两次**，同一段文本写进两个 store：
  ```ts
  recordHistory(trimmed);
  recordInputHistory(trimmed);
  ```
- 两套 store 各自的容量、去重、持久化策略独立演化；补全/历史搜索/上箭头回溯分别读不同来源。

### 影响什么

- **口径不一致**：你在输入框按 ↑ 翻到的历史，和补全下拉里提示的历史，可能不是同一套排序/去重结果。
- **双份存储**：每条发送的 prompt 存两遍，持久化体量翻倍。
- **维护陷阱**：改历史行为（比如加"按 workspace 隔离"）要改两处，漏一处就是隐性 bug。

### 处理后的影响

- 收敛为单一实现（建议保留 `useInputHistoryStore`，`usePromptHistory` 改为薄适配或直接删），发送时单写。
- 历史、补全、搜索三处读同一事实源，行为口径天然一致。
- 风险点：两套 store 的历史数据迁移——需要决定是合并去重还是任选其一保留，这是本项**唯一有数据语义的决策点**。

### UI 变化

**无直接 UI 变化**。间接效果：↑ 键回溯与补全建议的排序/内容变得一致，"偶尔翻不到刚发过的那句话"这类玄学问题消失。

---

## 3. 自动补全两套引擎同时跑

**状态**：❌ 未做（当前 HEAD 已核实）。

### 现状（证据）

- **第一套（被丢弃）**：`src/features/composer/hooks/useComposerAutocompleteState.ts`（980 行）在 `Composer.tsx:1034` 被调用，但其解构出的核心输出被**下划线弃用**：
  - `Composer.tsx:1030` `applyAutocomplete: _applyAutocomplete`
  - `Composer.tsx:1031` `handleInputKeyDown: _handleInputKeyDown`
  - `Composer.tsx:1054` `handleHistoryKeyDown: _handleHistoryKeyDown`
  - 即：980 行 hook 内部的文件/agent/skill 打分、记忆查询（`:296` 起 120ms 防抖的 `projectMemoryFacade.list` 请求）**照常执行**，结果大部分被扔掉。
- **第二套（实际生效）**：`ChatInputBox.tsx` 内 **7 个独立 `useCompletionDropdown` 实例**（`:432` file、`:480` memory、`:504` noteCard、`:529` command、`:557` skill、`:586` agent、`:654` prompt），各自独立做 trigger 解析、打分、渲染。

### 影响什么

- **性能浪费**：每次键入，第一套引擎的记忆查询、文件打分白跑一遍——纯 CPU/IPC 空转。
- **行为漂移风险**：两套 trigger 解析逻辑（何时弹、匹配什么）各自演化，同一输入在 Composer 层和 ChatInputBox 层判定可能不同。
- **维护成本**：修补全 bug 要先判断"用户看到的是哪一套算的"。

### 处理后的影响

- 砍掉 `useComposerAutocompleteState` 被弃用的输出与内部死计算，只保留 ChatInputBox 实际消费的字段（`handleTextChange`/`handleSelectionChange` 等仍在用的）。
- 980 行预计可瘦到 200~300 行；每次键入少一轮记忆 IPC 与文件打分。
- 风险点：需逐字段核对哪些输出**真的**没人用（测试里有消费者，见 `useComposerAutocompleteState.test.tsx`），删前先把测试同步收敛，避免"测试引用死 API"造成假活。

### UI 变化

**无**。用户看到的补全行为不变（第二套引擎本来就在干活），只是后台不再白算一份。

---

## 4. slash/prompt bridge no-op 死链路

**状态**：✅ **已清**（治理报告确认，`sendBridgeEvent` 恒 false 的链路已删除）。

### 现状

约 700 行"前端 → JCEF bridge → window.updateSlashCommands"的死链路已移除，无残留 caller。

### 影响 / 处理后影响

- 维护者不再会被一条"看起来在同步 slash 命令到 WebView"的假链路误导。
- 本项**无需再做任何事**，列入仅作存档对照。

### UI 变化

**无**（链路本来就是 no-op）。

---

## 5. 自定义命令空结果 15s 冷却 + 全局兜底启发式

**状态**：❌ 未做（当前 HEAD 已核实逻辑仍在）。

### 现状（证据）

`src/features/commands/hooks/useCustomCommands.ts:120-166`：

1. 向 server 请求 `commands/list`，结果为空时进入 **15 秒冷却**（`EMPTY_CLAUDE_COMMANDS_RETRY_COOLDOWN_MS`，按 workspace 记 `lastEmptyBurst`）。
2. 冷却允许时**原地重试一次**；重试仍为空，就**降级拉全局命令列表**（`getClaudeCommandsList(null)`）兜底展示。
3. 整个失败路径 `fallback: () => []` **静默吞错**——server 挂了和"真的没有命令"在 UI 上无法区分。
4. 无 fs 感知：你往 `.claude/commands/` 加了文件，列表不会自己刷新，要等下一次触发。

### 影响什么

- **张冠李戴**：全局兜底会把**别的 workspace 才有/当前 workspace 不可用**的命令展示给你，点了才发现用不了。
- **故障隐身**：server 出错时你以为是"这个 workspace 没配命令"，实际是请求挂了。
- **新鲜度差**：新建命令文件后最长要手动触发才出现。

### 处理后的影响

- 加 fs watch（`.claude/commands/` 目录变更 → 失效缓存重新拉取），命令列表随文件系统实时更新。
- 失败显式化：请求失败与空结果分开呈现（如"命令服务暂不可用"vs"暂无自定义命令"），去掉静默 `fallback: []`。
- 删除或收敛全局兜底：空结果就显示空，不再拿全局列表冒充。
- 风险点：fs watch 需遵守仓库红线"事件驱动 + ≥30s 兜底轮询，禁秒级轮询"。

### UI 变化

**有，三处**：

1. 命令补全列表**变准**——不再出现别的工作区的命令。
2. server 故障时从"静默空列表"变为**可见的错误/降级提示**。
3. 新增 `.claude/commands/*.md` 后，补全列表**自动出现新命令**，无需重启或手动刷新。

---

## 6. 技能调用纯文本拼接

**状态**：🔶 部分变化。旧 `SkillsSection.tsx`（1289 行）已随 `b1d94a930` 删除，Skills UI 迁入 Extensions/Skills Hub；但**调用层的文本拼接问题原样保留**。

### 现状（证据）

- `src/features/composer/utils/promptAssembler.ts:42-55` `assembleSinglePrompt`：把选中的 skill 变成 `/skill-name` 纯文本 token，**直接拼在用户输入前面**发出去：
  ```ts
  return `${tokens.join(" ")} ${userInput}`;
  ```
- 无任何结构化参数通道：skill 需要什么参数、本次调用传了什么值，AI 只能从这段拼接文本里**自行猜测**。

### 影响什么

- **AI 理解靠猜**：多个 skill 连拼时，参数归属模糊（`/skill-a /skill-b 帮我部署` —— "部署"是谁的参数？）。
- **无法校验**：客户端不知道 skill 声明的入参 schema，拼错了也只能等 AI 端失败。
- **扩展天花板**：未来想支持"带表单的技能调用"（填参数再执行），纯文本协议接不住。

### 处理后的影响

- 定义技能调用契约（结构化 `skillInvocations: [{name, args}]` 随消息下发，文本拼接仅作降级展示）。
- 编译期可校验参数；UI 可为带参 skill 渲染参数表单。
- 风险点：牵涉 engine 双端协议演进（前端发、引擎侧解析），是 9 项里**协议成本最高**的一项，建议与 P2-8 合并立项。

### UI 变化

**有（可选渐进）**：

- 最小改动版：UI 不变，仅协议层结构化。
- 完整版：选中带参数的 skill 时弹出**参数填写面板**（而非手敲），发送预览里 skill 调用显示为结构化卡片而非裸文本。

---

## 7. prompt enhancer 粗糙

**状态**：❌ 未做（当前 HEAD 已核实全部四个粗糙点仍在）。这是 9 项里**用户体验收益最大**的一项。

### 现状（证据）

`src/features/composer/components/ChatInputBox/hooks/usePromptEnhancer.ts`（501 行）：

1. **子串匹配错误分类**（`:150-154`）：用 `message.includes(needle)` 匹配错误文案判断错误类型，引擎改一句措辞分类就失效。
2. **阻塞式弹窗**：`PromptEnhancerDialog.tsx`（235 行）整段等待结果，超时按 `normalizeEnhancerTimeoutSeconds`（`:116-122`）走，默认上限量级为 60s——点完"润色"就干等。
3. **英文硬编码 system prompt**（`:37`）：`'You are a prompt rewriting assistant.'`，对中文输入的润色指令没有任何中文语境优化。
4. **每次新建隐藏 session、无缓存**（`:17-18` `sessionPurpose: 'prompt-enhancer'` + `visibility: 'hidden'`；`:415` `buildIsolatedSessionId()`）：同一段文本润色两次，就付两次 token、等两次。

### 影响什么

- **中文用户干等一分钟**：阻塞弹窗 + 无流式，等待感极差；超时后只有一句英文报错。
- **错误处理脆弱**：网络错误/超时/引擎错误靠文案子串区分，误分类就把"重试即可"显示成"不可重试"。
- **token 浪费**：隐藏 session 一次一建，无结果缓存。

### 处理后的影响

| 改动 | 效果 |
|---|---|
| 流式输出 | 润色结果逐字出现，首字延迟从几十秒降到秒级 |
| 就地 diff 替换 | 在输入框内直接看到改动高亮，接受/撤销，而不是弹窗整体替换 |
| system prompt 随界面语言走 | 中文输入得到中文语境的润色指令，质量提升 |
| 结果缓存（按文本 hash） | 同一文本二次润色秒回，零 token |
| 错误分类结构化 | 用引擎错误码/超时标志而非文案子串，重试策略准确 |

### UI 变化

**有，且是 9 项中最大**：

1. 阻塞弹窗 → **流式就地预览**：输入框上方直接浮现润色中/润色结果 diff。
2. 新增**接受 / 重新生成 / 撤销**三个轻量操作，替代现在的整段替换。
3. 可进一步做"**发送前自动润色**"开关（治理报告建议项），开启后无感触发。
4. 超时/失败提示中文化、可重试。

---

## 8. curated-skills 重型基础设施只服务 2 个条目

**状态**：🔶 半修复。

### 现状（证据）

- 全套 curated-skills 基础设施（锁文件、Rust `build.rs` 校验、注入管线）服务的 bundled skill 只有 **2 个**——"为两辆自行车修了座立交桥"。
- `src/features/curated-skills/components/CuratedSkillIndicator.tsx:32`：`POLL_INTERVAL_MS = 2000`，虽已套 `setVisibilityGatedInterval`（窗口隐藏时暂停），但**可见状态下仍每 2 秒轮询一次设置数据**——而设置是低频静态数据。
- 同时新 Skills Hub（`skills_hub.rs`，2995 行）走独立管线，两套技能面并行演化。

### 影响什么

- **过度工程的维护税**：校验/锁文件/注入链路每次升级都要维护，受益面只有 2 个条目。
- **空转轮询**：窗口可见期间每秒都在为几乎不变的数据发 IPC。
- **边界模糊**：bundled curated skill 与用户安装的 Skills Hub skill 没有清晰分工，两套指示器/入口让用户困惑"技能到底在哪管"。

### 处理后的影响

两条路线，**需先做产品决策**（治理报告原话："扩容 or 降级"）：

- **路线 A · 扩容**：curated bundle 扩充到有实际规模（比如内置高频官方技能集），基础设施利用率合理化；同时明确 bundled vs 用户安装的展示边界。
- **路线 B · 降级**：砍掉重型校验链，2 个条目退化为普通静态资源，注入走 Skills Hub 统一管线。
- 无论哪条：**用 settings 变更事件替代 2s 轮询**（仓库已有事件驱动先例，符合"禁秒级轮询"红线）。

### UI 变化

**基本无**。唯一可感知：状态栏技能指示器的刷新从"每 2 秒轮询"变为"设置变更即更新"，行为上更快、后台更安静。若走路线 B，技能管理入口收敛为一处，用户不再面对两个技能面板。

---

## 9. "对话→prompt/skill"一键沉淀缺失

**状态**：❌ 未做。这是唯一一项**纯增量功能**（不是还债）。

### 现状

- 可行性已验证：prompt enhancer 的隐藏 session 通道（`usePromptEnhancer.ts:17-18`）证明"客户端可以悄悄起一个 AI session 干活，不打断当前对话"。
- 但目前没有任何入口把一段有价值的对话提炼成可复用的 prompt 模板或 skill——对话结束，经验即蒸发。

### 影响什么

- 你反复手敲的同类指令（"按仓库 commit 规范写提交信息"、"把这个组件拆成 hook + 视图"）无法沉淀，每次都重新组织语言。
- 团队场景下，个人摸索出的好 prompt 无法变成共享资产。

### 处理后的影响

- 新链路：选中对话片段 → 隐藏 session 让 AI 提炼成模板 → 自动插入 `$ARGUMENTS` 参数位 → 存为自定义 prompt / skill。
- 与第 6 项（技能契约结构化）天然协同：沉淀出的 skill 若带结构化参数，即直接可被参数面板调用。
- 成本可控：通道复用 enhancer 已验证的模式，主要工作是模板提炼 prompt 设计 + 存放 UI。

### UI 变化

**有，新增入口**：

1. 对话消息右键/悬停菜单新增"**存为 Prompt / 存为 Skill**"。
2. 弹出**提炼预览**：AI 生成的模板 + 高亮的 `$ARGUMENTS` 参数位，可编辑后保存。
3. 保存后立即出现在 `/` 命令补全与 Skills 面板中（依赖第 5 项的 fs watch 可做到即时可见）。

---

## 附：实施顺序建议

按"还债先于增量、无 UI 风险先于有 UI 变化"排序：

| 批次 | 项 | 理由 |
|---|---|---|
| 第一批（纯清理，零风险） | #1 残留注释、#3 砍弃用输出 | 无 UI 变化，直接降低后续所有改动的认知成本 |
| 第二批（行为一致性） | #2 历史单一实现、#5 命令 fs watch + 去兜底 | 口径统一是后续补全/沉淀功能的地基 |
| 第三批（体验升级） | #7 enhancer 流式化、#8 curated 决策 | #7 收益最大；#8 需先产品决策 |
| 第四批（增量能力） | #6 技能契约、#9 对话沉淀 | 依赖前几批的统一协议与通道，#9 依赖 #6 的参数契约 |

> ⚠️ 每项动手前请先在 OpenSpec 立项（治理报告风险节第 3 条：删除型/大颗粒提案按 capability 分片，避免烂尾）。
