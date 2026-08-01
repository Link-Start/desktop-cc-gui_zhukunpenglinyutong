# Fix message row context and media scope

## OpenSpec

- Change: `openspec/changes/fix-message-row-context-and-media-scope`
- Roadmap: `docs/superpowers/plans/2026-07-21-messages-high-cohesion-low-coupling-roadmap.md` Phase 1

## 目标

- `MessageRow` memo equality 覆盖 browser / intent-canvas render-affecting attachments。
- deferred image hydration 使用 workspace/thread/message/locator scoped identity。
- stale completion 与 unmount 不提交 state，并释放 owned object URLs。

## 非目标

- 不移动 `MessageRow`。
- 不修改 streaming、virtualization、DOM/CSS 或 tool/Markdown rendering。

## 验收

- 新增 regression tests 先 RED 后 GREEN。
- focused tests、messages suite、typecheck、messages lint 通过。
- OpenSpec strict validation 通过并记录 verification evidence。
