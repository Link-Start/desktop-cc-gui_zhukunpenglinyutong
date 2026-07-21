## 1. Behavior Baseline

- [x] 1.1 运行 messages tests、typecheck、large-file report，记录 baseline：77 files / 698 passed / 7 skipped；核心三件套 7,215 lines。
- [x] 1.2 建立 owner matrix，锁定 stable snapshot、live text channel、virtualizer、scroll convergence 与 row memo comparator。

## 2. Move-only Helper Migration

- [x] 2.1 创建 `orchestration/**`、`timeline/**`、`rows/**`，迁移 direct pure helpers 与对应 tests。
- [x] 2.2 更新 canonical imports；focused helper tests、typecheck、`git diff --check` 通过；清理无引用旧路径壳。

## 3. Typed View Models

- [x] 3.1 新增 7 个 responsibility-specific timeline models。
- [x] 3.2 将 `MessagesTimelineProps` 收敛为 `snapshot/live/runtime/navigation/interactions/presentation/slots`。
- [x] 3.3 新增 shallow-stable model hook 与 identity diagnostic；timeline stability / streaming presentation tests 通过。

## 4. Timeline Decomposition

- [x] 4.1 抽取 `ConversationLightweightPrompt` 与 `TimelineProjectionViewport`，保持 DOM、row measurement 与 active-row probe 行为。
- [x] 4.2 将 projection、virtualization、hydration、render-loop guard helpers/tests 迁入 timeline domain。
- [x] 4.3 virtualized jump、projection、virtualization、hydration、render-loop guard regression 通过。

## 5. Rows Decomposition

- [x] 5.1 抽取 GeneratedImage/Review/Diff/Explore presentation rows 到 `rows/components/PresentationRows.tsx`。
- [x] 5.2 保持 MessageRow、ReasoningRow、WorkingIndicator 的 live text subscription、memo comparator、Markdown/toolBlocks API 不变。
- [x] 5.3 rich-content、reasoning、runtime-reconnect、stream-mitigation、media/Diff regression 通过。

## 6. Messages Orchestration Decomposition

- [x] 6.1 抽取 `useMessagesTimelineModels`，保持 stable/live model identity 分轨。
- [x] 6.2 抽取 `useMessagesAnchorNavigation`，保持 history reveal/jump、pending target 与 smooth anchor behavior。
- [x] 6.3 抽取 `MessagesLinkedRunBanner`，保持 linked-run DOM 与 action contract。
- [x] 6.4 `Messages.tsx` 从 2,864 降至 2,789 lines，低于 feature-hotpath fail threshold；live/history/scroll/timer regression 通过。

## 7. Cleanup and Verification

- [x] 7.1 删除 dead compatibility shells，审计 dependency direction、forbidden patterns、public imports 与 large-file report。
- [x] 7.2 `npm run lint`、`npm run typecheck`、messages suite、`git diff --check` 通过；`npm run test` 的唯一失败为 unrelated `SettingsView.test.tsx:1503` 既存文案断言；large-file report 不再包含本次 messages core/new modules。
- [x] 7.3 heavy-test-noise fresh run 已执行并记录 unrelated `SettingsView` failure 与 2 条既存 model-selection stdout；OpenSpec strict validation 与最终 evidence sync 完成。

## Evidence

- Messages suite: 77 files passed; 698 passed, 7 skipped.
- Focused final regression: 107 passed, 5 skipped.
- Lint: exit 0.
- Typecheck: exit 0.
- Large-file report: messages core/new modules 无 fail entry；仓库仍有 51 个 unrelated pre-existing entries。
- Full test: stopped on unrelated `src/features/settings/components/SettingsView.test.tsx:1503` (`Client UI visibility` text not found); isolated rerun reproduces 1 failed / 51 passed.
- Heavy-test-noise: same unrelated Settings failure；0 act warnings，2 stdout payload lines，均来自 `useAppShellComposerModelSection.test.tsx` 的既存 `[model/select]` 输出。
- OpenSpec: `openspec validate refactor-messages-presentation-architecture --strict` exit 0.

## 8. Components Directory Classification

- [x] 8.1 锁定 move-only baseline：messages suite 77 files / 698 passed / 7 skipped。
- [x] 8.2 保留四个核心 public entry 与 `toolBlocks/**` 原位，将小型 UI components 按功能迁入子目录。
- [x] 8.3 将 Markdown runtime helpers、presentation policy、pure utils、constants 与 types 移出 `components`，并更新 canonical imports。
- [x] 8.4 paired tests 与源码 co-locate；messages suite、typecheck、lint、large-file、`git diff --check` 与 OpenSpec strict validation 通过。

### Components Classification Evidence

- `components` 一级目录从 87 files 降至 36 files，一级 implementation source 从 36 降至 4；保留项仅为四个核心入口及其 integration tests / fixture。
- 51 个小型源码与 paired tests 完成 move-only integrity 审计，除 import/mock path 外无逻辑差异；stale path count 为 0。
- Messages suite: 77 files passed；698 passed，7 skipped。
- Lint / typecheck / OpenSpec strict validation / `git diff --check`: exit 0。
- Large-file report: 本次迁移文件无新增 fail entry；仓库仍有 51 个 unrelated pre-existing entries。
- Full test: 前 145 batches 通过，随后在既存 unrelated `src/features/settings/components/SettingsView.test.tsx:1503` 停止（`Client UI visibility` text not found）。

## 9. Explorer Test Nesting

- [x] 9.1 使用 workspace-level VS Code File Nesting 收纳 `Messages.*`、`Markdown.*` 与 `MessagesRows.*` tests。
- [x] 9.2 保持测试物理路径与 test discovery 不变，避免触发 large-file new-file ratchet。
- [x] 9.3 验证 32 个一级 tests / fixture 全部被 pattern 覆盖，且 JSON / diff checks 通过。

### Explorer Nesting Evidence

- `.vscode/settings.json` 启用 `explorer.fileNesting.enabled`，并设置 nested files 默认收起。
- Pattern coverage: `Messages.tsx` 23 files、`Markdown.tsx` 8 files、`MessagesRows.tsx` 1 file；missing / duplicate / wrong-row assignments 均为 0。
- 测试物理路径、imports、mocks 与 Vitest discovery 均未修改；large-file baseline 不受影响。
- `.gitignore` 仅新增 `!.vscode/settings.json` 精确例外，其他 `.vscode/*` 继续忽略。
