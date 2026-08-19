## 1. Identity helper

- [x] 1.1 新增 `sharedHideIdentity.ts`：已知 engine 前缀剥离、Codex rollout stem → uuid、Win 盘符/UNC/extended 与 POSIX 绝对路径识别
- [x] 1.2 新增 `sharedHideIdentity.test.ts`：Win / Mac / Linux id 形态分组；uuid ↔ stem 互认；路径不当 engine

## 2. Hide path wiring

- [x] 2.1 `expandHiddenSharedBindingIds` 并入 identity keys；路径形 id 跳过 `engine:` 补全
- [x] 2.2 `lookupSharedOwnerByNativeParent` / `isSharedSidebarHiddenPup` 用 identity 匹配，禁止任意 `:` 剥离
- [x] 2.3 `threadIdInHiddenSharedBindingSet` 改走同一 identity，覆盖 owner stem strip

## 3. Regression tests

- [x] 3.1 `sharedSessionSummaries.test.ts`：rollout parent + `codex:uuid` binding → pup hide；路径 id 不进 hide keys
- [x] 3.2 `useThreadRows.test.ts`：stem parent 的 Shared 崽不进侧栏；native 树仍在
- [x] 3.3 `useThreadActions.helpers.test.ts`：hide set 仅 uuid 时 strip `rollout-*-{uuid}` owner 行

## 4. Verification

- [x] 4.1 focused Vitest 全绿
- [x] 4.2 `openspec validate fix-shared-codex-sidebar-hide-alias --strict`
- [x] 4.3 **不 commit**
