## Context

`TurnFilesChangedCard` 同时渲染在历史回合边界和 timeline 末尾的会话累计位置，目前没有 action prop。`Messages` 已有 `onOpenDiffPath`，但它连接 center diff。真正的 modal lifecycle 位于 `GitDiffPanel` 内部，由 `previewFile` state 驱动，并已覆盖 diff mapping、editable review、dirty close guard 与 portal。

## Goals / Non-Goals

**Goals:**

- 从两类 summary card 发出 dedicated path-based modal preview request。
- 让 `GitDiffPanel` 解析当前 staged/unstaged file 并复用 `handleOpenFilePreview`。
- 支持同一路径连续触发、keyboard activation 与 callback absence。
- 保持 conversation Surface、tool rows、show-more 与 Git mutation state 不变。

**Non-Goals:**

- No duplicate modal, new diff loader, backend command, or persistence.
- No historical snapshot reconstruction when the path no longer exists in the working tree.
- No change to center-panel `onOpenDiffPath` semantics.

## Decisions

### Decision 1: Dedicated request token across AppShell

使用 `{ path, requestId, maximized } | null` 而非裸 path。`requestId` 单调递增，使用户连续点击同一路径仍能触发 `GitDiffPanel` effect；summary 入口设置 `maximized: true`。Alternative 是先 set null 再 set path；会依赖 batching timing，拒绝。

### Decision 2: GitDiffPanel owns path resolution

AppShell 先使用现有 `resolveDiffPathFromWorkspacePath` 将 conversation event 的 absolute/workspace-relative path 对齐为 Git repo-relative path。request 进入 `GitDiffPanel` 后，在其现有 `allFiles`（staged 优先、随后 unstaged）中解析目标并调用同一 modal open helper。Alternative 是让 messages 构造 `DiffFile`；会泄漏 Git view model 并重复 status mapping，拒绝。

modal helper 使用 optional `maximized=false` 参数：右侧 Git 文件行维持普通尺寸，summary external request 显式传 `true`，不复制 modal implementation。

### Decision 3: Summary row interaction is optional

只有 callback 存在时渲染 `<button type="button">`；否则保留现有 display row。这样独立测试/降级 host 不会出现虚假交互。

### Decision 4: Request 只在匹配成功后消费

Git lazy panel 与 file list 可能晚于 click request 就绪，因此 handled request id 只在 path 匹配成功后记录；同一 request 可随 `allFiles` 更新重试。历史 summary path 若最终已被提交、删除或重命名，则保持稳定 no-op，不打开空 modal、不切换 center、不抛错。

## Risks / Trade-offs

- [Risk] Git status 尚未刷新，目标暂时不可解析。→ 保留未消费 request，随现有 `allFiles` 更新自然重试；不引入额外 refresh timer。
- [Risk] staged 与 unstaged 同路径同时存在。→ 沿 `allFiles` 既有顺序选择 staged entry，与 panel 当前组织顺序一致。
- [Risk] 新 callback 跨越 messages/AppShell/Git panel。→ 使用窄类型 request，focused wiring tests 锁定不误用 center callback。
- [Trade-off] 历史已消失文件无法预览。→ 保持 canonical current-worktree modal 的真实性，不伪造旧内容。

## Migration Plan

1. 增加 summary card optional action 与 tests。
2. 透传 Messages/Timeline callback。
3. 在 AppShell layout state 创建 request token 并传入 messages 与 Git panel。
4. GitDiffPanel 消费 request，复用现有 modal helper。
5. 执行 focused tests、typecheck、lint 与 OpenSpec validation。

Rollback: revert request prop/wiring 与 summary button；无数据迁移。

## Open Questions

无。
