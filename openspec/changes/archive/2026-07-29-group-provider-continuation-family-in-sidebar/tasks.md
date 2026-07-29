## 1. Projection Contract

- [x] 1.1 [P0][depends:none] 输入：`ThreadRow[]` 与 Conversation Family metadata；输出：按 root subtree 切块、严格判定 eligible Family、稳定重排并附加 `start/middle/end` segment metadata 的纯 frontend helper；验证：focused unit test 覆盖连续化、相对顺序、未知 lineage fail-open、单成员不分组。
- [x] 1.2 [P0][depends:1.1] 输入：expanded/collapsed Subagent rows；输出：Family member 移动时保留完整 Subagent subtree 且 count 仅统计 depth=0 roots；验证：unit test 断言 child identity、depth、顺序和 ownership 不变。
- [x] 1.3 [P1][depends:1.1] 输入：pinned/unpinned、hide-exited 与当前 ThreadList scope；输出：各 partition 独立投影且不跨 separator/workspace/worktree/folder；验证：focused tests 覆盖 pin split、visible count 与单成员降级。
- [x] 1.4 [P0][depends:1.1] 输入：仅 continuation 一侧持有 `familyId` 与 authoritative source/lineage reference 的 legacy 数据；输出：exact-id 解析来源 root 并纳入 Family，多 Family claim 时 fail open；验证：unit/DOM tests 覆盖无 `familyId` 来源、链式续接、冲突与 partition boundary。

## 2. Sidebar Rendering

- [x] 2.1 [P0][depends:1.1,1.2,1.3] 输入：带 segment metadata 的 displayed rows；输出：virtualized 与 non-virtualized render path 复用同一 Family segment wrapper 和 accessible label；验证：DOM tests 断言相同 member order/count、独立 click target、无 tree role/`aria-expanded`。
- [x] 2.2 [P1][depends:2.1] 输入：现有 thread row 状态与 destructive confirmation；输出：围挡不拦截 active/hover/focus/processing/unread/context-menu/delete-confirm 交互；验证：扩展 `ThreadList.test.tsx` 的 selection、keyboard、menu regression。
- [x] 2.3 [P1][depends:2.1] 输入：`threads` locale；输出：中英文 Family label 与 accessible name；验证：i18n key 在 supported locales 存在且 test renderer 不回退为 key。

## 3. Visual Treatment

- [x] 3.1 [P0][depends:2.1] 输入：用户已批准的 Option A 轻围挡；输出：使用 semantic tokens 的低对比边框、surface、首尾圆角与浮动 label，active row 视觉优先；验证：窄 Sidebar 下无标题、Provider badge、时间或 hit target 裁剪。
- [x] 3.2 [P1][depends:3.1] 输入：virtual row height measurement 与 Subagent expanded subtree；输出：segment 拼接在 virtual/non-virtual layout 下视觉连续且无重叠；验证：virtualization focused test + light/dark manual screenshot check。

## 4. Quality And Contract Closure

- [x] 4.1 [P0][depends:2.2,2.3,3.2] 输入：全部变更；输出：focused Vitest 与 TypeScript gate 通过；验证：运行 `pnpm vitest run src/features/app/components/ThreadList.test.tsx` 和 `pnpm tsc --noEmit`。
- [x] 4.2 [P0][depends:4.1] 输入：OpenSpec artifacts 与实现 evidence；输出：change strict validation 通过并记录人工视觉检查结果；验证：运行 `openspec validate group-provider-continuation-family-in-sidebar --type change --strict --no-interactive`。
- [x] 4.3 [P0][depends:1.4] 输入：来源解析修复；输出：focused Vitest、ESLint、TypeScript、strict OpenSpec validation 与真实数据形态视觉复核通过；验证：重复全部质量门禁并更新 `verification.md`。
