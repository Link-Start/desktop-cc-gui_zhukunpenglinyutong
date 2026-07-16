## Why

当前文件视图只能看到行号和工作区 diff marker，无法直接回答“这一行由谁、何时、在哪次提交修改”。新增按需 Git Blame 可以显著降低代码追溯成本，但必须保持现有 file read、first useful viewport 与 CodeMirror typing local-first 性能契约不回退。

## 目标与边界

- 在 workspace text editor 的行号 gutter 旁按行显示简短 `date + author` 注解，并在当前行提供完整 commit metadata。
- 功能默认关闭，只能由当前文件的显式用户操作启用；关闭状态不得新增 Git IPC、文件读取或 gutter DOM。
- Blame 作为 file view side channel，在 document snapshot 与 CodeMirror 首屏可用后独立加载，迟到结果必须通过 file identity/render token 丢弃。
- Desktop Tauri 与 daemon/Web Service Git bridge 保持 contract parity，并支持 multi-repository `repositoryRoot` scope。

## 非目标

- 不替换 CodeMirror，不改变 `read_workspace_file`、document snapshot 或保存 command 的签名。
- 不在每次 typing、cursor、hover、scroll 或 selection 时重新请求 blame。
- 不在 MVP 中实现跨文件 copy/move 深度追踪、全局默认开启或 persistent blame preference。
- 不为未提交 editor draft 伪造历史归属；dirty 后使用明确 stale 语义，保存成功后再刷新。

## What Changes

- 新增压缩 hunk 形式的 `get_git_file_blame` command 与 typed frontend mapping。
- 新增 feature-local blame orchestration，负责 opt-in、loading/error/stale、request cancellation 与 session cache。
- 在 CodeMirror lazy runtime 内新增可动态启停的 viewport-bounded blame gutter；每行显示短注解，当前行展示 SHA、完整时间与 commit summary。
- 在 file editor 顶部与 gutter context menu 提供同一开关；代码正文原生 context menu 保持不变。
- 增加 disabled-path、first-viewport、stale-response、typing/scroll zero-IPC、multi-repository 与 daemon parity 回归门禁。

## 方案比较与取舍

1. **推荐：独立 command + 压缩 hunks + CodeMirror viewport gutter**。关闭时零 IPC；开启后 payload 与 DOM 都有界，并可复用现有 git2、render token 和 lazy editor boundary。
2. **合并进 `read_workspace_file`**。实现表面简单，但会让每次文件打开承担 Git history IO，直接违反首屏性能目标，因此拒绝。
3. **Frontend 执行 `git blame` 或按 viewport 分页请求**。会扩大安全边界，并让 scroll 诱发 IPC；重复请求成本和 stale 处理更差，因此拒绝。

## Capabilities

### New Capabilities

- `file-view-git-blame`: 定义文件视图 Git Blame 的显式启用、按行展示、stale/error/unsupported 与跨 runtime contract。

### Modified Capabilities

- `file-open-rendering-scheduler`: 明确 blame 必须晚于 first useful viewport，且异步结果受现有 file/snapshot/render epoch guard 保护。
- `file-editor-typing-latency`: 明确 typing、cursor、hover 与 scroll 不得触发 blame IPC 或 React 全文件 publication。
- `file-view-rendering-runtime-stability`: 将 blame 纳入有界 side channel，关闭状态不得增加 file-open 工作。

## 验收标准

- 默认打开任意 workspace text file 时 `get_git_file_blame` 调用数为 0。
- 用户启用后，文件内容与 CodeMirror 首屏不等待 blame；结果到达后仅 gutter 更新且 editor 不 remount。
- 可见行显示短 `date + author`；当前行可查看 short SHA、完整时间与 summary。
- typing、cursor、hover、scroll 不新增 blame IPC；dirty 后显示 stale，save 成功后最多刷新一次。
- file A 的迟到结果不能进入 file B；external/spec/binary/non-Git/untracked 场景有明确降级。
- Desktop 与 daemon/Web Service mapping、multi-repository scope、focused frontend/Rust tests、typecheck 与 runtime contract checks 通过。

## Impact

- Frontend：`src/features/files/**`、`src/services/tauri/git.ts`、`src/types/git.ts`、file view styles/i18n/tests。
- Backend：`src-tauri/src/git/**`、`src-tauri/src/types.rs`、`src-tauri/src/command_registry.rs`、daemon dispatch/tests。
- Dependencies：不新增依赖，复用现有 `git2 = 0.20.3` 与 CodeMirror 6。
- Performance：关闭状态零新增 IPC/DOM；开启状态只执行一次异步 blame，并用压缩 hunk payload 与 viewport projection 控制成本。
