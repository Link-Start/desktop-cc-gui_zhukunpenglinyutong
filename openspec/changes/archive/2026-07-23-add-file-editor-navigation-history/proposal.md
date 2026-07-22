## Why

File Editor 已能通过 Go to Definition、Go to Implementation 与 References 跨文件定位，但跳转后无法回到调用点，也无法沿原链路前进。当前 header 左侧的“返回聊天”按钮还会关闭全部 file tabs，与该位置更需要的代码导航语义冲突。

## 目标与边界

- 在主 File Editor header 左侧用 Back / Forward 成对导航按钮替换“返回聊天”按钮。
- 只记录 File Editor 内由 semantic navigation 产生的跨文件 `path + line + column` 跳转。
- 支持 macOS `Cmd+Option+Left/Right` 与 Windows/Linux `Ctrl+Alt+Left/Right`。
- 历史只属于当前 workspace 的当前 Editor 生命周期；关闭 Editor、切换 workspace 或手动切换文件时结束当前链路。

## What Changes

- 为 semantic cross-file navigation 增加有序 history cursor，保存 source 与 target location。
- Back / Forward 恢复文件、行、列，并支持回退后产生新跳转时截断旧 forward branch。
- 无可用历史方向时按钮 disabled，快捷键 no-op。
- 主 Editor 不再在 header 左侧提供“返回聊天”按钮；现有 tab close / close-all 退出路径保持不变。
- Detached File Explorer 的 sidebar collapse / expand leading action 保持原行为。

## 非目标

- 不记录文件树打开、global search 打开、手动 tab 切换、普通 cursor movement 或同文件定位。
- 不持久化 navigation history，不跨 workspace / window / Editor lifecycle 恢复。
- 不新增 backend command、第三方依赖或用户可配置 shortcut setting。

## 方案对比与取舍

1. **在 `useFileNavigation` 内维护 semantic history（采用）**：入口天然只覆盖 definition / implementation / references，能在跳转前读取 source cursor，并直接复用既有 open-at-location contract；影响面最小。
2. **在 app-shell file-open controller 维护全局 history（不采用）**：可覆盖更多入口，但会把 file tree、tab、search 等非目标行为混入，违背隔离边界。
3. **复用 browser/window history（不采用）**：其生命周期与 Tauri File Editor 无关，无法表达 `path + line + column`，也不能可靠处理 forward branch。

## Capabilities

### New Capabilities

<!-- 无。 -->

### Modified Capabilities

- `file-view-code-intelligence-navigation`: 增加 scoped cross-file semantic navigation history、header controls 与 platform shortcuts contract。

## Impact

- Frontend：`src/features/files/hooks/useFileNavigation.ts`、`src/features/files/components/FileViewPanel.tsx`、对应 CSS/i18n/tests。
- Contract：复用现有 `onNavigateToLocation(path, { line, column })`，不修改 backend API。
- Dependencies：无新增依赖。

## 验收标准

- `A -> B -> C` semantic 跨文件跳转后，可 Back 到 `B`、再 Back 到 `A`，并可 Forward 回到 `C`。
- Back 到 `B` 后跳转 `D`，Forward 不再返回旧 `C`。
- 手动切换 tab 或打开其他文件不会进入或延续 semantic history。
- macOS 与 Windows/Linux shortcut mapping 正确，disabled direction 不触发导航。
- Detached File Explorer leading action、file save、tab close 与现有 semantic query 行为无回归。
