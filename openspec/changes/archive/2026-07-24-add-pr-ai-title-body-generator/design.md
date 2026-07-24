# add-pr-ai-title-body-generator design

## 1. 背景与约束

- 现有 PR 对话框 `GitHistoryPanelView.tsx` 已经具备完整的 preview / defaults 加载机制，`createPrDefaults` 拿到 `baseBranch / headBranch / upstreamRepo / headOwner`，整个流程不需要再额外做 GitHub API 调用。
- PR 内容必须基于 committed branch range，而不是 commit-message 使用的 staged/worktree diff；后端执行 `git diff --no-color --find-renames <base>...<head>`，与 PR preview 的 base/head 语义对齐。
- 引擎执行路径在 `engine_send_message_sync`（src-tauri/src/engine/commands.rs）中已经统一覆盖 Claude / Codex / OpenCode / Kimi，且每个 engine 都返回 `EngineSendMessageResponse { text }`。本变更复用该路径。
- 前端已经在 commit message 场景实现 engine menu + language menu + 上次配置记忆（`readLastCommitMessageConfig` / `saveLastCommitMessageConfig`，存于 `localStorage`）；本变更复用完全相同的 menu 模式，避免另起炉灶。
- 仓库习惯：把新逻辑加在 `GitHistoryPanelImpl.tsx`（@ts-nocheck 巨型 scope-passing 视图文件对应的 impl），**不**修改 `useGitHistoryPanelInteractions`（那个 hook 已经把 ~150 个 state 通过 scope 串行传递，每加一个 state 都要重写 signature；新功能用 `ponytail:` 注释挂在 impl 上是仓库既定模式）。
- 仓库 shared stylesheet 风格：component-local 样式加在 `src/styles/git-history.part2.css`；跨组件共享样式（影响所有 `RendererContextMenu` 消费者）改在 `src/styles/sidebar.css` 根因修，而不是每个使用方加 override class。

## 2. 总体架构

```
┌──────────────────────────────────────────────────────────────────┐
│              GitHistoryPanelView.tsx (PR Dialog)                 │
│  ┌────────────────────────────┐  ┌────────────────────────────┐  │
│  │ PR Title <input>           │  │ PR Body <textarea>         │  │
│  │   [🤖 button] → menu ──────┼──┼─→ onOpenPrContentMenu(e)    │  │
│  └────────────────────────────┘  └────────────────────────────┘  │
│  ┌────────────────────────────┐  ┌────────────────────────────┐  │
│  │ progress / slow / success  │  │ error pill                 │  │
│  │ / error pills (1.2s flash) │  │                            │  │
│  └────────────────────────────┘  └────────────────────────────┘  │
│  <RendererContextMenu menu={prContentMenu} ... />                │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ (engine, language, previewBaseRef, previewHeadRef)
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│         GitHistoryPanelImpl.tsx (新增 triggerPrContentGeneration) │
│  - 复用 preview refs（upstream/<base> + head）并校验必填          │
│  - 校验 engine isEngineExecutionEnabled                            │
│  - setCreatePrContentEngine；language 仅作为 action 参数          │
│  - setCreatePrContentGenerating(true) + setCreatePrFormFlashAt(null)│
│  - setCreatePrContentStartedAt(Date.now())                        │
│  - 调 generatePullRequestContent(workspaceId, lang, eng, ...)     │
│    · onProgress({ kind: "soft-warn" }) → setCreatePrContentSlow   │
│  - setCreatePrContentGenerating(false) 立刻 (不等 setCreatePrForm)│
│  - setCreatePrForm(previous => 覆盖 title + body)  ← 总是覆盖     │
│  - setCreatePrFormFlashAt(Date.now()) ← 触发 1.2s 呼吸框         │
│  - setCreatePrContentSuccessAt(Date.now()) ← 3s 绿色 pill        │
│  - 错误 catch: /timed out/i → "AI 生成超时" / 历史 key            │
│  - finally: 清理所有状态                                          │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  src/services/tauri/pullRequestContent.ts                        │
│  - Promise.race([                                                  │
│      invoke("generate_pull_request_content", { ... }),           │
│      timeoutPromise(5 * 60 * 1000, reject)                        │
│    ])                                                              │
│  - setTimeout 60_000 → onProgress({ kind: "soft-warn" })         │
│  - reject 错误统一抽 message                                     │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  src-tauri: generate_pull_request_content                        │
│  - remote mode: fail closed（daemon 不支持 sync Codex generation）│
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. git diff --no-color --find-renames base...head → diff   │ │
│  │ 2. truncate_diff_for_prompt(diff) → diff ≤ 20_000 chars    │ │
│  │ 3. build_pull_request_content_prompt(                      │ │
│  │     diff, base_branch, head_branch, language)              │ │
│  │ 4. engine_send_message_sync(                               │ │
│  │     workspaceId, prompt, Some(EngineType),                 │ │
│  │     autoSession = { sessionPurpose: "pull-request-content",│ │
│  │                    visibility: "hidden",                  │ │
│  │                    ownerFeature: "git",                   │ │
│  │                    autoArchive: true,                     │ │
│  │                    createdBy: "system" })                  │ │
│  │ 5. parse_pull_request_response(text) → { title, body }     │ │
│  │ 6. truncate_pr_title(title) ≤ 72 chars                    │ │
│  │ 7. return { title, body, engine, language }                │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 关键决策

### 3.1 写回策略：AI 总是覆盖 + 1.2s outline 呼吸高亮

**first-cut 决策**（被用户报告为 bug 后调整）：用 `titleEmpty && bodyEmpty` gate，只在「两个字段都空」或「单个字段空」时填入。问题是 PR dialog 预填了默认值（merge commit 标题 + 空模板 body），`titleEmpty` / `bodyEmpty` 永远是 false，AI 内容**永远不写入**。

**最终决策**：AI 总是覆盖 `result.title` / `result.body`。理由：
- 用户主动点 AI 按钮 = 明确要替换当前 placeholder
- 已手动编辑的字段也会被覆盖——这个 trade-off 是 first-cut 显式接受的；后续 PR 可以加 dirty tracking 实现更精细的「只覆盖未编辑字段」
- 通过 1.2s outline 呼吸高亮让用户清楚看到变化，不会误以为没生成

```js
// 旧（first-cut，有 bug）:
setCreatePrForm((previous) => {
  const titleEmpty = !previous.title.trim();
  const bodyEmpty = !previous.body.trim();
  if (result.title && titleEmpty && result.body && bodyEmpty) return 全填;
  const next = { ...previous };
  if (result.title && titleEmpty) next.title = result.title;
  if (result.body && bodyEmpty) next.body = result.body;
  return next;
});

// 新（final）:
setCreatePrForm((previous) => {
  const next = { ...previous };
  if (result.title) next.title = result.title;
  if (result.body) next.body = result.body;
  return next;
});
```

### 3.2 Diff 容量上限：60K → 20K chars

**first-cut 决策**：`MAX_PROMPT_DIFF_CHARS = 60_000`（与 commit message 共享上限）。大 PR（vendor 升级、批量迁移）一次喂 60K chars ≈ 15K tokens 给 LLM，推理 + JSON 解析经常超过 60s 而超时。

**最终决策**：`MAX_PROMPT_DIFF_CHARS = 20_000`（≈ 5K tokens）。理由：
- 5K tokens 在主流模型（Codex / Claude Sonnet）的 comfort zone 内，30-90s 内稳定输出
- 20K 仍能完整覆盖绝大多数 PR 的核心 diff（除巨型 vendor 升级 / 初始 commit）
- 超长 diff 走 `truncate_diff_for_prompt` 加 `... (diff truncated for prompt length)` 标记，模型知道尾部被截断
- commit message 路径**不**改上限（commit message 容忍 60K，因为 commit subject 短、JSON 解析简单）

### 3.3 超时：60s → 5min + 60s soft warning

**first-cut 决策**：60s hard timeout。**结论：太短，被用户报告为 first-cut 的核心 bug**。

**最终决策**：
- 5min hard timeout：`Promise.race([invoke(...), timeoutPromise(5 * 60 * 1000, reject)])`
- 60s soft warning：`setTimeout(60_000, () => onProgress({ kind: "soft-warn" }))`，UI 切换进度条颜色到琥珀色并增加「diff 较大」文案
- 通过 `Promise.race` 实现避免 `finally` 里 `throw`（ESLint `no-unsafe-finally` 拒绝）

### 3.4 单一触发点（用户明确要求）

**first-cut**：title / body 各加一个按钮，共两个。**用户反馈**：只要一个，点一次同时填两个。

**最终决策**：title 字段旁加一个按钮，body 字段旁**不**加。理由：用户主动点击 = 期望同时填两个。

```tsx
<label className="git-history-create-branch-field">
  <span>PR 标题</span>
  <button className="git-history-create-pr-generate-button" onClick={openPrContentGenerationMenu}>
    <CommitMessageEngineIcon engine={createPrContentEngine} />
  </button>
</label>
<label className="git-history-create-branch-field">  {/* 不加第二个按钮 */}
  <span>PR 描述</span>
  <textarea ... />
</label>
```

### 3.5 `<label>` 嵌套 `<button>` 点击被吃

**first-cut bug**：`<label className="git-history-create-branch-field">` 内嵌 `<button>`，浏览器 native 行为：点击 `<button>` 也会触发 `<label>` 关联的 form control click，导致 button onClick 不执行。

**最终决策**：所有 wrapper 从 `<label>` 改为 `<div>`：
- `git-history-create-branch-field` outer: `<label>` → `<div>`
- `is-pr-content-row` inner: `<label>` → `<div>`
- body label inner: `<label>` → `<span>`

### 3.6 进度状态机

```
idle (no recent generation)
  ↓ user clicks button
generating (blue pill, Ns counter, button spinning, inputs disabled)
  ↓ 60s mark
generating-slow (amber pill, Ns counter, "diff 较大" hint)
  ↓ success
success (green pill "✓ {{engine}} 已生成", 3s, then auto-dismiss)
  ↓ inputs get 1.2s outline flash on title + body
idle
  ↓ error
error (red pill, persistent, button + inputs re-enabled)
idle
  ↓ 5min elapsed
error (red "AI 生成超时")
idle
```

UI 互斥逻辑（View 端）：
```tsx
{createPrContentGenerating ? <ProgressPill /> : null}
{createPrContentError ? <ErrorPill /> : null}
{!error && !generating && createPrContentSuccessAt !== null ? <SuccessPill /> : null}
```

### 3.7 共享样式根因修（不新加 override class）

**first-cut 决策**：给 `RendererContextMenu` 传一个 `className="git-history-pr-content-menu"` 做 local override。**用户反馈**：不要造新样式。

**最终决策**：改 `src/styles/sidebar.css` 里的 `.renderer-context-menu` / `.sidebar-workspace-menu`：
- `--sidebar-floating-menu-bg: var(--surface-popover) 96% mix` → `--sidebar-floating-menu-bg: var(--surface-sidebar-opaque)`（**完全不透**）
- 删 `backdrop-filter: blur(14px)`（之前是它在采样背景的 dialog shadow 导致 dark-left / white-right gradient）
- 所有 `RendererContextMenu` 消费者受益：sidebar workspace menu / terminal / git diff / PR content

### 3.8 Ponytail 注释：impl 状态机直接挂 Impl

仓库里 `useGitHistoryPanelInteractions` 已经传 ~150 个 state 通过 scope，新增 state 要重写 signature 链。本变更在 `GitHistoryPanelImpl.tsx` 直接 `useState` + 写 `triggerPrContentGeneration` / `openPrContentGenerationMenu`，并用 `RendererContextMenu` 原生 submenu 呈现 language 选项，不碰 giant scope 链。

## 4. 关键模块细节

### 4.1 后端 prompt 结构

`build_pull_request_content_prompt` 中英两套模板（zh / en），结构对齐 `build_commit_message_prompt`：

```
{intro}                                                       ← 角色 + 语言
Base branch: {base}                                            ← 分支名
Head branch: {head}
Diff (between base and head, may be truncated):                ← ≤ 20K chars
```
{diff}
```
{schema_label}: output ONLY a single JSON object, no prose:   ← 强 schema
{
  "title": string (<= 72 chars, Conventional Commits style),
  "body": string (Markdown, follow this template):
{body_template}                                                ← zh: ## 背景/## 改动点/## 验证
                                                                  en: ## Background/## Changes/## Verification
}
```

### 4.2 前端 service 错误处理

```ts
export async function generatePullRequestContent(
  workspaceId, language = "zh", engine = "codex",
  baseBranch, headBranch,
  onProgress?: (event: PullRequestProgressEvent) => void,
): Promise<PullRequestGeneratedContent> {
  if (!isEngineExecutionEnabled(engine)) throw new Error("unsupported_engine");

  const startedAt = Date.now();
  const softWarnTimer = setTimeout(() => onProgress?.({ kind: "soft-warn", elapsedMs: ... }), 60_000);
  let timeoutHandle: number | undefined;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      onProgress?.({ kind: "hard-timeout", elapsedMs: ... });
      reject(new Error("generate_pull_request_content timed out after 300s"));
    }, 300_000);
  });
  try {
    return await Promise.race([invoke(...), timeoutPromise]);
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw new Error(String((error as { message: unknown }).message));
    }
    throw error instanceof Error ? error : new Error(String(error));
  } finally {
    clearTimeout(softWarnTimer);
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}
```

### 4.3 UI 改造

`GitHistoryPanelView.tsx` 红框区域当前结构：

```tsx
<label className="git-history-create-branch-field">  {/* 改成 div 避免点击被吃 */}
  <span>PR 标题</span>
  <button className="git-history-create-pr-generate-button" onClick={openPrContentGenerationMenu}>
    <CommitMessageEngineIcon engine={createPrContentEngine} className={...spinning} />
  </button>
  <input value={createPrForm.title} data-ai-flash-at={createPrFormFlashAt} ... />
</label>
{createPrContentGenerating ? <ProgressPill /> : null}
{createPrContentError ? <ErrorPill /> : null}
{!error && !generating && createPrContentSuccessAt !== null ? <SuccessPill /> : null}
<label className="git-history-create-branch-field">
  <span>PR 描述</span>
  <textarea value={createPrForm.body} data-ai-flash-at={createPrFormFlashAt} ... />
</label>
```

### 4.4 i18n

10 locale 同步新增 / 更新 14 个实际使用的 key：

```jsonc
"historyGeneratePrTitleBody": "AI 自动生成 PR 标题与描述",
"historyGeneratePrLoading": "AI 正在生成… ({{elapsed}}s)",
"historyGeneratePrLoadingSlow": "AI 仍在生成中（diff 较大），请稍候… ({{elapsed}}s)",
"historyGeneratePrSuccessWithEngine": "✓ {{engine}} 已生成 PR 标题与正文",
"historyGeneratePrError": "PR 内容生成失败：{{error}}",
"historyGeneratePrTimeout": "AI 生成超时，请稍后重试",
"historyGeneratePrUnsupportedEngine": "当前引擎不可用，请选择 Codex 或 Claude",
"historyGeneratePrMissingBaseOrHead": "无法生成 PR 内容：base 或 head 分支为空",
"historyGeneratePrMenuTitle": "选择 PR 内容生成配置",
"historyGeneratePrMenuLastConfig": "使用上次的配置",
"historyGeneratePrMenuCodex": "使用 Codex 引擎",
"historyGeneratePrMenuClaude": "使用 Claude 引擎",
"historyGeneratePrMenuZh": "生成中文内容",
"historyGeneratePrMenuEn": "生成英文内容"
```

## 5. 测试矩阵

| 维度 | 验证 | 实现 |
|---|---|---|
| 后端 prompt | 中文 / 英文模板都含 base/head/diff，title 约束 72 字 | Rust unit test on `build_pull_request_content_prompt` |
| 后端 JSON 解析 | string/escape-aware tolerant 解析 + fail closed | Rust unit test on `parse_pull_request_response` |
| 后端 title 截断 | 长度 > 72 时裁剪并去尾空格 | Rust unit test on `truncate_pr_title` |
| 后端 diff 截断 | 长度 > 20K 时截断并附标记 | Rust unit test on `truncate_diff_for_prompt` |
| 前端 service | 成功路径 invoke 参数与返回类型 | vitest mock invoke |
| 前端 service | engine 拒绝抛 `unsupported_engine` | vitest |
| 前端 service | 错误 message 规范化（Tauri reject 抽出 message） | vitest |
| 前端 menu | last config / Codex / Claude 三项可达 | 复用 commit message 共享测试 pattern |
| 集成 | typecheck / lint / 全套 vitest / cargo test --lib pull_request_content / OpenSpec strict validation | local CI |

## 6. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| AI 返回非 JSON 或 partial JSON | 中 | 不可信内容覆盖 PR 表单 | parser fail closed 并展示 generation error，不写回 partial data |
| AI 标题超长 | 中 | GitHub 截断 | 后端硬截 72 字符 + 去尾 |
| diff 过大（>20K） | 中 | 模型 context 溢出 / 慢 | `truncate_diff_for_prompt` 20K cap + 截断标记；用户可手动精简 PR scope |
| 60s 内未返回 | 中 | 用户以为卡死 | soft warning → 琥珀色 pill + 倒计时 |
| 5min 内仍未返回 | 低 | 用户放弃 | hard timeout → 红色 "AI 生成超时" pill |
| engine menu 重复代码导致后续修改不一致 | 中 | UX 漂移 | `ponytail:` 注释明确指出可提取位置（commit message menu） |
| 多语言生成错位 | 低 | 用户拿到的不是预期语言 | prompt 中明确写出"请用中文回答" / "respond in English" |
| 写回覆盖用户已编辑内容 | 中 | 用户体验倒退 | 1.2s outline 呼吸让用户看清楚；后续 PR 可加 dirty tracking |
| PR dialog 预填默认值导致 first-cut 写回失效 | 已发生 | 用户报告的核心 bug | 已修：AI 总是覆盖 + 1.2s flash |
| `<label>` 嵌套 `<button>` 点击被吃 | 已发生 | 按钮无响应 | 已修：所有 wrapper 改 `<div>` |
| 共享 menu 用 `backdrop-filter` 透出 dialog shadow | 已发生 | 菜单左右颜色对不上 | 已修：sidebar.css 根因，去 backdrop-filter 改 opaque surface |

## 7. 非范围

- 不引入新的 engine 类型；只复用现有 5 个 engine。
- 不改 push / create / comment stage 流程。
- 不实现 PR 流式响应（架构备选，方案 E）。first-cut 用 sync 路径 + 60s soft + 5min hard timeout 平衡体验与实现成本。
- 不实现 dirty tracking 区分「用户已编辑」与「默认占位」；first-cut 总是覆盖。
- 不修改 OpenSpec main specs（除 capability spec 中 git-history-panel / git-pr-submission-workflow / pr-ai-content-generation 三条外，不新增 main spec）。
- 不在 View (`@ts-nocheck`) 之外重构 `useGitHistoryPanelInteractions`；impl 状态机用 `ponytail:` 注释挂在 `GitHistoryPanelImpl.tsx`。
