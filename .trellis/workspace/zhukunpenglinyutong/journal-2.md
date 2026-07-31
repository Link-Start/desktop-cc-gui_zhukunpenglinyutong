# Journal - zhukunpenglinyutong (Part 2)

> Continuation from `journal-1.md` (archived at ~2000 lines)
> Started: 2026-07-21

---



## Session 46: 提升共享 Markdown renderer 所有权

**Date**: 2026-07-21
**Task**: 提升共享 Markdown renderer 所有权
**Branch**: `bump-version-0.7.6`

### Summary

完成 Phase 6A：将 Markdown shell、runtime、resource/heavy/streaming support 与测试迁入 src/markdown，迁移所有外部 caller，收紧 messages boundary baseline，并通过 127 项 canonical tests、582 项 messages tests、typecheck、lint、build、worker、bundle、runtime、OpenSpec strict 与独立 review。large-files gate 保持既有 51 项 baseline。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `980db5f9` | (see git log) |
| `d1737fd7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 47: 归档共享 Markdown renderer 规范

**Date**: 2026-07-21
**Task**: 归档共享 Markdown renderer 规范
**Branch**: `bump-version-0.7.6`

### Summary

归档 promote-shared-markdown-renderer change，生成并严格验证 shared-markdown-renderer 主规格；修正 archive 生成的 trailing blank line 后 amend 提交。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `94a4b5eb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 48: 稳定 Messages 公共输入边界

**Date**: 2026-07-21
**Task**: 稳定 Messages 公共输入边界
**Branch**: `bump-version-0.7.6`

### Summary

完成 canonical grouped input、legacy façade、minimal public index 与 scope-safe precedence

### Main Changes

完成 roadmap Phase 2：新增 grouped MessagesCoreProps 与 pure legacy adapter；Messages.tsx 收敛为 8 行 façade；新增 minimal public index 并迁移 layout/app-shell callers；matching canonical、scope mismatch、engine derivation、legacy-only 行为均有回归覆盖。验证：61 messages files / 587 tests passed（7 skipped），typecheck、full lint、production build、messages boundary、large-file gate、git diff check 与独立 codex review 均通过。large-file gate 保持仓库既有 51 findings，Messages baseline 仅做 rename identity transfer。


### Git Commits

| Hash | Message |
|------|---------|
| `1af4995e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 49: 归档 Messages 公共输入契约

**Date**: 2026-07-21
**Task**: 归档 Messages 公共输入契约
**Branch**: `bump-version-0.7.6`

### Summary

将 Phase 2 行为契约同步到 OpenSpec 主规格

### Main Changes

归档 OpenSpec change stabilize-messages-public-input，并创建主规格 openspec/specs/messages-public-input/spec.md。主规格锁定 legacy façade、scope-safe canonical precedence 与 minimal public Messages surface；strict validation 通过。


### Git Commits

| Hash | Message |
|------|---------|
| `87bca291` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 50: 隔离 messages row ownership

**Date**: 2026-07-21
**Task**: 隔离 messages row ownership
**Branch**: `bump-version-0.7.6`

### Summary

完成 Phase 5 消息行职责拆分、流式 hot path 修复与验证

### Main Changes

完成 roadmap Phase 5。MessagesRows 仅保留 compatibility exports；MessageRow、ReasoningRow、WorkingIndicator、deferred image lifecycle、equality 与 pure presentation 各自拥有独立职责。修复 review 发现的 live delta 重算静态 presentation 问题，并将 user text parser 从 React component 抽离。验证：messages 64 files / 602 passed / 7 skipped，typecheck、full lint、build、boundary new=0、独立 review 通过；large-file finding 保持仓库既有 51 项。


### Git Commits

| Hash | Message |
|------|---------|
| `2666d664` | (see git log) |
| `8d4581e1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 51: 归档 message row ownership 规范

**Date**: 2026-07-21
**Task**: 归档 message row ownership 规范
**Branch**: `bump-version-0.7.6`

### Summary

将 Phase 5 ownership contract 固化到 OpenSpec 主规范

### Main Changes

归档 isolate-message-row-owners OpenSpec change，生成长期 message-row-ownership behavior spec，并完成 strict validation。


### Git Commits

| Hash | Message |
|------|---------|
| `fc948b1a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 52: 对齐界面回归契约

**Date**: 2026-07-21
**Task**: 对齐界面回归契约
**Branch**: `bump-version-0.7.6`

### Summary

修正隐藏设置断言、异步保存等待、taskRunStorage partial mock、renderer diagnostics dynamic import 清理、品牌 SVG 标题与 Git 滚动 owner 的测试契约；全仓 874 个测试文件通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `badba108` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 53: 区分 Kimi 提交信息引擎

**Date**: 2026-07-21
**Task**: 区分 Kimi 提交信息引擎
**Branch**: `bump-version-0.7.6`

### Summary

修复 checkpoint 提交信息引擎菜单将 Kimi 误标为 Claude 的问题，补齐 10 个 locale 文案与回归断言。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0ff12ea3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 54: 隔离消息时间线控制器

**Date**: 2026-07-21
**Task**: 隔离消息时间线控制器
**Branch**: `bump-version-0.7.6`

### Summary

完成 Phase 4：拆分 row renderer、virtualizer、hydration、outline 与 keyed node ref owners；MessagesTimeline 降至 700 行；全仓 874 个测试文件及静态、边界、构建检查通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2c76b28c` | (see git log) |
| `b7b39746` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 55: 固化消息时间线职责规格

**Date**: 2026-07-21
**Task**: 固化消息时间线职责规格
**Branch**: `bump-version-0.7.6`

### Summary

归档 Phase 4 OpenSpec change，并将时间线 projection、virtualizer、hydration、outline 与 keyed ref owner 契约同步到主规格。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `263c1808` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 56: 隔离 messages 编排控制器职责

**Date**: 2026-07-21
**Task**: 隔离 messages 编排控制器职责
**Branch**: `bump-version-0.7.6`

### Summary

拆分 runtime、presentation、history、scroll 与 interactions 状态 owner；补齐 workspace + thread scope 回归测试；完成 messages 全量、仓库 876 test files、lint、typecheck、build、boundary 与 OpenSpec strict 验证。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `90991c6a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 57: 归档 messages 编排控制器 OpenSpec

**Date**: 2026-07-21
**Task**: 归档 messages 编排控制器 OpenSpec
**Branch**: `bump-version-0.7.6`

### Summary

归档 isolate-messages-orchestration-controller change，并发布 messages-orchestration-ownership 主 spec；严格 spec validation 与 diff check 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `00c762ab` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 58: 统一 messages 对话展示上下文

**Date**: 2026-07-21
**Task**: 统一 messages 对话展示上下文
**Branch**: `bump-version-0.7.6`

### Summary

完成 roadmap Phase 7：建立 producer-aware 的顶层 conversation presentation normalization contract，统一 realtime/history metadata，移除 messages row/presentation 对四个 producer parser 的直接依赖，并完成完整回归与独立 review。

### Main Changes

- 新增 `ConversationPresentationContext` 与 `MessagePresentationMetadata` contract，保留 raw transport 字段。
- 新增 `src/conversation-presentation` normalization boundary，并让 realtime/history assembly 产出一致 metadata。
- messages user/row presentation 与 memory/note suppression 改为 metadata-first；direct producer parser import 清零。
- 修复 reducer 派生 metadata identity 对 fast path 和非 presentation 行为测试的影响。

### Testing

- Focused parity: 8 files, 130 tests passed.
- Messages + threads + presentation: 421 files passed, 2067 tests passed, 7 skipped.
- Passed lint, typecheck, build, runtime contracts, messages boundary, strict OpenSpec validation, diff check.
- Independent `codex review --uncommitted`: no actionable correctness findings.
- Large-file strict gate reproduced the known 51-file repository baseline; no new finding from this phase.


### Git Commits

| Hash | Message |
|------|---------|
| `21bf0975` | (see git log) |
| `6daca4aa` | (see git log) |

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 59: 归档 conversation presentation context OpenSpec

**Date**: 2026-07-21
**Task**: 归档 conversation presentation context OpenSpec
**Branch**: `bump-version-0.7.6`

### Summary

归档 normalize-conversation-presentation-context change，并发布 conversation-presentation-context-normalization 主 spec；严格主 spec 校验与 diff check 通过。

### Main Changes

- Archived change path: `openspec/changes/archive/2026-07-21-normalize-conversation-presentation-context/`.
- Main spec: `openspec/specs/conversation-presentation-context-normalization/spec.md`.
- The archive date is explicitly 2026-07-21.


### Git Commits

| Hash | Message |
|------|---------|
| `87fc179b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 60: 锁定 messages 最终模块边界

**Date**: 2026-07-21
**Task**: 锁定 messages 最终模块边界
**Branch**: `bump-version-0.7.6`

### Summary

完成 roadmap Phase 8.4-8.6：清零 messages inbound private imports，冻结 exact outbound debt graph，接入 CI，并完成全量验证、独立复审与 Trellis task 归档。

### Main Changes

- 将 live canvas、runtime reconnect、presentation profile 迁移到 neutral owners，messages 外部私有入口清零。
- 提取可测试的 AST boundary checker，结构性违规直接失败，并冻结 exact outbound debt graph。
- 将 messages boundary gate 接入 CI，补齐 public index、threads、rows 与 pure timeline fixture tests。

### Testing

- Boundary: inbound 0/0, outbound 50/50, new 0.
- Focused: 70 files passed, 605 tests passed, 7 skipped.
- Full suite: 878 test files completed; lint, typecheck, build, runtime contracts, bundle guard, realtime boundary guard passed.
- Independent follow-up review found no discrete correctness, security, or maintainability issues.
- Known unrelated baselines: large-file gate 51 findings; heavy-test-noise existing warnings/stdout; one unrelated OpenSpec change invalid on parent commit.


### Git Commits

| Hash | Message |
|------|---------|
| `ecf1e80f` | (see git log) |
| `bcd2970c` | (see git log) |

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 61: 归档 messages 最终模块边界契约

**Date**: 2026-07-21
**Task**: 归档 messages 最终模块边界契约
**Branch**: `bump-version-0.7.6`

### Summary

归档 enforce-messages-final-boundaries change，并发布 messages-final-boundary-enforcement 主 spec；严格主 spec validation 与 diff check 通过。

### Main Changes

- Archived change: `openspec/changes/archive/2026-07-21-enforce-messages-final-boundaries/`.
- Published main spec: `openspec/specs/messages-final-boundary-enforcement/spec.md`.
- Final change tasks are complete and the archive date is explicitly 2026-07-21.


### Git Commits

| Hash | Message |
|------|---------|
| `26e2e84b` | (see git log) |

### Testing

- `openspec validate messages-final-boundary-enforcement --strict --no-interactive` passed.
- Archive path and versioned metadata use `2026-07-21`.
- `git diff --check` passed.

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 62: 合并远端 bump-version-0.7.6 并修复 Git history 测试契约

**Date**: 2026-07-22
**Task**: 合并远端 bump-version-0.7.6 并修复 Git history 测试契约
**Branch**: `bump-version-0.7.6`

### Summary

合并远端 46 个提交与本地 62 个提交，保留双方逻辑；补齐 GitHistoryPanel 测试中的 react-i18next initReactI18next mock。验证通过 typecheck、runtime contracts 和 npm test（889 test files）。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0a5a68d1` | (see git log) |
| `8ff3834c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 63: 修复浅色主题原生控件配色并优化危险确认对话框按钮布局

**Date**: 2026-07-28
**Task**: 修复浅色主题原生控件配色并优化危险确认对话框按钮布局
**Branch**: `chore/bump-version-0.7.11`

### Summary

1) settings 浅色主题（含 prefers-color-scheme 回退）为 settings-section-basic/tabbed 及其 select/input 强制 color-scheme: light，修复原生控件在浅色主题下的暗色渲染，并新增 settings-basic-light-controls.test.ts 样式快照测试；2) 优化 diff 危险确认对话框与 git-history 建分支对话框的按钮区：加大 gap/min-width/min-height，增加顶部分隔线，窄屏下按钮换行并弹性占宽。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9f9ce10c6` | (see git log) |
| `781d5cb47` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 64: 修复 CI 编译失败：grok entry 缺 native_title

**Date**: 2026-07-28
**Task**: 修复 CI 编译失败：grok entry 缺 native_title
**Branch**: `chore/bump-version-0.7.11`

### Summary

线上发版 CI 报 E0063：WorkspaceSessionCatalogEntry 新增 native_title 字段后，两处 grok 会话初始化（session_management.rs list_global_codex_sessions 分支、session_management_catalog_projection.rs kimi/grok history 分支）未同步补齐。两处均补 native_title: None，与其他 grok/kimi entry 写法一致，本地 cargo check 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d5b6f42ca` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 65: 重构快捷键设置页为双栏录制布局

**Date**: 2026-07-30
**Task**: 重构快捷键设置页为双栏录制布局
**Branch**: `chore/bump-version-0.7.12`

### Summary

快捷键设置页从输入框列表重构为双栏布局：左侧搜索+分组快捷键行(kbd 键帽)，右侧详情面板(大号点击录制框 focusable div + 重置为默认按钮)；handleShortcutKeyDown 事件类型放宽为 HTMLElement；Escape 取消录制不冒泡；中英 i18n 各补 4 key；ShortcutsSection 测试 +4 交互用例、shortcuts.test.ts +3 splitShortcutForPlatform 用例；清理预览残留并 gitignore .playwright-mcp/。验证：tsc/eslint/settings 233+9 测试全绿。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `eb4ed9027` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 66: 快捷键设置页对齐参考样式并补全部重置

**Date**: 2026-07-30
**Task**: 快捷键设置页对齐参考样式并补全部重置
**Branch**: `chore/bump-version-0.7.12`

### Summary

在上一会话双栏布局基础上对齐参考样式：删除与顶部 header 重复的区内标题；列表列 520px 最大高度+分组区内部滚动(搜索框固定)；右侧详情面板改 stretch 与列表严格等高、16px 圆角+浅描边；新增「全部重置为默认」按钮(仅重置被改过项,执行期禁用)+中英 i18n key；reset-all 测试用例+1。验证：tsc + settings 全域 18 文件 234 测试全绿。注意：上一会话(Session 65)记录的双栏布局工作当时未提交,本次一并包含在 15a30e24f 中。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `15a30e24f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

---

## Session 67: 快捷键面板随视口伸缩并移除侧边栏手动折叠

**Date**: 2026-07-30
**Task**: 快捷键面板随视口伸缩并移除侧边栏手动折叠
**Branch**: `chore/bump-version-0.7.12`

### Summary

延续快捷键设置页改造：双栏面板从固定 `max-height: 520px` 改为随视口高度伸缩(`.settings-shortcuts-section` `height:100%` 承接 scroll-area viewport,布局 `flex: 1 1 auto` + `min-height: 0`,堆叠断点下恢复 520px 上限);内容区 padding 收紧(top 8px / bottom 16px);light 主题选中行与详情卡扁平化为 `#f9f9f9`(含 `data-theme` 与 `prefers-color-scheme` 双通道)。同时移除设置侧边栏手动折叠功能(`sidebarCollapsed` 状态、底部 toggle 按钮、`.is-collapsed` 样式),收窄改为纯响应式 ≤900px 媒体查询;10 个 locale 清理失效的 `sidebarExpand`/`sidebarCollapse` key。

### Main Changes

- `SettingsView.tsx`: 删除 sidebarCollapsed 状态与 toggle 按钮,导航按钮恢复常驻文案;ScrollArea 增加 `settings-content--shortcuts` 修饰类
- `settings.part2.css`: 快捷键面板视口高度链 + light 主题扁平化填充 + 折叠样式删除
- `settings.part2.scroll-area.test.ts`: 新增视口高度钉住的 CSS 契约断言

### Git Commits

| Hash | Message |
|------|---------|
| `5931b5cfc` | feat(settings): 快捷键面板随视口伸缩并移除侧边栏手动折叠 |

### Testing

- [OK] `npx vitest run src/styles/settings.part2.scroll-area.test.ts` 4/4 通过
- [OK] `npx tsc --noEmit` 无错误

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 67: 设置页重构为无顶栏居中窄列布局

**Date**: 2026-07-30
**Task**: 设置页重构为无顶栏居中窄列布局
**Branch**: `chore/bump-version-0.7.12`

### Summary

删顶部标题栏,大标题+描述移入内容区(.settings-page-head,兼作Windows拖拽面);侧边栏加44px拖拽spacer避让红绿灯/全局drag-strip;内容列1080→860px居中,变量上移到settings-content-wrap供页头与滚动区共用;providers页无页头改渲染44px拖拽条防macOS全局drag-strip遮挡搜索框;侧边栏精修(200px宽/32px行高/6px圆角/16px图标/选中500字重);快捷键页键帽去边框、行13px、选中#f2f2f2;删除Dictation/Composer/Commit/Placeholder四处与新页头重复的section-title;同步SettingsView.test与scroll-area契约测试;tsc+72测试+vite build全绿

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `cc6ae1007` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 68: 统一设置页内容列宽为 980px

**Date**: 2026-07-30
**Task**: 统一设置页内容列宽为 980px
**Branch**: `chore/bump-version-0.7.12`

### Summary

设置页列宽原为双事实源：wrap 变量 860px（页头/CLI配置管理/普通 section）与 basic-redesign 980px 覆盖（基础/快捷键/项目管理/智能体/运行环境）。本次将 --settings-content-fixed-width 提为 980px、删除冗余的 1360px 媒体查询与 basic/tabbed 的 980 覆盖（并发会话已提交 8b60dafd8），全部页面与页头共用 min(100%, 980px) 居中列，≤1100px 视口仍回落 100%。另发现 2 个 HEAD 上预存失败测试（sidebar-compact 180 vs 200、file-view-panel-visual-contract）未修。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `75b9ee299` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 69: 重做供应商设置面板并支持 CC Switch 文件导入

**Date**: 2026-07-30
**Task**: 重做供应商设置面板并支持 CC Switch 文件导入
**Branch**: `chore/bump-version-0.7.12`

### Summary

供应商设置页重做: CC Switch 手动选文件导入(按 id 匹配去重)、取消授权伪供应商、官方直连预设、品牌图标、预设模型更新(fable/glm-5.2/kimi-k3/deepseek-v4)、Codex sortOrder 排序, 46 文件 +4419/-1315

### Main Changes

### Main Changes

- CC Switch 导入: 新增 `vendor_list_cc_switch_providers_from_path` 命令, 支持用户手动选择 `.json`(legacy) / SQLite `.db` 文件导入, 解析失败按不可用空态处理; 前端去重从 name+baseUrl 改为按 id 匹配新增/更新, 面板入口改 DropdownMenu 选择导入源
- 取消授权: 新增 `__disabled__` 伪供应商(前后端 `DISABLED_PROVIDER_ID`), 仅用于清空 current 标记, 不出现在列表
- 官方直连: 新增 `OFFICIAL_DIRECT_PRESET_ID` 预设(锁定 Anthropic 官方端点) 与 `VendorOfficialConfigCard` / `ClaudeLocalSettingsCard` 组件
- 品牌图标: 新增 `providerBrandIcon.ts` 映射与 `ProviderBrandIconImg` 组件
- 预设模型更新: 新增 `ANTHROPIC_DEFAULT_FABLE_MODEL` env; glm-5.2 / kimi-k3 / 新增 kimi-coding 预设(262144 上下文) / deepseek-v4-pro / MiniMax 50 分钟超时注释
- Codex 供应商: 支持 `sortOrder` 排序(后端排序键从 created_at 改为 sort_order + created_at 兜底) 与 `source` 字段
- 重构 ProviderList / ProviderDialog / CodexProviderList / CodexProviderDialog / VendorSettingsPanel / CcSwitchImportDialog
- 补齐 10 语言 i18n 与供应商面板/对话框/滚动条样式

### Testing

- [OK] `npx vitest run src/features/vendors src/styles/settings.part1.vendor-panels.test.ts src/styles/settings.part2.scroll-area.test.ts` — 24 文件 114 测试全部通过
- [OK] `npm run typecheck` — 通过
- [OK] `cargo test --lib vendors` — 40 测试全部通过(含新增 list_from_file 3 个用例)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


### Git Commits

| Hash | Message |
|------|---------|
| `d7a657f5a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 70: Grok 图片输入与 Claude 模型目录

**Date**: 2026-07-31
**Task**: Grok 图片输入与 Claude 模型目录
**Branch**: `chore/bump-version-0.7.12`

### Summary

(Add summary)

### Main Changes

| 领域 | 变更 |
|------|------|
| Grok engine | 多模态从 `--prompt-json` 改为 `--prompt-file` 暂存 ACP blocks，避免 ARG_MAX；RAII 清理 staging 文件 |
| Claude 模型 | 内置目录同步 Fable 5 / Opus 4.8 / Sonnet 5 等；支持 `ANTHROPIC_DEFAULT_FABLE_MODEL` 与 fable 映射 |
| Composer UI | ModelSelect 展示映射后品牌图标、CLI 设置入口；i18n 与 ModelMappingSettings 同步 |
| OpenSpec | 更新 grok-cli-image-input-capability-gap 与 capability gap 报告 |

**主要文件**:
- `src-tauri/src/engine/grok.rs`
- `src-tauri/src/engine/status.rs`
- `src/features/models/constants.ts`
- `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx`


### Git Commits

| Hash | Message |
|------|---------|
| `78a09bb6a3b2c73b173b7b856b92280cc1bc2e19` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 71: 完善模型选择器渠道切换与自定义模型弹窗

**Date**: 2026-07-31
**Task**: 完善模型选择器渠道切换与自定义模型弹窗
**Branch**: `chore/bump-version-0.7.12`

### Summary

模型管理改为当前页 overlay；Atomic catalog 注入 plugin 自定义模型；统一本地渠道展示名；修正跨厂商 remap 与 Kimi 品牌图标；补齐多语言与测试。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2f6ffb247` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 72: 修复 mac-arm64 构建 TS2367

**Date**: 2026-07-31
**Task**: 修复 mac-arm64 构建 TS2367
**Branch**: `chore/bump-version-0.7.12`

### Summary

修复 useProviderTargetCatalogOwners 中 ProviderProfileEngine 与 gemini 无重叠比较导致的 tsc 失败，恢复 npm run build:mac-arm64。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3e2c60863` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
