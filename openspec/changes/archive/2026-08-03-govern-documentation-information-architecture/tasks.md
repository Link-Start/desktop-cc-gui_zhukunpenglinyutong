## 1. Governance Foundation

- [x] 1.1 [P0, depends: none] 以审计清单为输入，创建 `docs/GOVERNANCE.md` 与 `guides/reference/archive` section indexes；输出 lifecycle、metadata、事实源、迁移和 ownership 规则；验证每个 current 一级分区有明确职责。
- [x] 1.2 [P0, depends: 1.1] 重写 `docs/README.md` 为 canonical hub；输出按 current/reference/evidence/history/deprecated 分类的入口；验证所有维护中 Markdown 从 hub 可达。

## 2. Living Documentation Calibration

- [x] 2.1 [P0, depends: 1.1] 以 `0.7.16` 当前代码和 main specs 为输入，校准 workflow、skill onboarding、UI、session、conversation 与 troubleshooting guides；输出 last-verified/canonical pointers；验证不存在旧 active-change 声明。
- [x] 2.2 [P0, depends: 1.1] 校准 `docs/architecture/**` 与 `docs/perf/**` 的 current indexes/runbooks；输出正确 policy、CI、streaming 和 generated-evidence 边界；验证 machine-bound baseline paths 未移动。
- [x] 2.3 [P1, depends: 1.1] 校准 `docs/analysis/**`、`docs/research/**`、`docs/reports/**` 的 current claims；输出 current/historical/external/generated 分组；验证 dated evidence 未被改写为当前测量。

## 3. Lifecycle Migration And Retirement

- [x] 3.1 [P0, depends: 1.1] 对全部 implementation plans 分类为 implemented、superseded 或 cancelled；输出 lifecycle banners/index；验证 historical unchecked checkbox 不再进入 active backlog。
- [x] 3.2 [P1, depends: 1.1] 归档或标记 rendering snapshots、Browser Agent matrix、Superpowers artifacts、resolved incidents/reviews 与 performance placeholders；输出 canonical replacement；验证 direct-open reader 能判定其状态。
- [x] 3.3 [P1, depends: 1.1] 退役 legacy marketing site 并删除 `.DS_Store`；输出 archive retirement record；验证 current docs surface 不再包含缺图 HTML 或重复 assets。

## 4. References And Automation

- [x] 4.1 [P0, depends: 2.1,3.1,3.2] 更新 repo 内 local links、OpenSpec archive pointers、source comments 与 branding path rules；输出零断链引用图；验证旧高 fan-out path 保持或提供唯一 tombstone。
- [x] 4.2 [P0, depends: 1.1] 新增零依赖 `scripts/check-docs.mjs`、`npm run check:docs` 与 CI step；输出 link/reachability/index/lifecycle/root/JSON gate；验证 gate 对当前 tree 成功且对明确错误返回非零。
- [x] 4.3 [P1, depends: 2.2] 重扫 large-file advisory watchlist；输出当前 policy 的 generated watchlist；验证 accepted baseline/new-file ratchet 文件内容未被刷新。

## 5. Closure

- [x] 5.1 [P0, depends: 4.1,4.2,4.3] 运行 `npm run check:docs`、`npm run check:branding` 与 focused large-file advisory；输出全部 gate 结果并修复文档治理错误。
- [x] 5.2 [P0, depends: 5.1] 更新 tasks、OpenSpec verification evidence 与 Trellis task 状态；运行 strict OpenSpec validation；输出可审计的文件/影响/残余风险清单。
