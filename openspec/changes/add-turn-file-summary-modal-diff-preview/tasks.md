## 1. Conversation summary interaction

- [x] 1.1 [P0, depends: none] 输入 `TurnFilesChangedCard` summary 与 optional callback；输出 accessible file buttons、show-more isolation 与 non-interactive fallback；验证 component tests。
- [x] 1.2 [P0, depends: 1.1] 输入 dedicated `onPreviewFileDiff`；输出历史回合与 session 累计卡经 `MessagesTimeline` / `Messages` 透传相同行为；验证 focused wiring tests/typecheck。

## 2. Existing Git modal integration

- [x] 2.1 [P0, depends: none] 输入 `{ path, requestId, maximized }` external request；输出 `GitDiffPanel` 从 current staged/unstaged model 定位文件、复用现有 modal lifecycle 并按 request 初始最大化；验证 GitDiffPanel focused tests。
- [x] 2.2 [P0, depends: 1.2, 2.1] 输入 summary callback；输出 AppShell request state 同时连接 messages 与 Git panel，且不调用 center `onOpenDiffPath`；验证 AppShell boundary tests。

## 3. Quality gates

- [x] 3.1 [P1, depends: 1.2, 2.2] 输入最终实现与 artifacts；输出 focused Vitest、typecheck、lint、`git diff --check`、OpenSpec strict validation 全部通过。
