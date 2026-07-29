## Verification Evidence

### Automated

- `pnpm vitest run src/features/app/utils/continuationFamilyRows.test.ts src/features/app/components/ThreadList.test.tsx src/features/app/components/PinnedThreadList.test.tsx`
  - 3 test files passed
  - 45 tests passed
- Focused ESLint for touched TypeScript/TSX/i18n files passed.
- `pnpm tsc --noEmit` passed.
- `git diff --check` passed.
- `openspec validate group-provider-continuation-family-in-sidebar --type change --strict --no-interactive` passed.

### Manual Visual QA

使用真实 `ThreadList` source 构造本地 runtime preview，并分别检查 light/dark theme：

- Family label 显示为 `续接会话 · 3 个`，仅在 segment 首行出现。
- 三个 Family roots 连续展示，围挡首尾圆角闭合，中间无断裂或重叠。
- active row、Provider continuation badge、model badge、时间和独立 click target 保持原语义。
- unrelated session 保持在围挡外。
- 500 × 650 窄视口下标题 ellipsis 正常，label、badge、时间未被围挡裁剪。
- light theme 的 label background 使用 `--desktop-sidebar-background`，dark/light 均与 Sidebar surface 融合。

### Scope Confirmation

- 未引入会话 tree role、expand/collapse 或新的 persistence model。
- 未改变 backend lineage contract。
- pinned/unpinned 与 workspace partition 分别投影，不跨边界组成视觉 Family。

### Legacy Source Regression

用户实机截图暴露：Provider Continuation metadata 只持久化在 target Session，最初来源
Session 可能没有自身 `familyId`。原 projection 错误要求每个 member 自带相同
`familyId`，导致来源行落在围挡外。

修复后：

- 仅使用 continuation 的 `sourceSessionId`、`lineageParentSessionId`、
  `familyRootSessionId` 对当前 partition 的 canonical row id 做 exact match。
- 两段 continuation chain 可以解析并纳入无 `familyId` 的最初来源，label 从
  `续接会话 · 2 个` 正确更新为 `续接会话 · 3 个`。
- 一个来源被不同 Family claim、重复 canonical id、跨 pinned/unpinned partition 或
  未知 lineage 时不吸附，不做 title/time/Provider/prefix 猜测。
- 已知 `root`、`user-fork`、`provider-continuation` lineage 不被误判为 future lineage。
- 修复后 3 个 focused test files、48 tests、ESLint、TypeScript、OpenSpec strict
  validation 全部通过；light/dark 500 × 650 runtime preview 均确认来源行位于围挡内。

### Virtualized Right Border Regression

实机验收发现 virtualized ThreadList 中围挡右边框被裁剪。根因是
`.thread-list-virtual-row > .thread-continuation-family-segment` 使用 `width: 100%`，
同时 segment 保留左右各 `2px` margin，导致 outer width 超出 virtual row 并被 scroll
container 裁掉。

修复为 `width: calc(100% - 4px)` 后，使用 200 rows 强制进入 virtualized path：

- right border、top-right radius、bottom-right radius 均完整显示；
- label、三成员 Family、滚动列表布局保持正常；
- 仅复跑 3 个 focused test files（48 tests）、focused ESLint、`git diff --check` 与
  OpenSpec strict validation；按用户要求未跑 full test suite。
