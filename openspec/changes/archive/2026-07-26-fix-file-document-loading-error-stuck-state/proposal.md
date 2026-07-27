# fix-file-document-loading-error-stuck-state

## Why

会话活动视图（以及任何通过 `useFileDocumentState` 读取文件的路径）在文件读取失败时，会把错误吞掉并永远显示“正在加载文件...”。该问题在 Windows 上被放大，因为 Windows 更容易触发外部绝对路径 / allowed-root 拒绝等读取失败；macOS 读取成功则不会暴露。需要修复状态机，让读取失败后 loading 立即结束并把真实错误抛给用户。

## 目标与边界

- 修复 `useFileDocumentState`：读文件 `.catch` 时必须同步 `loadedFileReadTargetKey`，让 `isLoading` 返回 false。
- 修复同款隐患：读文件过程中用户已产生脏改（`latestIsDirtyRef.current === true`）的早退分支也必须同步 `loadedFileReadTargetKey`。
- 保证读失败时 `FileViewBody` 能进入 error UI 而非卡在 `files.loadingFile`。
- 覆盖回归测试：读失败停止 loading、读过程中编辑停止 loading 且保留草稿。
- 仅修复前端状态机，不改动 Rust 文件读取白名单；如果 Windows 真实错误是 allowed-root 拒绝，作为后续提案单独评估。

## 非目标

- 不新增 allowed-root（如 `~/.claude/plans`）。
- 不修改错误文案或全局 loading 策略。
- 不改写 markdown / diff / image 等具体 preview 组件。

## What Changes

- `src/features/files/hooks/useFileDocumentState.ts`
  - `.catch` 分支增加 `setLoadedFileReadTargetKey(fileReadTargetKey)`。
  - `latestIsDirtyRef.current === true` 早退分支增加同样调用。
- `src/features/files/hooks/useFileDocumentState.test.tsx`
  - 新增 regression test：读失败时 `isLoading` 变 false、`error` 可见。
  - 新增 regression test：读过程中用户编辑，读返回后 loading 停止、保留本地草稿。

## 方案对比与取舍

1. **在 `FileViewBody` 里检测 `error && isLoading` 优先显示 error**：只改 UI，根因仍在 hook 里；其他 consumer 仍可能卡死。否决。
2. **在 hook 里统一在 `finally` 中同步 `loadedFileReadTargetKey`**：`finally` 会覆盖重读取消的边界，且 catch 已经单独 setError，分开更清晰。否决。
3. **在 catch / dirty 早退分支分别同步 `loadedFileReadTargetKey`**：最小、语义精确、不引入回归。采用。

## Capabilities

### New Capabilities

- `file-document-loading-error-surface`：文件读取失败后，必须停止 loading 并把错误文本暴露到 UI。

### Modified Capabilities

无。

## 验收标准

- `useFileDocumentState` 读 reject 后，`result.current.isLoading === false` 且 `result.current.error` 非空。
- 读文件过程中如果用户已经编辑了内容，读 promise resolve 后 `result.current.isLoading === false`，且保留本地草稿不变。
- `npm run typecheck` 通过。
- `npx vitest run src/features/files/hooks/useFileDocumentState.test.tsx` 全绿。
- 不破坏现有 `useFileDocumentState` 其它行为（保存、撤销、缓存刷新、CRLF 保留）。

## Impact

- 受影响范围：`src/features/files/hooks/useFileDocumentState.ts` 及其测试。
- 用户可见变化：Windows 等读取失败场景从无限“正在加载文件...”变成显示真实错误。
- 无新增依赖、无 IPC signature 变化。

## References

- 修复实现：`src/features/files/hooks/useFileDocumentState.ts`
- 回归测试：`src/features/files/hooks/useFileDocumentState.test.tsx`
