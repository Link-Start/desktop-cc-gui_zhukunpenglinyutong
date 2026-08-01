## Context

`useFileNavigationHistory` 当前记录 `path + line + column`。首次 semantic jump 会捕获 source cursor，但 Back / Forward 离开当前 file 时只移动 history index，不把用户在当前 file 内的新 cursor 写回 entry；viewport 从未进入 history。恢复依赖 `useFileNavigation` 的 `navigationTarget` effect，该 effect 在 file load 后调用 CodeMirror `focusLocation` 并执行 `scrollIntoView(nearest)`。

共享工作区同时存在 `add-file-context-menu-shortcuts`，会修改 `FileViewPanel` 与 CodeMirror keymap。本修复必须避免覆盖其 shortcut definitions、listener 与 editor props。

## Goals / Non-Goals

**Goals:**

- 每个 semantic history entry 表示离开该 file 瞬间的 cursor 与 vertical viewport。
- traversal 先同步刷新 current entry，再导航到 destination。
- 复用既有 file-load/focus retry boundary，在 cursor focus 成功后恢复 exact `scrollTop`。
- 所有 viewport state 保持 feature-local。

**Non-Goals:**

- 不提供 horizontal scroll、selection range 或 fold state persistence。
- 不扩展 app-shell `EditorNavigationTarget`。
- 不改变 manual navigation isolation、history lifecycle 或 shortcut behavior。

## Decisions

### Decision: Snapshot on every history-owned departure

增加 `captureCurrentLocation()`，从当前 CodeMirror view 读取 selection head 与 `scrollDOM.scrollTop`。semantic jump 继续以 snapshot 建立 source；Back / Forward 在移动 index 前以 snapshot 覆盖 current entry。

Alternative：只在 semantic jump 时记录。该方案无法保存用户到达 target 后移动 cursor/scroll 再 Back 的真实离开状态，因此不采用。

### Decision: Restore viewport at existing focus-success boundary

history traversal 将 destination 写入 feature-local pending restore ref。`useFileNavigation` 在 `focusEditorAtLocationWithRetry` 成功 callback 内调用 history restore；先由既有逻辑恢复 cursor，再在 animation frame 写入 `scrollDOM.scrollTop`，避免 `scrollIntoView` 覆盖最终 viewport。

Alternative：把 `scrollTop` 加到 app-shell `EditorNavigationTarget`。会让 semantic-history 私有字段传播到通用 file-open controller，不符合隔离边界。

### Decision: Guard pending restore by path and location

restore callback 必须同时匹配 normalized path、line、column；manual/external transition 或新 navigation request 会清空/替换 pending state。这样 stale animation frame 不会作用于错误 file。

## Risks / Trade-offs

- [Risk] CodeMirror layout 在 focus 后继续变化，立即写 scrollTop 被覆盖 → 使用一帧延迟，并在执行前再次核对 current path / pending token。
- [Risk] 用户在等待 frame 时开始手动滚动 → pending restore 仅在 history-owned navigation focus success 后执行一次；执行后立即消费 token。
- [Risk] test mock 没有真实 CodeMirror scroll DOM → 在 test utility 暴露可控 `scrollTop` 与 animation frame settle，直接断言 snapshot/restore contract。
- [Trade-off] 只保存 vertical `scrollTop`；当前需求只涉及滚轮位置，horizontal scroll 与 selection range 留在非目标。

## Migration Plan

1. 扩展 feature-local history entry 与 snapshot helper。
2. traversal 前更新 current entry，并在 focus-success callback 恢复 pending viewport。
3. 增加 non-zero cursor / scroll focused tests，运行增量 gate。
4. 回滚时删除 `scrollTop`、pending restore 与 success callback 接线；无 persisted migration。

## Open Questions

无。产品方已明确要求同时恢复光标与滚轮位置。
