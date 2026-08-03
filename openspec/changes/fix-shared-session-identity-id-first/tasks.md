# Tasks: fix-shared-session-identity-id-first

> 范围 = analysis §7 的 T1+T2+T3（止血闭环，单个 commit 候选）。T4/T5 另开 change。

## 1. T1 — 身份 helper 收敛

- [x] 1.1 新建 `src/features/shared-session/utils/sharedSessionIdentity.ts`：`isSharedSessionThreadId`（支持 null/undefined）+ `resolveIsSharedSession(threadId, summary)`
- [x] 1.2 `sidebarInternals.ts` 的 `isSharedSessionThreadId` 改为 re-export（或删除并改 `Sidebar.tsx:790` import），全仓库单一实现
- [x] 1.3 helper 单测矩阵：`shared:x` / `claude:x` / null / undefined × kind shared / native / undefined

## 2. T2 — 全链路 id-first

- [x] 2.1 `useLayoutNodes.tsx:1305` 与 `app-shell.tsx:1184`：`isSharedSession` 收敛为单一来源（`resolveIsSharedSession(activeThreadId, activeThreadSummary)`），消除表达式复制
- [x] 2.2 `useThreads.getThreadKind`（`useThreads.ts:699-704`）：id 前缀 `shared:` → 恒 `"shared"`
- [x] 2.3 `Composer.tsx` `handleNativeProviderTargetChange`（:939-946）：`isSharedSessionThreadId(activeThreadId)` 硬 return
- [x] 2.4 `Composer.tsx` `onExecutionTargetChange` 分叉（:2720-2726）：`resolveIsSharedSession` 判定；`shared:` id 永不落 native 续接分支；locked 时明确 no-op
- [x] 2.5 `useSidebarMenus.prepareProviderContinuationDialog`（:585-591）：`thread.id.startsWith("shared:")` → return

## 3. T3 — 回归测试

- [x] 3.1 `shared:…` + `threadKind` 缺失：切 Claude managed 不调用 `requestProviderContinuationDialog`；走 `set_shared_session_selected_engine` + hydrate
- [x] 3.2 prepare：source id `shared:…`（kind 任意）静默拒绝
- [x] 3.3 summary 整行缺失 + 续接请求：走「来源会话已不可用」notice，不弹续接 dialog（既有行为锁定）
- [x] 3.4 `getThreadKind(ws, "shared:x")`（summary 缺/kind 缺）恒 `"shared"`
- [x] 3.5 send 路径：identity 丢失时 `resolveThreadKind("shared:x")` 恒 `"shared"`
- [x] 3.6 delete：`shared:` + kind 丢失仍执行 `clearSharedSessionBindingsForSharedThread`
- [x] 3.7 locked Shared + identity 丢失：点选 no-op，不续接
- [x] 3.8 native（`claude:`/`codex:` id）续接行为不变（既有套件回归）

## 4. 质量门禁

- [x] 4.1 `openspec validate --all --strict --no-interactive`
- [x] 4.2 `npm run typecheck`
- [x] 4.3 focused vitest：新增测试 + `Composer` / `useThreads` / `useThreadMessaging` / `useSidebarMenus` 相关套件

## 5. 收尾（本 change 范围内）

- [x] 5.1 review 一轮（不提交），用户人工验收
- [x] 5.2 验收后：analysis 文档状态回写「已修复」；commit 后补锚点；姊妹文 §5 残余表可另补
