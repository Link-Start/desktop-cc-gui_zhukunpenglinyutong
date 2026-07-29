## Why

Provider Continuation Family 在 Sidebar 中可能一次展开 6 个以上 Session，连续围挡会挤占普通会话的可见空间。围挡需要在保留家族关系提示的同时默认收敛信息密度。

## 目标与边界

- Family 首次渲染时默认折叠，只显示排序最前的代表 Session。
- 复用现有 `续接会话 · {{count}} 个` 标题作为 disclosure control，允许用户即时展开或再次折叠。
- 展开状态只属于当前 `ThreadList` 的 local UI state，不增加持久化、IPC 或 backend contract。
- pinned 与普通 workspace list 使用相同交互。

## 非目标

- 不改变 Family 成员识别、排序、数量计算或 catalog lineage。
- 不改变 Session row 的选择、右键菜单、Provider badge 与运行状态。
- 不保存跨重启折叠偏好，不新增全局 store。

## What Changes

- 将 Family boundary 标题从不可交互 label 改为带 `aria-expanded` 的 disclosure button。
- 默认仅投影 Family 的首个代表 row；展开后恢复全部既有 rows。
- 为 collapsed boundary 补齐底边与圆角，并增加 focused Vitest。

## 技术方案比较

1. **推荐：保留首个代表 Session**。默认折叠但仍可直接进入最新/排序最前会话，且可复用现有 segmented boundary。
2. **只显示空标题栏**。视觉更紧凑，但 active/latest Session 会完全消失，用户必须先展开才能进入。
3. **持久化每个 Family 状态**。可记忆偏好，但需要 storage key、清理策略与跨列表同步，超出当前 UI-only 需求。

采用方案 1，以最小状态面完成目标。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `workspace-sidebar-visual-harmony`: Provider Continuation Family boundary 默认折叠，并提供可访问的展开/折叠交互。

## 验收标准

- 含 2 个及以上成员的 Family 首帧只显示首个代表 Session 与完整成员数。
- 点击标题后全部成员按既有顺序出现，`aria-expanded=true`；再次点击恢复折叠。
- unrelated Session、单成员 Session、row click/context menu 与 active state 不受影响。
- pinned list 与普通 ThreadList 均通过 focused Vitest。

## Impact

- Frontend：`ThreadList.tsx`、`ThreadList.test.tsx`、`PinnedThreadList.test.tsx`、`sidebar.css`。
- Spec：`workspace-sidebar-visual-harmony` delta 与 Trellis continuation contract。
- Backend/API/dependency：无变更。
