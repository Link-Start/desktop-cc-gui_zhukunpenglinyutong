## 任务清单

### 1. useInputHistoryStore 事件化

- [x] 1.1 [P0][Depends: none][Input: `useInputHistoryStore.ts` 全部 mutation 函数][Output: `inputHistoryChanged` CustomEvent + `subscribeInputHistoryChanged`，6 个 mutation 点派发][Verify: 新增单测验证 record/delete/clear 均派发一次]

### 2. 历史消费方收敛

- [x] 2.1 [P0][Depends: 1.1][Input: `Composer.tsx` usePromptHistory / inlineCompletion 调用点][Output: 移除 usePromptHistory 全套（import、hook、双写、6 处 reset）、移除死 inlineCompletion；发送路径单写收敛至 useSubmitHandler（store），Composer 不再写][Verify: typecheck；grep 无 `usePromptHistory` 引用]
- [x] 2.2 [P0][Depends: 2.1][Input: `usePromptHistory.ts`、`usePromptHistory.test.tsx`][Output: 整文件删除][Verify: `grep -rn "usePromptHistory" src/` 无结果]
- [x] 2.3 [P0][Depends: 1.1][Input: ChatInputBox `useInputHistory.ts` 671 行][Output: 重写为 store 薄壳：nav 读 `loadHistoryItems` + 订阅 `inputHistoryChanged`，`record` 委派 store；删除 LS 直写/timestamps/设置页 API 副本][Verify: 重写后的 `useInputHistory.test.ts` 通过（nav 行为、record 委派、事件刷新）]
- [x] 2.4 [P0][Depends: 2.3][Input: ChatInputBox `useInlineHistoryCompletion.ts`、`hooks/index.ts`、`ChatInputBox.tsx`][Output: 删除 ChatInputBox 版 inline completion，改用 composer 层共享实现；index.ts 移除死 re-export][Verify: ChatInputBox 相关测试通过，ghost completion 照常工作]

### 3. 命令列表去兜底 + 错误显式化

- [x] 3.1 [P0][Depends: none][Input: `useCustomCommands.ts:120-166`][Output: 删除 15s 冷却/重试/全局兜底；fallback 捕获 reason → `commandsError` + `pushErrorToast`（id 去重）；返回 `commandsError`][Verify: 单测：空结果不触发全局调用；失败时 toast 一次]
- [x] 3.2 [P1][Depends: 3.1][Input: i18n locales][Output: `chat.commandsListUnavailable*` 文案按 parity 规则补齐][Verify: locale parity 测试通过]

### 4. Rust 命令目录 fs watch

- [x] 4.1 [P0][Depends: none][Input: `claude_commands.rs`、`state.rs`][Output: `claude_commands_watch_start/stop` commands + AppState registry + 500ms 去抖 emit `claude-commands-changed`][Verify: `cargo test` 通过；新增去抖/目录集合单测]
- [x] 4.2 [P0][Depends: 4.1][Input: `events.ts`、`useCustomCommands.ts`][Output: `subscribeClaudeCommandsChanged` hub + hook 订阅刷新 + 60s visibility-gated 兜底][Verify: typecheck；hook 测试覆盖事件刷新]

### 5. 跨层验证与交付

- [x] 5.1 [P0][Depends: 2.4, 3.2, 4.2][Input: 全部改动文件][Output: typecheck / lint / 相关 Vitest / cargo test 全绿][Verify: 各 gate 命令通过]
- [x] 5.2 [P1][Depends: 5.1][Input: OpenSpec artifacts][Output: proposal / design / tasks / specs 补全][Verify: `openspec validate unify-input-history-and-commands-refresh --strict --no-interactive`]

### 6. Review-Discovered Closure

- [x] 6.1 [P1][Depends: review][Input: review 发现项][Output: 修复或记录 waiver][Verify: 二次 review 通过]
