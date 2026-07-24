## Review 发现与处理

### 已确认并保留

| 项 | 说明 | 处理 |
|---|---|---|
| `note_web_service_reconnected` / `mutate_runtime_pool` 新增 `app: AppHandle` | Tauri command 注册在 `command_registry.rs`，签名自动匹配；`cargo check` 通过 | 保留 |
| Rust signature 使用 `format!("{:?}...")` | 枚举/Option 未 derive Hash，用 Debug 串稳定化；频率 15s、行数个位数 | 保留，已注释说明 |
| worktree 事件未按 `repositoryRoot` 前缀过滤 | 多余事件最多造成 1s 一次 IPC，不会污染 UI；精确过滤会引入额外路径解析复杂度 | 保留当前按 `workspaceId` 过滤 |
| 唯一 `console.error` | `useGlobalRuntimeNoticeDock.ts` 原有兜底错误日志，未新增 | 保留 |

### 已修复

无 review 过程中未发现需要代码修复的项。

### 仍需人工确认

- 实机 smoke 四条路径（见 `verification.md` 手动验收清单）。
- `openspec validate reduce-client-polling-overhead --strict --no-interactive` 在用户环境执行（本地未安装 openspec CLI 或路径未确认）。
