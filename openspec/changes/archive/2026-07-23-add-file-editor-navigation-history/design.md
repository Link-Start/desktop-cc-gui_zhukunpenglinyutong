## Context

`useFileNavigation` 是 File Editor definition、implementation 与 references 的统一 target resolution 入口；跨文件 target 通过 `onNavigateToLocation(path, { line, column })` 交给 app-shell file-tab controller，随后 `navigationTarget.requestId` 驱动新文件 CodeMirror 定位。当前链路只保留最新 target，没有可逆 history。

同一个 `FileViewPanel` instance 会在 active file 变化时继续存活，因此 feature-local hook 可以跨 semantic file transition 保留 history；关闭 Editor 或切换 workspace 会自然 unmount/reset。Detached File Explorer 通过 `onSingleRowLeadingAction` 复用 header leading slot，该行为不能被主 Editor controls 覆盖。

## Goals / Non-Goals

**Goals:**

- 在 semantic navigation 发起前捕获当前 CodeMirror selection 对应的 source `path + line + column`。
- 维护可逆的 ordered entries + cursor，并复用现有 open-at-location contract 执行 Back / Forward。
- 识别 hook 自己发起的 file transition；任何其他 active file 变化清空 history。
- 在 main File Editor header 提供可访问、可禁用的成对 controls 与固定 platform shortcuts。

**Non-Goals:**

- 不建设 app-wide file navigation service。
- 不记录同文件定位、manual tab/file-tree/search navigation 或 cursor movement。
- 不持久化 history，不修改 app settings、Tauri API 或 backend provider。

## Decisions

### Decision: History belongs to `useFileNavigation`

采用 feature-local history，而不是 app-shell global history。semantic target、source editor selection 与 existing navigation callback 在此边界同时可见；记录条件可以严格限定为 target file 与 current file 不同。

Alternative：在 `useGitPanelController.handleOpenFile` 统一记录。该层无法可靠区分 semantic、file tree、search 与 tab activation，会扩大 contract 并污染 history，因此不采用。

### Decision: Ordered entries plus cursor

状态使用 `{ entries: NavigationLocation[], index }`。首次跨文件 jump 建立 `[source, target]`；后续 jump 先以当次真实 cursor location 更新当前 source，再截断 `index` 之后 entries 并 append target。Back / Forward 只移动 cursor，不重新写入 history。

Alternative：独立 backStack / forwardStack。它也可工作，但 branch truncation、按钮可用性与测试断言需要同步维护两套容器，状态不如单 cursor 模型直接。

### Decision: Classify owned transitions with an expected target ref

semantic jump 与 history traversal 在调用 `onNavigateToLocation` 前写入 expected target path。监听 `filePath`：若新 path 与 expected target 等价，则消费标记并保留 history；否则视为 manual/external activation 并清空 history。这样无需修改通用 file-open API，也不会把 global search 等 `path + location` 请求纳入。

同文件 target 继续执行现有 focus behavior，但不写 expected target 或 history。

### Decision: Reuse platform shortcut utilities

固定 shortcut source 使用 `cmd+alt+arrowleft` / `cmd+alt+arrowright`，通过 `matchesShortcutForPlatform` 映射：macOS 要求 Meta+Alt，Windows/Linux 要求 Ctrl+Alt。listener 仅随 FileViewPanel mount，只有对应方向可用时才 prevent default 并导航。

### Decision: Preserve explicit detached leading actions

`renderHeader` 若收到 `onSingleRowLeadingAction`，继续渲染原 leading action；否则渲染 main Editor Back / Forward group。旧 `handleClose` 不再绑定 main header，但 tab close、close-all 与 dirty-state protection 保持现有实现。

## Risks / Trade-offs

- [Risk] semantic jump 后 `filePath` update 异步到达，可能被误判为 manual activation → expected target 使用 normalized workspace path equality，并只消费精确下一次 transition。
- [Risk] Back 后立即再次 Back 可能读取 stale React state → 使用同步 history ref 作为 traversal authority，revision state 仅驱动 render。
- [Risk] source cursor 在用户落到 target 后发生移动 → 下一次 semantic jump 用当下 selection 更新当前 entry，使 Back 返回真正的调用位置。
- [Risk] 移除 header exit action 降低退出可见性 → tab close、context-menu close all 与最后 tab close 返回 companion surface 保持可用；本变更不删除这些路径。
- [Trade-off] manual file activation 会清空整条 semantic chain，而不是暂停并恢复；这是防止非目标行为进入链路的明确隔离策略。

## Migration Plan

1. 先增加 hook history contract 与 focused tests。
2. 再替换 main header leading control 并接入 shortcuts/i18n/CSS。
3. 运行 focused Vitest、typecheck、lint 与 strict OpenSpec validation。
4. 回滚时恢复旧 main header `handleClose` button，并删除 hook history state；无 persisted data migration。

## Open Questions

无。范围、shortcut 与 manual navigation isolation 已由产品方确认。
