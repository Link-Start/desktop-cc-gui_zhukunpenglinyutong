## Automated Verification

- `npx vitest run ...`: 6 files / 122 tests passed。
- `npm run typecheck`: passed。
- `npm run lint`: 0 errors；8 个 repository-existing warnings，本次未新增。
- `npm run check:runtime-contracts`: passed。
- `npm run check:large-files`: command passed；报告的 21 个 repository baseline entries 均不由本 change 新增。
- `openspec validate fix-runtime-jank-feedback-and-catalog-race --strict --no-interactive`: passed。
- `openspec validate --all --strict --no-interactive`: 本 change passed；workspace 现有 `add-tokentracker-usage-dashboard`、`reduce-client-polling-overhead` 两个 change validation failed，与本 change 无关。
- `git diff --check`: passed。

## Manual Runtime Evidence Pending

归档前需在关闭 `react-scan` 的 packaged/dev desktop runtime 执行：

1. Claude/Codex provider-bound threads 交叉切换至少 20 次，确认无 engine/provider mismatch `get_engine_models` error，catalog 不闪空。
2. 清空 diagnostics 后持续运行 3–5 分钟，确认 `diagnostics-persist` 不再周期性成为 frame-drop dominant hotspot，记录 flush p95/current entry count。
3. 在 15–18 visible rows 的长输出 thread 复现 streaming，确认纯正文增长只更新 active `MessageRow`，`timeline-list-render` 不再随 snapshot cadence 重复触发；记录 frame duration 与 commit count。

这些检查需要真实 WebView/runtime timing，不以 jsdom unit test 伪造通过。
