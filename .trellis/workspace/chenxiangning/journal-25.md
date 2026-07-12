# Journal - chenxiangning (Part 25)

> Continuation from `journal-24.md` (archived at ~2000 lines)
> Started: 2026-07-10

---



## Session 970: 添加 Codex 5.6 系列模型

**Date**: 2026-07-10
**Task**: 添加 Codex 5.6 系列模型
**Branch**: `ui-refactoring`

### Summary

将 gpt-5.6-sol、gpt-5.6-terra、gpt-5.6-luna 加入 Codex 内置模型下拉，并同步中英文 i18n 映射与模型列表测试。

### Main Changes

| Area | Change |
|------|--------|
| Codex catalog | Added `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` ahead of `gpt-5.5` in `src/features/models/codexModelCatalog.ts`. |
| Composer model selector | Added label and description i18n key mappings in `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx`. |
| i18n | Added English and Chinese model labels/descriptions in `src/i18n/locales/en.models.ts` and `src/i18n/locales/zh.models.ts`. |
| Tests | Updated `src/features/composer/components/ChatInputBox/types.test.ts` to lock the new built-in model order. |

### Verification

- `git diff --check`
- `node node_modules/vitest/vitest.mjs run --maxWorkers 1 --minWorkers 1 src/features/composer/components/ChatInputBox/types.test.ts`
- `npm run typecheck`
- `npm run lint`


### Git Commits

| Hash | Message |
|------|---------|
| `94de14e6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 971: Git 可编辑双栏差异预览

**Date**: 2026-07-10
**Task**: Git 可编辑双栏差异预览
**Branch**: `feature/v-0.7.0`

### Summary

完成 IDEA-style workspace diff 双栏直接编辑，保留原 Toolbar 与只读 fallback；修复 dirty/save/cache refresh 竞态、未保存关闭保护和 Git 冷启动样式依赖，并通过 focused tests、lint、typecheck、build 与 OpenSpec strict validation。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `942776b3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 972: 优化中央便签工作台交互

**Date**: 2026-07-11
**Task**: 优化中央便签工作台交互
**Branch**: `feature/v-0.7.1`

### Summary

完成便签 Master-Detail 工作台、草稿保护、显式保存状态、归档撤销、Composer 引用与分栏比例持久化；补齐中英文文案、可访问交互和目标测试，同步主规范并归档两次便签 OpenSpec change。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c8eb17ba` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 973: 校准 OpenSpec 提案并归档完成变更

**Date**: 2026-07-11
**Task**: 校准 OpenSpec 提案并归档完成变更
**Branch**: `feature/v-0.7.1`

### Summary

(Add summary)

### Main Changes

## 工作摘要

- 按 `tasks=100% + strict validation` 口径归档 18 个已完成 OpenSpec changes，并同步 delta specs 到主 specs。
- 校准 4 个失效的 delta Requirement 锚点/section，确保 OpenSpec archive 原子同步成功。
- 补充 2 份 design、7 份 verification，并恢复 2 个 sidebar loading change 的 proposal/design/tasks/spec deltas。
- 更新 `openspec/project.md`：active=12、archive=581、main specs=383，明确结构校验不等于实现验证。

## 验证

- `openspec validate --all --strict --no-interactive`: 395 passed, 0 failed。
- OpenSpec consistency check: 执行成功，保留历史 main spec 标题格式警告。
- 提交范围仅为 `openspec/**`，未修改产品代码、配置、脚本或测试。

## 提交

- `1d7e88fc docs(openspec): 校准提案并归档已完成变更`


### Git Commits

| Hash | Message |
|------|---------|
| `1d7e88fc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 974: 移除 Gemini 和 OpenCode 前端入口

**Date**: 2026-07-11
**Task**: 移除 Gemini 和 OpenCode 前端入口
**Branch**: `feature/v-0.7.1`

### Summary

收敛 MCP 与 Git commit 菜单为 Claude/Codex 双引擎

### Main Changes

目标：在不扩散 backend/shared contract 的前提下，移除 MCP / Skills、Git Diff 和 Git History worktree 三个前端入口中的 Gemini/OpenCode 可见内容。

主要改动：
- McpSection 页面只展示 Claude/Codex，并在页面 boundary 过滤 legacy engine status，删除 OpenCode snapshot side effect。
- GitDiffPanel 与 GitHistoryWorktreePanel 的 commit message engine menu 只保留 Codex/Claude。
- OpenSpec change 记录 5.7-5.9 三个独立 frontend slice。

验证：
- McpSection focused tests 4/4。
- GitDiffPanel focused tests 56/56。
- GitHistoryWorktreePanel focused tests 19/19。
- npm run typecheck、npm run lint、OpenSpec strict validation、git diff --check 通过。
- 完整 npm run test 在未修改的 Sidebar.test.tsx 存在 3 个既有失败，单文件重跑可复现；未纳入本次范围。

边界：未修改 CheckpointCommitDialog、legacy last-config compatibility、shared CommitMessageEngine、services 或 Rust backend。


### Git Commits

| Hash | Message |
|------|---------|
| `be0aa7a2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 975: 修复 Tooltip 更新回环与会话空白

**Date**: 2026-07-12
**Task**: 修复 Tooltip 更新回环与会话空白
**Branch**: `feature/v-0.7.1`

### Summary

定位生产 React #185 到 sidebar toggle 的 Radix TooltipTrigger/PopperAnchor 链路，恢复 Base UI render element 通过 Radix asChild composition 的兼容契约，并保留 direct TooltipTrigger children，修复左侧 workspace session 空白回归。新增 caller-owned trigger、64 次稳定 rerender、sidebar/topbar host 搬迁与 direct children 回归测试。验证：Tooltip/ThreadList/PinnedThreadList 聚焦测试 41/41，通过 typecheck、lint、OpenSpec strict validation；全量 npm test 在既有 Sidebar.test.tsx 三处 stale assertion 停止（menuitem vs menuitemradio 两处、runtime notice DOM order 一处），未修改该范围。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a463a259` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
