# Tasks: remove-dock-streaming-dead-branch

## 1. Hook 死代码删除

- [x] 1.1 删除 `useGlobalRuntimeNoticeDock.ts` 的 `GLOBAL_RUNTIME_NOTICE_STREAMING_WINDOW_MS` 常量（:22）
- [x] 1.2 删除 `GlobalRuntimeNoticeDockStatus` 类型中的 `"streaming"` 成员（:28）
- [x] 1.3 删除 `resolveGlobalRuntimeNoticeDockStatus` 死函数（:423-437）
- [x] 1.4 从 `useGlobalRuntimeNoticeDock.test.tsx` 移除死函数 import 与断言（:16、:226）

## 2. 组件死分支删除

- [x] 2.1 删除 `GlobalRuntimeNoticeDock.tsx` `resolveStatusLabel` 的 streaming case（:50-51）
- [x] 2.2 删除 `resolveMinimizedIndicatorState` 的 streaming 分支（:79-81）
- [x] 2.3 调整 `GlobalRuntimeNoticeDock.test.tsx` 末例的 `status="streaming"` 为合法成员并移除 streaming label 断言

## 3. i18n 死键删除

- [x] 3.1 删除 10 个 locale 文件（zh / zh-TW / en / es / fr / hi / ja / ko / pt-BR / ru）的 `statusStreaming` 键
- [x] 3.2 删除 `src/test/vitest.setup.ts:138` 的 `runtimeNotice.statusStreaming` mock 键

## 4. Spec delta 与验证

- [x] 4.1 提供 `global-runtime-notice-dock` spec delta（MODIFIED 两处 requirement，记录 2026-06-05 `c585cc147` 的有意简化）
- [x] 4.2 `npm run typecheck` 通过
- [x] 4.3 `npx eslint` 覆盖全部改动文件通过
- [x] 4.4 相关 vitest（hook + component 两个测试文件）通过
