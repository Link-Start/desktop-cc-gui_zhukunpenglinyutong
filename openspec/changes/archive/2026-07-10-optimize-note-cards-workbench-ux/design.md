## Context

上一轮 change 已把 notes 提升为独立 `CenterMode`，外层由 `DesktopLayout` 组合 chat/note `1:2` split，`WorkspaceNoteCardPanel` 继续复用 `noteCardsFacade` 与 file-based storage。当前剩余问题集中在 frontend interaction：panel 内部仍是 vertical list/editor、selection 会覆盖 draft、行操作噪音较高、note 无法从当前 surface 直接进入 Composer selection。

约束：不得改变 Rust command、storage schema、attachment lifecycle；不得向 AppShell 高频根链加入 typing state；不得为一次性视觉优化引入新 dependency；现有 active/archive/query/focusNoteId contract 必须兼容。

## Goals / Non-Goals

**Goals:**

- 宽 note surface 使用 Master-Detail，窄 surface 自动回退 vertical layout。
- draft dirty state 只保留在 note component 内，所有主动 navigation 先通过统一 guard。
- 保存、失败、归档撤销与对话引用具有明确、可访问 feedback。
- split ratio 使用既有 `clientStorage` layout store，pointer/keyboard 共用 clamp contract。
- 继续复用 Composer 的 `NoteCardSelection` 语义，不复制正文到 draft text。

**Non-Goals:**

- 不实现 background autosave、draft recovery store 或跨设备同步。
- 不重构 `noteCardsFacade`、RichTextInput 或 Composer context ledger。
- 不新增 tags/pin/color/sort domain state。
- 不保证 app 被强制终止时恢复未保存 note draft；本轮只保护 surface 内主动切换。

## Decisions

### 1. Panel 使用 CSS responsive Master-Detail

topbar 保持全宽；主体改为 `list rail + detail pane`。宽度足够时 rail 使用稳定的 `280-340px` constraint，detail 填充剩余空间；container/narrow media 条件下回退为 list/editor 上下结构。DOM 顺序继续 list-first，保证 keyboard reading order 与 responsive 兼容。

Alternative：通过 JS `ResizeObserver` 切换 layout。放弃原因是 CSS 已能表达需求，JS measurement 会增加 render/layout coupling。

### 2. 以 persisted snapshot 派生 dirty state

active detail 的 baseline 来自 `selectedNote`；new draft baseline 为空。`title/body/attachment paths` 与 baseline 比较得到 `isDraftDirty`，不额外维护容易漂移的 boolean。select card、new、collection change、selected archive、clear editor 都调用同一个 async discard guard；search results 不再因为 selected item 暂时不在结果中而清空 editor。

Alternative：每次 onChange 设置 dirty boolean。放弃原因是 save/load/reset 分支多，boolean 容易与真实 draft divergence。

### 3. 保留显式保存并补齐状态机

状态采用 `idle | dirty | saving | saved | error` 的 presentation projection：`saving/error` 来自现有 async state，`dirty/saved` 从 draft baseline 与最近成功保存推导。`Cmd/Ctrl+S` 复用 `handleSave`。失败不清空 draft；切换 guard 使用 native Tauri confirm 明确“放弃并继续 / 留在此处”。

Alternative：debounced autosave。放弃原因是会改变 create timing、empty-note policy 与磁盘写入频率，需要新的 backend contract。

### 4. 复用 DropdownMenu 与 toast action

list row 保留 archive/restore quick action；permanent delete 移入现有 Radix `DropdownMenu`，不新增 dependency。archive success 通过既有 `pushErrorToast.actions` 提供 Undo，Undo 复用统一 restore helper；delete 继续使用 Tauri confirmation。

### 5. 对话引用使用显式 request contract

`useLayoutNodes` 同时拥有 main Composer 和 note panel node，因此在该 hook 中维护低频 `noteCardSelectionRequest`。panel 只暴露 `onReferenceNote(note)` callback；main Composer 接收带 monotonic key 的 external request，并以 idempotent add 方式写入既有 `selectedNoteCards`，随后 focus Composer。Home Composer 不接收该 request，避免隐藏实例被同步修改。

Alternative：window event bus 或把 `@#title` 写入文本。放弃原因是 event bus 隐藏 ownership，而纯文本会要求用户再次搜索并可能匹配错误 note。

### 6. split ratio 以 layout preference 持久化

默认 ratio 为 `66.667`，合法范围沿用 pointer clamp。mount 时读取 `getClientStoreSync("layout", key)`；pointer end、keyboard resize、double click reset 调用同一 `applyNoteCardsSplitRatio` 并写入 `writeClientStoreValue`。separator 增加 `tabIndex=0`、`aria-valuemin/max/now`；Arrow keys 按 2% 调整，Home 或 double click 恢复默认。

## Risks / Trade-offs

- [两个 active OpenSpec delta 同属一个 capability] → 本 change 只 ADDED 新 requirement headers，不覆盖上一轮 migration requirement，archive 时可独立 sync。
- [dirty confirm 产生过多打断] → 仅在真实内容与 baseline 不同时触发；search/filter 不触发 discard。
- [external note request 重放] → monotonic key + Composer handled ref 保证每次 action 只消费一次；相同 note idempotent add。
- [split preference 在小窗口不合法] → 读取、pointer、keyboard 都走同一 clamp，CSS min-width 继续兜底。
- [200 条列表渲染压力] → 本轮使用 `content-visibility` 保护 offscreen rows；不引入 virtualization measurement complexity。

## Migration Plan

1. 增加 change-local spec/tests，再实现 note panel draft lifecycle 与 Master-Detail markup。
2. 接入 DropdownMenu、undo toast 与 Composer request contract。
3. 完善 separator persistence/keyboard contract。
4. 执行 focused tests、typecheck、lint、strict OpenSpec verify 与桌面视觉检查。

Rollback：按 `WorkspaceNoteCardPanel`、`useLayoutNodes/Composer`、`DesktopLayout` 三个独立 diff 回退；backend/storage 无 migration。

## Open Questions

无。autosave、tags/pin 等能力延后到具备独立数据与写入 contract 的 change。
