# AppShell streaming bag probe

日期：2026-08-16
状态：CI proxy（结构探针，不是 GUI 30s Profiler 实测）

三刀后根 fiber 已切开。本探针锁的是下一层：`layoutNodes` 不得再把 13 个 domain 打成一个 flatten bag。

## 跑法

```bash
npx vitest run src/app-shell/assembly/appShellStreamingBagProbe.test.ts src/app-shell/assembly/appShellRenderIsolation.test.ts
```

断言：

1. `runtimeThreadContext` 变化时，`layoutNodesChrome` / `layoutNodesGit` bag 引用保持不变
2. 只有 `layoutNodesCanvas` 重建
3. 三组 zone 的并集仍等于旧 `layoutNodes` 13 域，不丢 key

## 还不是什么

这不是 React Profiler 的流式 30s 根 commit 计数。正式 GUI 探针仍需：

- 关 react-scan
- 录 30s 流式
- 对比 `AppShell` / `SessionHost` / `RuntimeThreadHost` / `GitSurfaceHost` commit 次数

在那之前，本文件作为回归基线：热域变化不得扇出 chrome/git flatten。
