# add-pr-ai-title-body-generator tasks

## 1. 后端 Rust（P1）

- [x] 1.1 [P0] `src-tauri/src/git/pull_request_content.rs`：新增 `build_pull_request_content_prompt(diff, base_branch, head_branch, language)`；language 仅归一为 `zh/en`；`parse_pull_request_response(text)` 采用 strict JSON → string-aware balanced object，并对 invalid/partial/截断后空标题 fail closed；`truncate_pr_title(title)` ≤ 72 字符；13 个 Rust module tests 覆盖 prompt/language/parser/truncation/真实 Git range。
- [x] 1.2 [P0] `src-tauri/src/git/pull_request_content.rs`：`generate_pull_request_content_impl(...)` 使用 `git diff --no-color --find-renames <base>...<head>` 获取 committed PR range；非法 engine fail closed；通过 `engine_send_message_sync` 派发 hidden auto session。
- [x] 1.3 [P0] `src-tauri/src/git/mod.rs` 加 `pub(super) mod pull_request_content;`；`src-tauri/src/git/commands.rs` 加 `pub(crate) async fn generate_pull_request_content(...)` Tauri 命令（desktop/local mode 执行；remote mode 明确 fail closed；`engine` 缺省 fallback 到 `"codex"`）；`src-tauri/src/command_registry.rs` 注册。
- [x] 1.4 [P0] `src-tauri/src/types.rs` 新增 `PullRequestGeneratedContent { title, body, engine, language }` 结构 + Serde，全部 `serde(default)`。

## 2. 前端 service & types（P2）

- [x] 2.1 [P0] `src/services/tauri/pullRequestContent.ts`：
  - `generatePullRequestContent(workspaceId, language, engine, baseBranch, headBranch, onProgress?)`
  - 5min hard timeout（`Promise.race`，避免 `finally` 里 `throw`）
  - 60s soft warning（`onProgress({ kind: "soft-warn" })`）
  - Tauri reject 时抽 `error.message` 统一抛 `Error(string)`
  - 复用 `CommitMessageEngine` / `CommitMessageLanguage` 类型
- [x] 2.2 [P0] `src/services/tauri/pullRequestContent.test.ts`：vitest 覆盖成功路径（invoke 参数透传）、engine 拒绝（`unsupported_engine`）、错误 message 规范化。
- [x] 2.3 [P0] `src/services/tauri.ts` barrel re-export。

## 3. 前端 hook & state（P3）

- [x] 3.1 [P0] `GitHistoryPanelImpl.tsx`（**不**碰 `useGitHistoryPanelInteractions`）：新增 generation/error/success/slow/elapsed/flash 状态；引擎状态 `createPrContentEngine` (default `"codex"`)；language 仅作为 action 参数；菜单状态 `prContentMenu`。
- [x] 3.2 [P0] `triggerPrContentGeneration(engine, language)`：复用 `createPrPreviewBaseRef` / `createPrPreviewHeadRef` 校验与生成；保存 last config；**总是覆盖** title/body；设 success / 写回 flash / 错误本地化。
- [x] 3.3 [P0] `openPrContentGenerationMenu(event)`：复用 `readLastCommitMessageConfig` / `saveLastCommitMessageConfig` + `clampRendererContextMenuPosition` + `RendererContextMenu` 原生 submenu。
- [x] 3.4 [P0] 3 个 useEffect：success 3s 自动消失 / 写回 1.2s flash 倒计时 / elapsedSec 每秒推进；60s slow 视觉切换由 service `onProgress({ kind: "soft-warn" })` 驱动。

## 4. 前端 UI（P4）

- [x] 4.1 [P0] `GitHistoryPanelView.tsx`：红框区域 title 字段旁加「自动生成」按钮；body 字段旁**不**加（**单一触发点**，用户明确要求）。
- [x] 4.2 [P0] 所有 wrapper 从 `<label>` 改为 `<div>`（修复 first-cut `<label>` 嵌套 `<button>` 浏览器把点击转发给关联 input 导致 button onClick 不触发的 bug），并用 localized `aria-label` 保留 title/body 控件的 accessible name。
- [x] 4.3 [P0] 进度条 / 慢警告 / 成功 / 错误 pill 四种状态互斥（View 端条件渲染）。
- [x] 4.4 [P0] title / body 字段加 `data-ai-flash-at={createPrFormFlashAt}` 属性，CSS `[data-ai-flash-at]` 触发 1.2s accent outline 呼吸。
- [x] 4.5 [P0] 挂载 `<RendererContextMenu menu={prContentMenu} onClose={() => setPrContentMenu(null)} />`。
- [x] 4.6 [P0] `src/styles/git-history.part2.css`：
  - `.git-history-create-pr-generate-button` (transparent + `--text-secondary`，避免在 light dialog 上突兀)
  - `.git-history-create-pr-generate-button.is-loading` (accent-tinted bg + 脉冲环 `pr-generate-pulse` keyframe)
  - `.git-history-create-pr-generation-progress` (蓝色) / `.is-slow` (琥珀色)
  - `.git-history-create-pr-generation-success` (绿色，`pr-generate-success-fade` 200ms 淡入)
  - `.git-history-create-pr-generation-error` (红色)
  - `input[data-ai-flash-at]` / `textarea[data-ai-flash-at]` (`pr-form-ai-flash` 1.2s outline 呼吸)
  - `.git-history-create-branch-field` 改 `<div>` 配合 `.is-pr-content-row` flex 布局

## 5. 共享样式根因修（P5）

- [x] 5.1 [P0] `src/styles/sidebar.css`：`.renderer-context-menu` / `.sidebar-workspace-menu`：
  - 背景 token 从 `color-mix(surface-popover 96%, ...)` 改为 `var(--surface-sidebar-opaque)`（**完全不透**）
  - 删 `backdrop-filter: blur(14px)`（修复 first-cut 在 PR dialog 上方 dark-left / white-right gradient bug）
- [x] 5.2 [P0] 不用 local override class（用户明确反对）；所有 `RendererContextMenu` 消费者受益。

## 6. i18n（P6）

- [x] 6.1 [P0] 10 locale `src/i18n/locales/{en,zh,ja,ru,zh-TW,es,fr,hi,ko,pt-BR}/git.ts` 同步新增 14 个实际使用的 key：`historyGeneratePrTitleBody` / `Loading` / `LoadingSlow` / `SuccessWithEngine` / `Error` / `Timeout` / `UnsupportedEngine` / `MissingBaseOrHead` / `MenuTitle` / `MenuLastConfig` / `MenuCodex` / `MenuClaude` / `MenuZh` / `MenuEn`。
- [x] 6.2 [P0] zh 与 en 主语言原生文案；其余 8 locale 以英文 fallback 为主（与 first-cut 决策一致）。
- [x] 6.3 [P1] `historyGeneratePrLoading` / `LoadingSlow` / `SuccessWithEngine` 含 `{{elapsed}}` / `{{engine}}` 占位符。

## 7. 验证与收尾（P7）

- [x] 7.1 [P0] `cargo test --lib pull_request_content` → 14/14 pass；`cd src-tauri && cargo check --lib` 无新增 warning（现有 dead-code warning 与本变更无关）。
- [x] 7.2 [P0] `npx tsc --noEmit` → 0 errors；`npx eslint --quiet` → clean。
- [x] 7.3 [P0] `npx vitest run src/features/git-history` → 155/155 pass。
- [x] 7.4 [P0] `npx vitest run src/services/tauri/pullRequestContent.test.ts` → 6/6 pass；`npx vitest run src/components/ui/RendererContextMenu.test.tsx` → 7/7 pass。
- [x] 7.5 [P0] `openspec validate add-pr-ai-title-body-generator --strict` → valid。
- [x] 7.6 [P0] 手动冒烟：实际 git 仓库（有 diff）打开 PR dialog，点击生成按钮；观察 Codex / Claude 路径均成功回填 title + body（success pill 标注 engine，1.2s outline 呼吸明显）；error path 用错误 engine / 5min+ 超时复现一次。
- [x] 7.7 [P1] runtime contract scripts（`check-engine-capability-matrix.mjs`、`check-app-shell-runtime-contract.mjs`、`check-git-history-runtime-contract.mjs`、`check-refactor-imports.mjs`、`doctor:strict`）全绿。

## 8. 文档同步（P8）

- [x] 8.1 [P0] `openspec/changes/add-pr-ai-title-body-generator/{proposal,design,tasks}.md` 同步更新到反映实际实现 + 4 个被用户报告并修复的 bug（写回失效、`<label>` 点击被吃、菜单颜色不对称、超时过短）。
- [x] 8.2 [P0] `openspec/changes/add-pr-ai-title-body-generator/specs/{pr-ai-content-generation,git-pr-submission-workflow,git-history-panel}/spec.md` 同步更新：明确「总是覆盖」写回策略、5min timeout、60s soft warning、1.2s flash 高亮、单一触发点约定、共享 `RendererContextMenu` opaque 样式。
- [x] 8.3 [P0] git commit + Trellis session record（`python3 ./.trellis/scripts/get_context.py --mode record`），待用户确认。
- [x] 8.4 [P1] `openspec/changes/README.md` 同步加入本 change 行（含进度计数）。
- [x] 8.5 [P1] `openspec archive add-pr-ai-title-body-generator --no-interactive`（待所有 P0 关闭后）。
