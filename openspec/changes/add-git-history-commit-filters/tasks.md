## 1. Filter domain contract

- [x] 1.1 [P0][depends:none][I: date preset values and a fixed clock][O: sanitized `GitHistoryDatePreset` and snapshot-stable epoch-second range][V: focused pure-helper Vitest] 实现 filter types、persisted preset sanitizer 与 date range resolver。
- [x] 1.2 [P0][depends:1.1][I: valid/invalid presets, local-midnight and rolling windows][O: deterministic all/today/7d/30d behavior][V: fake-clock boundary assertions] 覆盖 date resolver 与损坏 persistence fallback。

## 2. Independent filter surface

- [x] 2.1 [P0][depends:1.1][I: applied filters, branch options, author suggestions and callbacks][O: accessible `GitHistoryCommitFilters` with child-local text drafts and 300ms publish][V: component Vitest with fake timers] 抽取独立筛选组件并复用 inline picker。
- [x] 2.2 [P1][depends:2.1][I: existing Git History theme tokens and locale catalog][O: compact responsive filter toolbar, clear controls and localized copy][V: DOM accessibility assertions + scoped CSS audit] 增加 scoped styles 与全 locale i18n 文案。

## 3. Panel state and query orchestration

- [x] 3.1 [P0][depends:1.1][I: existing `GitHistoryPanelPersistedState`][O: author/date applied state restores and persists with sanitization][V: panel persistence regression test] 扩展 panel state 与 workspace-scope restore。
- [x] 3.2 [P0][depends:2.1,3.1][I: left branch tree, loaded authors and filter callbacks][O: filter component integrated with shared branch source and current-branch clear behavior][V: GitHistoryPanel interaction test] 接入独立筛选 surface，保持 branch single source of truth。
- [x] 3.3 [P0][depends:1.1,3.1][I: applied branch/query/author/date/repository scope][O: one canonical history request payload reused by initial, append and snapshot retry][V: exact mocked service payload assertions] 接通全部 server-side filters。
- [x] 3.4 [P0][depends:3.3][I: overlapping first-page/append responses after scope changes][O: generation guard rejects stale data/error/loading settlement and resets old snapshot][V: deferred-promise race regression] 加固 history request concurrency。

## 4. Verification

- [x] 4.1 [P0][depends:2.2,3.4][I: filter implementation and existing service contract][O: focused component/helper/service tests pass][V: `npx vitest run ...`] 完成 debounce、clear、persistence、combined payload 与 stale-response覆盖。
- [x] 4.2 [P0][depends:4.1][I: completed code and artifacts][O: lint, typecheck, runtime contract, large-file and strict OpenSpec gates pass][V: repository gate commands] 执行提交前质量门禁并记录无关 baseline failure。

  - Gate evidence: targeted ESLint、`npm run typecheck`、58 个 Git History tests、2 个既有 service contract tests、Git History runtime/static-import contract 与 strict OpenSpec validation 全部通过。
  - Baseline note: `npm run check:large-files:gate` 仍报告 36 个仓库既存 baseline 项；报告中不包含本 change 新增或修改的 Git History 文件。

## 5. Acceptance corrections

- [x] 5.1 [P0][depends:2.2][I: accepted filter surface and picker positioning][O: Branch/User/Date/Clear inside commit title header, search in the next row, dropdown anchored to trigger, Path removed end-to-end][V: component/panel tests + scoped CSS audit] 按人工验收调整筛选布局并删除 Path。
- [x] 5.2 [P1][depends:5.1][I: email author filter and commit identity metadata][O: matching author email visible without changing backend filter semantics][V: focused render assertion] 消除 email filter 与 author display name 的视觉歧义。

## 6. Review closure

- [x] 6.1 [P0][depends:2.1][I: pending text debounce and Clear activation][O: local drafts clear synchronously and stale timer cannot reapply filters][V: fake-timer component regression] 修复 Clear 后旧 draft 延迟回填。
- [x] 6.2 [P0][depends:3.1][I: workspace scope change before debounce settle][O: previous scope timer is cancelled even when restored values are equal][V: rerender scope-switch regression] 隔离 workspace 间的 pending drafts。
- [x] 6.3 [P0][depends:3.3][I: repeated first-page request with unchanged Date preset][O: new request re-anchors date range while append/retry reuse its canonical payload][V: fake-clock panel request assertions] 修复 Date preset 跨 snapshot 时间边界。
- [x] 6.4 [P0][depends:3.3][I: daemon request with branch `"all"` / `"*"`][O: local and remote refs are traversed with Desktop parity][V: focused Rust regression] 补齐 Web Service all-branches 语义。
- [x] 6.5 [P1][depends:5.2][I: partial email filter that does not match display name][O: matching email is visible and bounded in commit metadata][V: focused panel render assertion] 修复 partial email 身份展示。
- [x] 6.6 [P1][depends:5.1][I: narrow commit column and text filter inputs][O: Date dropdown end-aligns without overflow; inputs expose stable form/browser hints][V: component DOM assertions + scoped CSS audit] 补齐筛选 UI hygiene。
- [x] 6.7 [P0][depends:6.1,6.2,6.3,6.4,6.5,6.6][I: review fixes][O: focused frontend/backend tests and repository gates pass][V: Vitest, cargo test, lint, typecheck, runtime contracts, strict OpenSpec validation] 执行 review closure 验证。

  - Review gate evidence: full ESLint、`npm run typecheck`、63 个相关 Vitest、Git History runtime/static-import contracts、`doctor:strict`、Desktop lib 与 `cc_gui_daemon` focused Rust tests、Rust format、`git diff --check` 与 strict OpenSpec validation 全部通过。
  - Baseline note: `npm run check:large-files:gate` 仍报告相同 36 个仓库既存 baseline 项；报告不包含本次新增/修改的 filter、shared Git helper 或 code-spec 文件。
