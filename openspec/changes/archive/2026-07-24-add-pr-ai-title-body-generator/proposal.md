# add-pr-ai-title-body-generator

## Why

ccgui 的 Git History「创建 Pull Request」对话框红框区域（PR 标题 + PR 描述）目前完全依赖用户手写。当一次 PR 涉及几十个文件改动（vendor 升级、批量迁移、catalog 重建）时，人工概括 `upstream/<base>...HEAD` 差异成本很高。

仓库已经有现成的 AI commit message 引擎体系（Codex CLI + Claude `engineSendMessageSync`）以及 `CommitMessageEngineIcon` + `readLastCommitMessageConfig` / `saveLastCommitMessageConfig` 的 engine/language 菜单模式。本变更复用这些 engine / menu / error-handling 能力，同时为 PR 使用独立的 committed range context，避免误用 staged/worktree diff。

## 目标与边界

- 在 Create PR 对话框的 PR 标题字段旁提供 **一个**「自动生成」按钮，点击后调用 AI 同时回填 title 和 body。
- 复用 `CommitMessageEngine`（codex / claude / kimi / opencode）+ `CommitMessageLanguage`（zh / en）+ `engineSendMessageSync` 现有路径；通过 `readLastCommitMessageConfig` / `saveLastCommitMessageConfig` 记忆上次的 (engine, language)。
- 上下文仅使用当前工作区 git diff（`upstream/<base>...HEAD` 视角），加 base / head 分支名；不引入额外 GitHub 元数据。
- title 必须 ≤ 72 字符；body 使用 Markdown 结构 `## 背景 / ## 改动点 / ## 验证`（zh）或 `## Background / ## Changes / ## Verification`（en），与 `default_pr_description` 对齐。
- 生成结果总是覆盖当前 title / body（默认值与 AI 内容都是 placeholder，用户主动点 AI 即明确要替换）。
- 提供完整的生成状态机：idle → generating（蓝色 pill + 按钮 spinning + 倒计时秒数）→ success（绿色 pill，标注实际使用的 engine，3s 后自动消失）/ slow warning（>60s，琥珀色 pill）/ error（红色 pill，5min 超时或 backend 异常）→ idle。
- AI 写回后给 title 输入框和 body 文本域加 1.2s 的 outline 呼吸高亮，让用户清楚看到内容变化。

## 非目标

- 不实现按 PR template 渲染（不同 repo 自定义 `.github/PULL_REQUEST_TEMPLATE.md` 不在 first-cut 范围）。
- 不实现 review 摘要、label 推断、冲突预测。
- 不为 PR 生成新增独立 engine；沿用现有 commit message engine 选择菜单 + 上次配置记忆。
- 不改 push / create / comment stage 流程；本变更只影响 PR 表单预填。
- 不在 PR 创建成功后再次自动改写 PR description；用户明确点击才生成。
- 不在 View 文件 (`@ts-nocheck` 巨型 scope-passing 文件) 之外重构 `useGitHistoryPanelInteractions`；新逻辑直接挂在 `GitHistoryPanelImpl.tsx`（加 `ponytail:` 注释说明），避免触碰那个 giant scope 链。

## What Changes

### 后端

- **新模块** `src-tauri/src/git/pull_request_content.rs`：
  - `build_pull_request_content_prompt(diff, base_branch, head_branch, language)`：中英两套模板，强 JSON 输出 `{"title": string, "body": string}`，title ≤ 72 字符约束，body Markdown 段落结构对齐 `default_pr_description`。
  - `truncate_pr_title(title)`：硬截 72 字符 + 去尾空格/标点。
  - `parse_pull_request_response(text)`：string/escape-aware tolerant JSON 解析（strict → first balanced `{...}`）；解析失败或 title/body 不完整时 fail closed，禁止 raw model text 写回表单。
  - `truncate_diff_for_prompt(diff)`：硬 cap 20K chars（约 5K tokens），超出部分附 `... (diff truncated for prompt length)` 标记。20K 是经验值：60K 在大 PR 上经常导致 LLM 推理 + JSON 解析超过 60s 而超时；20K 让绝大多数 diff 在 30-90s 内稳定输出。
  - `generate_pull_request_content_impl(workspace_id, language, engine, base_branch, head_branch, state, app)`：执行 `git diff --no-color --find-renames <base>...<head>` 获取 committed PR range；通过 `engine_send_message_sync` 派发，`autoSession = { sessionPurpose: "pull-request-content", visibility: "hidden", ownerFeature: "git", autoArchive: true, createdBy: "system" }`。
  - 13 个 Rust module tests 覆盖中英 prompt、language normalization、字数/标点截断、截断后空标题 fail-closed、JSON string braces、diff 截断，以及真实临时 Git repo 的 remote-tracking base/head range。

- **新 Tauri command** `generate_pull_request_content(workspaceId, language, engine, baseBranch, headBranch)`：
  - `src-tauri/src/git/commands.rs` 加 `pub(crate) async fn generate_pull_request_content(...)`；desktop/local mode 执行生成，remote mode 明确 fail closed。daemon 当前不支持 Codex sync generation，本变更不扩展 daemon engine protocol。
  - `engine` 缺省或空时 fallback 到 `"codex"`，与现有 commit message 路径行为一致。
  - `src-tauri/src/command_registry.rs` 注册。

- **新类型** `src-tauri/src/types.rs::PullRequestGeneratedContent { title, body, engine, language }`，全部 `serde(default)`。

### 前端

- **新 service** `src/services/tauri/pullRequestContent.ts`：
  - `generatePullRequestContent(workspaceId, language, engine, baseBranch, headBranch, onProgress?)`。
  - 复用 `CommitMessageEngine` / `CommitMessageLanguage` 类型 + `isEngineExecutionEnabled` 校验。
  - **5min hard timeout**（之前 60s 对大 diff 来说不够），通过 `Promise.race` 包装实现，避免 `finally` 里 `throw`（ESLint `no-unsafe-finally`）。
  - **60s soft warning**：通过可选的 `onProgress({ kind: "soft-warn" | "hard-timeout", elapsedMs })` 回调通知 UI，让 UI 进入「长时间运行」视觉状态。
  - Tauri reject 时把 `error.message` 抽出统一抛 `Error(string)`。
  - 6 个 vitest 覆盖 invoke 透传 / engine 拒绝 / 错误 message 规范化 / soft warning / hard timeout。

- **service barrel**：`src/services/tauri.ts` 同步 re-export。

- **hook & state**：新逻辑直接挂在 `GitHistoryPanelImpl.tsx`（**不**走 `useGitHistoryPanelInteractions` 这个 giant scope-passing hook；用 `ponytail:` 注释说明）：
  - generation state：`createPrContentGenerating` / `createPrContentError` / `createPrContentSuccessAt` / `createPrContentSlow` / `createPrContentElapsedSec` / `createPrFormFlashAt`。
  - 引擎状态：`createPrContentEngine` (default `"codex"`)；language 作为 action 参数与 last config 持久化，不保留冗余 React state。
  - 菜单状态：`prContentMenu` (default `null`) / `setPrContentMenu`。
  - `triggerPrContentGeneration(engine, language)`：复用 PR preview 已解析的 `createPrPreviewBaseRef` / `createPrPreviewHeadRef` → 校验 → 保存 last config → 调 service → 写回 title/body → 设置 success / error。
  - `openPrContentGenerationMenu(event)`：弹出「上次配置 / Codex / Claude」菜单；engine 项复用 `RendererContextMenu` 原生 submenu 承载「中文 / 英文」，不使用 close + `setTimeout(0)` 重开菜单的竞态方案。
  - 3 个 useEffect：success 3s 自动消失 / 写回 1.2s flash 倒计时 / elapsedSec 每秒推进；60s slow 视觉切换由 service 的 `onProgress({ kind: "soft-warn" })` 驱动。

- **写入策略变更**：AI 返回的 `result.title` / `result.body` **总是覆盖**当前 form 字段。之前用 `titleEmpty && bodyEmpty` gate 的「only fill empty」逻辑被静默丢弃：因为 PR dialog 预填了默认值（merge commit 标题 + 空模板 body），`titleEmpty` / `bodyEmpty` 永远是 false，AI 内容永远不写入。这是 first-cut 一个被报告的核心 bug。

- **错误本地化**：timeout / `unsupported_engine` 映射专用文案，其余 backend error 统一包装到 `historyGeneratePrError`，不把 raw 文本直接渲染为孤立 UI copy。

### 前端 UI

- **`GitHistoryPanelView.tsx`**：
  - 把 `git-history-create-branch-field` 和 `is-pr-content-row` 的 `<label>` 改成 `<div>`，**避免 `<label>` 嵌套 `<button>` 时浏览器把点击转发给关联的 form input 导致按钮 onClick 不触发**。这是 first-cut 另一个被报告的 bug。
  - title 字段旁加「自动生成」按钮，复用 `CommitMessageEngineIcon`。
  - 单一触发点（用户明确要求「只要一个按钮同时填 title 和 body」，所以 body 字段旁**不**加第二个按钮）。
  - 加载中：input/textarea disabled，按钮 icon spinning，蓝色 "AI 正在生成… ({{elapsed}}s)" 进度条。
  - 60s 后进度条变琥珀色 "AI 仍在生成中（diff 较大），请稍候… ({{elapsed}}s)"。
  - 成功后：绿色 "✓ {{engine}} 已生成 PR 标题与正文" pill，3s 后自动消失；title/body 字段加 1.2s 蓝色 outline 呼吸框，让用户看到内容变化。
  - 失败：红色 timeout / unsupported / generic localized error pill，persistent。
  - 挂载 `RendererContextMenu menu={prContentMenu} onClose={() => setPrContentMenu(null)}` 用于显示引擎/语言选择菜单。

- **CSS** (`src/styles/git-history.part2.css`)：
  - `.git-history-create-pr-generate-button`：22×22 inline-flex，transparent 背景 + `--text-secondary` 颜色（避免在 light dialog 上突兀），hover 时切到 `--surface-hover` 60% mix + accent 描边。
  - `.git-history-create-pr-generate-button.is-loading`：accent-tinted 背景 + accent 描边 + `cursor: progress`。
  - `.git-history-create-pr-generate-button.is-loading::after`：accent 描边的脉冲环 + `pr-generate-pulse` keyframe（1.2s ease-in-out）。
  - `.git-history-create-pr-generation-progress` / `.is-slow`：蓝色/琥珀色 pill。
  - `.git-history-create-pr-generation-success`：绿色 pill + `pr-generate-success-fade` 200ms 淡入。
  - `.git-history-create-pr-generation-error`：红色 pill。
  - `.git-history-create-pr-dialog input[data-ai-flash-at]` / `textarea[data-ai-flash-at]`：1.2s accent outline 呼吸，范围只限 Create PR dialog。
  - `.git-history-create-branch-field` 内部从 `<label>` 改为 `<div>`，正确使用 `> .is-pr-content-row` selector 建立 flex 布局。

- **共享样式根因修复** (`src/styles/sidebar.css`)：
  - 之前的 `.renderer-context-menu` 用 `surface-popover`（`rgba(255,255,255,0.99)`，light theme 1% 透明）+ `backdrop-filter: blur(14px)`。在 PR dialog 上方时，dialog 的 `box-shadow` 会透过来，导致菜单左右颜色对不上（dark-left / white-right gradient）。
  - 改为 `--sidebar-floating-menu-bg: var(--surface-sidebar-opaque)`（**完全不透**），同时去掉 `backdrop-filter`。所有 `RendererContextMenu` 消费者（sidebar、terminal、git diff、PR content）受益。

### i18n

10 locale `src/i18n/locales/*/git.ts` 同步新增 / 更新：

| Key | 用途 |
|---|---|
| `historyGeneratePrTitleBody` | 按钮 title / aria-label |
| `historyGeneratePrLoading` | 进度条（带 `{{elapsed}}`） |
| `historyGeneratePrLoadingSlow` | 60s+ 慢进度条 |
| `historyGeneratePrSuccessWithEngine` | 成功 pill（带 `{{engine}}`） |
| `historyGeneratePrError` | 错误通用 |
| `historyGeneratePrTimeout` | 5min 超时 |
| `historyGeneratePrUnsupportedEngine` | engine 不可用 |
| `historyGeneratePrMissingBaseOrHead` | base / head 为空 |
| `historyGeneratePrMenuTitle` / `LastConfig` / `Codex` / `Claude` / `Zh` / `En` | 菜单项 |

zh 与 en 主语言原生文案；其余 8 locale（ja / zh-TW / ru / es / fr / hi / ko / pt-BR）以英文 fallback 为主，本地化由后续 PR 补齐。

## 方案对比与取舍

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A | 复用 commit message 路径，仅扩展 prompt 模板 + service | 改动小，复用 engine 选择 / 错误处理 / 进度展示 | prompt 与 commit message 同语义不同结构，需明确约束 | 采纳 |
| B | 新建独立 PR generator（独立 engine 选择、prompt、状态） | 隔离清晰 | 多一份并行的 engine menu / loading / error | 不采纳 |
| C | 直接调用 Codex 引擎发普通 chat，不复用 autoSession | 实现最简 | 与 commit message 体验不一致，错误路径与提示文案都得另写 | 不采纳 |
| D | 在 server 端推送 PR template 文件再渲染 | 自动遵循仓库约定 | first-cut 范围过宽 | 不采纳 |
| E | 通过 `engine_send_message` 流式响应 + Tauri event | 实时显示 token、5-10s 后即可看到部分内容 | 需重写 prompt 流式 + 事件协议 + 前端 subscribe + 部分 JSON 容错；first-cut 工作量翻倍 | 暂不采纳（架构备选），后续 PR 替换 sync 路径 |
| F | 写回策略：`titleEmpty && bodyEmpty` 才整体替换 | 保留用户已写的内容 | 实际场景：PR dialog 预填了默认值，AI 内容**永远不写入**（被用户报告为 first-cut 的核心 bug） | 不采纳 |
| G | 写回策略：AI 总是覆盖；用 outline 呼吸高亮提示用户 | 用户主动点 AI 即明确要替换；高亮让用户看清楚 | 已手动编辑过的内容也会被覆盖 | 采纳（first-cut 显式约定） |

## 验收标准

- 在 Create PR 对话框中，title 字段右侧出现「自动生成」按钮（icon 反映当前 engine），body 字段旁不出现按钮（单一触发点）。
- 点击按钮弹出 menu：上次配置 / Codex / Claude → 中文 / 英文。任一选项触发生成。
- 生成中：button disabled，icon spinning，蓝色 "AI 正在生成… (Ns)" 进度条，title/body 不可编辑。
- 60s 后进度条变琥珀色 "AI 仍在生成中（diff 较大），请稍候… (Ns)"。
- 生成成功：title + body 立即被 AI 内容覆盖；绿色 "✓ {{engine}} 已生成 PR 标题与正文" pill 出现 3s；title / body 字段有 1.2s 蓝色 outline 呼吸。
- 生成失败：红色错误 pill 出现；按钮 / 字段恢复可编辑；已填写内容**不**被破坏。
- 5min 仍无响应：前端 service 自动 reject，红色 "AI 生成超时，请稍后重试" pill。
- baseBranch / headBranch 缺失时按钮 disabled 且不弹出菜单。
- engine 不可用：抛 `unsupported_engine`，前端红色 "当前引擎不可用，请选择 Codex 或 Claude" pill。
- 后端 diff 大于 20K chars 时自动截断，prompt 末尾附 `... (diff truncated for prompt length)` 标记。
- 成功 pill 明确显示使用的 engine（`Claude` / `Codex` / `Kimi` / `OpenCode` / `Gemini`），让用户可以确认 dispatch 正确。
- 复用 commit message 的 `isEngineExecutionEnabled` 与 `engineSendMessageSync` 路径。
- 14 个 Rust targeted test、6 个 vitest service test、155 个 git-history vitest 全绿。
- `cargo check --lib` 无新增 warning（pre-existing 3 个 dead-code 警告与本变更无关）。
- `npx tsc --noEmit` 0 errors；`npx eslint --quiet` clean。
- `openspec validate add-pr-ai-title-body-generator --strict` 通过。
- 10 locale i18n key 完整；zh / en 文案符合术语习惯。

## Capabilities

### New Capabilities

- `pr-ai-content-generation`：PR 标题 / 描述自动生成，复用 commit message 引擎选择，并使用 PR preview 已解析的 committed range 收集上下文；含写回策略、进度状态机、错误本地化、超时保护。
- `git-pr-submission-workflow`：PR workflow 接受 prefill 内容来源（用户手填或 AI 生成）；生成结果即 form value，无 post-submit 改写。

### Modified Capabilities

- `git-history-panel`：Create PR dialog 红框区域增加 AI 自动生成触发器（菜单 + loading + 错误显示 + 写回高亮 + 进度条 + 60s 慢警告 + 5min 超时）。
- `renderer-context-menu`（shared stylesheet `sidebar.css`）：去掉 `backdrop-filter`，背景 token 从 `surface-popover` 改为 `surface-sidebar-opaque`，所有 `RendererContextMenu` 消费者受益。
