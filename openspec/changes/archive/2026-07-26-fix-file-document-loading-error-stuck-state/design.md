# fix-file-document-loading-error-stuck-state Design

## 背景

`useFileDocumentState` 通过 `fileReadTargetKey` + `loadedFileReadTargetKey` 来判断当前是否仍在加载目标文件。返回值：

```ts
isLoading: isLoading || loadedFileReadTargetKey !== fileReadTargetKey
```

`loadedFileReadTargetKey` 只在成功读取（`.then` 正常路径）和跳过/无效路径中被设置；`.catch` 以及 dirty 早退路径都没有设置它，因此一旦失败或早退，`isLoading` 永远为 true。

`FileViewBody` 的渲染顺序又是 `if (isLoading) return <loading/>; if (error) return <error/>;`，错误 UI 永远不会出现。

## 修改点

### 1. 错误分支同步目标 key

```ts
.catch((readError) => {
  if (cancelled || currentRequest !== requestIdRef.current) return;
  setError(readError instanceof Error ? readError.message : String(readError));
  setLoadedFileReadTargetKey(fileReadTargetKey);
})
```

### 2. dirty 早退分支同步目标 key

```ts
.then((response) => {
  if (cancelled || currentRequest !== requestIdRef.current) return;
  if (latestIsDirtyRef.current) {
    setLoadedFileReadTargetKey(fileReadTargetKey);
    return;
  }
  ...
})
```

## 为什么不在 finally 里统一做

- `finally` 里已经用 `currentRequest === requestIdRef.current` 作为条件；如果后续重读被取消，这个条件可能为 false，导致 `loadedFileReadTargetKey` 被错误地保留为旧值。
- 在各自分支显式设置语义更清晰，避免取消竞态。

## 测试策略

1. 用 `mockRejectedValue` 模拟读失败，断言 `isLoading` 最终为 false 且 error 包含真实消息。
2. 用 pending promise 模拟慢读取，在 resolve 前调用 `setContent` 制造脏改，resolve 后断言 `isLoading` 为 false 且 content 保留草稿。

## 风险与回滚

- 风险：极低。只影响失败/脏改早退两条路径，成功路径不动。
- 回滚：revert `useFileDocumentState.ts` 两个 `setLoadedFileReadTargetKey` 调用及对应测试即可。
