## Why

输入与提示词体系审计（`docs/reports/composer-prompt-stack-optimization-impact-2026-07-25.md` 第 2、5 项）确认两组行为一致性问题：

**#2 输入历史三套并存、发送时三写**：
- `usePromptHistory`（clientStorage `composer.promptHistory`，按 key 全文本）——其 ↑/↓ 导航输出 `handleHistoryKeyDown` 在 Composer 已被下划线弃用，唯一活功能是发送时写一份**没有任何读者**的存储。
- `useInputHistoryStore`（`~/.ccgui/inputHistory.json` + localStorage 同步，fragment 化）——设置页、搜索雷达、inline completion 的事实源。
- ChatInputBox `useInputHistory`（localStorage `chat-input-history`，与 store 写同一 key 的第三份实现，另带 timestamps）——↑/↓ 导航的真实执行者。
- 每次发送写三遍（Composer 两处 + useSubmitHandler 一处）；另有 Composer 层 `useInlineHistoryCompletion` 的 suffix 从未被渲染（死计算），与 ChatInputBox 层同名 hook 重复。

**#5 自定义命令空结果 15s 冷却 + 全局兜底**：
- `useCustomCommands.ts` 空结果时 15s 冷却原地重试，仍空则拉全局列表兜底——展示别的 workspace 才有的命令。
- `fallback: () => []` 静默吞错，server 故障与「真的没有命令」无法区分。
- 无 fs 感知，新建 `.claude/commands/*.md` 不会自动出现在补全里。

## What Changes

**历史收敛（单一事实源 = `useInputHistoryStore`）**：
- `useInputHistoryStore` 每个 mutation 派发 `inputHistoryChanged` 事件，新增 `subscribeInputHistoryChanged`。
- `Composer.tsx` 移除 `usePromptHistory`（含发送时 `recordHistory` 双写、6 处 `resetHistoryNavigation`、`handleHistoryTextChange`）与从未渲染 suffix 的 Composer 层 `inlineCompletion` 调用；发送只写 `useInputHistoryStore` 一次（ChatInputBox submit 路径的 record 亦改为委派 store，总计单写）。
- 删除 `usePromptHistory.ts`(+test)；删除 ChatInputBox 层 `useInlineHistoryCompletion.ts`，ChatInputBox 改用 composer 层共享实现（本就读 store）。
- ChatInputBox `useInputHistory.ts` 重写为 store 的薄导航壳：读 `loadHistoryItems()`、订阅 `inputHistoryChanged` 实时刷新、`record` 委派 store；删除其 localStorage 直写、timestamps 与无人消费的设置页 API 副本。
- 数据决策：`composer.promptHistory` 存量数据不做迁移——双写时期内容已重叠，更早期条目本就无读者；`migrateLocalStorage.ts` 的旧版导入路径保持原样（一次性迁移代码，零运行时成本）。

**命令列表修复**：
- 删除 15s 冷却重试与全局兜底：空结果就是空列表，不再张冠李戴。
- 失败显式化：`startupOrchestrator` fallback 捕获 reason → `commandsError` 状态 + `pushErrorToast`（id 去重）提示「命令服务暂不可用」；成功时清除。
- Rust 新增 `claude_commands_watch_start/stop`：按 `claude_commands_list` 相同的目录集合（workspace managed、project `.claude`/`.codex`/`.agents` commands、global 三族）建立 notify watcher，去抖后 emit `claude-commands-changed {workspaceId}`；前端订阅即刷新，另加 60s visibility-gated 兜底轮询（遵守「事件驱动 + ≥30s 兜底」红线）。

## 目标与边界

- 目标：发送时历史单写；↑/↓ 导航、inline completion、设置页、搜索雷达读同一事实源，排序/去重口径一致。
- 目标：命令列表只展示当前作用域真实命令；故障可见；新建命令文件秒级出现在补全。
- 边界：不改变历史的 fragment 化记录策略与 200 条容量；不改变命令归并优先级。
- 边界：OpenCode 引擎的命令列表不走 fs watch（其目录模型不同），仅享受去兜底与错误显式化。

## 非目标

- 不迁移 `composer.promptHistory` 存量数据，不删除 `migrateLocalStorage.ts` 旧导入路径。
- 不合并 prompts 与 commands 两套 hook。
- 不改动设置页历史管理 UI。

## 方案取舍

1. **推荐：store 单源 + 事件同步。** 保留 `useInputHistoryStore`（读者最多、有后端持久化），其余两套改为委派/删除。改动集中在 composer 与 ChatInputBox 两处，无协议变化。
2. **备选：保留 usePromptHistory 作为主存储。** 其存储按 historyKey 隔离看似更准，但 ↑/↓ 导航已死、无其他读者，扶正成本高于删除，拒绝。
3. **备选：命令 fs watch 复用 `external_changes.rs`。** 该 watcher 按 detached 窗口 + 单 active file 设计，扩展为目录前缀监听需改其生命周期模型，耦合两个无关域，拒绝；采用 commands 域自带轻量 watcher。
4. **备选：命令错误仅写 debug 面板。** debug 面板默认不可见，不满足「故障可见」，拒绝；采用 toast。

## Capabilities

### New Capabilities

- `claude-commands-fs-watch`：Rust 侧按命令目录集合 watch 并差量 emit `claude-commands-changed`，前端订阅刷新。

### Modified Capabilities

- `composer-input-history`：发送单写、读者统一至 `useInputHistoryStore`；`usePromptHistory` 与 ChatInputBox localStorage 副本移除。
- `composer-command-completion`：空结果不再全局兜底；失败 toast 可见；fs 变更驱动刷新。

## Impact

- Frontend：`src/features/composer/hooks/useInputHistoryStore.ts`、`usePromptHistory.ts`（删）、`usePromptHistory.test.tsx`（删）、`useInlineHistoryCompletion.ts`（composer 层保留）、`Composer.tsx`、`ChatInputBox/hooks/useInputHistory.ts`、`useInlineHistoryCompletion.ts`（删）、`hooks/index.ts`、`ChatInputBox.tsx`、`useSubmitHandler.ts`、`src/features/commands/hooks/useCustomCommands.ts`、`src/services/events.ts`、i18n locale 文件。
- Backend：`src-tauri/src/claude_commands.rs`（watcher）、`src-tauri/src/state.rs`、`src-tauri/src/command_registry.rs`（或 lib.rs 注册处）。
- 依赖：无新增 package（Rust `notify` 已在使用）。

## 验收标准

- `npm run typecheck`、`npm run lint`、composer/commands/notifications 相关 Vitest 全绿。
- `cargo test --manifest-path src-tauri/Cargo.toml` 通过（含新增 watcher 单测）。
- 发送一条 prompt 后：localStorage `chat-input-history` 仅增长一份 fragment 集合；`composer.promptHistory` 不再被写入（guard test）。
- 空 workspace 命令列表为空且不包含全局命令；server 故障时出现 toast；向 `.claude/commands/` 写入新 md 文件后 ~1s 内补全列表刷新。
