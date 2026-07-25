# 检索与导航优化项 · 逐项影响明细

> **日期**：2026-07-25
> **基线**：分支 `feature/v-799` @ `c75922dec`
> **来源**：从 `client-aux-modules-governance-report-2026-07-25.md` 摘出"检索与导航（search / quick-switcher / project-map / workspaces）"一节的 9 项，逐项展开"现状 → 影响 → 处理后影响 → UI 变化"
> **核对方法**：逐项对照当前 HEAD 源码与生产 caller；治理报告中有两处描述与现状有出入，本文按当前事实修正并显式标注
> **行号声明**：行号为 `c75922dec` 快照，后续提交请按 symbol 搜索

---

## 总览

| # | 优化项 | 优先级 | 真实状态（已按 HEAD 修正） | UI 变化 |
|---|---|---|---|---|
| 1 | message search 每次查询全量重建索引 | P1 | 🔶 部分清理（死索引已删，全量重建仍在） | 无（性能） |
| 2 | 三个搜索入口各自为政 | P1 | 🔶 **描述过半过时**：SearchPalette 已统一 | **有**（入口收敛） |
| 3 | QuickSwitcher 无查询、硬上限 30 条 | P1 | ❌ 未做（已核实） | **有**（加查询框） |
| 4 | project-map 证据选取硬编码 15 个文件名 | P1 | ❌ 未做（已核实） | 无（生成质量） |
| 5 | project-map 引擎响应递归嗅探 + 修复重发全量证据 | P0-P1 | ❌ 未做（已核实，双倍 token 坐实） | 无（成本/速度） |
| 6 | ProjectMapPanel.tsx 1945 行 / 17 useState | P1 | 🔶 部分变化（orchestration 直写已查无实据） | 无（可维护性） |
| 7 | worktree 默认分支名无语义 | P1 | ❌ 未做（已核实） | **有**（分支名可读） |
| 8 | workspaces 错误契约靠字符串匹配 | P1 | ❌ 未做（已核实） | **有**（错误提示变准） |
| 9 | 文件列表 30s 全量轮询 | P2 | 🔶 比描述略好（已有指数退避），但仍是全量轮询 | 无（后台行为） |

---

## 1. message search 每次查询全量重建索引

**状态**：🔶 部分清理。旧的"建了就没人用的死索引"已删，但**每次查询全量重建**的问题原样保留。

### 现状（证据）

- `src/features/search/providers/messageProvider.ts:25-28`：每次搜索都调用 `buildWorkspaceMessageIndex(threads.map(id), threadItemsByThread)`。
- `src/features/search/indexing/messageIndex.ts:9-32`：`buildWorkspaceMessageIndex` **遍历所有 thread 的所有 items**，过滤 `kind === "message"`、trim、重新装箱成 `IndexedMessage[]`——这是一个无任何缓存的全量物化。
- 随后 `messageProvider.ts:33-40` 对物化结果逐条 `toLowerCase().indexOf(query)` 子串扫描，打分规则是 `index === 0 ? 40 : 260 + index`（按命中位置给分）。

### 影响什么

- **每次键入都全量扫**：搜索在 SearchPalette 里有防抖，但每次触发都是"遍历全部会话消息 + 全箱子串扫描"，消息量越大，单次查询的同步主线程工作越大——大 workspace 下会直接表现为搜索框卡顿。
- **内存churn**：每次查询都新建整个 `IndexedMessage[]` 数组，GC 压力随消息总量线性增长。
- 死索引删除 ≠ 搜索性能闭环：现在是没有冗余索引了，但也没有任何增量机制。

### 处理后的影响

- 按 `workspaceId + thread version/updatedAt` 做**增量索引缓存**：只有变更的 thread 重建对应分片，未变部分直接复用。
- 将 **index build 与 query scoring 分离**：索引常驻（LRU），查询只做打分——单次查询从 O（全量消息） 降到 O（索引命中数）。
- 风险点：缓存失效键必须包含 thread 内容版本，否则会出现"新发的消息搜不到"；需要为失效逻辑补测试。

### UI 变化

**无直接 UI 变化**。间接效果：大 workspace 下搜索框输入不再卡顿，结果出现更快。

---

## 2. 三个搜索入口各自为政

**状态修正**：治理报告写"三套独立打分"，但当前 HEAD 核实——**SearchPalette 已经统一**。本项的实际残留比描述小得多。

### 现状（证据）

- **SearchPalette = 已统一**：`src/features/search/hooks/useUnifiedSearch.ts` 聚合了 **10 个 provider**（messages / files / commands / history / kanban / threads / skills / api / recentDiscovery / actions），统一走 `ranking/score.ts` 的 `compareSearchResults` + `ranking/recencyStore` 的 frecency，并有防抖（`SEARCH_DEBOUNCE_MS`）、provider 限额（`SEARCH_PROVIDER_LIMITS`）和性能上报（`searchMetrics`）。这一套就是治理报告 P1-4 想要的"统一搜索入口"的雏形，**已经存在**。
- **QuickSwitcher = 仍独立**：`src/features/quick-switcher/` 自成体系，不接 `useUnifiedSearch`（详见第 3 项）。
- **会话内搜索 = 未找到独立实现**：在 `src/features/threads`、`src/features/conversation` 下未检索到独立的会话内搜索打分实现，疑似已并入统一搜索或尚未建设——**此点待复核**，不能继续按"三套独立打分"估算工作量。

### 影响什么

- 继续按"三套各自为政"立项会**高估工作量**：真正要做的不是"从零统一"，而是把 QuickSwitcher 并入已有的 `useUnifiedSearch`，或明确它的差异化定位。
- 残留的真实问题：同一条内容在 SearchPalette（有 frecency + 统一打分）与 QuickSwitcher（无查询、纯时间序）里的可达性不同。

### 处理后的影响

- QuickSwitcher 二选一：并入统一搜索（推荐，复用打分与 frecency），或明确定位为"最近文件快速跳转"并砍掉重叠能力。
- 补**意图路由**：`/` 开头走命令、`@` 开头走文件/agent、普通文本走内容搜索——`useUnifiedSearch` 的 provider 架构已天然支持，只需在入口层加路由。

### UI 变化

**有（取决于路线）**：

- 并入路线：QuickSwitcher 从"最近 30 条列表"升级为**带查询框的统一搜索**，与 SearchPalette 体验一致。
- 定位路线：UI 不变，但入口文案/快捷键职责说清，用户不再困惑"两个搜索框有啥区别"。

---

## 3. QuickSwitcher 无查询、硬上限 30 条

**状态**：❌ 未做（当前 HEAD 已核实）。

### 现状（证据）

- `src/features/quick-switcher/types.ts:1`：`QUICK_SWITCHER_RECENT_LIMIT = 30`，最近文件列表硬上限 30 条。
- 数据结构 `QuickSwitcherRecentFile` 只有 `workspaceId / path / touchedAt / source("opened" | "ai-modified")`——**纯时间序，无 frecency（频率 × 新近度）打分**。
- `QuickSwitcher.tsx` 中无查询输入处理（仅渲染最近列表 + 导航项），用户不能键入过滤。

### 影响什么

- **第 31 个文件永远找不到**：活跃项目里最近文件很容易超过 30 条，被挤掉的文件在 QuickSwitcher 里彻底不可达，只能退回 SearchPalette。
- **无查询 = 只能肉眼扫**：列表长了以后，"快速切换"名不副实。
- **无 frecency**：一周前开过一次的文件和今天开了十次的文件，只要时间近就排前面。

### 处理后的影响

- 两条路线（与第 2 项联动决策）：
  - **并入统一搜索**：QuickSwitcher 获得查询能力、frecency、跨 workspace 搜索，30 条上限被 provider 限额机制取代。
  - **保留差异化**：加查询过滤 + frecency 排序，保留"最近文件"的轻量定位。
- 风险点：QuickSwitcher 的导航 contract（导航项 + 文件混排）有双层拦截逻辑靠注释维系，改造时需先补测试再动。

### UI 变化

**有**：QuickSwitcher 弹出层从"纯列表"变为"**查询框 + 过滤列表**"；排序从纯时间序变为 frecency（常用且最近的排前）。

---

## 4. project-map 证据选取硬编码 15 个文件名

**状态**：❌ 未做（当前 HEAD 已核实）。

### 现状（证据）

`src/features/project-map/services/projectMapGenerationWorker.ts`：

- `:86-88` 三重硬上限：`MAX_CONTEXT_FILES = 24`、`MAX_EVIDENCE_PROMPT_CHARS = 52_000`、`MAX_EVIDENCE_FILE_CHARS = 5_000`。
- `:527-558` `filePriority()`：证据优先级靠**硬编码清单**——只有 `package.json`、`pnpm-workspace.yaml`、`vite.config.ts`、`tsconfig.json`、`pyproject.toml`、`requirements.txt`、`go.mod`、`Cargo.toml`、`pom.xml`、`build.gradle`、`settings.gradle`、`CMakeLists.txt`、`Makefile`、`README.md`、`AGENTS.md` 这 15 个文件名拿最高优先级（return 0）；其余按路径前缀分档（openspec/.trellis → 1，src → 2，test → 3，其他 → 4）。

### 影响什么

- **AI 只能看到有偏见的切片**：一个 Rust + Python 混合项目、或用非标准构建文件的项目，证据集里可能连真正的核心源码都排不进前 24 个文件。
- **语言歧视**：清单明显偏 JS/TS 生态（4 个 JS 构建文件 vs 各 1 个其他语言），非 JS 项目的 project map 生成质量天然更差。
- **52k 字符天花板**：大项目的证据被截断后，AI 生成的"项目知识地图"基于残缺信息，图谱可信度打折。

### 处理后的影响

- 证据检索 **RAG 化**：用项目内符号/引用关系（仓库已有 `code_intel` 能力）或 embedding 检索"与地图主题最相关"的文件，替代文件名清单。
- 硬上限保留（防爆 token），但花在**真正相关**的证据上——同样 52k 字符，信息密度完全不同。
- 风险点：依赖记忆语义检索的 embedding 方案决策（治理报告 P2-1 前置依赖）；短期可先做"按 import 图中心性排序"的廉价版。

### UI 变化

**无直接 UI 变化**。间接效果：生成的 project map 节点/摘要更准确，非 JS 项目改善最明显。

---

## 5. project-map 引擎响应递归嗅探 + 修复重发全量证据

**状态**：❌ 未做（当前 HEAD 已核实，且"双倍 token"指控坐实）。这是本节**成本最高**的问题，优先级 P0-P1。

### 现状（证据）

- **响应解析靠猜**：`projectMapGenerationWorker.ts:218-319` `extractTextFromCodexContent` 对引擎返回值做**递归嗅探**——依次尝试 `text` / `last_agent_message` / `lastAgentMessage` / `output_text` / `outputText` / `summary`，都不是就递归进 `content` / `parts` / `output` 继续猜。引擎响应格式一变，解析就静默拿到空串。
- **修复重试 = 双倍证据**：`:901-924` `buildJsonRepairPrompt` 在 JSON 校验失败时，把 **`input.originalPrompt`（即含 52k 证据的完整生成 prompt）原样再发一遍**，外加截断到 12k 的上次无效输出（`:89` `MAX_INVALID_OUTPUT_REPAIR_CHARS = 12_000`）。一次修复 ≈ 64k 字符的重复开销。
- 已有结构化基础没用完：`:9` 已 import `parseModelStructuredJsonObject`，`:109` 有 `PROJECT_MAP_JSON_SCHEMA_EXAMPLE`——但生成主链路仍是"发自然语言 prompt + 祈祷返回纯 JSON + 失败后整包重发"。

### 影响什么

- **直接的钱**：每次 JSON 修复重试，52k 证据 prompt 完整重发，token 成本翻倍；生成一次 project map 实际花费是名义成本的 1~2 倍。
- **脆弱性**：递归嗅探 + 字符串契约，引擎侧任何字段调整都会让地图生成静默失败或产出空图。
- **速度**：900s turn 超时（`:930` `timeoutMs: 900_000`）下，修复重试让整个生成流程动辄十几分钟。

### 处理后的影响

- **生成管线契约化**：引擎响应走 structured output（已有 `parseModelStructuredJsonObject` 可复用），消除递归嗅探。
- **修复重试瘦身**：repair prompt 只带 schema + 无效输出摘要 + 校验错误，**不重发证据**——52k 证据在第一次请求里引擎已见过，修复轮只需"你上次输出错了，错在这，按 schema 重出"。
- **落盘节流**：生成中间产物增量落盘，失败可续跑而不是从头再来。
- 预期收益：修复场景 token 开销从 ~64k 降到 ~13k（schema + 无效输出），降约 80%。

### UI 变化

**无直接 UI 变化**。间接效果：project map 生成更快、失败率更低、不再偶发"生成完成但图是空的"。

---

## 6. ProjectMapPanel.tsx 1945 行 / 17 useState

**状态**：🔶 部分变化，且治理报告的一条证据**当前查无实据**。

### 现状（证据）

- 体量属实：`src/features/project-map/components/ProjectMapPanel.tsx` 当前 **1945 行**，`useState` 调用 **17 处**（另有 37 处 `useState|useReducer` 匹配含类型导入）。
- **跨层直写证据未复现**：治理报告称"面板仍直接 import orchestration 存储跨层直写"，但在当前 HEAD 对 `src/features/project-map/**` 检索 `kanban|orchestration` **零命中**。面板的 import 已收敛到自身 feature 内的 hooks（`useProjectMapDataset`、`useProjectMapGraphInteractionHandlers`、`useProjectMapIntentCanvasHandlers`）与 utils（`interactiveLayout`、`impactAnalysis`、`contextBuilder`）。该条证据**疑似已随编排中心删除而消失，或原始定位有误**——立项前需复核，不能按旧描述设计拆分方案。
- 剩余的真实债务：面板仍承载图谱布局计算、镜头（lens）过滤、impact 分析、intent-canvas 联动、生成队列展示等多重职责。

### 影响什么

- 1945 行 + 17 个独立 state：state 间的同步靠 useEffect 网，改一个交互（比如镜头切换）要在十几个 state 里追联动。
- 渲染面大：图谱高频交互（拖拽、缩放）与低频配置（队列、运行历史）混在一个组件，任何 state 变化都全量重渲染。

### 处理后的影响

- 按职责拆：**GraphCanvas**（布局 + 交互）、**LensBar**（过滤）、**RunQueuePanel**（生成队列/历史）、**ImpactPanel**（影响分析）四个 owner，面板壳只做组合。
- state 下沉到各 owner，跨 owner 通信走明确的 props/回调。
- 风险点：图谱交互 handlers 已抽出（`useProjectMapGraphInteractionHandlers`），拆分是对现有 hooks 的**重组而非重写**，风险中等。

### UI 变化

**无**。纯内部结构优化，用户看到的界面不变；间接效果是图谱交互更顺滑（重渲染面缩小）。

---

## 7. worktree 默认分支名无语义

**状态**：❌ 未做（当前 HEAD 已核实）。

### 现状（证据）

`src/features/workspaces/hooks/useWorktreePrompt.ts:355-357`：

```ts
const defaultBranch = `codex/${new Date().toISOString().slice(0, 10)}-${Math.random()
  .toString(36)
  .slice(2, 6)}`;
```

默认分支名 = `codex/2026-07-25-x7k2` 这种"日期 + 4 位随机字符"，与用户意图零关联。同函数里 `worktreeSetupScript` 已有读取（`normalizeSetupScript`），但分支命名完全没用上任何上下文。

### 影响什么

- **分支列表成乱码墙**：一周后面对 `codex/2026-07-18-a3f9`、`codex/2026-07-19-k2mz`，谁也看不出哪个分支干什么，只能靠记忆或逐个 checkout 看 diff。
- **清理决策困难**：不敢删——不知道哪个还有用。
- `codex/` 前缀本身也误导：非 Codex 引擎创建的 worktree 也顶着 codex 前缀。

### 处理后的影响

- **语义分支名**：从用户输入的 worktree 目的（prompt 首行）提取 slug，如 `feat/search-index-cache-x7k2`（语义 + 短随机防撞）。
- 配套：默认 `baseRef` 记忆上次选择；`setupScript` 在创建流程中更显眼。
- 风险点：slug 生成要处理中文（拼音化或保留 unicode 取决于 git 配置）、长度上限与非法字符过滤。

### UI 变化

**有**：

1. worktree 创建弹窗的分支名输入框，预填值从"日期乱码"变为**可读的语义名**。
2. worktree 列表里分支一目了然，清理决策成本大降。

---

## 8. workspaces 错误契约靠字符串匹配

**状态**：❌ 未做（当前 HEAD 已核实）。

### 现状（证据）

`src/features/workspaces/hooks/useWorktreePrompt.ts`：

- `:109-117` `isNonGitRepositoryError`：靠 `message.toLowerCase().includes(...)` 匹配 **6 种英文错误文案**（"could not find repository"、"not a git repository"、"class=repository"、"code=notfound"、"repository not found"、"git root not found"）判断"不是 git 仓库"。
- `:119-120` 另有前缀契约：`VALIDATION_ERROR:` 和 `Worktree created locally, but push failed:`——后端改任何一个措辞，前端的错误分类就失效。

### 影响什么

- **后端改措辞，前端就瞎**：把 "not a git repository" 改成 "no git repository found"，用户得到的就不是"该目录不是 git 仓库"的友好提示，而是裸错误文案糊脸。
- **匹配清单永远不全**：6 种子串是撞一个补一个攒出来的，git/libgit2 不同版本的报错变体覆盖不全。
- **i18n 隐患**：后端若本地化错误文案，子串匹配全灭。

### 处理后的影响

- **错误契约结构化**：后端 Tauri command 返回 typed error（如 `{ kind: "not_git_repo" | "push_failed" | "validation", message, retryCommand? }`），前端 switch on kind，不再碰 message 文案。
- 前端匹配逻辑从 6 种子串 + 2 个前缀，收敛为一个 discriminated union——后端措辞随便改，分类不受影响。
- 风险点：双端改动（Rust 侧错误类型 + 前端消费），需要为每种错误路径补契约测试；可作为 engine/workspace 错误契约统一改造的第一块样板。

### UI 变化

**有**：

1. "非 git 仓库"等场景的错误提示**稳定友好**（不再偶发裸英文报错）。
2. `retryCommand` 结构化后，可渲染"**一键重试**"按钮而不是让用户手抄命令。

---

## 9. 文件列表 30s 全量轮询

**状态**：🔶 比治理报告描述略好——**已有指数退避**，但仍是全量轮询。

### 现状（证据）

`src/features/workspaces/hooks/useWorkspaceFiles.ts`：

- `:167` `BASE_REFRESH_INTERVAL_MS = 30_000`，`:168` `MAX_REFRESH_INTERVAL_MS = 180_000`。
- `:544-553`：轮询带**失败退避**——连续失败时间隔按 `2^n` 翻倍，最高 180s；成功路径仍是固定 30s 全量刷新（`refreshFiles("poll")` 拉整个文件树快照）。
- 无 fs watcher 事件通道（对比：`GitHistoryWorktreePanel` 已有 `external_changes` watcher 先例）；未看到可见性门控（窗口隐藏时是否暂停需进一步确认）。

### 影响什么

- **空转**：文件树不变时，每 30s 全量拉一次快照——大 monorepo 的文件列表序列化 + IPC 是实打实的开销。
- **新鲜度与开销的死结**：30s 意味着"新建文件最长 30s 才出现在列表"；想更快就得更频繁轮询，更浪费。

### 处理后的影响

- 接 **fs watcher**（复用 `external_changes` 先例）：文件变更事件驱动刷新，轮询降级为 ≥30s 的可见性门控兜底（符合仓库"事件驱动 + ≥30s 兜底，禁秒级轮询"红线）。
- 或做**增量更新**：后端推送变更路径集，前端局部 patch 文件树，不再全量拉。
- 风险点：watcher 在大型 monorepo 的事件风暴需要节流/去抖；远端 SSH workspace 无本地 fs 事件，轮询兜底必须保留。

### UI 变化

**无直接 UI 变化**。间接效果：新建/删除文件**秒级**出现在列表（而非最长 30s），后台 IPC 空转消失。

---

## 附：实施顺序建议

| 批次 | 项 | 理由 |
|---|---|---|
| 第一批（止血，省钱） | **#5 修复重试瘦身 + 契约化** | 唯一 P0-P1；改的是 prompt 组装，不动 UI，收益是实打实的 token 成本 |
| 第二批（用户直接可感） | #7 语义分支名、#3 QuickSwitcher 加查询、#8 错误契约 | 改动小、UI 收益明确；#8 可作双端错误契约样板 |
| 第三批（性能地基） | #1 增量索引缓存、#9 fs watcher | 纯后台收益，但需要缓存失效/事件节流的测试护航 |
| 第四批（结构与决策） | #2 入口收敛决策、#4 证据 RAG 化、#6 面板拆分 | #4 依赖 embedding 方案决策（P2-1）；#6 立项前先复核 orchestration 直写证据 |

> ⚠️ 注意两个前置依赖：
> - **#4（证据 RAG）依赖治理报告 P2-1 的 embedding 方案决策**，不要按"差一步"估算；
> - **#6 立项前先复核**"orchestration 跨层直写"证据（当前 HEAD 查无实据），拆分方案要基于真实耦合点设计。
>
> 每项动手前请在 OpenSpec 按 capability 分片立项，避免大颗粒提案烂尾（治理报告风险节第 3 条）。
