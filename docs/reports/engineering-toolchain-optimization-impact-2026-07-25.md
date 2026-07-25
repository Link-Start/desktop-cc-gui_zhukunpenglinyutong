# 当前工程工具链优化现状与影响范围

> **复核日期**：2026-07-26
>
> **代码基线**：分支 `feature/v-0710`，HEAD `e6c8b2433`
>
> **工作区说明**：第 6 项包含当前尚未提交的 AI commit message 交互修复，其余结论以 HEAD 和当前 working tree 的实际源码为准
>
> **文档目标**：回答 12 个工程工具链问题现在做到哪一步、影响哪些用户与代码，以及下一步应处理什么
>
> **核对方法**：按 symbol、生产 caller、测试、line count 和治理命令逐项核对；行号会随提交变化，定位时应优先搜索 symbol

这 12 项目前有 4 项完成、4 项部分完成、4 项未完成。文件外部变更轮询和 stale mock 已完成治理；AI commit message 已恢复 engine 与 language 的显式选择。当前最高风险仍是 large-file gate 的 17 项失败，以及 Git History 仍有 8,944 行 `@ts-nocheck`。

## 状态总览

| # | 优化项 | 优先级 | 当前状态 | 主要影响范围 |
|---|---|---:|---|---|
| 1 | Git History 大面积 `@ts-nocheck` | P0 | 🔶 部分完成：1 个文件已摘，4 个文件仍有 8,944 行 | Git History 高危操作、类型检查、AI 改码安全 |
| 2 | `GitDiffPanel` 与 `FileViewPanel` 超大文件 | P0-P1 | ❌ 未完成：large-file gate 仍有 17 项失败 | CI gate、Git Changes、文件编辑与预览 |
| 3 | File View 重复纯函数 | P0 | ✅ 已完成：重复导出从 10 个降为 0 | File View 共享逻辑、维护一致性 |
| 4 | 文件外部变更 2s 轮询 | P1 | ✅ 已完成：30s 兜底、visibility gate、单一常量 | 文件同步、后台 IO、慢磁盘与远端 workspace |
| 5 | `aiReview` 无生产者 | P1 | ✅ 已完成：生产与消费链路闭环 | Session Activity、semantic diff summary |
| 6 | AI commit message 选择入口 | P1 | 🔶 部分完成：显式三层选择已恢复，流式生成未做 | Git Changes、Git History Worktree、Codex/Claude、中英文 |
| 7 | Worktree 面板重复实现 AI commit | P1 | 🔶 部分完成：配置事实源共享，执行编排仍重复 | 两套 commit UI、修复同步成本 |
| 8 | Terminal 能力不足 | P1 | 🔶 部分完成：选区可发送 Composer，addon 仍只有 Fit | Terminal 搜索、链接、错误上下文 |
| 9 | Code annotation 锚点会漂移 | P1 | ❌ 未完成：仍只有路径与行号 | 批注可靠性、AI prompt 上下文 |
| 10 | Diff/compare 组件平行演化 | P2 | ❌ 未完成：11 个相关组件共 4,650 行 | Diff 渲染、评审、只读与可编辑对比 |
| 11 | Markdown legacy renderer 仍在生产链 | P1 | ❌ 未完成：Fast wrapper 仍依赖 1,581 行 legacy | Markdown 预览、outline、Mermaid、图片 |
| 12 | Live Edit Preview stale mock | P1 | ✅ 已完成：mock 已指向真实路径 | AppShell startup test 可信度 |

## 影响范围矩阵

| 项 | 用户可见影响 | Runtime / IO | 代码与维护 | 测试与 Gate |
|---|---|---|---|---|
| #1 | 无直接 UI 变化 | Git 高危操作仍按现有流程执行 | 4 个核心文件失去 TypeScript 保护 | 类型检查无法覆盖 8,944 行 |
| #2 | 无直接 UI 变化 | 大组件副作用仍集中 | Git/File 两个高频入口回归半径大 | large-file gate 17 项失败 |
| #3 | 无 | 无新增 runtime 成本 | File View helper 已恢复单一事实源 | 重复实现风险下降 |
| #4 | watcher 失效时刷新最长等待增加 | fallback IO 从 2s 降为 30s，隐藏窗口暂停 | polling 常量只保留一份 | 已有 polling 与 visibility tests |
| #5 | Session Activity 可展示 AI review facts | semantic review 进入 summary 构建 | schema、producer、consumer 已闭环 | semantic summary tests 覆盖 |
| #6 | 可随时切换 engine 与中文/English | 仍等待完整结果，无 token streaming | 两个入口共享 menu config policy | 两个 panel tests 覆盖选择路径 |
| #7 | 两个入口体验接近但实现仍可能漂移 | 两条 generation/commit 调用链 | 同类 bug 仍可能修两次 | 两套 component tests |
| #8 | 右键可把终端选区发送到 Composer | 未增加 addon 与后台任务 | 缺 Search/WebLinks/Serialize 集成 | TerminalPanel selection tests 已覆盖 |
| #9 | 代码变化后批注可能错位 | 无额外 runtime 成本 | annotation 缺内容快照与重定位 | 缺漂移回归测试 |
| #10 | 不同 diff surface 可能行为不一致 | 重复渲染与状态逻辑 | 11 个组件平行维护 | 测试分散在多个 surface |
| #11 | 富 Markdown 预览继续可用 | rich path 仍加载 legacy renderer | Fast 与 legacy 命名和职责不清 | 删除 legacy 会直接破坏生产链 |
| #12 | 无 | startup test 不再误跑真实 hook | mock 路径与生产 import 对齐 | 测试隔离恢复 |

## 1. Git History 类型保护只完成第一步

**状态**：🔶 部分完成。`GitHistoryPanelPickers.tsx` 已在 `dbcd943eb` 摘除 `@ts-nocheck`，另外 4 个文件仍保留该指令。

### 当前证据

| 文件 | 行数 | 状态 |
|---|---:|---|
| `GitHistoryPanelImpl.tsx` | 2,803 | `@ts-nocheck` |
| `GitHistoryPanelView.tsx` | 2,405 | `@ts-nocheck` |
| `useGitHistoryPanelInteractions.tsx` | 2,188 | `@ts-nocheck` |
| `GitHistoryPanelDialogs.tsx` | 1,548 | `@ts-nocheck` |
| `GitHistoryPanelPickers.tsx` | 493 | 已恢复类型检查 |

未受 TypeScript 保护的代码共 8,944 行。删除分支、force delete、reset、rebase 和 checkout 等操作仍跨 `Interactions → Dialogs → Impl` 分布。

### 影响范围

- **用户与数据安全**：高危 Git 操作的参数错误只能在 runtime 暴露
- **开发体验**：IDE、refactor 和 TypeScript 无法验证跨组件 props
- **AI 协作**：AI 无法借助类型系统识别 branch name、commit hash 和 dialog payload 的边界
- **回归范围**：修改任一 interaction slice 时，需要人工追踪多个 nocheck 文件

### 剩余动作

先定义共享 props 与 action types，再按完整 interaction slice 摘除。下一片建议选择“删除分支”或“reset”，一次覆盖按钮、handler、dialog、执行与测试。

## 2. 两个高频入口仍被 large-file gate 阻断

**状态**：❌ 未完成。`npm run check:large-files:gate` 当前报告 17 项失败。

### 当前证据

- `GitDiffPanel.tsx`：3,132 行
- `FileViewPanel.tsx`：3,092 行，25 处 `useEffect`
- `GitDiffPanel.test.tsx`：3,336 行
- `FileViewPanel.test.tsx`：3,940 行

这 4 个文件都以 `status=new` 触发 hard failure。17 项失败还包含 Rust runtime、Threads 和 CSS 文件，因此拆分这 4 个文件只能解决本项，不能让整个 gate 变绿。

### 影响范围

- **Git Changes**：stage、commit、AI commit、Pull Request 和 context menu 集中在一个组件
- **File View**：读取、草稿、外部同步、Git blame、二进制判断和 typing diagnostics 集中在一个组件
- **CI**：gate 持续红灯，新增超限和存量债务无法区分
- **Review**：单次修改面对 3,000 行以上实现和测试，误伤概率高

### 剩余动作

不要只为数字拆文件。先按 capability owner 切分 production code，再同步拆分测试。每批应让一个完整功能片独立拥有 state、effects 和 tests。

## 3. File View 重复纯函数已经清理

**状态**：✅ 已完成。`04764a654` 合并了重复 helper，并缩小 `fileViewPanelInternals.ts`。

### 当前证据

- `fileViewPanelShared.ts`：417 行
- `fileViewPanelInternals.ts`：295 行
- 两个文件的重复导出 symbol：0
- `EXTERNAL_CHANGE_POLL_INTERVAL_MS` 只在 shared 文件定义

### 影响范围

- **行为一致性**：theme、path、line range、annotation order 和 polling interval 不再有双份实现
- **维护成本**：修改 shared helper 只需更新一个事实源
- **风险变化**：整文件合并风险已消除，后续应按 symbol 继续维护边界

本项无需继续实施。后续 review 只需防止 internals 再复制 shared exports。

## 4. 文件外部变更轮询已经符合当前红线

**状态**：✅ 已完成。`04764a654` 将 fallback interval 从 2s 调整为 30s，并增加 visibility gate。

### 当前证据

- `EXTERNAL_CHANGE_POLL_INTERVAL_MS = 30_000`
- watcher 和 polling 仍通过 `externalChangeTransportMode` 明确分流
- polling 使用递归 `setTimeout`，上一轮完成后才安排下一轮
- 窗口隐藏时停止计时，恢复可见时先刷新一次
- watcher event 与 polling 都进入统一 `refreshFromDisk`

### 影响范围

- **IO**：fallback stat/read 频率最多降为原来的十五分之一
- **后台资源**：隐藏窗口不再继续轮询
- **同步延迟**：watcher 不可用时，后台变化的被动发现窗口从 2s 增加到最长 30s
- **正确性**：递归调度避免慢磁盘下多个 polling request 重叠

本项已闭环。剩余观察项是 watcher fallback 的可观测性，不应重新引入秒级轮询。

## 5. `aiReview` 已形成生产闭环

**状态**：✅ 已完成。

### 当前证据

`WorkspaceSessionActivityPanel` 调用 `useTurnSemanticReview` 生成 `aiReview`，过滤空 facts 后将其传入 semantic diff summary。`semanticDiffSummary.ts` 负责消费 facts。

### 影响范围

- **用户界面**：Session Activity 可以显示 AI 提取的变更事实
- **数据流**：hook、panel、summary schema 和 renderer 已闭环
- **测试**：semantic summary 已覆盖有无 `aiReview` 的输入

本项无需新增生产者。后续应只关注 facts 质量和生成成本。

## 6. AI commit message 已恢复显式选择

**状态**：🔶 部分完成。当前 working tree 已修复“历史配置导致直接生成”的交互回退；流式生成仍未实现。

### 当前交互

1. 点击常驻 AI commit 按钮
2. 选择 **使用上次配置**、**Codex** 或 **Claude**
3. 选择 engine 时，再选择 **中文** 或 **English**
4. 生成 commit message

`GitDiffPanel` 和 `GitHistoryWorktreePanel` 都使用该流程。历史配置只作为可见快捷项，不再跳过 engine menu。retired 或 disabled engine 也不能通过旧配置绕过当前 menu catalog。

### 影响范围

- **Git Changes**：单仓与多仓 commit composer 都能显式选择 engine 与 language
- **Git History Worktree**：worktree commit composer 使用相同选择策略
- **用户控制权**：每次生成都可以切换 Codex/Claude 和中文/English
- **兼容性**：有效历史配置仍可通过菜单一项完成快捷生成
- **等待体验**：生成仍是 request/response，一次性写入输入框，没有 token streaming

### 剩余动作

将“流式生成”拆为独立需求评估。它需要 engine adapter、取消语义、partial result 和输入框覆盖策略，不能只改按钮状态。

## 7. Worktree 只共享了配置策略

**状态**：🔶 部分完成。`9fb13076e` 和当前修复让两个面板共享 AI commit menu catalog 与 persisted config policy，但没有统一执行编排。

### 当前证据

`GitHistoryWorktreePanel.tsx` 仍有 1,245 行，并继续直接调用：

- `stageGitAll`、`stageGitFile`、`unstageGitFile`
- `generateCommitMessageWithEngine`
- `sanitizeGeneratedCommitMessage`
- `runScopedCommitOperation`

### 影响范围

- **已收敛**：engine catalog、last config 合法性和显式选择策略
- **仍重复**：loading、error、selected paths、repository scope、generation 和 commit orchestration
- **测试成本**：同一交互规则仍要在两个 panel test suite 中验证
- **回归风险**：共享配置之外的 bug 仍可能只修到一个入口

### 剩余动作

先抽取 commit generation controller，再评估 stage/commit orchestration。不要直接合并整块 UI，因为 worktree 的 repository scope 与 GitDiffPanel 不同。

## 8. Terminal 已有 Composer 入口，但仍缺 addon

**状态**：🔶 部分完成。

### 当前证据

- `useTerminalSession.ts` 只加载 `@xterm/addon-fit`
- `SearchAddon`、`WebLinksAddon` 和 `SerializeAddon` 仍是零引用
- `TerminalPanel` 已支持右键把当前 xterm selection 发送到 Composer
- selection tests 覆盖精确文本、重复调用、空选区和旧选区清理

### 影响范围

- **已改善**：用户不再需要手动复制选中的终端错误到 Composer
- **仍缺搜索**：长日志无法通过 terminal 内 Cmd+F 定位
- **仍缺链接**：URL 不能由 WebLinksAddon 提供统一点击行为
- **仍缺错误语义**：非零 exit code 不会自动形成带 workspace context 的提问
- **依赖范围**：新增 addon 会修改 package dependencies、xterm 初始化和 Terminal tests

### 剩余动作

优先评估 SearchAddon 与 WebLinksAddon。SerializeAddon 涉及 session persistence，价值和数据边界不同，应单独立项。

## 9. Code annotation 仍会随行号漂移

**状态**：❌ 未完成。

### 当前证据

`createCodeAnnotationSelection` 使用路径、行范围和正文构造稳定 ID。`formatCodeAnnotationForPrompt` 只输出 `@file` 引用与批注正文。数据结构没有保存所选代码快照，也没有重定位结果。

### 影响范围

- **编辑器**：插入或删除代码后，旧批注可能指向错误行
- **AI prompt**：发送给 AI 的 `@file` 行范围可能已经失效
- **持久化**：缺少 snapshot、hash version 和 drift status，无法可靠迁移
- **性能**：未来重定位必须限制搜索窗口，避免在大文件做全量模糊匹配

### 剩余动作

先扩展 annotation contract，保存 selected code snapshot 与上下文 hash。随后实现限定窗口的精确匹配，再考虑模糊匹配。

## 10. Diff/compare 组件仍有 4,650 行平行实现

**状态**：❌ 未完成。

### 当前证据

当前相关 production components 共 11 个、4,650 行：

- 6 个主要 surface：`DiffBlock`、`GitDiffViewer`、`ImageDiffCard`、`WorkspaceEditableDiffCompare`、`WorkspaceEditableDiffReviewSurface`、`WorkspaceReadOnlyDiffCompare`
- 4 个 `GitDiffPanel` 子组件：CommitScope、FileSections、Inclusion、SectionActions
- 1 个 settings preview：`SyntaxAndDiffPreview`

### 影响范围

- **渲染一致性**：hunk、empty state、toolbar 和 syntax style 可能在不同 surface 分裂
- **能力扩展**：inline annotation、context expansion 或 image diff 改进需要确认多个入口
- **测试**：Editable、Review、ReadOnly 和 Viewer 各有独立测试边界
- **拆分依赖**：本项与 #2 的 `GitDiffPanel` owner 拆分直接相关

### 剩余动作

先建立 renderer capability matrix，区分 core diff rendering、editing、review annotation 和 read-only policy。不要先建通用大组件。

## 11. Fast Markdown wrapper 仍依赖 legacy renderer

**状态**：❌ 未完成。

### 当前证据

- `FileMarkdownPreview.tsx`：1,581 行
- `FileMarkdownPreviewFast.tsx`：556 行
- Fast wrapper 直接 import 并渲染 `FileMarkdownPreview`
- `FileViewBody` 的生产链路仍使用 Fast wrapper
- fast path 不适用或发生 mismatch 时会回退 rich ReactMarkdown path

### 影响范围

- **生产功能**：直接删除 legacy 会破坏 rich Markdown、outline、Mermaid、图片和 fallback
- **加载与渲染**：Fast wrapper 不是完全独立 renderer，而是 fast/rich router
- **维护认知**：`Fast` 与 legacy 名称容易让开发者误判依赖关系
- **测试**：迁移必须覆盖 fast path、rich path 和 mismatch fallback

### 剩余动作

先把 rich renderer 的稳定能力边界命名清楚，再迁移调用。目标不是删除行数，而是让 fast parser 与 rich renderer 各自拥有明确 contract。

## 12. Live Edit Preview stale mock 已修复

**状态**：✅ 已完成。修复包含在 `04764a654`。

### 当前证据

`src/app-shell.startup.test.tsx` 现在 mock：

```typescript
vi.mock("./features/live-edit-preview/hooks/useLiveEditPreview", () => ({
  useLiveEditPreview: () => ({
    enabled: false,
  }),
}));
```

该路径与 `useAppShellSections.ts` 的生产 import 对齐，真实模块存在于 `src/features/live-edit-preview/hooks/useLiveEditPreview.ts`。

### 影响范围

- **测试隔离**：startup test 不再误跑真实 Live Edit Preview hook
- **副作用控制**：IPC 与 storage 行为不会因 stale mock 泄漏进测试
- **UI**：无生产 UI 变化

本项无需继续实施。

## 当前实施顺序

| 顺序 | 项目 | 原因 |
|---:|---|---|
| 1 | #2 large-file gate 决策 | 17 项失败持续降低 gate 信号价值，需要先区分存量 baseline 与本轮拆分目标 |
| 2 | #1 Git History 类型切片 | 涉及不可逆 Git 操作，8,944 行缺少类型保护 |
| 3 | #7 commit generation controller | #6 的交互策略已稳定，可以开始收敛执行层 |
| 4 | #9 annotation snapshot contract | 先修数据契约，才能实现可靠重定位 |
| 5 | #8 SearchAddon / WebLinksAddon | 用户收益明确，依赖面小于 session serialization |
| 6 | #11 Markdown renderer 边界 | 删除型重构，需要按 fast/rich capability 分片 |
| 7 | #10 diff capability matrix | 依赖 #2 的 owner 边界，优先级保持 P2 |

#3、#4、#5 和 #12 已闭环，不应继续占用实施批次。#6 当前只剩流式生成议题，应作为独立产品与 runtime contract 评估，不应回退已恢复的 engine/language 显式选择。
