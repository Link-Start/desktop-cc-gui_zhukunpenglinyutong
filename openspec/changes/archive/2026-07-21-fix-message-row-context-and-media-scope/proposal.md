## Why

`MessageRow` 为 long-history 与 streaming performance 使用 `React.memo`，但当前
comparator 未覆盖 browser / intent-canvas context attachments。仅 attachment
变化时，旧 row 可能被错误复用。Deferred image hydration 的 request identity
也缺少 workspace scope，旧请求可能在 scope 切换后覆盖新 row。

## What Changes

- 在 `MessageItem` equality 中覆盖 browser / intent-canvas attachments。
- deferred image request identity 纳入 workspace/thread/message/locator。
- 拒绝 stale async completion，并释放 renderer-owned object URLs。
- 保持现有 row DOM、streaming subscription 与 image presentation 不变。

## Impact

- Affected code：`MessagesRows.tsx` 与 rich-content/stream mitigation tests。
- APIs：不修改 public API 或 transport contract。
- Dependencies：不新增 dependency。
- Compatibility：completed row 继续使用 shallow memo；只有 render-affecting
  attachment 变化与 current-scope media completion 才触发更新。

## 验收标准

- browser attachment-only 变化必须渲染新的 context summary。
- intent-canvas attachment-only 变化必须渲染新的 context summary。
- workspace scope 切换后，旧 deferred image request 不得覆盖新状态。
- stale transient object URL 必须释放。
- focused tests、messages suite、typecheck 与 lint 通过。
