## 设计概要

### 1. 历史单源化（`useInputHistoryStore` 为唯一事实源）

**事件化**：`useInputHistoryStore` 新增

```ts
const INPUT_HISTORY_CHANGED_EVENT = "ccgui:input-history-changed";
export function subscribeInputHistoryChanged(listener: () => void): () => void;
```

`recordHistory` / `deleteHistoryItem` / `clearAllHistory` / `addHistoryItem` / `updateHistoryItem` / `clearLowImportanceHistory` 每次 mutation 后 dispatch。模块级 `emitInputHistoryChanged()` 私有辅助，try/catch 防御非 window 环境。

**Composer.tsx 收敛**：
- 删除 `usePromptHistory` import、hook 调用、发送路径两处 `recordHistory(trimmed)`（保留 `recordInputHistory(trimmed)`）、`handleHistoryTextChange(next)` 调用、6 处 `resetHistoryNavigation()`。
- 删除 Composer 层 `useInlineHistoryCompletion` 调用（`inlineCompletion.updateQuery/clear`）——其 suffix 从未渲染，ChatInputBox 自带实例才是可见的那份。
- `handleTextChangeWithHistory` 简化为只做 `markComposerInputInteraction` + `handleTextChange`。

**ChatInputBox `useInputHistory.ts` 重写**（公开面收缩）：
- `useInputHistory` hook 保留签名 `{editableRef, getTextContent, handleInput, historyScopeKey}` → `{record, handleKeyDown}`。
- 数据源改为 `loadHistoryItems()`（store 内存缓存）；挂载与 `historyScopeKey` 变化时加载，并订阅 `subscribeInputHistoryChanged` 实时刷新 `historyRef`。
- `record(text)` 委派 `storeRecordHistory(text)`，随后本地 reload（事件同步触发，reload 保证同帧一致）。
- 删除：localStorage 直读直写全套（`loadHistory/saveHistory/loadCounts/saveTimestamps/cleanupCounts/isQuotaExceededError`）、timestamps、设置页 API 副本（`loadHistoryWithImportance/addHistoryItem/updateHistoryItem/clearLowImportanceHistory/deleteHistoryItem/clearAllHistory`——消费者全部用 store 版本，已 grep 核实）。
- `hooks/index.ts` 移除对应 re-export；`useInlineHistoryCompletion.ts`（ChatInputBox 版）删除，`ChatInputBox.tsx` 改从 `features/composer/hooks/useInlineHistoryCompletion` 导入（API 相同，已逐字段比对）。

**useSubmitHandler**：`recordInputHistory` prop 不变，但 ChatInputBox 传入的已是委派 store 的 `record`，发送总写入次数 3 → 1。

**死存储处置**：`composer.promptHistory` 不再被写。`migrateLocalStorage.ts` 保持不动（一次性 legacy 迁移，删除会破坏 `clientStorage.test.ts` 且无运行时收益）。

### 2. 命令列表：去兜底 + 错误显式化 + fs watch

**useCustomCommands.ts**：
- 删除 `EMPTY_CLAUDE_COMMANDS_RETRY_COOLDOWN_MS`、`lastEmptyBurstByWorkspaceRef`、重试与 `getClaudeCommandsList(null)` 全局兜底分支。
- `startupOrchestrator.run` 的 `fallback(reason)` 捕获原因：
  ```ts
  let failedReason: string | null = null;
  ...fallback: (reason) => { failedReason = String(reason); return []; }
  ```
  失败时 `setCommandsError(...)` + `pushErrorToast({ id: "commands-list-unavailable", title, message, variant: "warning" })`（id 固定实现去重）；成功时 `setCommandsError(null)`。
- 返回值增加 `commandsError: string | null`。
- 订阅 `subscribeClaudeCommandsChanged((changedWorkspaceId) => …)`，匹配当前 workspaceId 时 `void refreshCommands()`。
- `setVisibilityGatedInterval(() => void refreshCommands(), 60_000)` 兜底。
- toast 文案走 i18n（`chat.commandsListUnavailableTitle/Message`），en/zh 等 locale 按仓库 parity 规则补齐。

**Rust `claude_commands.rs`**：
- 新增 `CommandsWatchRegistry = Mutex<HashMap<String, CommandsWatchHandle>>` 入 `AppState`；handle 内含 `RecommendedWatcher` 与去抖 `JoinHandle`。
- `claude_commands_watch_start(state, app, workspace_id)`：复用 `claude_commands_list` 的目录解析（workspace managed、project 三族、global 三族），对存在的目录建 `RecursiveMode::Recursive` watcher（`discover_commands_in` 递归读取子目录，watcher 必须同口径）；事件经 500ms 去抖后 `app.emit("claude-commands-changed", { workspaceId })`。同 key 重复 start 幂等（先 stop 旧的）。
- `claude_commands_watch_stop(workspace_id)`：drop watcher。
- 前端 `useCustomCommands` effect：claude 引擎且有 workspaceId 时 start，cleanup stop；global（无 workspaceId）也允许 watch（只含 global 目录）。
- 单测：目录集合解析与去抖合并逻辑（emit 计数）。

**events.ts**：`claudeCommandsChangedHub = createEventHub<{ workspaceId: string | null }>("claude-commands-changed")` + `subscribeClaudeCommandsChanged`。

### 兼容性

- ↑/↓ 导航行为不变（同一份 localStorage 数据经 store 内存缓存提供）；设置页/搜索雷达无感。
- 命令列表在「server 空」时从显示全局命令变为显示空——这是目标行为修正。
- OpenCode 路径不 start watcher。

### 不引入的复杂度

- 不迁移历史数据；不合并 prompts/commands hook；不改命令归并优先级。
