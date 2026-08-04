## Why

近期 Composer / Git 辅助能力优化引入了四个回归风险：AI commit message 的 engine/language 选择被藏到右键路径、Prompt Enhancer cache 跨 workspace 复用、managed command 同名并发写可能覆盖、commands watcher 的异步 start/stop 可能遗留失管任务。它们分别影响可发现性、workspace 隔离、数据安全与 runtime 生命周期，需要在同一轮 review closure 中收敛。

## 目标与边界

- 恢复 AI commit message 的显式三步选择：点击生成按钮 → engine → language。
- 保留“使用上次配置”作为可见 quick option，不再让主按钮静默直接执行。
- Prompt Enhancer cache identity 纳入 `workspaceId`，并拒绝旧 workspace request 写回当前 UI。
- managed command 创建使用原子 exclusive create，保证并发同名保存不覆盖。
- commands watcher start/stop 在同一 scope 上串行化，快速 mount/unmount 后不遗留 watcher。

## 非目标

- 不改变 commit message backend prompt、diff scope 或 engine routing。
- 不新增 engine、language、cache persistence 或第三方依赖。
- 不重构 commands discovery 目录优先级、事件 payload 或 60s fallback poll。
- 不改 Prompt Distill 产品流程与 managed command 文件格式。

## What Changes

- `GitDiffPanel` 与 `GitHistoryWorktreePanel` 的主按钮始终打开 engine menu；engine 选择后打开 zh/en language menu。
- `composer-prompt-enhancer` 的模块级 LRU key 增加 workspace scope，并在 workspace 变化时失效旧 request。
- `claude_command_create` 使用 `OpenOptions::create_new(true)` 原子拒绝重名。
- `claude_commands_watch_start/stop` 使用 per-scope lifecycle serialization，消除 registry check 与 insert/remove 之间的竞态。
- 增加 frontend 与 Rust focused regression tests。

## 方案对比与取舍

### 方案 A：局部修复现有 owner boundary（采纳）

保留现有 menu、LRU、Tauri command 与 watcher registry，只修正 interaction contract、cache identity、exclusive create 与 registry lifecycle critical section。优点是 diff 小、无迁移、可直接复用现有测试基础；缺点是 watcher start 期间会短暂持有 registry lock，但路径解析和 watcher 初始化是低频生命周期动作，可接受。

### 方案 B：重建统一 AI generation menu 与 watcher reference-count service（不采纳）

抽象统一 menu component、前端 watcher lease manager、backend generation token。长期扩展性更强，但本轮只有两个稳定 UI caller 和一个 hook owner，会引入超出修复范围的新 abstraction 与跨层 payload，违反 YAGNI。

## Capabilities

### New Capabilities

- `managed-command-runtime-safety`: 定义 managed command 原子创建与 commands watcher 竞态安全生命周期。

### Modified Capabilities

- `git-commit-message-generation`: 主按钮必须公开 engine/language 选择，上次配置只能作为可见 quick option。
- `composer-prompt-enhancer`: cache 与 async result 必须按 workspace 隔离。

## Impact

- Frontend：`GitDiffPanel`、`GitHistoryWorktreePanel`、Prompt Enhancer hook 及其 tests。
- Backend：`claude_commands.rs`、`claude_commands_watch.rs` 及 Rust tests。
- API/event：不改变 command signatures、event names 或 payload。
- Dependencies：无新增依赖。

## 验收标准

- 存在历史配置时，左键点击 AI commit 按钮仍显示 Codex/Claude；选择 engine 后可选择中文/英文。
- “使用上次配置”仍可在同一可见 menu 中一键生成。
- workspace A 的 Prompt Enhancer cache/result 不得进入 workspace B。
- 两个并发同名 managed command create 恰好一个成功，既有内容不被覆盖。
- watcher start 与 stop 并发后，registry 最终状态与最后一个 lifecycle action 一致。
- focused Vitest、`npm run typecheck`、targeted Rust tests 与 OpenSpec strict validation 通过。
