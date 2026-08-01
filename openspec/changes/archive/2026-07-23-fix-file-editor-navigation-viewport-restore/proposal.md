## Why

File Editor semantic Back / Forward 当前主要恢复 file path；history traversal 离开当前文件前不会刷新真实 cursor，且恢复只使用 `scrollIntoView(nearest)`，导致返回时丢失用户跳转前的光标与滚动上下文。navigation history 应恢复完整 Editor location snapshot，而不是退化成 file history。

## 目标与边界

- semantic cross-file history entry 保存 `path + line + column + scrollTop`。
- semantic jump、Back、Forward 离开当前 file 前刷新当前 CodeMirror snapshot。
- 目标文件完成 cursor focus 后恢复 captured scroll offset。
- 保持 history feature-local，不改变 file tree、global search、manual tab 或 ordinary file open 行为。

## 非目标

- 不建设通用 app-wide viewport persistence。
- 不持久化 history，不跨 Editor lifecycle 或 workspace 恢复。
- 不修改 backend、Tauri command、settings 或 Detached File Explorer leading action。

## What Changes

- 扩展 navigation history location，记录 CodeMirror cursor 与 scroll offset。
- history traversal 前以当前 Editor snapshot 覆盖当前 entry。
- 在既有 navigation target 成功 focus 后执行一次 feature-owned scroll restoration。
- 增加 non-zero cursor / scroll regression tests，覆盖 Back、Forward 与 branch traversal。

## 技术方案对比

1. **Feature-local pending viewport restore（采用）**：history hook 保存 snapshot，`useFileNavigation` 在已有 focus success boundary 恢复 scroll；不扩大 app-shell open-file contract，隔离性最强。
2. **扩展全局 `EditorNavigationTarget`**：把 `scrollTop` 传过 app-shell controller；链路清晰，但会让 semantic-history 私有状态进入所有 file-open contract，污染范围过大。
3. **依赖 per-tab Editor session**：代码可能更少，但当前没有可靠的 cursor + viewport session contract，无法证明返回点与 semantic history entry 一致。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `file-view-code-intelligence-navigation`: Back / Forward 从恢复 file/location 加强为恢复离开瞬间的 cursor 与 viewport snapshot。

## Impact

- Frontend：`useFileNavigationHistory.ts`、`useFileNavigation.ts` 与 focused navigation-history tests。
- API/backend/dependencies：无新增依赖，不修改 backend 或 persisted schema。

## 验收标准

- 从非首行、非零滚动位置 semantic jump 后，Back 精确恢复原 cursor 与 scroll offset。
- 在目标 file 移动 cursor/scroll 后 Back，再 Forward，恢复离开目标 file 时的最新 snapshot。
- manual file activation 仍清空 history；非 semantic file-open 不读取或写入 viewport snapshot。
- focused Vitest、typecheck、lint、changed-code review 与 strict OpenSpec validation 通过。
