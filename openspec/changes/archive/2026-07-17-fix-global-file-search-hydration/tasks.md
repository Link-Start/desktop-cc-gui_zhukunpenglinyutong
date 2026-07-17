## 1. Hydration State Contract

- [x] 1.1 [P0][depends:none] 将搜索文件缓存从 `Record<string, string[]>` 改为 typed workspace snapshot；输入：shallow/full response metadata；输出：`shallow/loading/complete/partial/error` 状态；验证：TypeScript compile 与 state hook test。
- [x] 1.2 [P0][depends:1.1] 调整 active workspace shallow seeding，禁止 shallow/empty 数据覆盖 full/partial snapshot；输入：file tree `files[]`；输出：可立即搜索但不伪装 complete 的 cache entry；验证：focused hook test。

## 2. Bounded Full Snapshot Hydration

- [x] 2.1 [P0][depends:1.1,1.2] 统一 current/global scope hydration；输入：palette lifecycle、content filters、workspace targets；输出：active-first、concurrency=2、复用 loading/completed snapshot 的 full hydration；验证：current/global/cache-reuse tests。
- [x] 2.2 [P0][depends:2.1] 保留 response `scan_state`、`limit_hit`、`sourceVersion` 并拒绝 stale writes；输入：`getWorkspaceFiles()` response/error；输出：complete/partial/error snapshot；验证：partial、error retry、palette close/workspace switch tests。

## 3. Search Presentation

- [x] 3.1 [P1][depends:2.2] 将 aggregate hydration state 传入搜索面板并区分 loading/partial/error 与 confirmed zero result；输入：scoped workspace snapshots；输出：non-blocking localized status；验证：SearchPalette component tests。

## 4. Verification

- [x] 4.1 [P0][depends:2.2,3.1] 运行 focused Vitest、typecheck 与 lint；输入：实现与测试；输出：零失败质量证据；验证：相关命令 exit code 0。
- [x] 4.2 [P0][depends:4.1] 执行 strict OpenSpec validation 并校对 tasks/spec/code 一致性；输入：change artifacts；输出：validation pass 与完成任务清单；验证：`openspec validate fix-global-file-search-hydration --strict --no-interactive`。
