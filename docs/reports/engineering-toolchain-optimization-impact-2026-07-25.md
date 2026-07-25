# 工程工具链优化项 · 逐项影响明细

> **日期**：2026-07-25
> **基线**：分支 `feature/v-799` @ `c75922dec`
> **来源**：从 `client-aux-modules-governance-report-2026-07-25.md` 摘出"工程工具链（files / git / git-history / terminal / live-edit-preview / code-annotations / markdown）"一节的 12 项，逐项展开"现状 → 影响 → 处理后影响 → UI 变化"
> **核对方法**：逐项对照当前 HEAD 源码与生产 caller；治理报告中有三处描述与现状有出入，本文按当前事实修正并显式标注
> **行号声明**：行号为 `c75922dec` 快照，后续提交请按 symbol 搜索

---

## 总览

| # | 优化项 | 优先级 | 真实状态（已按 HEAD 修正） | UI 变化 |
|---|---|---|---|---|
| 1 | Git History 5 文件共 9438 行 `@ts-nocheck` | P0 | ❌ 未做（行数逐一吻合，路径已迁移） | 无 |
| 2 | `GitDiffPanel.tsx` 3125 行 / `FileViewPanel.tsx` 3092 行 | P0-P1 | ❌ 未做（gate 红灯主犯） | 无 |
| 3 | `fileViewPanelShared` / `fileViewPanelInternals` 重复纯函数 | P0 | 🔶 部分变化（仍剩 10 个重复导出符号） | 无 |
| 4 | 文件外部变更 2s 轮询 | P1 | 🔶 已重构但 **2s 兜底间隔仍在**，且常量本身重复定义 | 无 |
| 5 | `aiReview` 无生产者 | P1 | ✅ 已接线（路径已迁至 session-activity） | 无 |
| 6 | AI commit message 藏太深 | P1 | 🔶 **描述部分过时**：已有显眼按钮，但仍需两级菜单、无流式 | **有**（一键+流式） |
| 7 | worktree 面板重复实现 AI commit | P1 | ❌ 未做（1200 行，平行实现坐实） | 无 |
| 8 | terminal 零 addon | P1 | ❌ 未做（已核实零引用） | **有**（搜索/链接/问 AI） |
| 9 | code-annotations 批注只带行号 | P1 | ❌ 未做（无内容快照） | **有**（批注不漂移） |
| 10 | diff/compare 组件族 6+ 个平行演化 | P2 | ❌ 未做（已清点出 7 个组件 + 4 个子件） | 无 |
| 11 | `FileMarkdownPreview.tsx` 1581 行仍是生产依赖 | P1 | 🔶 部分变化（Fast wrapper 仍渲染 legacy） | 无 |
| 12 | stale mock 路径不符 | P1 | ❌ 未做（已定位到具体失效 mock） | 无 |

---

## 1. Git History 5 文件共 9438 行 `@ts-nocheck`

**状态**：❌ 未做。**路径修正**：文件已迁入 `components/git-history-panel/` 子目录，治理报告里的旧路径已失效；行数逐一吻合。

### 现状（证据）

当前 5 个文件全部带 `@ts-nocheck`，合计 **9438 行**：

| 文件 | 行数 |
|---|---:|
| `components/git-history-panel/components/GitHistoryPanelImpl.tsx` | 2803 |
| `components/git-history-panel/components/GitHistoryPanelView.tsx` | 2405 |
| `components/git-history-panel/hooks/useGitHistoryPanelInteractions.tsx` | 2188 |
| `components/git-history-panel/components/GitHistoryPanelDialogs.tsx` | 1548 |
| `components/git-history-panel/components/GitHistoryPanelPickers.tsx` | 494 |

删除分支、force-delete、reset、rebase、checkout 等**不可逆 Git 操作**的处理函数横跨 Interactions → Dialogs → Impl 三个文件分布。

### 影响什么

- **高危链路零类型保护**：一个 handler 的入参类型写错（比如把 branch name 传成 commit hash），TypeScript 不会报警，运行时才知道——对不可逆操作来说这等于裸奔。
- **单拆 Impl 无法恢复边界安全**：组件间 props 靠 nocheck 下的隐式 any 穿透，只拆一个文件，接口边界依然是 any。
- **AI 协作者风险放大**：AI 改代码高度依赖类型信号做约束，9438 行 nocheck 区域是 AI 误改的重灾区。

### 处理后的影响

- **先补 shared props/action types**：为 Impl ↔ View ↔ Dialogs ↔ Pickers 之间的 props 定义显式接口（这是摘 nocheck 的真正瓶颈，不是行数）。
- **再按完整 interaction slice 渐进摘**：例如"删除分支"全链路（按钮 → handler → 确认对话框 → 执行）作为一个 slice 一次摘完，避免半摘状态下 any 从边界渗入。
- 风险点：摘 nocheck 会暴露存量类型错误，预期要修几十处；按 slice 摘可以把每批修复控制在可 review 的规模。

### UI 变化

**无**。纯类型安全与可维护性。

---

## 2. `GitDiffPanel.tsx` 3125 行 / `FileViewPanel.tsx` 3092 行

**状态**：❌ 未做。这两个文件是当前 **large-file gate 红灯的直接主犯**（治理报告 P0-H 17 项失败中的 frontend hard failure 前两名）。

### 现状（证据）

- `src/features/git/components/GitDiffPanel.tsx` **3125 行**：单文件承载 stage/unstage、commit、PR、AI commit message（引擎/语言两级菜单）、多仓库模式、context menu 体系。
- `src/features/files/components/FileViewPanel.tsx` **3092 行**，**26 处 `useEffect`**（治理报告写 25，当前为 26）：文件读取、外部变更同步、git blame、编辑器草稿、二进制检测、typing 诊断等副作用全部聚合在一个组件里。
- 两者都在 `large-file-new-file-baseline`，但 hard baseline `entries` 为空 → gate 判为 `status=new` 直接失败。

### 影响什么

- **CI 治理命令直接红灯**：`npm run check:large-files:gate` 失败 17 项，导致无法区分"新增回退"与"已知债务"——门禁失去信号价值。
- **高频工程入口的回归半径**：Git 面板和文件查看器是每天用的入口，每次改动都在 3000+ 行单文件里做外科手术，review 难度和误伤概率双高。
- **副作用网**：26 个 useEffect 之间的执行顺序依赖，是 FileViewPanel 各类"状态不同步"疑难 bug 的温床。

### 处理后的影响

**先决策，再动手**（治理报告原话）：立即拆分 vs 带 owner/期限的临时 hard baseline。建议：

- `GitDiffPanel` 按 **command orchestration / selection / preview / dialog** 拆 owner：commit 编排（stage/commit/AI commit）一个 owner，diff 选择与预览一个，context menu/对话框一个。
- `FileViewPanel` 已有大量 hooks（`useFileExternalSync`、`useFileGitBlame`、`useFileDocumentState`），拆分方向是把 26 个 useEffect 按域下沉到这些 hooks，组件壳只做组合。
- 风险点：两文件测试体量同样巨大（`GitDiffPanel.test.tsx` 3279 行、`FileViewPanel.test.tsx` 3940 行，也在 gate 红灯清单里），拆分时测试要同步按 owner 切分。

### UI 变化

**无**。纯结构优化；间接效果是这两个高频入口的 bug 率和 review 成本下降。

---

## 3. `fileViewPanelShared.ts` / `fileViewPanelInternals.ts` 重复纯函数

**状态**：🔶 部分变化。两文件已不是整份同实现，但**仍有 10 个重复导出符号**。

### 现状（证据）

- `fileViewPanelShared.ts` 415 行 / `fileViewPanelInternals.ts` 658 行。
- 重复导出符号（当前 HEAD 逐一比对）：
  ```
  EDITOR_LINE_RANGE_SYNC_DELAY_MS
  EXTERNAL_CHANGE_POLL_INTERVAL_MS   ← 注意：第 4 项的轮询常量本身就是重复定义
  formatEditorLineRangeKey
  formatFileSize
  hasGitLineMarkers
  isSameEditorLineRange
  resolveAbsolutePath
  resolveDeclarationCodeSelectionAnchor
  resolveEditorAnnotationWidgetOrder
  resolveEditorTheme
  ```

### 影响什么

- **双份维护**：改 `resolveEditorTheme` 或调轮询常量要改两处，漏一处就是行为分裂——而这种漂移**已经发生过一次**（这就是当初出现两个文件的原因）。
- 常量重复尤其危险：`EXTERNAL_CHANGE_POLL_INTERVAL_MS` 两处都定义成 2000，未来有人改其中一处，两个消费方静默拿到不同值。

### 处理后的影响

- **按 symbol 合并**：每个重复符号保留一个事实源（建议收进 `fileViewPanelShared.ts`），另一处 re-export 过渡后删除。
- 10 个符号是有限集合，一次可清完；清完加一条 lint/codeowner 约定防止再分裂。
- 治理报告特别提醒：**避免整文件替换**——两文件已各有独有内容，整文件覆盖会误杀（这是 8.1 事故复盘里的同款教训）。

### UI 变化

**无**。

---

## 4. 文件外部变更 2s 轮询

**状态**：🔶 治理报告标"已重构"，但核实发现**两个遗留点**。

### 现状（证据）

- `useFileExternalSync.ts:78` 已有 `externalChangeTransportMode: "watcher" | "polling"` 双通道，watcher 为主（`:154` watcher 事件队列、`:391` 统一 `refreshFromDisk(source, eventKind)` 入口）——**重构属实**。
- 但：**兜底间隔常量仍是 2 秒**（`EXTERNAL_CHANGE_POLL_INTERVAL_MS = 2_000`），`useFileExternalSync.ts:457-474` 在 `polling` 模式下按此间隔 `refreshFromDisk("polling", "polling-tick")`。
- 且该常量在 shared / internals **重复定义**（见第 3 项）。

### 影响什么

- watcher 正常时无影响；一旦 watcher 不可用（远端 workspace、watcher 崩溃），fallback 到 **2 秒全量 stat 轮询**——直接撞仓库红线"事件驱动 + ≥30s 兜底轮询，禁秒级轮询"。
- 2s 全量轮询对大文件/慢磁盘是实打实的 IO 开销。

### 处理后的影响

- 兜底间隔改为 **≥30s 且 visibility-gated**（仓库已有 `setVisibilityGatedInterval` 先例，GitHistoryWorktreePanel 同款改造已落地，可直接抄）。
- watcher 失效本身应**显式提示**（"文件监听不可用，已降级为低频刷新"），而不是静默 2s 轮询。

### UI 变化

**基本无**。可选增加：watcher 失效时文件标签页出现降级提示徽标。

---

## 5. `semanticDiffSummary.ts` 的 `aiReview` 无生产者

**状态**：✅ **已接线**。路径修正：面板已从 `workspaces/components` 迁至 `session-activity/components`。

### 现状（证据）

`src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx:719-738`：`useTurnSemanticReview` 产出 `aiReview`，`:727` 判空，`:735` 注入 summary 构建——schema/UI/生产者三段已闭环。

### UI 变化

**无**（已闭环项，仅存档）。Session Activity 的语义 diff 评审位正常出内容。

---

## 6. AI commit message 藏太深

**状态修正**：治理报告称"要右键→引擎→语言两级菜单，99% 用户找不到"——**部分过时**。

### 现状（证据）

- **已有显眼按钮**：`GitDiffPanel.tsx:2266-2285`，commit 输入框旁有常驻 `commit-message-generate-button`（带引擎图标），不是只能右键。
- **但点击后仍要走两级菜单**：按钮 `onClick → showCommitMessageEngineMenu`（`:2270`）→ 选引擎（Codex/Claude）→ 再选语言（中/英，`showCommitMessageLanguageMenu` `:2109-2130`）。**点 3 次才生成**。
- **无流式**：`useGitCommitController.ts:105-152` `handleGenerateCommitMessage` `await` 完整结果后一次性 `setCommitMessage`——生成期间只有按钮转圈，用户干等。
- **已有未利用的优化素材**：`saveLastCommitMessageConfig({ engine, language })`（`:2096`）已记住上次选择——做"一键按上次配置直接生成"的基础设施已就位。

### 影响什么

- 三级点击（按钮 → 引擎 → 语言）+ 无流式等待 = 用户宁可自己手写 commit message，AI 功能形同虚设。
- 多仓库模式下入口更深（`showGenerateCommitMessage && !multiRepositoryMode`，`:2255`）。

### 处理后的影响

- **一键生成**：单击按钮直接按上次配置（engine + language 已持久化）生成；长按/右键才弹出菜单改配置。3 次点击 → 1 次。
- **流式输出**：commit message 逐字流入输入框，等待感从"转圈 10 秒"变为"秒见首字"。
- **自动分组建议**（治理报告建议项）：按改动文件语义建议拆成多个 commit。
- 风险点：流式需要 engine 侧支持增量输出；一键默认要处理"首次使用无历史配置"的 fallback。

### UI 变化

**有**：

1. 按钮单击直接生成（菜单变为辅助入口）。
2. commit message **逐字流式出现**在输入框内，可中途打断修改。
3. 可选：自动分组建议以多个 commit 草稿卡片呈现。

---

## 7. worktree 面板重复实现 AI commit

**状态**：❌ 未做（当前 HEAD 已核实，平行实现坐实）。

### 现状（证据）

`src/features/git-history/components/GitHistoryWorktreePanel.tsx` **1200 行**，自带一整套与 GitDiffPanel 平行的实现：

- 自有 stage/unstage：`:33-35` `stageGitAll / stageGitFile / unstageGitFile`
- 自有 AI commit：`:29` `generateCommitMessageWithEngine`，`:536-542` 调用，`:576-623` 同样的"语言（中/英）→ 引擎（Codex/Claude）"两级菜单
- 同样的 `sanitizeGeneratedCommitMessage` 清洗、同样的 `runScopedCommitOperation`

### 影响什么

- **两套平行演化**：第 6 项在 GitDiffPanel 做的任何改进（一键、流式、分组建议）不会自动惠及 worktree 面板——上次治理给一边加了功能，另一边就是旧体验。
- 同一 bug 要修两遍（比如 commit message 清洗逻辑）。

### 处理后的影响

- 把 stage/commit/AI-commit 抽成共享 hook（如 `useGitCommitActions`），两个面板消费同一实现。
- **顺序建议**：先做第 6 项（在 GitDiffPanel 把体验改对），再收敛——否则会把"对的体验"和"错的体验"一起抽象固化。
- 风险点：worktree 面板的 commit scope 语义（`runScopedCommitOperation`）与 diff 面板不同，抽象时 scope 参数要显式化。

### UI 变化

**无直接变化**；间接效果：worktree 面板自动获得第 6 项的一键 + 流式体验。

---

## 8. terminal 零 addon

**状态**：❌ 未做（当前 HEAD 已核实零引用）。

### 现状（证据)

- `src/features/terminal/hooks/useTerminalSession.ts:3-32`：只加载 `xterm` + `addon-fit` 两个依赖。
- 全仓 `SearchAddon` / `SerializeAddon` / `WebLinksAddon` **零引用**——终端没有搜索、没有会话序列化、没有 URL 可点。
- `src/services/tauri/terminalRuntime.ts:36-69` 已有 `runtimeLog*` 后端通道（session 快照、profile 探测），但终端面板**没有"把这段报错发给 AI"的入口**。

### 影响什么

- **终端就是个裸命令行**：日志里找一次错误要肉眼滚屏；看到链接要手动复制；报错要自己粘贴到对话框问 AI。
- runtimeLog 通道已建好却接不到产品上——又一条"差一步"的死资产。

### 处理后的影响

- 补三个 addon：**Search**（Cmd+F 终端内搜索）、**WebLinks**（URL 可点击）、Serialize（会话恢复，可选）。
- **"报错→问 AI"链路**：终端选中文本/检测到非零退出码时，出现"问 AI"按钮，把 tail 日志 + 退出码 + 当前 workspace 上下文喂给引擎（复用 prompt enhancer 已验证的隐藏 session 通道）。
- 风险点：xterm addon 版本需与当前 xterm 主版本匹配；"问 AI"要控制注入的日志体量（tail N 行 + 截断）。

### UI 变化

**有**：

1. 终端内 **Cmd+F 搜索栏**。
2. 终端输出中的 **URL 变可点击链接**。
3. 选中报错文本 / 命令失败时出现"**问 AI**"按钮。

---

## 9. code-annotations 批注只带行号

**状态**：❌ 未做（当前 HEAD 已核实）。

### 现状（证据）

- `src/features/code-annotations/utils/codeAnnotations.ts:85-91` 有 `stableAnnotationHash`（对内容做 djb2 hash 的工具），`:94-97` `formatCodeAnnotationForPrompt` 把批注格式化为 `@file 路径:行范围 + 标注正文`——**锚点只有文件路径 + 行号**，hash 工具存在但没用于锚点快照。
- 批注不存所标注代码的**内容快照**：代码一变（插入/删除行），行号即漂移。

### 影响什么

- **批注保质期极短**：AI 帮你改了代码，行号全移，之前的批注指向错误位置甚至悬空——"行号漂移即失效"。
- 发给 AI 的批注上下文（`formatCodeAnnotationForPrompt`）可能引用到错误的代码行，AI 基于错位信息回答。

### 处理后的影响

- **锚点快照**：批注保存时带上所标注代码的文本快照 + `stableAnnotationHash`。
- **漂移重定位**：打开文件时按快照内容在新文本里模糊匹配（锚点行上下文 ±N 行窗口搜索），自动修正行号；匹配失败标记为"已漂移"。
- 进阶（治理报告建议）：漂移严重时用 AI 重定位。
- 风险点：大文件全量模糊匹配要限窗口；重定位结果需用户可确认/可撤销。

### UI 变化

**有**：

1. 批注在代码变动后**自动吸附到正确位置**，不再悬空。
2. 无法重定位的批注显示"**已漂移**"标记，可手动重新锚定。

---

## 10. diff/compare 组件族 6+ 个平行演化

**状态**：❌ 未做（当前 HEAD 清点）。

### 现状（证据）

当前 `src/features/git/components/` 下的 diff 相关组件族：

| 组件 | 角色 |
|---|---|
| `DiffBlock.tsx` | 单块 diff 渲染 |
| `GitDiffViewer.tsx` | diff 查看器 |
| `ImageDiffCard.tsx` | 图片 diff |
| `WorkspaceEditableDiffCompare.tsx` | 可编辑对比 |
| `WorkspaceEditableDiffReviewSurface.tsx` | 可编辑评审面 |
| `WorkspaceReadOnlyDiffCompare.tsx` | 只读对比 |
| `settings/.../SyntaxAndDiffPreview.tsx` | 设置页 diff 预览 |

外加 `GitDiffPanel` 的 4 个子件（`CommitScope / FileSections / Inclusion / SectionActions`）。治理报告估"6+ 个、4000+ 行"，清点属实，且"可编辑 vs 只读 vs 评审面"三者的边界最模糊。

### 影响什么

- 修一个 diff 渲染 bug（比如空 hunks 显示异常），要先判断用户走的是哪条路径——EditableCompare、ReadOnlyCompare 还是 DiffViewer？
- 样式/交互改进（如行内注释、展开上下文）要在多个组件里各做一遍。

### 处理后的影响

- **diff 组件族重切分**：统一为一个 core diff renderer（hunks 解析 + 渲染），Editable/ReadOnly/Review 作为**能力层**（editing、review annotations）叠加，而不是三个平行组件。
- 风险点：P2 优先级，体量不小；建议排在第 2 项（GitDiffPanel 拆分）之后，复用其拆分中沉淀的 owner 边界。

### UI 变化

**无直接变化**；间接效果：diff 相关 bug 修一处全场景生效。

---

## 11. `FileMarkdownPreview.tsx` 1581 行仍是生产依赖

**状态**：🔶 部分变化。`SkillsSection.tsx` 已删除（旧耦合点没了），但 legacy 实现仍被 Fast wrapper 生产依赖。

### 现状（证据）

- `FileMarkdownPreviewFast.tsx:10` `import { FileMarkdownPreview } from "./FileMarkdownPreview"`，`:434` **直接渲染 legacy 实现**。
- `FileMarkdownPreviewFast.tsx` 自身 556 行，其注释（`:30`）自述*"mount the rich `FileMarkdownPreview` directly"*——**"Fast" 不是独立管线，是 legacy 的条件渲染外壳**。
- 生产链路：`FileViewBody.tsx` 用 Fast wrapper → wrapper 在需要富渲染时回落 legacy。

### 影响什么

- "删掉 1581 行 legacy"这个直觉动作会**直接破坏文件预览**——Fast wrapper 的富渲染路径整个依赖它。
- legacy 1581 行继续累积维护成本，且名字（Preview vs PreviewFast）持续误导维护者以为有两条独立管线。

### 处理后的影响

- **先迁出 rich preview 能力**：把 legacy 里 Fast wrapper 实际用到的渲染能力抽成共享模块，legacy 瘦身后要么删除、要么重命名为真实角色（如 `MarkdownRichRenderer`）。
- 风险点：先理清 Fast wrapper 在哪些条件回落 legacy（`:434` 周边条件），迁移以这些条件为边界；这是删除型任务，按 capability 分片立项。

### UI 变化

**无**。纯结构优化。

---

## 12. stale mock 路径不符

**状态**：❌ 未做。已定位到**具体失效 mock**。

### 现状（证据）

- `src/app-shell.startup.test.tsx:1165-1169` mock 了 `./features/app/hooks/useLiveEditPreview`——**该路径不存在**。
- 真实模块在 `src/features/live-edit-preview/hooks/useLiveEditPreview.ts`（live-edit-preview 已独立成 feature）。
- `vi.mock` 指向不存在的路径 = 静默无效；同文件其他 mock（`usePullRequestComposer`、`useSoloMode`）已核实路径有效，**只有这一个失效**。

### 影响什么

- **测试在跑真实 hook**：startup 测试本想把 live-edit-preview 关掉（`enabled: false`），实际跑的是真实现——测试结果依赖真 hook 的行为，"可能测了个寂寞"。
- 更隐蔽的风险：真 hook 若在测试环境里发起副作用（IPC/存储），测试可能偶发失败或互相污染，排查时很难想到是 mock 没生效。

### 处理后的影响

- 修正 mock 路径为 `./features/live-edit-preview/hooks/useLiveEditPreview`——一行修复。
- 顺手加防御：对关键 mock 用 `vi.mocked(...)` 断言生效，或在 CI 加一条"mock 路径存在性"检查脚本（成本极低，防复发）。

### UI 变化

**无**。测试可信度修复。

---

## 附：实施顺序建议

| 批次 | 项 | 理由 |
|---|---|---|
| 第一批（快赢 + 决策） | **#12 一行修 mock**、**#2 的"拆 or baseline"决策**、#3 按 symbol 合并 | #12 成本一行；#2 的决策是解锁 gate 红灯的前提；#3 是有限集合 |
| 第二批（类型安全） | #1 Git History shared types → 按 slice 摘 nocheck | P0，高危不可逆链路；先做 types 再摘，别反过来 |
| 第三批（用户体验） | #6 一键 + 流式 → #7 收敛 worktree → #8 terminal addon + 问 AI | #6 先做对再收敛 #7；#8 是最大 UI 增量 |
| 第四批（结构与存量） | #2 拆分执行、#4 兜底间隔 ≥30s、#11 迁出 rich preview、#9 锚点快照、#10 diff 重切分 | #10 依赖 #2 沉淀的边界；#11 是删除型任务需分片立项 |

> ⚠️ 三条提醒：
> - **#2 是 gate 红灯的直接来源**，拖一天，"新增回退 vs 已知债务"就一天无法区分——决策本身比执行更紧急；
> - **#3 和第 1 项的拆分都要遵守"语义合并、不整文件覆盖"**（8.1 事故教训）；
> - **#4 的 2s 兜底直接撞仓库轮询红线**，建议随 #3 一起处理（同一个重复常量）。
>
> 每项动手前请在 OpenSpec 按 capability 分片立项，避免大颗粒提案烂尾。
